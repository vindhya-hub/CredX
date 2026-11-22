const walletService = require('./wallet.service');

exports.getMyWallet = async (req, res) => {
  const wallet = await walletService.getWallet(req.user.id);
  res.json(wallet);
};

exports.addMoney = async (req, res) => {
  const { amount, cardId } = req.body;
  const { wallet, transaction } = await walletService.topUp({ userId: req.user.id, amount, cardId });
  // Response keeps the wallet fields at the top level (backwards compatible).
  res.json({ ...wallet.toJSON(), transaction });
};

// Same implementation as POST /api/transactions/transfer (kept for the existing UI).
exports.transferMoney = async (req, res) => {
  const { receiverEmail, amount, note } = req.body;
  const result = await walletService.transfer({ senderId: req.user.id, receiverEmail, amount, note });
  res.json({ message: 'Transfer successful', ...result });
};
