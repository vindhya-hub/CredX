const BM25 = require('../../src/modules/assistant/retrieval/bm25');
const { tokenize } = require('../../src/modules/assistant/retrieval/tokenizer');

const docs = [
  'card purchase at swiggy food dining',
  'card purchase at uber transport ride',
  'loan emi payment from wallet',
  'swiggy swiggy swiggy food order',
].map((d) => tokenize(d));

describe('BM25', () => {
  const bm25 = new BM25(docs);

  test('computes corpus statistics', () => {
    expect(bm25.N).toBe(4);
    expect(bm25.avgdl).toBeCloseTo(docs.reduce((s, d) => s + d.length, 0) / 4);
    expect(bm25.documentFrequency.get('swiggy')).toBe(2);
  });

  test('IDF is positive and rarer terms weigh more', () => {
    expect(bm25.idf('loan')).toBeGreaterThan(0);
    expect(bm25.idf('card')).toBeGreaterThan(0);
    expect(bm25.idf('loan')).toBeGreaterThan(bm25.idf('card')); // 1 doc vs 2 docs
    expect(bm25.idf('unknownterm')).toBeGreaterThan(bm25.idf('loan'));
  });

  test('documents containing the query terms score higher', () => {
    const scores = bm25.scoreAll(tokenize('swiggy food'));
    expect(scores[0]).toBeGreaterThan(0);
    expect(scores[1]).toBe(0);
    expect(scores[2]).toBe(0);
    expect(scores[0]).toBeGreaterThan(scores[1]);
  });

  test('term frequency saturates (k1) instead of growing linearly', () => {
    const single = new BM25([['swiggy', 'x', 'y', 'z'], ['other', 'a', 'b', 'c']]);
    const triple = new BM25([['swiggy', 'swiggy', 'swiggy', 'z'], ['other', 'a', 'b', 'c']]);
    const one = single.score(['swiggy'], 0);
    const three = triple.score(['swiggy'], 0);
    expect(three).toBeGreaterThan(one);
    expect(three).toBeLessThan(3 * one);
  });

  test('length normalisation favours shorter documents (b > 0)', () => {
    const corpus = new BM25([['emi', 'loan'], ['emi', 'a', 'b', 'c', 'd', 'e', 'f', 'g'], ['other']]);
    expect(corpus.score(['emi'], 0)).toBeGreaterThan(corpus.score(['emi'], 1));
    const noNorm = new BM25([['emi', 'loan'], ['emi', 'a', 'b', 'c', 'd', 'e', 'f', 'g'], ['other']], { b: 0 });
    expect(noNorm.score(['emi'], 0)).toBeCloseTo(noNorm.score(['emi'], 1));
  });

  test('duplicate query terms are counted once and empty queries score zero', () => {
    expect(bm25.score(['swiggy', 'swiggy'], 0)).toBeCloseTo(bm25.score(['swiggy'], 0));
    expect(bm25.scoreAll([])).toEqual([0, 0, 0, 0]);
  });

  test('handles an empty corpus', () => {
    const empty = new BM25([]);
    expect(empty.scoreAll(['x'])).toEqual([]);
    expect(empty.score(['x'], 0)).toBe(0);
  });
});
