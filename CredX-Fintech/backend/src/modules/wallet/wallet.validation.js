const { z, amount, id, email } = require('../../utils/validators');

const optionalCardId = z.preprocess((v) => (v === '' || v === null ? undefined : v), id('cardId').optional());

const addMoney = z.object({
  amount: amount(1_000_000),
  cardId: optionalCardId,
});

/**
 * Accepts both field names used by the two transfer routes
 * (`receiverEmail` on /api/transactions/transfer, `email` on /api/wallet/transfer).
 */
const transfer = z
  .preprocess(
    (body) => {
      if (!body || typeof body !== 'object') return body;
      const { email: legacyEmail, receiverEmail, ...rest } = body;
      return { ...rest, receiverEmail: receiverEmail ?? legacyEmail };
    },
    z.object({
      receiverEmail: email,
      amount: amount(),
      note: z.string().trim().max(140, 'Note is too long').optional(),
    }),
  );

module.exports = { addMoney, transfer };
