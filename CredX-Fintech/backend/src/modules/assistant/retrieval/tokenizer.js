/**
 * Text normalisation shared by BM25 and the hashing embedder:
 * lower-case, strip accents and apostrophes, keep numbers ("4,520" -> "4520"),
 * drop stop words and apply a light English stemmer so "transactions",
 * "transaction" and "groceries"/"grocery" match.
 */
const STOPWORDS = new Set([
  'a', 'about', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can', 'could',
  'did', 'do', 'does', 'doing', 'for', 'from', 'get', 'got', 'had', 'has', 'have', 'having', 'he', 'her', 'here',
  'hers', 'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'just', 'me', 'mine', 'my', 'myself',
  'of', 'on', 'or', 'our', 'ours', 'please', 'show', 'so', 'some', 'tell', 'than', 'that', 'the', 'their', 'them',
  'then', 'there', 'these', 'they', 'this', 'those', 'to', 'too', 'us', 'was', 'we', 'were', 'what', 'whats',
  'when', 'where', 'which', 'who', 'whom', 'why', 'will', 'with', 'would', 'you', 'your', 'yours', 'give', 'list',
  'much', 'many', 'ive', 'im', 'id', 'let', 'see', 'view',
]);

const VOWEL = /[aeiouy]/;

/** Very small suffix stripper (a pragmatic subset of Porter step 1). */
function stem(token) {
  if (token.length <= 3 || /^\d/.test(token)) return token;
  let t = token;
  if (t.endsWith('ies') && t.length > 4) t = `${t.slice(0, -3)}y`;
  else if (t.endsWith('sses')) t = t.slice(0, -2);
  else if (t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us') && !t.endsWith('is') && t.length > 3) t = t.slice(0, -1);

  for (const suffix of ['ing', 'ed']) {
    if (t.endsWith(suffix) && t.length - suffix.length >= 3 && VOWEL.test(t.slice(0, -suffix.length))) {
      t = t.slice(0, -suffix.length);
      // shopp -> shop, transferr -> transfer
      if (/([bdfgklmnprt])\1$/.test(t)) t = t.slice(0, -1);
      break;
    }
  }
  return t;
}

function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/(\d),(?=\d)/g, '$1');
}

/**
 * @param {string} text
 * @param {{ stem?: boolean, keepStopwords?: boolean }} [options]
 * @returns {string[]}
 */
function tokenize(text, options = {}) {
  const { stem: doStem = true, keepStopwords = false } = options;
  const raw = normalize(text).split(/[^a-z0-9]+/);
  const tokens = [];
  for (const token of raw) {
    if (!token) continue;
    if (token.length < 2 && !/\d/.test(token)) continue;
    if (/^0+$/.test(token)) continue; // "4520.00" -> drop the "00" fragment
    if (!keepStopwords && STOPWORDS.has(token)) continue;
    tokens.push(doStem ? stem(token) : token);
  }
  return tokens;
}

module.exports = { tokenize, stem, normalize, STOPWORDS };
