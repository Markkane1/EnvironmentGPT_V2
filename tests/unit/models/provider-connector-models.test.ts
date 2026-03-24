import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'
import {
  createPrismaTestContext,
  expectPrismaForeignKeyError,
  expectPrismaUniqueConstraintError,
  expectPrismaValidationError,
  resetPrismaTestData,
} from '../../helpers/prisma-model-test'

describe('Prisma provider and connector registry models', () => {
  let prisma: PrismaClient
  let dispose: () => Promise<void>

  beforeAll(async () => {
    const context = await createPrismaTestContext('provider_connector_models')
    prisma = context.prisma
    dispose = context.dispose
  })

  afterAll(async () => {
    await dispose()
  })

  beforeEach(async () => {
    await resetPrismaTestData(prisma)
  })

  async function createUser() {
    return prisma.user.create({
      data: {
        email: `admin-${randomUUID()}@example.com`,
        name: 'Registry Admin',
      },
    })
  }

  async function createConnector() {
    return prisma.dataConnector.create({
      data: {
        name: `connector-${randomUUID()}`,
        displayName: 'Punjab AQI',
        connectorType: 'aqi',
        endpointUrl: 'https://example.com/aqi',
      },
    })
  }

  describe('LLMProvider', () => {
    it('throws a Prisma validation error when name is omitted', async () => {
      await expectPrismaValidationError(
        prisma.lLMProvider.create({
          data: {
            displayName: 'Primary Provider',
            baseUrl: 'https://api.example.com/v1',
            modelId: 'gpt-4o-mini',
          } as any,
        })
      )
    })

    it('throws a Prisma validation error when displayName is omitted', async () => {
      await expectPrismaValidationError(
        prisma.lLMProvider.create({
          data: {
            name: `provider-${randomUUID()}`,
            baseUrl: 'https://api.example.com/v1',
            modelId: 'gpt-4o-mini',
          } as any,
        })
      )
    })

    it('throws a Prisma validation error when baseUrl is omitted', async () => {
      await expectPrismaValidationError(
        prisma.lLMProvider.create({
          data: {
            name: `provider-${randomUUID()}`,
            displayName: 'Primary Provider',
            modelId: 'gpt-4o-mini',
          } as any,
        })
      )
    })

    it('throws a Prisma validation error when modelId is omitted', async () => {
      await expectPrismaValidationError(
        prisma.lLMProvider.create({
          data: {
            name: `provider-${randomUUID()}`,
            displayName: 'Primary Provider',
            baseUrl: 'https://api.example.com/v1',
          } as any,
        })
      )
    })

    it('fails when two providers share the same name', async () => {
      const name = `provider-${randomUUID()}`

      await prisma.lLMProvider.create({
        data: {
          name,
          displayName: 'Primary Provider',
          baseUrl: 'https://api.example.com/v1',
          modelId: 'gpt-4o-mini',
        },
      })

      await expectPrismaUniqueConstraintError(
        prisma.lLMProvider.create({
          data: {
            name,
            displayName: 'Fallback Provider',
            baseUrl: 'https://api.example.com/v1',
            modelId: 'gpt-4o',
          },
        }),
        ['name']
      )
    })

    it('throws a foreign key error when addedBy references a missing user', async () => {
      await expectPrismaForeignKeyError(
        prisma.lLMProvider.create({
          data: {
            name: `provider-${randomUUID()}`,
            displayName: 'Primary Provider',
            baseUrl: 'https://api.example.com/v1',
            modelId: 'gpt-4o-mini',
            addedBy: 'missing-user',
          },
        })
      )
    })

    it('throws a Prisma validation error when runtime types are invalid', async () => {
      await expectPrismaValidationError(
        prisma.lLMProvider.create({
          data: {
            name: `provider-${randomUUID()}`,
            displayName: 'Primary Provider',
            baseUrl: 'https://api.example.com/v1',
            modelId: 'gpt-4o-mini',
            priority: 'high',
            isActive: 'true',
            temperature: 'warm',
          } as any,
        })
      )
    })

    it('populates provider defaults and timestamps on create', async () => {
      const admin = await createUser()
      const provider = await prisma.lLMProvider.create({
        data: {
          name: `provider-${randomUUID()}`,
          displayName: 'Primary Provider',
          baseUrl: 'https://api.example.com/v1',
          modelId: 'gpt-4o-mini',
          addedBy: admin.id,
        },
      })

      expect(provider.providerType).toBe('openai_compat')
      expect(provider.defaultParams).toBe('{}')
      expect(provider.role).toBe('available')
      expect(provider.priority).toBe(100)
      expect(provider.isActive).toBe(true)
      expect(provider.timeoutSeconds).toBe(120)
      expect(provider.maxTokens).toBe(1024)
      expect(provider.temperature).toBe(0.1)
      expect(provider.healthStatus).toBe('unknown')
      expect(provider.requestCount).toBe(0)
      expect(provider.errorCount).toBe(0)
      expect(provider.createdAt).toBeInstanceOf(Date)
      expect(provider.updatedAt).toBeInstanceOf(Date)
    })

    it('updates updatedAt automatically when a provider changes', async () => {
      const provider = await prisma.lLMProvider.create({
        data: {
          name: `provider-${randomUUID()}`,
          displayName: 'Primary Provider',
          baseUrl: 'https://api.example.com/v1',
          modelId: 'gpt-4o-mini',
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      const updated = await prisma.lLMProvider.update({
        where: { id: provider.id },
        data: {
          healthStatus: 'healthy',
        },
      })

      expect(updated.updatedAt.getTime()).toBeGreaterThan(provider.updatedAt.getTime())
    })
  })

  describe('DataConnector', () => {
    it('throws a Prisma validation error when required fields are omitted', async () => {
      await expectPrismaValidationError(
        prisma.dataConnector.create({
          data: {
            name: `connector-${randomUUID()}`,
          } as any,
        })
      )
    })

    it('fails when two connectors share the same name', async () => {
      const name = `connector-${randomUUID()}`

      await prisma.dataConnector.create({
        data: {
          name,
          displayName: 'AQI Connector',
          connectorType: 'aqi',
          endpointUrl: 'https://example.com/aqi',
        },
      })

      await expectPrismaUniqueConstraintError(
        prisma.dataConnector.create({
          data: {
            name,
            displayName: 'Weather Connector',
            connectorType: 'weather',
            endpointUrl: 'https://example.com/weather',
          },
        }),
        ['name']
      )
    })

    it('throws a Prisma validation error when runtime types are invalid', async () => {
      await expectPrismaValidationError(
        prisma.dataConnector.create({
          data: {
            name: `connector-${randomUUID()}`,
            displayName: 'AQI Connector',
            connectorType: 'aqi',
            endpointUrl: 'https://example.com/aqi',
            refreshIntervalSec: '300',
            cacheEnabled: 'true',
          } as any,
        })
      )
    })

    it('populates connector defaults and timestamps on create', async () => {
      const connector = await prisma.dataConnector.create({
        data: {
          name: `connector-${randomUUID()}`,
          displayName: 'AQI Connector',
          connectorType: 'aqi',
          endpointUrl: 'https://example.com/aqi',
        },
      })

      expect(connector.authMethod).toBe('none')
      expect(connector.requestMethod).toBe('GET')
      expect(connector.injectAs).toBe('system_context')
      expect(connector.isActive).toBe(true)
      expect(connector.refreshIntervalSec).toBe(300)
      expect(connector.cacheEnabled).toBe(true)
      expect(connector.cacheTtlSec).toBe(300)
      expect(connector.requestCount).toBe(0)
      expect(connector.errorCount).toBe(0)
      expect(connector.createdAt).toBeInstanceOf(Date)
      expect(connector.updatedAt).toBeInstanceOf(Date)
    })

    it('updates updatedAt automatically when a connector changes', async () => {
      const connector = await prisma.dataConnector.create({
        data: {
          name: `connector-${randomUUID()}`,
          displayName: 'AQI Connector',
          connectorType: 'aqi',
          endpointUrl: 'https://example.com/aqi',
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      const updated = await prisma.dataConnector.update({
        where: { id: connector.id },
        data: {
          lastFetchStatus: 'success',
        },
      })

      expect(updated.updatedAt.getTime()).toBeGreaterThan(connector.updatedAt.getTime())
    })
  })

  describe('ConnectorTopicMapping', () => {
    it('throws a Prisma validation error when connectorId or topic is omitted', async () => {
      await expectPrismaValidationError(
        prisma.connectorTopicMapping.create({
          data: {
            priority: 1,
          } as any,
        })
      )
    })

    it('fails when the same connector/topic pair is inserted twice', async () => {
      const connector = await createConnector()

      await prisma.connectorTopicMapping.create({
        data: {
          connectorId: connector.id,
          topic: 'air_quality',
        },
      })

      await expectPrismaUniqueConstraintError(
        prisma.connectorTopicMapping.create({
          data: {
            connectorId: connector.id,
            topic: 'air_quality',
          },
        }),
        ['connectorId', 'topic']
      )
    })

    it('throws a foreign key error when a topic mapping references a missing connector', async () => {
      await expectPrismaForeignKeyError(
        prisma.connectorTopicMapping.create({
          data: {
            connectorId: 'missing-connector',
            topic: 'air_quality',
          },
        })
      )
    })

    it('throws a Prisma validation error when runtime types are invalid', async () => {
      const connector = await createConnector()

      await expectPrismaValidationError(
        prisma.connectorTopicMapping.create({
          data: {
            connectorId: connector.id,
            topic: 99,
            priority: 'first',
            isActive: 'true',
          } as any,
        })
      )
    })

    it('populates default priority, active state, and conditions on create', async () => {
      const connector = await createConnector()
      const mapping = await prisma.connectorTopicMapping.create({
        data: {
          connectorId: connector.id,
          topic: 'air_quality',
        },
      })

      expect(mapping.priority).toBe(100)
      expect(mapping.isActive).toBe(true)
      expect(mapping.conditions).toBe('{}')
    })
  })

  describe('ConnectorCache', () => {
    it('throws a Prisma validation error when required fields are omitted', async () => {
      await expectPrismaValidationError(
        prisma.connectorCache.create({
          data: {
            cacheKey: 'aqi:lahore',
          } as any,
        })
      )
    })

    it('fails when the same connector/cacheKey pair is inserted twice', async () => {
      await prisma.connectorCache.create({
        data: {
          connectorId: 'connector-1',
          cacheKey: 'aqi:lahore',
          data: '{"aqi":120}',
          expiresAt: new Date(Date.now() + 60_000),
        },
      })

      await expectPrismaUniqueConstraintError(
        prisma.connectorCache.create({
          data: {
            connectorId: 'connector-1',
            cacheKey: 'aqi:lahore',
            data: '{"aqi":100}',
            expiresAt: new Date(Date.now() + 120_000),
          },
        }),
        ['connectorId', 'cacheKey']
      )
    })

    it('throws a Prisma validation error when runtime types are invalid', async () => {
      await expectPrismaValidationError(
        prisma.connectorCache.create({
          data: {
            connectorId: 'connector-1',
            cacheKey: 'aqi:lahore',
            data: 42,
            expiresAt: 'tomorrow',
          } as any,
        })
      )
    })

    it('populates fetchedAt on create', async () => {
      const cacheEntry = await prisma.connectorCache.create({
        data: {
          connectorId: 'connector-1',
          cacheKey: 'aqi:lahore',
          data: '{"aqi":120}',
          expiresAt: new Date(Date.now() + 60_000),
        },
      })

      expect(cacheEntry.fetchedAt).toBeInstanceOf(Date)
    })
  })

  describe('LLMRequestLog', () => {
    it('throws a Prisma validation error when status is omitted', async () => {
      await expectPrismaValidationError(
        prisma.lLMRequestLog.create({
          data: {
            modelUsed: 'gpt-4o-mini',
          } as any,
        })
      )
    })

    it('throws a Prisma validation error when runtime types are invalid', async () => {
      await expectPrismaValidationError(
        prisma.lLMRequestLog.create({
          data: {
            status: 'success',
            requestTokens: '100',
            responseTokens: false,
            latencyMs: 'fast',
          } as any,
        })
      )
    })

    it('populates createdAt on create', async () => {
      const logEntry = await prisma.lLMRequestLog.create({
        data: {
          status: 'success',
          providerId: 'provider-1',
          modelUsed: 'gpt-4o-mini',
        },
      })

      expect(logEntry.createdAt).toBeInstanceOf(Date)
    })
  })
})
