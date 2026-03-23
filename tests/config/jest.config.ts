import path from 'path'
import { fileURLToPath } from 'url'
import type { Config } from 'jest'

const configDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(configDir, '../..')

const config: Config = {
  rootDir,
  projects: [
    '<rootDir>/tests/config/jest.backend.config.ts',
    '<rootDir>/tests/config/jest.frontend.config.ts',
  ],
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
  verbose: true,
}

export default config
