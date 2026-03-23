// =====================================================
// EPA Punjab EnvironmentGPT - Test Configuration
// Phase 8: Testing Utilities and Helpers
// =====================================================

// ==================== Mock Factories ====================

export function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    json: jest.fn(),
    text: jest.fn(),
    headers: new Headers(),
    ...overrides,
  }
}

export function createMockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    getHeader: jest.fn(),
    statusCode: 200,
  }
  return res
}

// ==================== Test Data Generators ====================

export function generateTestDocument(overrides = {}) {
  return {
    id: `doc-${Date.now()}`,
    title: 'Test Document',
    content: 'This is test content for the document.',
    category: 'Air Quality',
    audience: 'General Public',
    tags: ['test', 'document'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function generateTestMessage(overrides = {}) {
  return {
    id: `msg-${Date.now()}`,
    sessionId: `session-${Date.now()}`,
    role: 'user' as const,
    content: 'Test message content',
    createdAt: new Date(),
    ...overrides,
  }
}

export function generateTestSession(overrides = {}) {
  return {
    id: `session-${Date.now()}`,
    title: 'Test Session',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function generateTestEmbedding(dimension: number = 384): number[] {
  return Array.from({ length: dimension }, () => Math.random())
}

// ==================== Assertion Helpers ====================

export function expectValidDocument(doc: any) {
  expect(doc).toBeDefined()
  expect(doc.id).toBeDefined()
  expect(doc.title).toBeDefined()
  expect(doc.content).toBeDefined()
}

export function expectValidMessage(msg: any) {
  expect(msg).toBeDefined()
  expect(msg.id).toBeDefined()
  expect(msg.role).toMatch(/^(user|assistant)$/)
  expect(msg.content).toBeDefined()
}

export function expectValidAPIResponse(response: any, success: boolean = true) {
  expect(response).toBeDefined()
  expect(response.success).toBe(success)
  if (!success) {
    expect(response.error).toBeDefined()
  }
}

// ==================== Wait Helpers ====================

export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function waitForCondition(
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('Condition not met within timeout')
    }
    await waitFor(interval)
  }
}

// ==================== Mock Database Helpers ====================

export function mockDbSuccess(operation: string, result: any) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const db = require('@/lib/db').db
  const parts = operation.split('.')
  let mock = db
  for (let i = 0; i < parts.length - 1; i++) {
    mock = mock[parts[i]]
  }
  mock[parts[parts.length - 1]].mockResolvedValue(result)
}

export function mockDbError(operation: string, error: Error) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const db = require('@/lib/db').db
  const parts = operation.split('.')
  let mock = db
  for (let i = 0; i < parts.length - 1; i++) {
    mock = mock[parts[i]]
  }
  mock[parts[parts.length - 1]].mockRejectedValue(error)
}

// ==================== Test Environment Setup ====================

export function setupTestEnv() {
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/environmentgpt_test?schema=public'
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
}

export function cleanupTestEnv() {
  delete process.env.NODE_ENV
  delete process.env.DATABASE_URL
  delete process.env.NEXT_PUBLIC_APP_URL
}

// ==================== Performance Testing Helpers ====================

export async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now()
  const result = await fn()
  const duration = performance.now() - start
  
  console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`)
  
  return { result, duration }
}

export function createPerformanceThreshold(maxMs: number) {
  return (duration: number) => {
    expect(duration).toBeLessThan(maxMs)
  }
}

// ==================== Snapshot Testing Helpers ====================

export function createSerializableDate(date: Date): string {
  return date.toISOString()
}

export function sanitizeForSnapshot(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (obj instanceof Date) return createSerializableDate(obj)
  if (Array.isArray(obj)) return obj.map(sanitizeForSnapshot)
  if (typeof obj === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeForSnapshot(value)
    }
    return sanitized
  }
  return obj
}
