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
    '^next/server$': '<rootDir>/node_modules/next/server.js',
    '^next/headers$': '<rootDir>/node_modules/next/headers.js',
    '^next/navigation$': '<rootDir>/node_modules/next/navigation.js',
    '^next/link$': '<rootDir>/node_modules/next/link.js',
    '^next/image$': '<rootDir>/node_modules/next/image.js',
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
      tsconfig: path.join(rootDir, 'frontend/tsconfig.json'),
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
