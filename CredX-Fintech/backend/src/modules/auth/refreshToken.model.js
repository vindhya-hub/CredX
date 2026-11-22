const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');

/**
 * One row per issued refresh token (a login "session"). The row id is the
 * token's `jti`; the token itself is never stored. Refresh tokens are single
 * use: exchanging one revokes it and links the replacement (`replacedById`).
 * Presenting an already-revoked token again is treated as token theft and
 * revokes every session of the user (see token.service.js).
 */
const RefreshToken = sequelize.define('RefreshToken', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  revokedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  replacedById: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  timestamps: true,
  indexes: [{ name: 'idx_refresh_tokens_user', fields: ['userId'] }],
});

module.exports = RefreshToken;
