/**
 * Score fusion for hybrid retrieval.
 *
 * weighted (default): min-max normalise each signal to [0, 1] over the
 *   candidate set, then  fused = w * keyword + (1 - w) * vector.
 * rrf: reciprocal rank fusion,  fused = w / (k + rank_kw) + (1 - w) / (k + rank_vec),
 *   where documents with no keyword match get no keyword contribution.
 */

const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

function minMaxNormalize(scores) {
  if (!scores.length) return [];
  let min = Infinity;
  let max = -Infinity;
  for (const s of scores) {
    if (s < min) min = s;
    if (s > max) max = s;
  }
  const range = max - min;
  if (range < 1e-12) {
    // All equal: they are equally relevant if positive, irrelevant if zero/negative.
    return scores.map(() => (max > 0 ? 1 : 0));
  }
  return scores.map((s) => (s - min) / range);
}

function weightedFusion(keywordScores, vectorScores, { keywordWeight = 0.4 } = {}) {
  assertSameLength(keywordScores, vectorScores);
  const wk = clamp01(keywordWeight);
  const wv = 1 - wk;
  const kw = minMaxNormalize(keywordScores);
  const vec = minMaxNormalize(vectorScores);
  return kw.map((k, i) => wk * k + wv * vec[i]);
}

/** 1-based ranks, highest score first; ties keep input order. */
function ranksOf(scores) {
  const order = scores.map((score, index) => ({ score, index })).sort((a, b) => b.score - a.score || a.index - b.index);
  const ranks = new Array(scores.length);
  order.forEach(({ index }, position) => {
    ranks[index] = position + 1;
  });
  return ranks;
}

function reciprocalRankFusion(keywordScores, vectorScores, { keywordWeight = 0.5, k = 60 } = {}) {
  assertSameLength(keywordScores, vectorScores);
  const wk = clamp01(keywordWeight);
  const wv = 1 - wk;
  const kwRanks = ranksOf(keywordScores);
  const vecRanks = ranksOf(vectorScores);
  return keywordScores.map((score, i) => (score > 0 ? wk / (k + kwRanks[i]) : 0) + wv / (k + vecRanks[i]));
}

function fuseScores(keywordScores, vectorScores, { method = 'weighted', keywordWeight = 0.4, rrfK = 60 } = {}) {
  if (method === 'rrf') return reciprocalRankFusion(keywordScores, vectorScores, { keywordWeight, k: rrfK });
  if (method === 'weighted') return weightedFusion(keywordScores, vectorScores, { keywordWeight });
  throw new Error(`Unknown fusion method: ${method}`);
}

function assertSameLength(a, b) {
  if (a.length !== b.length) throw new RangeError('Score arrays must have the same length');
}

module.exports = { minMaxNormalize, weightedFusion, reciprocalRankFusion, fuseScores, ranksOf };
