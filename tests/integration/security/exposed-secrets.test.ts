import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import { POST as loginPost } from '@/app/api/auth/login/route'
import { GET as getUsers, POST as postUsers } from '@/app/api/users/route'
import { db } from '@/lib/db'
import { createAuthHeaders } from '../../helpers/auth'

jest.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
    },
  },
}))

const mockDb = db as {
  user: {
    findUnique: jest.Mock
    findMany: jest.Mock
    create: jest.Mock
  }
  refreshToken: {
    create: jest.Mock
  }
}

const SECRET_PATTERNS: RegExp[] = [
  /sk-(?:live|test|proj)-[A-Za-z0-9_-]{10,}/,
  /AKIA[0-9A-Z]{16}/,
  /AIza[0-9A-Za-z\-_]{20,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
  /BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY/,
]

const TEXT_FILE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yml', '.yaml', '.mjs', '.cjs', '.txt', '.toml'
])

function walkFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolvedPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      if (new Set(['.git', '.next', 'node_modules', 'coverage', 'dist', 'build', 'out', 'playwright-report', 'test-results']).has(entry.name)) {
        return []
      }

      return walkFiles(resolvedPath)
    }

    if (entry.isFile() && (TEXT_FILE_EXTENSIONS.has(path.extname(entry.name)) || entry.name === '.gitignore')) {
      return [resolvedPath]
    }

    return []
  })
}

function adminRequest(url: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers)

  for (const [key, value] of Object.entries(createAuthHeaders('admin', 'admin-user'))) {
    headers.set(key, value)
  }

  return new Request(url, {
    ...init,
    headers,
  })
}

function adminJsonRequest(url: string, method: string, body: unknown): Request {
  return adminRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('security: exposed secrets and sensitive response data', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('keeps env files ignored and does not commit high-confidence secret literals in tracked text files', () => {
    const repoRoot = process.cwd()
    const gitignore = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8')
    const sourceFiles = walkFiles(repoRoot)

    expect(gitignore).toContain('.env')

    const matches = sourceFiles.flatMap((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8')
      const matchedPattern = SECRET_PATTERNS.find((pattern) => pattern.test(content))

      return matchedPattern ? [`${path.relative(repoRoot, filePath)}:${matchedPattern.source}`] : []
    })

    expect(matches).toEqual([])
  })

  it('does not expose password hashes or refresh token internals in login responses', async () => {
    const passwordHash = await bcrypt.hash('TestPass123!', 4)

    mockDb.user.findUnique.mockResolvedValue({
      id: 'user-1',
      username: 'admin',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
      isActive: true,
      passwordHash,
    } as never)

    const response = await loginPost(jsonRequest('http://localhost/api/auth/login', {
      username: 'admin',
      password: 'TestPass123!',
    }) as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.user).toEqual({
      id: 'user-1',
      username: 'admin',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
    })
    expect(payload.user.passwordHash).toBeUndefined()
    expect(payload.refreshToken).toBeUndefined()
    expect(payload.hashedToken).toBeUndefined()
    expect(JSON.stringify(payload)).not.toContain(passwordHash)
    expect(response.headers.get('set-cookie')).not.toContain('hashedToken')
  })

  it('does not expose password hashes in admin user listing or user creation responses', async () => {
    mockDb.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        email: 'admin@example.com',
        username: 'admin',
        name: 'Admin User',
        role: 'admin',
        department: 'Operations',
        isActive: true,
        createdAt: new Date('2026-03-24T00:00:00.000Z'),
        _count: {
          chatSessions: 1,
          feedback: 2,
        },
      },
    ] as never)
    mockDb.user.findUnique
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(null as never)
    mockDb.user.create.mockResolvedValue({
      id: 'user-2',
      email: 'viewer@example.com',
      username: 'viewer',
      name: 'Viewer User',
      role: 'viewer',
      department: 'Air Quality',
      isActive: true,
      createdAt: new Date('2026-03-24T00:00:00.000Z'),
      passwordHash: 'should-not-leak',
    } as never)

    const listResponse = await getUsers(adminRequest('http://localhost/api/users'))
    const listPayload = await listResponse.json()
    const createResponse = await postUsers(adminJsonRequest('http://localhost/api/users', 'POST', {
      email: 'viewer@example.com',
      username: 'viewer',
      password: 'TestPass123!',
      name: 'Viewer User',
      role: 'viewer',
      department: 'Air Quality',
    }))
    const createPayload = await createResponse.json()

    expect(listResponse.status).toBe(200)
    expect(listPayload.users[0].passwordHash).toBeUndefined()
    expect(listPayload.users[0].hashedToken).toBeUndefined()
    expect(createResponse.status).toBe(201)
    expect(createPayload.user.passwordHash).toBeUndefined()
    expect(createPayload.user.hashedToken).toBeUndefined()
    expect(mockDb.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        passwordHash: expect.any(String),
      }),
    })
  })
})
