import path from 'path'
import { fileURLToPath } from 'url'
import type { Config } from 'jest'

const configDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(configDir, '../..')

const config: Config = {
  rootDir,
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/*.test.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/backend/src/$1',
    '^next/server$': '<rootDir>/node_modules/next/server.js',
    '^next/headers$': '<rootDir>/node_modules/next/headers.js',
    '^next/navigation$': '<rootDir>/node_modules/next/navigation.js',
    '^next/link$': '<rootDir>/node_modules/next/link.js',
    '^next/image$': '<rootDir>/node_modules/next/image.js',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/config/jest.setup.ts'],
  collectCoverageFrom: [
    '<rootDir>/backend/src/**/*.{ts,tsx}',
    '!<rootDir>/backend/src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 20,
      lines: 20,
      statements: 20,
    },
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/tests/components/', '<rootDir>/tests/e2e/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: path.join(rootDir, 'backend/tsconfig.json'),
    }],
  },
  moduleDirectories: ['node_modules', '<rootDir>/'],
  testTimeout: 15000,
  clearMocks: true,
  restoreMocks: true,
  transformIgnorePatterns: [
    'node_modules/(?!(z-ai-web-dev-sdk)/)',
  ],
}

export default config
