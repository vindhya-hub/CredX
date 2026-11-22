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

  // Uniqueness is enforced by the named index below rather than a column-level
  // `unique: true`: with sync({ alter: true }) Sequelize's Postgres dialect
  // re-adds a column UNIQUE constraint on every boot (Users_email_key1, ...).
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true,
    },
  },

  // bcrypt hash, never the plain-text password
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
  },

  // Incremented on logout / password change to revoke outstanding refresh tokens.
  tokenVersion: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },

  // SHA-256 of the single-use password reset token (the token itself is never stored).
  passwordResetTokenHash: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },

  passwordResetExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: true,
  indexes: [
    // Same name Postgres gave the constraint created by earlier versions, so
    // existing databases are recognised as already indexed.
    { name: 'Users_email_key', unique: true, fields: ['email'] },
  ],
});

const PRIVATE_FIELDS = ['password', 'tokenVersion', 'passwordResetTokenHash', 'passwordResetExpiresAt'];

// Defence in depth: secrets are stripped whenever a user is serialised to JSON.
User.prototype.toJSON = function toJSON() {
  const values = { ...this.get({ plain: true }) };
  for (const field of PRIVATE_FIELDS) delete values[field];
  return values;
};

module.exports = User;
