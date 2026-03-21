const User = require('../users/user.model');
const CardTransaction = require('../cards/cardTransaction.model');
const Card = require('../cards/card.model');

exports.getAllUsers = async (req, res) => {
  const users = await User.findAll();
  res.json(users);
};

exports.getFraudTransactions = async (req, res) => {
  const frauds = await CardTransaction.findAll({
    where: { isFraud: true }
  });
  res.json(frauds);
};

exports.freezeUserCard = async (req, res) => {
  const { cardId } = req.body;

  const card = await Card.findByPk(cardId);
  if (!card) return res.status(404).json({ message: "Card not found" });

  card.status = 'frozen';
  await card.save();

  res.json({ message: "Card frozen by admin" });
};