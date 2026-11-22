const { minMaxNormalize, weightedFusion, reciprocalRankFusion, fuseScores, ranksOf } = require('../../src/modules/assistant/retrieval/fusion');

describe('score fusion', () => {
  test('min-max normalisation maps to [0, 1]', () => {
    expect(minMaxNormalize([2, 4, 6])).toEqual([0, 0.5, 1]);
    expect(minMaxNormalize([])).toEqual([]);
    expect(minMaxNormalize([3, 3])).toEqual([1, 1]); // equally relevant
    expect(minMaxNormalize([0, 0])).toEqual([0, 0]); // equally irrelevant
  });

  test('weighted fusion respects the keyword weight', () => {
    const keyword = [10, 0, 5];
    const vector = [0.1, 0.9, 0.5];
    const keywordOnly = weightedFusion(keyword, vector, { keywordWeight: 1 });
    const vectorOnly = weightedFusion(keyword, vector, { keywordWeight: 0 });
    expect(keywordOnly).toEqual([1, 0, 0.5]);
    expect(vectorOnly[1]).toBeCloseTo(1);
    expect(vectorOnly[0]).toBeCloseTo(0);

    const mixed = weightedFusion(keyword, vector, { keywordWeight: 0.4 });
    // doc0: 0.4*1 + 0.6*0 ; doc1: 0.4*0 + 0.6*1 ; doc2: 0.4*0.5 + 0.6*0.5
    expect(mixed[0]).toBeCloseTo(0.4);
    expect(mixed[1]).toBeCloseTo(0.6);
    expect(mixed[2]).toBeCloseTo(0.5);
  });

  test('weights outside [0, 1] are clamped', () => {
    expect(weightedFusion([1, 0], [0, 1], { keywordWeight: 5 })).toEqual([1, 0]);
    expect(weightedFusion([1, 0], [0, 1], { keywordWeight: -1 })).toEqual([0, 1]);
  });

  test('ranks are 1-based, highest first, ties keep input order', () => {
    expect(ranksOf([0.2, 0.9, 0.5])).toEqual([3, 1, 2]);
    expect(ranksOf([1, 1, 0])).toEqual([1, 2, 3]);
  });

  test('reciprocal rank fusion ignores keyword ranks of non-matching docs', () => {
    const fused = reciprocalRankFusion([3, 0, 1], [0.1, 0.9, 0.5], { keywordWeight: 0.5, k: 60 });
    expect(fused[0]).toBeCloseTo(0.5 / 61 + 0.5 / 63);
    expect(fused[1]).toBeCloseTo(0 + 0.5 / 61); // no keyword match: vector part only
    expect(fused[2]).toBeCloseTo(0.5 / 62 + 0.5 / 62);
  });

  test('fuseScores dispatches by method and validates input', () => {
    expect(fuseScores([1, 0], [0, 1], { method: 'weighted', keywordWeight: 1 })).toEqual([1, 0]);
    expect(fuseScores([1, 0], [0, 1], { method: 'rrf', keywordWeight: 0.5, rrfK: 10 })[0]).toBeCloseTo(0.5 / 11 + 0.5 / 12);
    expect(() => fuseScores([1], [1], { method: 'nope' })).toThrow('Unknown fusion method');
    expect(() => fuseScores([1, 2], [1])).toThrow(RangeError);
  });
});
