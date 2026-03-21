const Wallet = require("./wallet.model");
const User = require("../users/user.model");
const Card = require("../cards/card.model"); // <-- added for card deduction

exports.getMyWallet = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({
      where: { userId: req.user.id }
    });

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    res.json(wallet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addMoney = async (req, res) => {
  try {
    const { amount, cardId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const wallet = await Wallet.findOne({
      where: { userId: req.user.id }
    });

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    // ✅ NEW: Deduct from selected card
    if (cardId) {
      const card = await Card.findOne({
        where: { id: cardId, userId: req.user.id }
      });

      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      if (card.balance < amount) {
        return res.status(400).json({ message: "Insufficient card balance" });
      }

      card.balance -= Number(amount);
      await card.save();
    }

    wallet.balance += Number(amount);
    await wallet.save();

    res.json(wallet);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.transferMoney = async (req, res) => {
  try {
    const { email, amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const sender = await Wallet.findOne({
      where: { userId: req.user.id }
    });

    if (!sender) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    if (sender.balance < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    const receiverUser = await User.findOne({ where: { email } });
    if (!receiverUser) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    const receiver = await Wallet.findOne({
      where: { userId: receiverUser.id }
    });

    sender.balance -= Number(amount);
    receiver.balance += Number(amount);

    await sender.save();
    await receiver.save();

    res.json({ message: "Transfer successful" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};