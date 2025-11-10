/**
 * Jest Configuration for Unit Tests
 * Runs isolated unit tests for utilities and libraries
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/__tests__/lib/**/*.test.ts',
    '<rootDir>/src/__tests__/utils/**/*.test.ts',
    '<rootDir>/src/__tests__/unit/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/lib/**/*.{js,ts}',
    'src/utils/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/__tests__/**'
  ],
  coverageDirectory: 'coverage/unit',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript'
      ]
    }]
  },
  moduleFileExtensions: ['js', 'ts', 'tsx', 'json'],
  testTimeout: 5000, // 단위 테스트는 짧은 타임아웃
  verbose: true
};
