/**
 * Deterministic local fallback embedder ("feature hashing").
 *
 * Each text is turned into word unigrams plus character 3-5-grams of every
 * word (with boundary markers), each feature is hashed (FNV-1a) into one of
 * `dim` buckets with a hashed +/- sign, and the vector is L2-normalised.
 * It captures lexical and sub-word similarity (plurals, typos, shared stems)
 * but not real semantics. It needs no model download, so it is used in tests,
 * offline, and whenever the transformer model cannot be loaded.
 */
const { tokenize } = require('../retrieval/tokenizer');
const { l2Normalize } = require('../retrieval/vector');

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

class HashingEmbedder {
  constructor({ dim = 512, minN = 3, maxN = 5, minSimilarity = 0.2 } = {}) {
    this.dim = dim;
    this.minN = minN;
    this.maxN = maxN;
    this.kind = 'hashing';
    this.id = `hashing-ngram-v1-${dim}`;
    // Cosine below this is treated as "not related" for this embedder.
    this.minSimilarity = minSimilarity;
  }

  addFeature(vector, feature, weight) {
    const bucket = fnv1a(feature) % this.dim;
    const sign = fnv1a(`sign:${feature}`) & 1 ? 1 : -1;
    vector[bucket] += sign * weight;
  }

  embedOne(text) {
    const vector = new Float32Array(this.dim);
    for (const token of tokenize(text)) {
      this.addFeature(vector, `w:${token}`, 1);
      const padded = `<${token}>`;
      for (let n = this.minN; n <= this.maxN; n += 1) {
        for (let i = 0; i + n <= padded.length; i += 1) {
          this.addFeature(vector, `c${n}:${padded.slice(i, i + n)}`, 0.5);
        }
      }
    }
    return l2Normalize(vector);
  }

  async embed(texts) {
    return texts.map((text) => this.embedOne(text));
  }
}

module.exports = { HashingEmbedder, fnv1a };
