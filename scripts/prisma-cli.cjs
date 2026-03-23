const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const repoRoot = path.resolve(__dirname, '..')
const backendRoot = path.join(repoRoot, 'backend')
const enginesRoot = path.join(repoRoot, 'node_modules', '@prisma', 'engines')
const env = { ...process.env }

const engineFiles = {
  PRISMA_QUERY_ENGINE_LIBRARY: 'query_engine-windows.dll.node',
  PRISMA_SCHEMA_ENGINE_BINARY: 'schema-engine-windows.exe',
}

for (const [envVar, fileName] of Object.entries(engineFiles)) {
  const enginePath = path.join(enginesRoot, fileName)
  if (fs.existsSync(enginePath)) {
    env[envVar] = enginePath
  }
}

const prismaCommand = process.platform === 'win32'
  ? path.join(repoRoot, 'node_modules', '.bin', 'prisma.cmd')
  : path.join(repoRoot, 'node_modules', '.bin', 'prisma')

const commandArgs = process.argv.slice(2).join(' ')
const result = process.platform === 'win32'
  ? spawnSync(`"${prismaCommand}" ${commandArgs}`, {
      cwd: backendRoot,
      env,
      stdio: 'inherit',
      shell: true,
    })
  : spawnSync(prismaCommand, process.argv.slice(2), {
      cwd: backendRoot,
      env,
      stdio: 'inherit',
      shell: false,
    })

if (result.error) {
  console.error('[prisma-cli] Failed to run Prisma CLI:', result.error)
  process.exit(1)
}

process.exit(result.status ?? 0)
