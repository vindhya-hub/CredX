const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');
const { decimalGetter } = require('../../utils/money');

// Associations live in config/associations.js.
const Wallet = sequelize.define('Wallet', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  balance: {
    type: DataTypes.DECIMAL(14, 2),
    defaultValue: 0,
    get: decimalGetter('balance'),
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'INR',
  },
}, {
  timestamps: true,
  indexes: [{ name: 'idx_wallets_user_id', fields: ['userId'] }],
});

module.exports = Wallet;
