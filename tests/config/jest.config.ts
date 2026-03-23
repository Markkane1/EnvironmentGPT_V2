import path from 'path'
import { fileURLToPath } from 'url'
import type { Config } from 'jest'

const configDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(configDir, '../..')

const config: Config = {
  rootDir,
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/*.test.ts',
    '**/*.test.tsx',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/backend/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/config/jest.setup.ts'],
  collectCoverageFrom: [
    '<rootDir>/backend/src/**/*.{ts,tsx}',
    '<rootDir>/frontend/src/**/*.{ts,tsx}',
    '!<rootDir>/**/*.d.ts',
    '!<rootDir>/tests/**',
  ],
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 20,
      lines: 20,
      statements: 20,
    },
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/tests/e2e/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        module: 'commonjs',
        moduleResolution: 'node',
        skipLibCheck: true,
        strict: false,
        target: 'ES2020',
        lib: ['ES2020', 'DOM'],
      }
    }],
  },
  moduleDirectories: ['node_modules', '<rootDir>/'],
  verbose: true,
  testTimeout: 15000,
  clearMocks: true,
  restoreMocks: true,
  transformIgnorePatterns: [
    'node_modules/(?!(z-ai-web-dev-sdk)/)',
  ],
}

export default config
