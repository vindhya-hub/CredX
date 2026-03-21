const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

const Card = sequelize.define('Card', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  cardNumber: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  maskedNumber: {
    type: DataTypes.STRING,
  },
  cvv: {
    type: DataTypes.STRING,
  },
  expiryDate: {
    type: DataTypes.STRING,
  },
  cardType: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  // Credit system fields
  creditLimit: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  availableCredit: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  outstandingBalance: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  minimumDue: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  billingDate: {
    type: DataTypes.DATE,
  },

  status: {
    type: DataTypes.STRING,
    defaultValue: 'active'
  }

}, {
  timestamps: true
});

module.exports = Card;