/**
 * Single entry point for models: requiring this guarantees every model is
 * registered and associations are defined before any query runs.
 */
const { sequelize } = require('../config/db');
const models = require('../config/associations');

module.exports = { sequelize, ...models };
