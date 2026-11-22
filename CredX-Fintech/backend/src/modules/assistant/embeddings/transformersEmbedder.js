/**
 * Local sentence-embedding model via @huggingface/transformers (ONNX runtime,
 * CPU). Default: Xenova/all-MiniLM-L6-v2, 8-bit quantised (~23 MB, 384 dims),
 * mean-pooled and L2-normalised. No API key or paid service is involved.
 *
 * The library and model are loaded lazily on first use. The package is an
 * optional dependency; if it is missing, or the model cannot be downloaded,
 * load() rejects and the embedding service falls back to the hashing embedder.
 */
const BATCH_SIZE = 32;

const defaultLoader = async () => require('@huggingface/transformers');

class TransformersEmbedder {
  constructor({ model, dtype = 'q8', cacheDir, minSimilarity = 0.3, loader = defaultLoader } = {}) {
    this.model = model;
    this.dtype = dtype;
    this.cacheDir = cacheDir;
    this.loader = loader;
    this.kind = 'transformers';
    this.id = model;
    this.dim = null;
    this.minSimilarity = minSimilarity;
    this.extractor = null;
    this.loading = null;
  }

  get ready() {
    return Boolean(this.extractor);
  }

  load() {
    if (this.extractor) return Promise.resolve(this);
    if (!this.loading) {
      this.loading = (async () => {
        const lib = await this.loader();
        if (this.cacheDir && lib.env) lib.env.cacheDir = this.cacheDir;
        this.extractor = await lib.pipeline('feature-extraction', this.model, { dtype: this.dtype });
        return this;
      })().catch((error) => {
        this.loading = null; // allow a later retry
        throw error;
      });
    }
    return this.loading;
  }

  async embed(texts) {
    await this.load();
    const vectors = [];
    for (let start = 0; start < texts.length; start += BATCH_SIZE) {
      const batch = texts.slice(start, start + BATCH_SIZE);
      const output = await this.extractor(batch, { pooling: 'mean', normalize: true });
      const [rows, dim] = output.dims;
      this.dim = dim;
      for (let r = 0; r < rows; r += 1) {
        vectors.push(Float32Array.from(output.data.subarray(r * dim, (r + 1) * dim)));
      }
      if (typeof output.dispose === 'function') output.dispose();
    }
    return vectors;
  }
}

module.exports = { TransformersEmbedder };
