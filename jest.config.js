/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  preset: 'ts-jest',
  moduleNameMapper: {
    '^\\$$': path.join(__dirname, 'src'),
    '^\\$/(.*)$': path.join(__dirname, 'src/$1'),
    '^\\$test/(.*)$': path.join(__dirname, 'test/$1'),
  },
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: path.join(__dirname, 'coverage'),
  coverageReporters: ['text'],
};
