/**
 * Pluggable embedding provider with automatic fallback.
 *
 *   EMBEDDINGS_PROVIDER=transformers (default) -> local MiniLM model, loaded in
 *     the background; until it is ready, or if it fails to load (offline, CI,
 *     unsupported platform), requests use the hashing embedder. Failed loads
 *     are retried after EMBEDDINGS_RETRY_MS.
 *   EMBEDDINGS_PROVIDER=hashing -> deterministic hashing embedder only (tests).
 *
 * The query and all documents of one request are always embedded by the
 * same embedder, so their vectors are comparable. Vectors are cached in an
 * LRU keyed by (embedder id, text hash), so unchanged records are embedded once.
 */
const crypto = require('crypto');
const config = require('../../../config/config');
const logger = require('../../../utils/logger');
const { HashingEmbedder } = require('./hashingEmbedder');
const { TransformersEmbedder } = require('./transformersEmbedder');

class LRUCache {
  constructor(maxEntries) {
    this.maxEntries = Math.max(0, maxEntries);
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.maxEntries === 0) return;
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.maxEntries) this.map.delete(this.map.keys().next().value);
  }

  get size() {
    return this.map.size;
  }
}

const hashText = (text) => crypto.createHash('sha1').update(text).digest('hex');

class EmbeddingService {
  constructor(options = {}) {
    const settings = { ...config.assistant, ...options };
    this.provider = settings.embeddingsProvider;
    this.retryMs = settings.embeddingRetryMs;
    this.waitMs = settings.embeddingWaitMs ?? 2000;
    this.fallback = options.fallback || new HashingEmbedder({ minSimilarity: settings.minSimilarityHashing });
    this.primary =
      this.provider === 'transformers'
        ? options.primary ||
          new TransformersEmbedder({
            model: settings.embeddingModel,
            dtype: settings.embeddingDtype,
            cacheDir: settings.embeddingCacheDir,
            minSimilarity: settings.minSimilarityModel,
            loader: options.loader,
          })
        : null;
    this.state = this.primary ? 'idle' : 'disabled'; // idle | loading | ready | failed | disabled
    this.failedAt = 0;
    this.lastError = null;
    this.loadPromise = null;
    this.cache = new LRUCache(settings.embeddingCacheSize ?? 5000);
  }

  /** Starts loading the model in the background (non-blocking). */
  warmup() {
    return this.startLoad();
  }

  startLoad() {
    if (!this.primary || this.state === 'ready') return Promise.resolve();
    if (this.state === 'loading') return this.loadPromise;
    if (this.state === 'failed' && Date.now() - this.failedAt < this.retryMs) return Promise.resolve();

    this.state = 'loading';
    this.loadPromise = this.primary
      .load()
      .then(() => {
        this.state = 'ready';
        this.lastError = null;
        logger.info('Embedding model ready', { model: this.primary.id });
      })
      .catch((error) => {
        this.markFailed(error);
      });
    return this.loadPromise;
  }

  markFailed(error) {
    this.state = 'failed';
    this.failedAt = Date.now();
    this.lastError = error.message;
    logger.warn('Embedding model unavailable, using hashing fallback', { model: this.primary.id, message: error.message });
  }

  /** Embedder for this request; waits briefly if the model is mid-load. */
  async resolveEmbedder() {
    if (!this.primary) return this.fallback;
    if (this.state !== 'ready') {
      const loading = this.startLoad();
      if (this.state === 'loading' && this.waitMs > 0) {
        await Promise.race([loading, new Promise((resolve) => setTimeout(resolve, this.waitMs).unref?.())]);
      }
    }
    return this.state === 'ready' ? this.primary : this.fallback;
  }

  async embedWithCache(embedder, texts) {
    const keys = texts.map((text) => `${embedder.id}|${hashText(text)}`);
    const vectors = keys.map((key) => this.cache.get(key));
    const missing = [];
    vectors.forEach((vector, index) => {
      if (!vector) missing.push(index);
    });
    if (missing.length) {
      const computed = await embedder.embed(missing.map((index) => texts[index]));
      missing.forEach((textIndex, i) => {
        vectors[textIndex] = computed[i];
        this.cache.set(keys[textIndex], computed[i]);
      });
    }
    return vectors;
  }

  /**
   * Embeds all texts with one embedder. If the model fails mid-request, the
   * whole batch is redone with the fallback so vectors stay comparable.
   * @returns {Promise<{ vectors: Float32Array[], embedder: object }>}
   */
  async embedTexts(texts) {
    const embedder = await this.resolveEmbedder();
    try {
      return { vectors: await this.embedWithCache(embedder, texts), embedder };
    } catch (error) {
      if (embedder === this.fallback) throw error;
      this.markFailed(error);
      return { vectors: await this.embedWithCache(this.fallback, texts), embedder: this.fallback };
    }
  }

  status() {
    return {
      provider: this.provider,
      model: this.primary ? this.primary.id : null,
      state: this.state,
      active: this.state === 'ready' ? this.primary.id : this.fallback.id,
      lastError: this.lastError,
      cachedVectors: this.cache.size,
    };
  }
}

let shared = null;

/** Process-wide service used by the API. */
function getEmbeddingService() {
  if (!shared) shared = new EmbeddingService();
  return shared;
}

module.exports = { EmbeddingService, LRUCache, getEmbeddingService };
