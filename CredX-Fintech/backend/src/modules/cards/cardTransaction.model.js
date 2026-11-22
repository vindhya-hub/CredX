const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');
const { decimalGetter } = require('../../utils/money');

const CardTransaction = sequelize.define('CardTransaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  cardId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    get: decimalGetter('amount'),
  },
  merchant: {
    type: DataTypes.STRING,
  },
  // Spending category (food, travel, ...). Derived from the merchant when not supplied.
  category: {
    type: DataTypes.STRING(40),
  },
  // "approved" purchases move money; "declined" ones (e.g. blocked by the
  // fraud engine) are kept for the audit trail only.
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'approved',
  },
  fraudScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  isFraud: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  timestamps: true,
  indexes: [
    // Every per-card listing/aggregation filters by card and sorts/filters by date.
    { name: 'idx_card_txn_card_created', fields: ['cardId', 'createdAt'] },
  ],
});

module.exports = CardTransaction;
