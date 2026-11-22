const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');
const { decimalGetter } = require('../../utils/money');

const money = (field, extra = {}) => ({
  type: DataTypes.DECIMAL(14, 2),
  get: decimalGetter(field),
  ...extra,
});

const Loan = sequelize.define('Loan', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // Principal disbursed to the wallet
  amount: money('amount', { allowNull: false }),
  interestRate: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  tenureMonths: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  emi: money('emi', { allowNull: false }),
  // approved (active, being repaid) -> closed
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending',
  },
  // Amount still to be repaid (principal + interest for loans created by this version)
  remainingBalance: money('remainingBalance', { allowNull: false }),
  paidAmount: money('paidAmount', { defaultValue: 0 }),
}, {
  timestamps: true,
  indexes: [{ name: 'idx_loans_user_id', fields: ['userId'] }],
});

module.exports = Loan;
