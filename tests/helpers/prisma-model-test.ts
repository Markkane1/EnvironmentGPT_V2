import path from 'path'
import { randomUUID } from 'crypto'
import { execFileSync } from 'child_process'
import { Prisma, PrismaClient } from '@prisma/client'

const repoRoot = path.resolve(__dirname, '../..')
const prismaCliScript = path.join(repoRoot, 'scripts', 'prisma-cli.cjs')
const fallbackDatabaseUrl = 'postgresql://postgres:root123@127.0.0.1:5432/environmentgpt?schema=public'

function getBaseDatabaseUrl(): string {
  return process.env.DATABASE_URL || fallbackDatabaseUrl
}

function withSchema(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl)
  url.searchParams.set('schema', schema)
  return url.toString()
}

function runPrismaDbPush(databaseUrl: string): void {
  execFileSync(process.execPath, [
    prismaCliScript,
    'db',
    'push',
    '--skip-generate',
    '--accept-data-loss',
  ], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: 'pipe',
  })
}

export async function createPrismaTestContext(prefix: string): Promise<{
  prisma: PrismaClient
  databaseUrl: string
  schema: string
  dispose: () => Promise<void>
}> {
  const schema = `test_${prefix.replace(/[^a-zA-Z0-9_]/g, '_')}_${randomUUID().replace(/-/g, '')}`
  const baseDatabaseUrl = getBaseDatabaseUrl()
  const databaseUrl = withSchema(baseDatabaseUrl, schema)

  runPrismaDbPush(databaseUrl)

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })

  const adminPrisma = new PrismaClient({
    datasources: {
      db: {
        url: baseDatabaseUrl,
      },
    },
  })

  return {
    prisma,
    databaseUrl,
    schema,
    dispose: async () => {
      await prisma.$disconnect()
      await adminPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      await adminPrisma.$disconnect()
    },
  }
}

export async function resetPrismaTestData(prisma: PrismaClient): Promise<void> {
  await prisma.lLMRequestLog.deleteMany()
  await prisma.connectorTopicMapping.deleteMany()
  await prisma.connectorCache.deleteMany()
  await prisma.dataConnector.deleteMany()
  await prisma.lLMProvider.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.analyticsEvent.deleteMany()
  await prisma.systemConfig.deleteMany()
  await prisma.feedback.deleteMany()
  await prisma.chatMessage.deleteMany()
  await prisma.documentChunk.deleteMany()
  await prisma.chatSession.deleteMany()
  await prisma.document.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.user.deleteMany()
}

export async function expectPrismaValidationError(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(Prisma.PrismaClientValidationError)
}

export async function expectPrismaUniqueConstraintError(
  promise: Promise<unknown>,
  fields?: string[]
): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    code: 'P2002',
    ...(fields ? { meta: { target: fields } } : {}),
  })
}

export async function expectPrismaForeignKeyError(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    code: 'P2003',
  })
}
