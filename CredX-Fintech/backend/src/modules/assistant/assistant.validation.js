const { z } = require('../../utils/validators');

const query = z.object({
  query: z
    .string('query is required')
    .trim()
    .min(1, 'Ask a question')
    .max(500, 'Questions can be at most 500 characters'),
  topK: z.coerce.number().int().min(1).max(20).optional(),
  // Client's local time minus UTC in minutes (JavaScript: -new Date().getTimezoneOffset()).
  utcOffsetMinutes: z.coerce.number().int().min(-720).max(840).default(0),
});

module.exports = { query };
