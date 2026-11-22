const { cosineSimilarity, l2Normalize, dot, magnitude } = require('../../src/modules/assistant/retrieval/vector');

describe('cosine similarity', () => {
  test('identical direction is 1, orthogonal is 0, opposite is -1', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1);
  });

  test('is scale invariant', () => {
    expect(cosineSimilarity([1, 2, 3], [10, 20, 30])).toBeCloseTo(1);
    expect(cosineSimilarity([3, 4], [4, 3])).toBeCloseTo(24 / 25);
  });

  test('zero vectors give 0 instead of NaN', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });

  test('works on typed arrays and rejects mismatched dimensions', () => {
    expect(cosineSimilarity(Float32Array.from([1, 1]), Float32Array.from([1, 1]))).toBeCloseTo(1);
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(RangeError);
  });

  test('l2Normalize returns a unit vector and leaves zero vectors alone', () => {
    const v = l2Normalize([3, 4]);
    expect(magnitude(v)).toBeCloseTo(1);
    expect(Array.from(v)).toEqual([expect.closeTo(0.6), expect.closeTo(0.8)]);
    expect(Array.from(l2Normalize([0, 0]))).toEqual([0, 0]);
    expect(dot([1, 2], [3, 4])).toBe(11);
  });
});
