import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
  ],
  collectCoverageFrom: [
    'lib/**/*.ts',
    'app/api/**/*.ts',
    '!lib/db.ts',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    global: { branches: 50, functions: 60, lines: 60, statements: 60 },
  },
}

export default createJestConfig(config)
