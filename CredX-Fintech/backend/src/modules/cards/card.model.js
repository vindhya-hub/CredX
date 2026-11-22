const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db');
const { decimalGetter } = require('../../utils/money');

/**
 * Card data minimisation: the full card number (PAN) and the CVV are never
 * stored. We keep only what the UI and duplicate detection need: brand, last
 * four digits, a masked display string and a keyed HMAC fingerprint.
 * (Older databases are cleaned up by db/migrations.js on startup.)
 */
const money = (field) => ({
  type: DataTypes.DECIMAL(14, 2),
  defaultValue: 0,
  get: decimalGetter(field),
});

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
  maskedNumber: {
    type: DataTypes.STRING,
  },
  last4: {
    type: DataTypes.STRING(4),
  },
  brand: {
    type: DataTypes.STRING(20),
  },
  fingerprint: {
    type: DataTypes.STRING(64),
  },
  cardHolderName: {
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
  creditLimit: money('creditLimit'),
  availableCredit: money('availableCredit'),
  outstandingBalance: money('outstandingBalance'),
  minimumDue: money('minimumDue'),
  billingDate: {
    type: DataTypes.DATE,
  },

  status: {
    type: DataTypes.STRING,
    defaultValue: 'active',
  },
}, {
  timestamps: true,
  indexes: [
    { name: 'idx_cards_user_id', fields: ['userId'] },
    { name: 'idx_cards_user_fingerprint', fields: ['userId', 'fingerprint'] },
  ],
});

/** API representation: masked number only, never secrets. */
Card.prototype.toJSON = function toJSON() {
  const values = { ...this.get({ plain: true }) };
  delete values.fingerprint;
  return values;
};

module.exports = Card;
