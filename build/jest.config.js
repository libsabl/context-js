/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  testEnvironment: 'node',
  collectCoverage: true,
  testMatch: ['**/*.spec.*'],
  coverageReporters: ['text'],
};
