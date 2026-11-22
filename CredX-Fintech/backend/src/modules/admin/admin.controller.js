const AppError = require('../../utils/AppError');
const { User, Card, CardTransaction } = require('../../models');

// Passwords and token metadata are stripped by User#toJSON.
exports.getAllUsers = async (req, res) => {
  const { limit, offset } = req.validated.query;
  const { rows, count } = await User.findAndCountAll({ order: [['createdAt', 'DESC']], limit, offset });
  res.json({ total: count, users: rows });
};

exports.getFraudTransactions = async (req, res) => {
  const { limit, offset } = req.validated.query;
  const frauds = await CardTransaction.findAll({
    where: { isFraud: true },
    include: [{ model: Card, as: 'card', attributes: ['id', 'userId', 'maskedNumber', 'brand', 'cardType', 'status'] }],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  res.json(frauds);
};

exports.freezeUserCard = async (req, res) => {
  const card = await Card.findByPk(req.body.cardId);
  if (!card) throw AppError.notFound('Card not found', 'CARD_NOT_FOUND');

  card.status = 'frozen';
  await card.save();

  res.json({ message: 'Card frozen by admin', card });
};
