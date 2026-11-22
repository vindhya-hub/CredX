const { hybridSearch, filterRelevant, hasRelevant } = require('../../src/modules/assistant/retrieval/hybrid');
const { HashingEmbedder } = require('../../src/modules/assistant/embeddings/hashingEmbedder');

const embedder = new HashingEmbedder();
const fakeService = () => {
  const calls = [];
  return {
    calls,
    async embedTexts(texts) {
      calls.push(texts);
      return { vectors: await embedder.embed(texts), embedder };
    },
  };
};

const docs = [
  {
    id: 'a',
    text: 'Card purchase at Swiggy for 450. Category food dining restaurant.',
    embedText: 'Swiggy (food & dining)',
    date: '2026-10-02',
  },
  {
    id: 'b',
    text: 'Card purchase at Uber for 200. Category transport cab ride.',
    embedText: 'Uber (transport)',
    date: '2026-10-05',
  },
  {
    id: 'c',
    text: 'Loan of 50000 at 12% for 12 months. Monthly EMI 4442.',
    embedText: 'Active loan with a monthly EMI',
    date: '2026-09-01',
  },
];

describe('hybridSearch', () => {
  test('ranks keyword and vector matches first and exposes component scores', async () => {
    const service = fakeService();
    const { ranked, embedder: used } = await hybridSearch({ query: 'swiggy food', documents: docs, embeddings: service });
    expect(used.kind).toBe('hashing');
    expect(ranked[0].doc.id).toBe('a');
    expect(ranked[0].keywordScore).toBeGreaterThan(0);
    expect(ranked[0]).toEqual(expect.objectContaining({ score: expect.any(Number), vectorScore: expect.any(Number) }));
    expect(ranked).toHaveLength(3);
  });

  test('embeds the original query and embedText; expansions are keyword-only', async () => {
    const service = fakeService();
    await hybridSearch({ query: 'emi', documents: docs, embeddings: service, expansions: ['loan', 'instalment'] });
    expect(service.calls[0]).toEqual(['emi', 'Swiggy (food & dining)', 'Uber (transport)', 'Active loan with a monthly EMI']);
  });

  test('keyword weight 1 ranks purely by BM25', async () => {
    const { ranked } = await hybridSearch({ query: 'loan emi', documents: docs, embeddings: fakeService(), keywordWeight: 1 });
    expect(ranked[0].doc.id).toBe('c');
    expect(ranked[0].score).toBe(1);
  });

  test('keyword weight 0 ranks purely by cosine similarity', async () => {
    const { ranked } = await hybridSearch({ query: 'Uber', documents: docs, embeddings: fakeService(), keywordWeight: 0 });
    expect(ranked[0].doc.id).toBe('b');
    expect(ranked[0].vectorScore).toBeGreaterThan(ranked[1].vectorScore);
  });

  test('reciprocal rank fusion is supported', async () => {
    const { ranked } = await hybridSearch({ query: 'uber ride', documents: docs, embeddings: fakeService(), fusion: 'rrf' });
    expect(ranked[0].doc.id).toBe('b');
  });

  test('empty candidate sets short-circuit without embedding', async () => {
    const service = fakeService();
    expect(await hybridSearch({ query: 'x', documents: [], embeddings: service })).toEqual({ ranked: [], embedder: null });
    expect(service.calls).toHaveLength(0);
  });
});

describe('filterRelevant', () => {
  const mk = (keywordScore, vectorScore) => ({ keywordScore, vectorScore, score: 0, doc: {} });
  const model = { minSimilarity: 0.3 };

  test('keeps keyword matches regardless of similarity', () => {
    expect(filterRelevant([mk(1.2, 0.01)], model)).toHaveLength(1);
  });

  test('applies the absolute threshold and the relative cutoff', () => {
    const ranked = [mk(0, 0.67), mk(0, 0.31), mk(0, 0.6), mk(0, 0.2)];
    const kept = filterRelevant(ranked, model, { relativeCutoff: 0.85 });
    expect(kept.map((r) => r.vectorScore)).toEqual([0.67, 0.6]); // 0.31 < 0.85 * 0.67
  });

  test('nothing is relevant when every similarity is below the threshold', () => {
    expect(hasRelevant([mk(0, 0.25), mk(0, 0.1)], model)).toBe(false);
    expect(filterRelevant([], model)).toEqual([]);
  });
});
