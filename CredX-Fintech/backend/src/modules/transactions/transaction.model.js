const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  senderId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  receiverId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    defaultValue: 'transfer',
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'completed',
  },
  fraud_score: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  }
}, {
  timestamps: true
});

module.exports = Transaction;