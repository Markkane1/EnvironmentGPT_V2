import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'
import {
  createPrismaTestContext,
  expectPrismaForeignKeyError,
  expectPrismaUniqueConstraintError,
  expectPrismaValidationError,
  resetPrismaTestData,
} from '../../helpers/prisma-model-test'

describe('Prisma user and auth-adjacent models', () => {
  let prisma: PrismaClient
  let dispose: () => Promise<void>

  beforeAll(async () => {
    const context = await createPrismaTestContext('user_auth_models')
    prisma = context.prisma
    dispose = context.dispose
  })

  afterAll(async () => {
    await dispose()
  })

  beforeEach(async () => {
    await resetPrismaTestData(prisma)
  })

  function uniqueEmail(label: string): string {
    return `${label}-${randomUUID()}@example.com`
  }

  describe('User', () => {
    it('throws a Prisma validation error when email is omitted', async () => {
      await expectPrismaValidationError(
        prisma.user.create({
          data: {
            name: 'EPA Punjab User',
          } as any,
        })
      )
    })

    it('throws a Prisma validation error when name is omitted', async () => {
      await expectPrismaValidationError(
        prisma.user.create({
          data: {
            email: uniqueEmail('missing-name'),
          } as any,
        })
      )
    })

    it('fails when two users share the same email address', async () => {
      const email = uniqueEmail('duplicate-email')

      await prisma.user.create({
        data: {
          email,
          name: 'First User',
        },
      })

      await expectPrismaUniqueConstraintError(
        prisma.user.create({
          data: {
            email,
            name: 'Second User',
          },
        }),
        ['email']
      )
    })

    it('fails when two users share the same username', async () => {
      const username = `user_${randomUUID().slice(0, 8)}`

      await prisma.user.create({
        data: {
          email: uniqueEmail('username-a'),
          username,
          name: 'First User',
        },
      })

      await expectPrismaUniqueConstraintError(
        prisma.user.create({
          data: {
            email: uniqueEmail('username-b'),
            username,
            name: 'Second User',
          },
        }),
        ['username']
      )
    })

    it('throws a Prisma validation error when string and boolean fields receive wrong runtime types', async () => {
      await expectPrismaValidationError(
        prisma.user.create({
          data: {
            email: 12345,
            name: true,
            isActive: 'yes',
          } as any,
        })
      )
    })

    it('populates default role, active state, and timestamps on create', async () => {
      const user = await prisma.user.create({
        data: {
          email: uniqueEmail('defaults'),
          name: 'Defaulted User',
        },
      })

      expect(user.role).toBe('viewer')
      expect(user.isActive).toBe(true)
      expect(user.createdAt).toBeInstanceOf(Date)
      expect(user.updatedAt).toBeInstanceOf(Date)
    })

    it('updates updatedAt automatically when a user record changes', async () => {
      const created = await prisma.user.create({
        data: {
          email: uniqueEmail('updated-at'),
          name: 'Original Name',
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      const updated = await prisma.user.update({
        where: { id: created.id },
        data: {
          name: 'Updated Name',
        },
      })

      expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime())
    })

    it('does not apply password hashing at the Prisma model layer', async () => {
      const user = await prisma.user.create({
        data: {
          email: uniqueEmail('password-hash'),
          name: 'Password Hash User',
          passwordHash: 'plain-text-value',
        },
      })

      expect(user.passwordHash).toBe('plain-text-value')
    })
  })

  describe('RefreshToken', () => {
    async function createUser() {
      return prisma.user.create({
        data: {
          email: uniqueEmail('refresh-user'),
          name: 'Refresh User',
        },
      })
    }

    it('throws a Prisma validation error when userId is omitted', async () => {
      await expectPrismaValidationError(
        prisma.refreshToken.create({
          data: {
            hashedToken: `hash-${randomUUID()}`,
            expiresAt: new Date(Date.now() + 60_000),
          } as any,
        })
      )
    })

    it('throws a Prisma validation error when hashedToken is omitted', async () => {
      const user = await createUser()

      await expectPrismaValidationError(
        prisma.refreshToken.create({
          data: {
            userId: user.id,
            expiresAt: new Date(Date.now() + 60_000),
          } as any,
        })
      )
    })

    it('throws a Prisma validation error when expiresAt is omitted', async () => {
      const user = await createUser()

      await expectPrismaValidationError(
        prisma.refreshToken.create({
          data: {
            userId: user.id,
            hashedToken: `hash-${randomUUID()}`,
          } as any,
        })
      )
    })

    it('fails when two refresh tokens share the same hashed token', async () => {
      const user = await createUser()
      const hashedToken = `hash-${randomUUID()}`

      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          hashedToken,
          expiresAt: new Date(Date.now() + 60_000),
        },
      })

      await expectPrismaUniqueConstraintError(
        prisma.refreshToken.create({
          data: {
            userId: user.id,
            hashedToken,
            expiresAt: new Date(Date.now() + 120_000),
          },
        }),
        ['hashedToken']
      )
    })

    it('throws a foreign key error when a refresh token references a missing user', async () => {
      await expectPrismaForeignKeyError(
        prisma.refreshToken.create({
          data: {
            userId: 'missing-user-id',
            hashedToken: `hash-${randomUUID()}`,
            expiresAt: new Date(Date.now() + 60_000),
          },
        })
      )
    })

    it('throws a Prisma validation error when runtime types are invalid', async () => {
      const user = await createUser()

      await expectPrismaValidationError(
        prisma.refreshToken.create({
          data: {
            userId: user.id,
            hashedToken: 12345,
            expiresAt: 'tomorrow',
            revoked: 'false',
          } as any,
        })
      )
    })

    it('populates revoked and timestamp defaults on create', async () => {
      const user = await createUser()
      const token = await prisma.refreshToken.create({
        data: {
          userId: user.id,
          hashedToken: `hash-${randomUUID()}`,
          expiresAt: new Date(Date.now() + 60_000),
        },
      })

      expect(token.revoked).toBe(false)
      expect(token.createdAt).toBeInstanceOf(Date)
      expect(token.updatedAt).toBeInstanceOf(Date)
    })

    it('updates updatedAt automatically when a refresh token changes', async () => {
      const user = await createUser()
      const created = await prisma.refreshToken.create({
        data: {
          userId: user.id,
          hashedToken: `hash-${randomUUID()}`,
          expiresAt: new Date(Date.now() + 60_000),
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      const updated = await prisma.refreshToken.update({
        where: {
          id: created.id,
        },
        data: {
          revoked: true,
        },
      })

      expect(updated.revoked).toBe(true)
      expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime())
    })
  })

  describe('SystemConfig', () => {
    it('throws a Prisma validation error when key is omitted', async () => {
      await expectPrismaValidationError(
        prisma.systemConfig.create({
          data: {
            value: 'enabled',
          } as any,
        })
      )
    })

    it('throws a Prisma validation error when value is omitted', async () => {
      await expectPrismaValidationError(
        prisma.systemConfig.create({
          data: {
            key: 'feature_flag',
          } as any,
        })
      )
    })

    it('fails when two system config rows share the same key', async () => {
      await prisma.systemConfig.create({
        data: {
          key: 'feature_flag',
          value: 'enabled',
        },
      })

      await expectPrismaUniqueConstraintError(
        prisma.systemConfig.create({
          data: {
            key: 'feature_flag',
            value: 'disabled',
          },
        }),
        ['key']
      )
    })

    it('throws a Prisma validation error when key and value receive wrong types', async () => {
      await expectPrismaValidationError(
        prisma.systemConfig.create({
          data: {
            key: 42,
            value: false,
          } as any,
        })
      )
    })

    it('updates updatedAt automatically when a config value changes', async () => {
      const created = await prisma.systemConfig.create({
        data: {
          key: 'cache_enabled',
          value: 'true',
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      const updated = await prisma.systemConfig.update({
        where: { id: created.id },
        data: {
          value: 'false',
        },
      })

      expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime())
    })
  })
})
