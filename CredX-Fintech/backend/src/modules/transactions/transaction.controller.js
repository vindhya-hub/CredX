const { Op } = require('sequelize');
const { Transaction, User } = require('../../models');
const walletService = require('../wallet/wallet.service');

// ================= TRANSFER =================
exports.transfer = async (req, res) => {
  const { receiverEmail, amount, note } = req.body;
  const result = await walletService.transfer({ senderId: req.user.id, receiverEmail, amount, note });
  res.json({ message: 'Transfer successful', ...result });
};

// ================= LEDGER HISTORY =================
// All wallet movements of the user (transfers, top-ups, loan disbursements,
// EMI and card bill payments), newest first, with optional type filter.
exports.getHistory = async (req, res) => {
  const userId = req.user.id;
  const { limit, offset, type } = req.validated.query;

  const whereClause = { [Op.or]: [{ senderId: userId }, { receiverId: userId }] };
  if (type) whereClause.type = type;

  const transactions = await Transaction.findAll({
    where: whereClause,
    include: [
      { model: User, as: 'sender', attributes: ['id', 'name', 'email'] },
      { model: User, as: 'receiver', attributes: ['id', 'name', 'email'] },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  res.json(
    transactions.map((tx) => ({
      ...tx.toJSON(),
      direction: tx.senderId === userId ? 'debit' : 'credit',
    })),
  );
};
