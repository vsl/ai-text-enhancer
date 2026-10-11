export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  silent: true,
  roots: ['<rootDir>/tests'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^npm:([^@/]+)@[^/]+/(.*)$': '$1/$2', // Preserve package subpaths (e.g., npm:langsmith@0.10.5/traceable)
    '^npm:([^@]+)@.*$': '$1', // Map versioned unscoped npm imports
    '^npm:(.*)$': '$1', // Map npm: imports to regular node_modules
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
