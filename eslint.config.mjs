import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

export default [
  {
    ignores: [
      '**/.next/**',
      '**/node_modules/**',
      'playwright-report/**',
      'backend/prisma/dev.db',
      'backend/prisma/push-created.db',
    ],
  },
  ...nextVitals,
  ...nextTypescript,
  {
    settings: {
      next: {
        rootDir: ['frontend/', 'backend/'],
      },
    },
  },
]
