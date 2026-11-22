const { answerQuery, SUGGESTIONS } = require('./assistant.service');
const { getEmbeddingService } = require('./embeddings');

// POST /api/assistant/query
exports.query = async (req, res) => {
  const { query, topK, utcOffsetMinutes } = req.body;
  const result = await answerQuery({ userId: req.user.id, query, topK, utcOffsetMinutes });
  res.json(result);
};

// GET /api/assistant/suggestions
exports.suggestions = (req, res) => {
  res.json({ suggestions: SUGGESTIONS });
};

// GET /api/assistant/status - which embedder is active (no user data).
exports.status = (req, res) => {
  const { provider, model, state, active } = getEmbeddingService().status();
  res.json({ provider, model, state, active });
};
