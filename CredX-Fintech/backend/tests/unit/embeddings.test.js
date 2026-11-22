const { HashingEmbedder } = require('../../src/modules/assistant/embeddings/hashingEmbedder');
const { EmbeddingService, LRUCache } = require('../../src/modules/assistant/embeddings');
const { cosineSimilarity, magnitude } = require('../../src/modules/assistant/retrieval/vector');

describe('HashingEmbedder (deterministic fallback)', () => {
  const embedder = new HashingEmbedder();

  test('produces deterministic unit vectors of the configured size', async () => {
    const [a] = await embedder.embed(['Swiggy food order']);
    const [b] = await embedder.embed(['Swiggy food order']);
    expect(a).toHaveLength(512);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(magnitude(a)).toBeCloseTo(1);
  });

  test('similar texts are closer than unrelated ones', async () => {
    const [q, near, far] = await embedder.embed(['grocery shopping', 'groceries at BigBasket', 'loan EMI payment']);
    expect(cosineSimilarity(q, near)).toBeGreaterThan(cosineSimilarity(q, far));
  });

  test('empty text gives a zero vector', async () => {
    const [v] = await embedder.embed(['']);
    expect(magnitude(v)).toBe(0);
  });
});

describe('EmbeddingService', () => {
  const fakeModel = ({ fail = false, failOnEmbed = false } = {}) => ({
    id: 'fake-model',
    kind: 'transformers',
    minSimilarity: 0.3,
    loads: 0,
    embedCalls: 0,
    async load() {
      this.loads += 1;
      if (fail) throw new Error('offline');
    },
    async embed(texts) {
      this.embedCalls += 1;
      if (failOnEmbed) throw new Error('runtime failure');
      return texts.map(() => Float32Array.from([1, 0, 0]));
    },
  });

  test('falls back to hashing when the model cannot load (offline / CI)', async () => {
    const primary = fakeModel({ fail: true });
    const service = new EmbeddingService({ embeddingsProvider: 'transformers', primary, embeddingWaitMs: 50 });
    const { vectors, embedder } = await service.embedTexts(['a', 'b']);
    expect(embedder.kind).toBe('hashing');
    expect(vectors).toHaveLength(2);
    expect(service.status()).toEqual(expect.objectContaining({ state: 'failed', active: embedder.id, lastError: 'offline' }));
  });

  test('uses the model once it is ready', async () => {
    const primary = fakeModel();
    const service = new EmbeddingService({ embeddingsProvider: 'transformers', primary, embeddingWaitMs: 1000 });
    const { embedder } = await service.embedTexts(['a']);
    expect(embedder).toBe(primary);
    expect(service.status().state).toBe('ready');
  });

  test('a failure while embedding redoes the whole batch with the fallback', async () => {
    const primary = fakeModel({ failOnEmbed: true });
    const service = new EmbeddingService({ embeddingsProvider: 'transformers', primary, embeddingWaitMs: 1000 });
    const { vectors, embedder } = await service.embedTexts(['query', 'doc one', 'doc two']);
    expect(embedder.kind).toBe('hashing');
    expect(new Set(vectors.map((v) => v.length))).toEqual(new Set([512])); // all comparable
  });

  test('a failed load is retried only after the retry interval', async () => {
    const primary = fakeModel({ fail: true });
    const service = new EmbeddingService({ embeddingsProvider: 'transformers', primary, embeddingWaitMs: 50, embeddingRetryMs: 60000 });
    await service.embedTexts(['a']);
    await service.embedTexts(['b']);
    expect(primary.loads).toBe(1);
  });

  test('hashing provider never touches a model', async () => {
    const service = new EmbeddingService({ embeddingsProvider: 'hashing' });
    expect(service.primary).toBeNull();
    const { embedder } = await service.embedTexts(['x']);
    expect(embedder.kind).toBe('hashing');
    expect(service.status().state).toBe('disabled');
  });

  test('vectors are cached per embedder and text', async () => {
    const primary = fakeModel();
    const service = new EmbeddingService({ embeddingsProvider: 'transformers', primary, embeddingWaitMs: 1000 });
    await service.embedTexts(['same text', 'other']);
    await service.embedTexts(['same text', 'other']);
    expect(primary.embedCalls).toBe(1);
    expect(service.status().cachedVectors).toBe(2);
  });

  test('the transformers embedder rejects cleanly when the package/model is unavailable', async () => {
    const { TransformersEmbedder } = require('../../src/modules/assistant/embeddings/transformersEmbedder');
    const embedder = new TransformersEmbedder({ model: 'x/y', loader: async () => { throw new Error('Cannot find module'); } });
    await expect(embedder.load()).rejects.toThrow('Cannot find module');
    expect(embedder.ready).toBe(false);
  });
});

describe('LRUCache', () => {
  test('evicts the least recently used entry', () => {
    const cache = new LRUCache(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.size).toBe(2);
  });
});
