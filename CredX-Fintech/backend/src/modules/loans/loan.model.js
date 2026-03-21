const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

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
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  interestRate: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  tenureMonths: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  emi: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending'
  }, // ✅ comma added here

  remainingBalance: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },

  paidAmount: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  }

}, {
  timestamps: true
});

module.exports = Loan;