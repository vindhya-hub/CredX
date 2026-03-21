const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

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
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  merchant: {
    type: DataTypes.STRING,
  },
  fraudScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  isFraud: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  timestamps: true
});

module.exports = CardTransaction;