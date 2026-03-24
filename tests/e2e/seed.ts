import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface SeededUsers {
  admin: { id: string }
  viewer: { id: string }
}

async function clearDatabase() {
  await prisma.connectorCache.deleteMany()
  await prisma.connectorTopicMapping.deleteMany()
  await prisma.lLMRequestLog.deleteMany()
  await prisma.dataConnector.deleteMany()
  await prisma.lLMProvider.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.feedback.deleteMany()
  await prisma.chatMessage.deleteMany()
  await prisma.chatSession.deleteMany()
  await prisma.documentChunk.deleteMany()
  await prisma.document.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.analyticsEvent.deleteMany()
  await prisma.systemConfig.deleteMany()
  await prisma.user.deleteMany()
}

async function createUsers(): Promise<SeededUsers> {
  const [adminPasswordHash, userPasswordHash] = await Promise.all([
    bcrypt.hash('AdminPass123!', 10),
    bcrypt.hash('TestPass123!', 10),
  ])

  const admin = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      username: 'admin',
      passwordHash: adminPasswordHash,
      name: 'Admin Test User',
      role: 'admin',
      isActive: true,
    },
    select: { id: true },
  })

  const viewer = await prisma.user.create({
    data: {
      email: 'testuser@test.com',
      username: 'testuser',
      passwordHash: userPasswordHash,
      name: 'Regular Test User',
      role: 'viewer',
      isActive: true,
    },
    select: { id: true },
  })

  return { admin, viewer }
}

async function createDocuments(users: SeededUsers) {
  const adminDocument = await prisma.document.create({
    data: {
      title: 'Punjab Air Quality Annual Review',
      content: 'Vehicular emissions and crop burning are major contributors to particulate pollution in Punjab.',
      category: 'Air Quality',
      audience: 'Policy Maker',
      year: 2024,
      ownerId: users.admin.id,
      source: 'Seed Fixture',
      fileType: 'txt',
      tags: JSON.stringify(['air quality', 'pm2.5']),
    },
    select: { id: true, title: true },
  })

  await prisma.document.create({
    data: {
      title: 'Lahore Water Quality Bulletin',
      content: 'Monitoring stations show localized contamination spikes during monsoon runoff.',
      category: 'Water Resources',
      audience: 'Technical',
      year: 2023,
      ownerId: users.admin.id,
      source: 'Seed Fixture',
      fileType: 'txt',
      tags: JSON.stringify(['water', 'lahore']),
    },
  })

  const viewerDocument = await prisma.document.create({
    data: {
      title: 'Citizen Guide to Cleaner Neighborhoods',
      content: 'Residents can reduce localized waste burning by coordinating pickup and reporting dumping hotspots.',
      category: 'Waste Management',
      audience: 'General Public',
      year: 2025,
      ownerId: users.viewer.id,
      source: 'Seed Fixture',
      fileType: 'md',
      tags: JSON.stringify(['community', 'waste']),
    },
    select: { id: true, title: true },
  })

  await prisma.documentChunk.createMany({
    data: [
      {
        documentId: adminDocument.id,
        chunkIndex: 0,
        content: 'Vehicular emissions are a key source of PM2.5 in Lahore and Faisalabad.',
      },
      {
        documentId: viewerDocument.id,
        chunkIndex: 0,
        content: 'Community reporting and waste segregation reduce open burning.',
      },
    ],
  })

  return { adminDocument, viewerDocument }
}

async function createSessions(users: SeededUsers, documents: Awaited<ReturnType<typeof createDocuments>>) {
  const adminSession = await prisma.chatSession.create({
    data: {
      userId: users.admin.id,
      documentId: documents.adminDocument.id,
      title: 'Admin dashboard smoke session',
    },
    select: { id: true },
  })

  const viewerSession = await prisma.chatSession.create({
    data: {
      userId: users.viewer.id,
      documentId: documents.viewerDocument.id,
      title: 'Neighborhood cleanup ideas',
    },
    select: { id: true },
  })

  await prisma.chatMessage.create({
    data: {
      sessionId: adminSession.id,
      role: 'user',
      content: 'Summarize the latest air-quality report.',
    },
  })

  const viewerAssistantMessage = await prisma.chatMessage.create({
    data: {
      sessionId: viewerSession.id,
      role: 'assistant',
      content: 'Prioritize waste segregation, timely pickup, and public reporting of dumping hotspots.',
      sources: JSON.stringify([
        {
          id: documents.viewerDocument.id,
          title: documents.viewerDocument.title,
          category: 'Waste Management',
          excerpt: 'Residents can reduce localized waste burning by coordinating pickup.',
          relevanceScore: 0.91,
        },
      ]),
    },
    select: { id: true },
  })

  await prisma.feedback.create({
    data: {
      messageId: viewerAssistantMessage.id,
      userId: users.viewer.id,
      rating: 5,
      comment: 'Helpful and actionable',
    },
  })
}

async function createProviders(users: SeededUsers) {
  await prisma.lLMProvider.create({
    data: {
      name: 'seed-primary-provider',
      displayName: 'Seed Primary Provider',
      providerType: 'openai_compat',
      baseUrl: 'https://api.example.com',
      modelId: 'gpt-4o-mini',
      role: 'primary',
      isActive: true,
      priority: 1,
      timeoutSeconds: 120,
      maxTokens: 1024,
      temperature: 0.1,
      healthStatus: 'healthy',
      requestCount: 12,
      errorCount: 1,
      avgLatencyMs: 425,
      addedBy: users.admin.id,
    },
  })
}

async function createConnectors() {
  const connector = await prisma.dataConnector.create({
    data: {
      name: 'seed-air-quality-connector',
      displayName: 'Seed Air Quality Connector',
      connectorType: 'aqi',
      endpointUrl: 'https://api.example.com/aqi',
      injectAs: 'system_context',
      isActive: true,
      cacheEnabled: true,
      cacheTtlSec: 300,
      refreshIntervalSec: 300,
      requestCount: 7,
      errorCount: 0,
      lastFetchStatus: 'success',
    },
    select: { id: true },
  })

  await prisma.connectorTopicMapping.create({
    data: {
      connectorId: connector.id,
      topic: 'air_quality',
      priority: 100,
    },
  })
}

async function main() {
  await clearDatabase()
  const users = await createUsers()
  const documents = await createDocuments(users)
  await createSessions(users, documents)
  await createProviders(users)
  await createConnectors()
}

main()
  .catch((error) => {
    console.error('E2E seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
