const { spawn } = require('child_process')
const { execFileSync } = require('child_process')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const backendDir = path.join(rootDir, 'backend')
const frontendDir = path.join(rootDir, 'frontend')
const nodeCommand = process.execPath
const prismaCli = path.join(rootDir, 'node_modules', 'prisma', 'build', 'index.js')
const nextCli = path.join(rootDir, 'node_modules', 'next', 'dist', 'bin', 'next')

function getDefaultDatabaseUrl() {
  const user = process.env.POSTGRES_USER || 'postgres'
  const password = process.env.POSTGRES_PASSWORD || 'postgres'
  const host = process.env.POSTGRES_HOST || '127.0.0.1'
  const port = process.env.POSTGRES_PORT || '5432'
  const database = process.env.POSTGRES_DB || 'environmentgpt'

  return `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`
}

const databaseUrl = process.env.DATABASE_URL || getDefaultDatabaseUrl()

const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'development',
  NEXT_TELEMETRY_DISABLED: '1',
  PLAYWRIGHT_TEST: '1',
  DATABASE_URL: databaseUrl,
}

function ensureDatabase() {
  execFileSync(nodeCommand, [prismaCli, 'db', 'push', '--skip-generate', '--accept-data-loss'], {
    cwd: backendDir,
    env,
    stdio: 'inherit',
  })
}

async function main() {
  ensureDatabase()

  // Start backend on port 3001
  const backend = spawn(nodeCommand, [nextCli, 'dev', '--webpack', '-p', '3001'], {
    cwd: backendDir,
    env,
    stdio: 'inherit',
  })

  // Start frontend on port 3000
  const frontend = spawn(nodeCommand, [nextCli, 'dev', '--webpack', '-p', '3000'], {
    cwd: frontendDir,
    env: {
      ...env,
      BACKEND_URL: 'http://localhost:3001',
    },
    stdio: 'inherit',
  })

  const shutdown = (signal) => {
    if (!backend.killed) {
      backend.kill(signal)
    }
    if (!frontend.killed) {
      frontend.kill(signal)
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  const onExit = (name) => (code) => {
    console.log(`${name} exited with code ${code ?? 0}`)
    shutdown('SIGTERM')
    process.exit(code ?? 0)
  }

  backend.on('exit', onExit('backend'))
  frontend.on('exit', onExit('frontend'))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
