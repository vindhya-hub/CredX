/**
 * Shared zod building blocks for request validation.
 */
const { z } = require('zod');
const { round2 } = require('./money');

const MAX_AMOUNT = 10_000_000;

/** Numeric strings ("250.50") are accepted and converted; booleans/null are not. */
const numericString = (v) => (typeof v === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(v) ? Number(v) : v);

const amount = (max = MAX_AMOUNT) =>
  z.preprocess(
    numericString,
    z
      .number('Amount must be a number')
      .positive('Amount must be greater than 0')
      .max(max, `Amount cannot exceed ${max}`)
      .multipleOf(0.01, 'Amount can have at most 2 decimal places')
      .transform(round2),
  );

const id = (label = 'id') => z.uuid(`Invalid ${label}`);

const email = z
  .string('Email is required')
  .trim()
  .toLowerCase()
  .pipe(z.email('Invalid email address').max(254, 'Email is too long'));

/** bcrypt only uses the first 72 bytes of a password, so longer ones are rejected. */
const password = z
  .string('Password is required')
  .min(8, 'Password must be at least 8 characters')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Password must be at most 72 bytes')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Password must contain at least one letter and one number');

const intInRange = (min, max) => z.coerce.number().int().min(min).max(max);

module.exports = { z, amount, id, email, password, intInRange, MAX_AMOUNT };
