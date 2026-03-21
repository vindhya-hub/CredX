const User = require("../modules/users/user.model");
const Wallet = require("../modules/wallet/wallet.model");
const Card = require("../modules/cards/card.model");
const CardTransaction = require("../modules/cards/cardTransaction.model");

// USER ↔ WALLET
User.hasOne(Wallet, { foreignKey: "userId", as: "wallet" });
Wallet.belongsTo(User, { foreignKey: "userId" });

// USER ↔ CARDS
User.hasMany(Card, { foreignKey: "userId", as: "cards" });
Card.belongsTo(User, { foreignKey: "userId" });

// CARD ↔ TRANSACTIONS
Card.hasMany(CardTransaction, { foreignKey: "cardId", as: "transactions" });
CardTransaction.belongsTo(Card, { foreignKey: "cardId" });

console.log("Associations loaded");