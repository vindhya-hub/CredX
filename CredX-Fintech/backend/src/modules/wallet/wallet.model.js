const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');
const User = require('../users/user.model');

const Wallet = sequelize.define('Wallet', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  balance: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'USD',
  }
});

User.hasOne(Wallet, { foreignKey: 'userId' });
Wallet.belongsTo(User, { foreignKey: 'userId' });

module.exports = Wallet;