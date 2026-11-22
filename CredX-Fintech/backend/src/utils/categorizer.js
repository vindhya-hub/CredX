/**
 * Maps merchant names to spending categories. Used when a card transaction is
 * recorded without an explicit category, and to backfill older rows.
 */
const CATEGORIES = [
  'food',
  'groceries',
  'shopping',
  'transport',
  'travel',
  'entertainment',
  'utilities',
  'health',
  'electronics',
  'fuel',
  'education',
  'wallet_topup',
  'other',
];

// Order matters: the first matching rule wins (groceries before food so
// "Whole Foods" is a grocery store, not a restaurant).
const MERCHANT_RULES = [
  ['wallet_topup', ['credx wallet', 'wallet top-up', 'wallet topup']],
  ['groceries', ['bigbasket', 'blinkit', 'zepto', 'grofers', 'dmart', 'walmart', 'costco', 'kroger', 'whole foods', 'trader joe', 'grocery', 'supermarket', 'reliance fresh', 'instamart']],
  ['food', ['swiggy', 'zomato', 'uber eats', 'doordash', 'grubhub', 'deliveroo', 'starbucks', 'mcdonald', 'domino', 'pizza', 'kfc', 'burger', 'subway', 'cafe', 'coffee', 'restaurant', 'eatery', 'dunkin', 'chipotle', 'bakery', 'food', 'dine', 'diner']],
  ['transport', ['uber', 'ola', 'lyft', 'rapido', 'metro', 'transit', 'taxi', 'cab', 'parking', 'toll']],
  ['travel', ['indigo', 'air india', 'vistara', 'makemytrip', 'goibibo', 'airbnb', 'booking.com', 'expedia', 'irctc', 'hotel', 'airline', 'airways', 'delta', 'united', 'marriott', 'hilton']],
  ['fuel', ['shell', 'indian oil', 'iocl', 'bharat petroleum', 'bpcl', 'hp petrol', 'hpcl', 'petrol', 'fuel', 'chevron', 'exxon']],
  ['entertainment', ['netflix', 'spotify', 'prime video', 'hotstar', 'disney', 'youtube', 'bookmyshow', 'pvr', 'inox', 'cinema', 'steam', 'playstation', 'xbox', 'hulu']],
  ['electronics', ['apple', 'samsung', 'croma', 'best buy', 'reliance digital', 'oneplus', 'xiaomi', 'dell', 'electronics']],
  ['utilities', ['airtel', 'jio', 'vodafone', 'verizon', 'comcast', 'electricity', 'water bill', 'broadband', 'gas bill', 'utility', 'bescom', 'tata power']],
  ['health', ['apollo', 'pharmeasy', '1mg', 'netmeds', 'pharmacy', 'hospital', 'clinic', 'medical', 'cvs', 'walgreens', 'practo']],
  ['education', ['udemy', 'coursera', 'byju', 'unacademy', 'school', 'college', 'university', 'tuition', 'edx']],
  ['shopping', ['amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho', 'ikea', 'target', 'ebay', 'zara', 'h&m', 'uniqlo', 'decathlon', 'mall', 'store']],
];

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Keywords must start at a word boundary so "ola" does not match "coca-cola"
// and "apple" does not match "pineapple".
const COMPILED_RULES = MERCHANT_RULES.map(([category, keywords]) => [
  category,
  keywords.map((keyword) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword)}`)),
]);

function categorizeMerchant(merchant) {
  const name = String(merchant ?? '').toLowerCase();
  if (!name.trim()) return 'other';
  for (const [category, patterns] of COMPILED_RULES) {
    if (patterns.some((pattern) => pattern.test(name))) return category;
  }
  return 'other';
}

module.exports = { CATEGORIES, categorizeMerchant };
