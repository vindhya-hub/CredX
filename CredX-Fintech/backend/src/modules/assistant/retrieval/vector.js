/** Vector helpers for embedding similarity. */

function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

function magnitude(a) {
  return Math.sqrt(dot(a, a));
}

/**
 * Cosine similarity in [-1, 1]; 0 when either vector is all zeros.
 * @param {ArrayLike<number>} a
 * @param {ArrayLike<number>} b
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new RangeError(`Vector dimensions differ (${a.length} vs ${b.length})`);
  }
  const denominator = magnitude(a) * magnitude(b);
  if (denominator === 0) return 0;
  // Clamp tiny floating-point overshoots (e.g. 1.0000001).
  return Math.max(-1, Math.min(1, dot(a, b) / denominator));
}

/** Returns a unit-length copy of the vector (zero vector stays zero). */
function l2Normalize(vector) {
  const out = Float32Array.from(vector);
  const norm = magnitude(out);
  if (norm === 0) return out;
  for (let i = 0; i < out.length; i += 1) out[i] /= norm;
  return out;
}

module.exports = { dot, magnitude, cosineSimilarity, l2Normalize };
