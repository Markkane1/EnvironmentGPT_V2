import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'
import {
  createPrismaTestContext,
  expectPrismaValidationError,
  resetPrismaTestData,
} from '../../helpers/prisma-model-test'

describe('Prisma operational support models', () => {
  let prisma: PrismaClient
  let dispose: () => Promise<void>

  beforeAll(async () => {
    const context = await createPrismaTestContext('operational_models')
    prisma = context.prisma
    dispose = context.dispose
  })

  afterAll(async () => {
    await dispose()
  })

  beforeEach(async () => {
    await resetPrismaTestData(prisma)
  })

  describe('AnalyticsEvent', () => {
    it('throws a Prisma validation error when eventType is omitted', async () => {
      await expectPrismaValidationError(
        prisma.analyticsEvent.create({
          data: {
            metadata: '{"query":"aqi"}',
          } as any,
        })
      )
    })

    it('throws a Prisma validation error when runtime types are invalid', async () => {
      await expectPrismaValidationError(
        prisma.analyticsEvent.create({
          data: {
            eventType: 42,
            userId: false,
            metadata: 123,
          } as any,
        })
      )
    })

    it('populates createdAt on create', async () => {
      const event = await prisma.analyticsEvent.create({
        data: {
          eventType: `query_${randomUUID()}`,
          metadata: '{"query":"what is the AQI in Lahore?"}',
        },
      })

      expect(event.createdAt).toBeInstanceOf(Date)
    })
  })

  describe('AuditLog', () => {
    it('throws a Prisma validation error when action is omitted', async () => {
      await expectPrismaValidationError(
        prisma.auditLog.create({
          data: {
            entityType: 'Document',
            entityId: 'doc-1',
          } as any,
        })
      )
    })

    it('throws a Prisma validation error when entityType is omitted', async () => {
      await expectPrismaValidationError(
        prisma.auditLog.create({
          data: {
            action: 'create',
            entityId: 'doc-1',
          } as any,
        })
      )
    })

    it('throws a Prisma validation error when entityId is omitted', async () => {
      await expectPrismaValidationError(
        prisma.auditLog.create({
          data: {
            action: 'create',
            entityType: 'Document',
          } as any,
        })
      )
    })

    it('throws a Prisma validation error when runtime types are invalid', async () => {
      await expectPrismaValidationError(
        prisma.auditLog.create({
          data: {
            action: true,
            entityType: 5,
            entityId: false,
            oldData: 123,
          } as any,
        })
      )
    })

    it('populates createdAt on create', async () => {
      const entry = await prisma.auditLog.create({
        data: {
          action: 'create',
          entityType: 'Document',
          entityId: 'doc-1',
          newData: '{"title":"AQI report"}',
        },
      })

      expect(entry.createdAt).toBeInstanceOf(Date)
    })
  })
})
