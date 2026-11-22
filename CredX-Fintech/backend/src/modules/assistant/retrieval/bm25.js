/**
 * Okapi BM25 keyword scoring.
 *
 *   score(D, Q) = sum over unique terms q in Q of
 *                 IDF(q) * f(q, D) * (k1 + 1) / (f(q, D) + k1 * (1 - b + b * |D| / avgdl))
 *
 *   IDF(q) = ln(1 + (N - n(q) + 0.5) / (n(q) + 0.5))   (always positive)
 *
 * k1 controls term-frequency saturation, b controls length normalisation.
 */
class BM25 {
  /**
   * @param {string[][]} documentsTokens tokenised documents
   * @param {{ k1?: number, b?: number }} [params]
   */
  constructor(documentsTokens, { k1 = 1.2, b = 0.75 } = {}) {
    this.k1 = k1;
    this.b = b;
    this.N = documentsTokens.length;
    this.docLengths = documentsTokens.map((tokens) => tokens.length);
    const totalLength = this.docLengths.reduce((sum, len) => sum + len, 0);
    this.avgdl = this.N ? totalLength / this.N : 0;

    this.termFrequencies = documentsTokens.map((tokens) => {
      const tf = new Map();
      for (const token of tokens) tf.set(token, (tf.get(token) || 0) + 1);
      return tf;
    });

    this.documentFrequency = new Map();
    for (const tf of this.termFrequencies) {
      for (const term of tf.keys()) {
        this.documentFrequency.set(term, (this.documentFrequency.get(term) || 0) + 1);
      }
    }
  }

  idf(term) {
    const n = this.documentFrequency.get(term) || 0;
    return Math.log(1 + (this.N - n + 0.5) / (n + 0.5));
  }

  score(queryTokens, index) {
    const tf = this.termFrequencies[index];
    if (!tf) return 0;
    const lengthNorm = 1 - this.b + this.b * (this.docLengths[index] / (this.avgdl || 1));
    let total = 0;
    for (const term of new Set(queryTokens)) {
      const f = tf.get(term);
      if (!f) continue;
      total += this.idf(term) * ((f * (this.k1 + 1)) / (f + this.k1 * lengthNorm));
    }
    return total;
  }

  /** Scores every document for the query. */
  scoreAll(queryTokens) {
    return this.termFrequencies.map((_, index) => this.score(queryTokens, index));
  }
}

module.exports = BM25;
