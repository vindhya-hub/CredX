const { z, amount, id, intInRange } = require('../../utils/validators');
const { luhnCheck, digitsOnly, isExpiryValid } = require('../../utils/cardUtils');
const { CATEGORIES } = require('../../utils/categorizer');

const cardIdParam = z.object({ cardId: id('cardId') });
const idParam = z.object({ id: id('card id') });

/**
 * The card number and CVV are validated here and never stored: the
 * controller keeps only brand, last 4 digits, a masked string and a keyed
 * fingerprint. The CVV is checked for format only and then discarded.
 */
const createCard = z.object({
  type: z.enum(['credit', 'debit'], 'Card type must be "credit" or "debit"'),
  name: z.string('Cardholder name is required').trim().min(2, 'Cardholder name is too short').max(100, 'Cardholder name is too long'),
  cardNumber: z
    .string('Card number is required')
    .transform(digitsOnly)
    .refine((v) => v.length >= 13 && v.length <= 19, 'Card number must be 13-19 digits')
    .refine(luhnCheck, 'Invalid card number (checksum failed)'),
  expiryDate: z
    .string('Expiry date is required')
    .trim()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Expiry must be in MM/YY format')
    .refine((v) => isExpiryValid(v), 'Card has expired'),
  cvv: z.string('CVV is required').regex(/^\d{3,4}$/, 'CVV must be 3 or 4 digits'),
});

const spend = z.object({
  cardId: id('cardId'),
  amount: amount(1_000_000),
  merchant: z.string().trim().min(1).max(100).default('Simulated Merchant'),
  category: z.enum(CATEGORIES).optional(),
});

const payBill = z.object({
  cardId: id('cardId'),
  // Omit to pay the full outstanding balance.
  amount: amount().optional(),
});

const toggleFreeze = z.object({ cardId: id('cardId') });

const simulate = z.object({
  cardId: id('cardId'),
  count: intInRange(1, 50).default(10),
  daysBack: intInRange(0, 365).default(60),
});

const listQuery = z.object({
  limit: intInRange(1, 1000).default(500),
  offset: intInRange(0, 1_000_000).default(0),
});

const categoryAnalyticsQuery = z.object({
  groupBy: z.enum(['merchant', 'category']).default('merchant'),
});

module.exports = {
  cardIdParam,
  idParam,
  createCard,
  spend,
  payBill,
  toggleFreeze,
  simulate,
  listQuery,
  categoryAnalyticsQuery,
};
