module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/ui', '<rootDir>/backend'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'ui/**/*.ts',
    'ui/**/*.tsx',
    'backend/**/*.py',
    '!**/__tests__/**',
    '!**/node_modules/**'
  ]
}
