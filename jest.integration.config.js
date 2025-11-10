/**
 * Jest Configuration for Integration Tests
 * Runs API and integration tests that require a running server
 */
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testMatch: [
    '<rootDir>/src/__tests__/api/**/*.test.ts',
    '<rootDir>/src/__tests__/integration/**/*.test.ts',
    '<rootDir>/src/__tests__/performance/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/app/api/**/*.{js,ts}',
    'src/lib/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/__tests__/**'
  ],
  coverageDirectory: 'coverage/integration',
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
  testTimeout: 30000, // 통합 테스트는 더 긴 타임아웃 필요
  verbose: true,
  maxWorkers: 1 // 통합 테스트는 순차 실행 (서버 리소스 공유)
};
