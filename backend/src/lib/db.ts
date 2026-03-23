import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  (process.env.NODE_ENV === 'production'
    // Disable query logging in production to avoid leaking SQL statements and request data.
    ? new PrismaClient()
    : new PrismaClient({
        log: ['warn', 'error'],
      }))

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
