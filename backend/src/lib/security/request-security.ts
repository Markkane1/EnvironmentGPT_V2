const DEFAULT_DEV_CORS_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
]

const DEFAULT_ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type',
  'X-Request-ID',
]

const DEFAULT_ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']

type SecurityEnv = {
  NODE_ENV?: string
  CORS_ALLOWED_ORIGINS?: string
}

export function getAllowedCorsOrigins(env: SecurityEnv = process.env): string[] {
  const configuredOrigins = env.CORS_ALLOWED_ORIGINS
    ?.split(',')
    .map(origin => origin.trim())
    .filter(Boolean)

  if (configuredOrigins && configuredOrigins.length > 0) {
    return configuredOrigins
  }

  if (env.NODE_ENV !== 'production') {
    return DEFAULT_DEV_CORS_ALLOWED_ORIGINS
  }

  return []
}

export function isAllowedCorsOrigin(origin: string | null, env: SecurityEnv = process.env): boolean {
  if (!origin) {
    return false
  }

  return getAllowedCorsOrigins(env).includes(origin)
}

export function buildCorsHeaders(
  origin: string | null,
  requestedHeaders: string | null,
  env: SecurityEnv = process.env
): Record<string, string> {
  if (!isAllowedCorsOrigin(origin, env) || !origin) {
    return {}
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': DEFAULT_ALLOWED_METHODS.join(', '),
    'Access-Control-Allow-Headers': requestedHeaders || DEFAULT_ALLOWED_HEADERS.join(', '),
    'Access-Control-Max-Age': '86400',
  }
}

export function createRequestId(existingRequestId?: string | null): string {
  const trimmedRequestId = existingRequestId?.trim()

  if (trimmedRequestId) {
    return trimmedRequestId
  }

  return crypto.randomUUID()
}
