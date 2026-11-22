const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');
const { decimalGetter } = require('../../utils/money');

/**
 * Wallet ledger. Every movement of wallet money is recorded here:
 *
 *  type               senderId   receiverId  referenceId
 *  transfer           user       other user  -
 *  deposit            -          user        card (if topped up from a credit card)
 *  loan_disbursement  -          user        loan
 *  emi_payment        user       -           loan
 *  card_payment       user       -           card (credit card bill payment)
 */
const TRANSACTION_TYPES = ['transfer', 'deposit', 'loan_disbursement', 'emi_payment', 'card_payment'];

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  senderId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  receiverId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  amount: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    get: decimalGetter('amount'),
  },
  type: {
    type: DataTypes.STRING,
    defaultValue: 'transfer',
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'completed',
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  referenceId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  fraud_score: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
}, {
  timestamps: true,
  indexes: [
    { name: 'idx_txn_sender_created', fields: ['senderId', 'createdAt'] },
    { name: 'idx_txn_receiver_created', fields: ['receiverId', 'createdAt'] },
  ],
});

module.exports = Transaction;
module.exports.TRANSACTION_TYPES = TRANSACTION_TYPES;
