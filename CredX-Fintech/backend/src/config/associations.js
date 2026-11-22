/**
 * All model associations, defined once.
 *
 * The Wallet/Card/CardTransaction foreign keys match what earlier versions
 * created. Loan and Transaction associations are query-only
 * (`constraints: false`) so starting this version against an existing
 * database never fails on legacy rows that would violate a new constraint.
 */
const User = require('../modules/users/user.model');
const Wallet = require('../modules/wallet/wallet.model');
const Card = require('../modules/cards/card.model');
const CardTransaction = require('../modules/cards/cardTransaction.model');
const Loan = require('../modules/loans/loan.model');
const Transaction = require('../modules/transactions/transaction.model');
const RefreshToken = require('../modules/auth/refreshToken.model');

let defined = false;

function defineAssociations() {
  if (defined) return;
  defined = true;

  // USER <-> WALLET
  User.hasOne(Wallet, { foreignKey: 'userId', as: 'wallet' });
  Wallet.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // USER <-> CARDS
  User.hasMany(Card, { foreignKey: 'userId', as: 'cards' });
  Card.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // CARD <-> CARD TRANSACTIONS
  Card.hasMany(CardTransaction, { foreignKey: 'cardId', as: 'transactions' });
  CardTransaction.belongsTo(Card, { foreignKey: 'cardId', as: 'card' });

  // USER <-> LOANS
  User.hasMany(Loan, { foreignKey: 'userId', as: 'loans', constraints: false });
  Loan.belongsTo(User, { foreignKey: 'userId', as: 'user', constraints: false });

  // WALLET LEDGER -> USERS
  Transaction.belongsTo(User, { foreignKey: 'senderId', as: 'sender', constraints: false });
  Transaction.belongsTo(User, { foreignKey: 'receiverId', as: 'receiver', constraints: false });

  // USER <-> REFRESH TOKEN SESSIONS (new table, so a real FK is safe)
  User.hasMany(RefreshToken, { foreignKey: 'userId', as: 'refreshTokens', onDelete: 'CASCADE' });
  RefreshToken.belongsTo(User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
}

defineAssociations();

module.exports = { User, Wallet, Card, CardTransaction, Loan, Transaction, RefreshToken, defineAssociations };
