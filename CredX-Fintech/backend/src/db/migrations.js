/**
 * Startup schema management.
 *
 * DB_SYNC controls what happens on boot (see config.js):
 *   alter  sequelize.sync({ alter: true })   development default
 *   safe   create missing tables, columns and indexes only (never drops or
 *          retypes anything)                 production default
 *   none   leave the schema alone (manage it yourself)
 *
 * Before syncing, idempotent upgrade steps bring databases created by older
 * versions of CredX in line with the current models:
 *   1. Legacy card data: older versions stored the full card number and the
 *      CVV. Brand / last 4 / masked number / keyed fingerprint are backfilled
 *      from the stored number, then both columns are dropped. (Storing a CVV
 *      after authorisation is never allowed under PCI DSS; storing a PAN
 *      needs strong controls this app does not have, so we keep neither.)
 *   2. Wallet ledger rows may now have no sender (deposits, loan
 *      disbursements) or no receiver (bill/EMI payments), so the legacy NOT
 *      NULL constraints on Transactions.senderId/receiverId are relaxed.
 *   3. Card transactions created before categories existed get a category
 *      derived from the merchant name (used by analytics and the assistant).
 */
const { DataTypes, QueryTypes } = require('sequelize');
const logger = require('../utils/logger');
const { maskPan, lastFour, detectBrand, fingerprint } = require('../utils/cardUtils');
const { categorizeMerchant } = require('../utils/categorizer');

async function listTables(queryInterface) {
  const tables = await queryInterface.showAllTables();
  return new Set(tables.map((t) => (typeof t === 'string' ? t : t.tableName)));
}

/** Adds model attributes that are missing from an existing table (never drops or alters). */
async function addMissingColumns(sequelize, model, tables) {
  const queryInterface = sequelize.getQueryInterface();
  const tableName = model.getTableName();
  if (!tables.has(tableName)) return [];

  const existing = await queryInterface.describeTable(tableName);
  const added = [];
  for (const [name, attribute] of Object.entries(model.rawAttributes)) {
    const field = attribute.field || name;
    if (existing[field] || attribute.primaryKey) continue;
    await queryInterface.addColumn(tableName, field, {
      type: attribute.type,
      // NOT NULL can only be added to a populated table together with a default.
      allowNull: !(attribute.allowNull === false && attribute.defaultValue !== undefined),
      defaultValue: attribute.defaultValue,
    });
    added.push(field);
  }
  if (added.length) logger.info('Schema upgrade: added columns', { table: tableName, columns: added });
  return added;
}

async function scrubLegacyCardData(sequelize, tables) {
  const queryInterface = sequelize.getQueryInterface();
  const Card = sequelize.models.Card;
  if (!Card || !tables.has('Cards')) return;

  const columns = await queryInterface.describeTable('Cards');
  if (!columns.cardNumber && !columns.cvv) return;

  await addMissingColumns(sequelize, Card, tables);

  if (columns.cardNumber) {
    const rows = await sequelize.query(
      'SELECT "id", "cardNumber" FROM "Cards" WHERE "cardNumber" IS NOT NULL',
      { type: QueryTypes.SELECT },
    );
    await sequelize.transaction(async (transaction) => {
      for (const row of rows) {
        await sequelize.query(
          `UPDATE "Cards" SET "maskedNumber" = :masked, "last4" = :last4,
             "brand" = COALESCE("brand", :brand), "fingerprint" = COALESCE("fingerprint", :fingerprint)
           WHERE "id" = :id`,
          {
            replacements: {
              id: row.id,
              masked: maskPan(row.cardNumber),
              last4: lastFour(row.cardNumber),
              brand: detectBrand(row.cardNumber),
              fingerprint: fingerprint(row.cardNumber),
            },
            transaction,
          },
        );
      }
    });
    await queryInterface.removeColumn('Cards', 'cardNumber');
  }
  if (columns.cvv) await queryInterface.removeColumn('Cards', 'cvv');

  logger.warn('Schema upgrade: removed stored card numbers and CVVs from Cards (masked data kept)');
}

async function relaxLegacyNotNull(sequelize, tables) {
  if (!tables.has('Transactions')) return;
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable('Transactions');
  for (const field of ['senderId', 'receiverId']) {
    if (columns[field] && columns[field].allowNull === false) {
      await queryInterface.changeColumn('Transactions', field, { type: DataTypes.UUID, allowNull: true });
      logger.info('Schema upgrade: made column nullable', { table: 'Transactions', column: field });
    }
  }
}

async function backfillCategories(sequelize) {
  const rows = await sequelize.query(
    'SELECT DISTINCT "merchant" FROM "CardTransactions" WHERE "category" IS NULL',
    { type: QueryTypes.SELECT },
  );
  for (const { merchant } of rows) {
    await sequelize.query(
      merchant === null
        ? 'UPDATE "CardTransactions" SET "category" = :category WHERE "category" IS NULL AND "merchant" IS NULL'
        : 'UPDATE "CardTransactions" SET "category" = :category WHERE "category" IS NULL AND "merchant" = :merchant',
      { replacements: { category: categorizeMerchant(merchant), merchant } },
    );
  }
  if (rows.length) logger.info('Schema upgrade: categorised legacy card transactions', { merchants: rows.length });
}

/**
 * Runs the upgrade steps and syncs the schema. Safe to run on every boot.
 * @param {import('sequelize').Sequelize} sequelize
 * @param {{ mode?: 'alter'|'safe'|'none' }} [options]
 */
async function prepareDatabase(sequelize, { mode = 'alter' } = {}) {
  if (mode === 'none') return;

  const tables = await listTables(sequelize.getQueryInterface());
  await scrubLegacyCardData(sequelize, tables);
  await relaxLegacyNotNull(sequelize, tables);

  if (mode === 'safe') {
    for (const model of Object.values(sequelize.models)) {
      await addMissingColumns(sequelize, model, tables);
    }
  }

  // alter: create/alter tables to match the models; safe: create missing tables and indexes.
  await sequelize.sync({ alter: mode === 'alter' });
  await backfillCategories(sequelize);
}

module.exports = { prepareDatabase, addMissingColumns, scrubLegacyCardData, relaxLegacyNotNull, backfillCategories };
