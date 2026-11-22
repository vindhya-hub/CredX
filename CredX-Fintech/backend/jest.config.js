/** Jest configuration: tests run against in-memory SQLite, no PostgreSQL needed. */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setup/env.js'],
  testTimeout: 20000,
  restoreMocks: true,
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
};
