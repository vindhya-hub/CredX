const { tokenize, stem, normalize } = require('../../src/modules/assistant/retrieval/tokenizer');

describe('tokenizer', () => {
  test('lower-cases, drops stop words and punctuation', () => {
    expect(tokenize("What's my Swiggy spending?")).toEqual(['swiggy', 'spend']);
  });

  test('keeps numbers, joins thousands separators, drops decimal zero fragments', () => {
    expect(tokenize('Paid 4,520.00 on 12 Oct')).toEqual(expect.arrayContaining(['paid', '4520', '12', 'oct']));
    expect(tokenize('4520.00')).not.toContain('00');
  });

  test('light stemming makes plural and verb forms match', () => {
    expect(stem('transactions')).toBe(stem('transaction'));
    expect(stem('groceries')).toBe('grocery');
    expect(stem('shopping')).toBe('shop');
    expect(stem('bus')).toBe('bus');
  });

  test('normalize strips accents and apostrophes', () => {
    expect(normalize("Café Domino's")).toBe('cafe dominos');
  });

  test('options can keep stop words and skip stemming', () => {
    expect(tokenize('show my transactions', { keepStopwords: true, stem: false })).toEqual(['show', 'my', 'transactions']);
  });
});
