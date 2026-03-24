import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'
import {
  createPrismaTestContext,
  expectPrismaForeignKeyError,
  expectPrismaValidationError,
  resetPrismaTestData,
} from '../../helpers/prisma-model-test'

describe('Prisma document and chat models', () => {
  let prisma: PrismaClient
  let dispose: () => Promise<void>

  beforeAll(async () => {
    const context = await createPrismaTestContext('document_chat_models')
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
        email: `user-${randomUUID()}@example.com`,
        name: 'EPA Punjab User',
      },
    })
  }

  async function createDocument(ownerId?: string) {
    return prisma.document.create({
      data: {
        ownerId,
        title: `Document ${randomUUID()}`,
        content: 'Environmental monitoring report content '.repeat(8),
        category: 'Air Quality',
      },
    })
  }

  async function createSession(userId?: string, documentId?: string) {
    return prisma.chatSession.create({
      data: {
        userId,
        documentId,
        title: 'AQI Session',
      },
    })
  }

  async function createMessage(sessionId: string) {
    return prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: 'AQI summary content',
      },
    })
  }

  describe('Document', () => {
    it('throws a Prisma validation error when title is omitted', async () => {
      await expectPrismaValidationError(
        prisma.document.create({
          data: {
            content: 'Environmental content',
          } as any,
        })
      )
    })

    it('throws a Prisma validation error when content is omitted', async () => {
      await expectPrismaValidationError(
        prisma.document.create({
          data: {
            title: 'Missing content',
          } as any,
        })
      )
    })

    it('throws a Prisma validation error when scalar runtime types are invalid', async () => {
      await expectPrismaValidationError(
        prisma.document.create({
          data: {
            title: 99,
            content: true,
            year: '2026',
            isActive: 'true',
          } as any,
        })
      )
    })

    it('populates default audience, language, active state, and timestamps on create', async () => {
      const document = await prisma.document.create({
        data: {
          title: 'Defaults document',
          content: 'Environmental baseline content '.repeat(8),
        },
      })

      expect(document.audience).toBe('General Public')
      expect(document.language).toBe('en')
      expect(document.isActive).toBe(true)
      expect(document.createdAt).toBeInstanceOf(Date)
      expect(document.updatedAt).toBeInstanceOf(Date)
    })

    it('updates updatedAt automatically when a document changes', async () => {
      const document = await createDocument()

      await new Promise((resolve) => setTimeout(resolve, 10))

      const updated = await prisma.document.update({
        where: { id: document.id },
        data: {
          summary: 'Updated summary',
        },
      })

      expect(updated.updatedAt.getTime()).toBeGreaterThan(document.updatedAt.getTime())
    })
  })

  describe('DocumentChunk', () => {
    it('throws a Prisma validation error when documentId is omitted', async () => {
      await expectPrismaValidationError(
        prisma.documentChunk.create({
          data: {
            content: 'Chunk content',
            chunkIndex: 0,
          } as any,
        })
      )
    })

    it('throws a Prisma validation error when content is omitted', async () => {
      const document = await createDocument()

      await expectPrismaValidationError(
        prisma.documentChunk.create({
          data: {
            documentId: document.id,
            chunkIndex: 0,
          } as any,
        })
      )
    })

    it('throws a Prisma validation error when chunkIndex is omitted', async () => {
      const document = await createDocument()

      await expectPrismaValidationError(
        prisma.documentChunk.create({
          data: {
            documentId: document.id,
            content: 'Chunk content',
          } as any,
        })
      )
    })

    it('throws a foreign key error when a chunk references a missing document', async () => {
      await expectPrismaForeignKeyError(
        prisma.documentChunk.create({
          data: {
            documentId: 'missing-document',
            content: 'Chunk content',
            chunkIndex: 0,
          },
        })
      )
    })

    it('throws a Prisma validation error when runtime types are invalid', async () => {
      const document = await createDocument()

      await expectPrismaValidationError(
        prisma.documentChunk.create({
          data: {
            documentId: document.id,
            content: 123,
            chunkIndex: 'zero',
          } as any,
        })
      )
    })

    it('populates createdAt on create', async () => {
      const document = await createDocument()
      const chunk = await prisma.documentChunk.create({
        data: {
          documentId: document.id,
          content: 'Chunk content',
          chunkIndex: 0,
        },
      })

      expect(chunk.createdAt).toBeInstanceOf(Date)
    })
  })

  describe('ChatSession', () => {
    it('allows creation without optional user, document, or title fields', async () => {
      const session = await prisma.chatSession.create({
        data: {},
      })

      expect(session.id).toEqual(expect.any(String))
      expect(session.createdAt).toBeInstanceOf(Date)
      expect(session.updatedAt).toBeInstanceOf(Date)
      expect(session.userId).toBeNull()
      expect(session.documentId).toBeNull()
      expect(session.title).toBeNull()
    })

    it('throws a Prisma validation error when optional scalar runtime types are invalid', async () => {
      await expectPrismaValidationError(
        prisma.chatSession.create({
          data: {
            title: 42,
          } as any,
        })
      )
    })

    it('updates updatedAt automatically when a session changes', async () => {
      const session = await prisma.chatSession.create({
        data: {
          title: 'Original session',
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      const updated = await prisma.chatSession.update({
        where: { id: session.id },
        data: {
          title: 'Updated session',
        },
      })

      expect(updated.updatedAt.getTime()).toBeGreaterThan(session.updatedAt.getTime())
    })
  })

  describe('ChatMessage', () => {
    it('throws a Prisma validation error when sessionId is omitted', async () => {
      await expectPrismaValidationError(
        prisma.chatMessage.create({
          data: {
            role: 'assistant',
            content: 'Missing session',
          } as any,
        })
      )
    })

    it('throws a Prisma validation error when role is omitted', async () => {
      const session = await prisma.chatSession.create({ data: {} })

      await expectPrismaValidationError(
        prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            content: 'Missing role',
          } as any,
        })
      )
    })

    it('throws a Prisma validation error when content is omitted', async () => {
      const session = await prisma.chatSession.create({ data: {} })

      await expectPrismaValidationError(
        prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            role: 'assistant',
          } as any,
        })
      )
    })

    it('throws a foreign key error when a message references a missing session', async () => {
      await expectPrismaForeignKeyError(
        prisma.chatMessage.create({
          data: {
            sessionId: 'missing-session',
            role: 'assistant',
            content: 'Orphan message',
          },
        })
      )
    })

    it('throws a Prisma validation error when runtime types are invalid', async () => {
      const session = await prisma.chatSession.create({ data: {} })

      await expectPrismaValidationError(
        prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            role: 5,
            content: false,
          } as any,
        })
      )
    })

    it('populates createdAt on create', async () => {
      const session = await prisma.chatSession.create({ data: {} })
      const message = await prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'assistant',
          content: 'AQI summary content',
        },
      })

      expect(message.createdAt).toBeInstanceOf(Date)
    })
  })

  describe('Feedback', () => {
    it('throws a Prisma validation error when messageId is omitted', async () => {
      await expectPrismaValidationError(
        prisma.feedback.create({
          data: {
            rating: 5,
          } as any,
        })
      )
    })

    it('throws a Prisma validation error when rating is omitted', async () => {
      const session = await prisma.chatSession.create({ data: {} })
      const message = await createMessage(session.id)

      await expectPrismaValidationError(
        prisma.feedback.create({
          data: {
            messageId: message.id,
          } as any,
        })
      )
    })

    it('throws a foreign key error when feedback references a missing message', async () => {
      await expectPrismaForeignKeyError(
        prisma.feedback.create({
          data: {
            messageId: 'missing-message',
            rating: 5,
          },
        })
      )
    })

    it('throws a Prisma validation error when runtime types are invalid', async () => {
      const session = await prisma.chatSession.create({ data: {} })
      const message = await createMessage(session.id)

      await expectPrismaValidationError(
        prisma.feedback.create({
          data: {
            messageId: message.id,
            rating: 'five',
            comment: 123,
          } as any,
        })
      )
    })

    it('populates createdAt on create and keeps the optional user relation nullable', async () => {
      const session = await prisma.chatSession.create({ data: {} })
      const message = await createMessage(session.id)
      const feedback = await prisma.feedback.create({
        data: {
          messageId: message.id,
          rating: 5,
        },
      })

      expect(feedback.createdAt).toBeInstanceOf(Date)
      expect(feedback.userId).toBeNull()
    })

    it('does not enforce a 1..5 rating bound at the Prisma model layer', async () => {
      const user = await createUser()
      const document = await createDocument(user.id)
      const session = await createSession(user.id, document.id)
      const message = await createMessage(session.id)

      const feedback = await prisma.feedback.create({
        data: {
          messageId: message.id,
          userId: user.id,
          rating: 99,
          comment: 'Route-level validators are expected to guard this.',
        },
      })

      expect(feedback.rating).toBe(99)
    })
  })
})
