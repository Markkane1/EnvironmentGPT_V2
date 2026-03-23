import path from 'path'
import { fileURLToPath } from 'url'
import type { Config } from 'jest'

const configDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(configDir, '../..')

const config: Config = {
  rootDir,
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests/components'],
  testMatch: [
    '**/*.test.tsx',
    '**/*.test.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/frontend/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/config/jest.setup.ts'],
  collectCoverageFrom: [
    '<rootDir>/frontend/src/**/*.{ts,tsx}',
    '!<rootDir>/frontend/src/**/*.d.ts',
  ],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
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
