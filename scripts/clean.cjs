const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const removeDeps = process.argv.includes('--deps')

const targets = [
  '.next',
  'playwright-report',
  'test-results',
  'coverage',
  path.join('tests', 'playwright-results.json'),
  'jest-results.json',
  'next-dev.log',
  'server.log',
  'dev.log',
  path.join('backend', 'prisma', 'e2e.db'),
  'tsconfig.tsbuildinfo',
  'tsconfig.verify.tsbuildinfo',
  // Monorepo workspace build artifacts
  path.join('frontend', '.next'),
  path.join('backend', '.next'),
  path.join('frontend', 'coverage'),
  path.join('backend', 'coverage'),
]

if (removeDeps) {
  targets.push('node_modules')
  targets.push(path.join('frontend', 'node_modules'))
  targets.push(path.join('backend', 'node_modules'))
}

for (const target of targets) {
  const fullPath = path.join(rootDir, target)
  if (!fs.existsSync(fullPath)) {
    continue
  }

  fs.rmSync(fullPath, { recursive: true, force: true })
  console.log(`removed ${target}`)
}
