const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    validate: {
      isEmail: true,
    }
  },

  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  role: {
    type: DataTypes.ENUM('user', 'admin'),
    defaultValue: 'user',
  },

  credit_score: {
    type: DataTypes.INTEGER,
    defaultValue: 600,
  },

  kyc_status: {
    type: DataTypes.ENUM('pending', 'verified', 'rejected'),
    defaultValue: 'pending',
  },

  risk_rating: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },

  account_status: {
    type: DataTypes.ENUM('active', 'suspended'),
    defaultValue: 'active',
  }

}, {
  timestamps: true
});

module.exports = User;