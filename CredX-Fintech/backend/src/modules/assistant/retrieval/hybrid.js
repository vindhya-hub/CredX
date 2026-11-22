/**
 * Hybrid retrieval over a user's documents:
 *   1. BM25 keyword scores for the query plus expansion terms (detected
 *      category synonyms, merchant names, intent vocabulary),
 *   2. cosine similarity between the embedding of the original query and
 *      the document embeddings (the embedder handles meaning, so the
 *      expansion terms are not added there),
 *   3. weighted (default) or reciprocal-rank score fusion,
 * returning documents ranked by the fused score with every component score
 * attached, so callers (and the UI) can show why a record was retrieved.
 */
const BM25 = require('./bm25');
const { tokenize } = require('./tokenizer');
const { cosineSimilarity } = require('./vector');
const { fuseScores } = require('./fusion');

const byDateDesc = (a, b) => new Date(b.doc.date || 0) - new Date(a.doc.date || 0);

/**
 * @param {object} params
 * @param {string} params.query
 * @param {Array<{ id: string, text: string, embedText?: string, date?: string|Date }>} params.documents
 * @param {{ embedTexts(texts: string[]): Promise<{ vectors: Float32Array[], embedder: object }> }} params.embeddings
 * @param {string[]} [params.expansions] extra keyword-side query terms
 * @param {'weighted'|'rrf'} [params.fusion]
 * @param {number} [params.keywordWeight] weight of BM25 in [0, 1]; vectors get 1 - weight
 * @param {number} [params.rrfK] RRF damping constant
 */
async function hybridSearch({ query, documents, embeddings, expansions = [], fusion = 'weighted', keywordWeight = 0.4, rrfK = 60 }) {
  if (!documents.length) return { ranked: [], embedder: null };

  const keywordQuery = [query, ...expansions].join(' ').trim();
  const bm25 = new BM25(documents.map((doc) => tokenize(doc.text)));
  const keywordScores = bm25.scoreAll(tokenize(keywordQuery));

  // Documents may carry a shorter `embedText` for the embedding model.
  const { vectors, embedder } = await embeddings.embedTexts([query, ...documents.map((doc) => doc.embedText || doc.text)]);
  const [queryVector, ...documentVectors] = vectors;
  const vectorScores = documentVectors.map((vector) => cosineSimilarity(queryVector, vector));

  const fused = fuseScores(keywordScores, vectorScores, { method: fusion, keywordWeight, rrfK });

  const ranked = documents
    .map((doc, index) => ({
      doc,
      score: fused[index],
      keywordScore: keywordScores[index],
      vectorScore: vectorScores[index],
    }))
    .sort((a, b) => b.score - a.score || byDateDesc(a, b));

  return { ranked, embedder };
}

/**
 * Keeps results that share a keyword with the query, or whose cosine
 * similarity reaches both the embedder's absolute threshold and
 * `relativeCutoff` x the best similarity in the set. The relative part
 * drops weak semantic neighbours when a clearly better match exists
 * ("pizza": Domino's 0.67 is kept, Shell 0.31 is not).
 */
function filterRelevant(ranked, embedder, { relativeCutoff = 0.85, fallbackThreshold = 0.25 } = {}) {
  if (!ranked.length) return ranked;
  const threshold = (embedder && embedder.minSimilarity) ?? fallbackThreshold;
  const best = Math.max(...ranked.map((r) => r.vectorScore));
  const cutoff = Math.max(threshold, best * relativeCutoff);
  return ranked.filter((r) => r.keywordScore > 0 || r.vectorScore >= cutoff);
}

/** True if any result passes filterRelevant. */
const hasRelevant = (ranked, embedder, options) => filterRelevant(ranked, embedder, options).length > 0;

module.exports = { hybridSearch, filterRelevant, hasRelevant };
