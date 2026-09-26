export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  silent: true,
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^npm:([^@/]+)@[^/]+/(.*)$': '$1/$2', // Preserve package subpaths (e.g., npm:langsmith@0.10.5/traceable)
    '^npm:([^@]+)@.*$': '$1', // Map npm:package@version to package (e.g., npm:jose@5 -> jose)
    '^npm:(.*)$': '$1', // Map npm: imports to regular node_modules
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jose)/)', // Transform jose module (ESM)
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
