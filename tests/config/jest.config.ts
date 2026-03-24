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
      branches: 50,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    './backend/src/app/api/auth/': {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './backend/src/lib/auth.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './backend/src/middleware/auth.ts': {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './backend/src/app/api/users/route.ts': {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  verbose: true,
}

export default config
