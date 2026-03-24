// =====================================================
// EPA Punjab EnvironmentGPT - SSRF Guard
// Blocks requests to private/loopback/link-local
// IP ranges and dangerous URL schemes.
// =====================================================

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  '169.254.169.254',
])

const BLOCKED_IPV4_PREFIXES = [
  '0.',
  '10.',
  '127.',
  '169.254.',
  '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.',
  '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.',
  '192.168.',
  '192.0.2.',
  '198.51.100.',
  '203.0.113.',
  '240.',
]

const BLOCKED_IPV6_PREFIXES = [
  '::1',
  'fc',
  'fd',
  'fe80',
  '::ffff:',
]

const ALLOWED_SCHEMES = new Set(['http:', 'https:'])
const ENV_VAR_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/
const PROVIDER_ALWAYS_BLOCKED_HOSTNAMES = new Set([
  'metadata.google.internal',
  '169.254.169.254',
])
const PRIVATE_PROVIDER_HOSTNAME_SUFFIXES = [
  '.internal',
  '.local',
  '.localhost',
  '.localdomain',
  '.home',
  '.lan',
  '.docker',
  '.test',
]

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '').split('%')[0]
}

function isBlockedIpv4(hostname: string): boolean {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return false
  }

  for (const prefix of BLOCKED_IPV4_PREFIXES) {
    if (hostname.startsWith(prefix)) {
      return true
    }
  }

  return hostname === '255.255.255.255'
}

function isBlockedIpv6(hostname: string): boolean {
  if (hostname.includes('.')) {
    const mappedIpv4 = hostname.split(':').pop()
    return mappedIpv4 ? isBlockedIpv4(mappedIpv4) : false
  }

  for (const prefix of BLOCKED_IPV6_PREFIXES) {
    if (hostname === prefix || hostname.startsWith(prefix)) {
      return true
    }
  }

  return false
}

function isBlockedIpAddress(hostname: string): boolean {
  const normalized = normalizeHost(hostname)
  const family = isIP(normalized)

  if (family === 4) {
    return isBlockedIpv4(normalized)
  }

  if (family === 6) {
    return isBlockedIpv6(normalized)
  }

  return false
}

function allowsPrivateProviderUrls(): boolean {
  return process.env.ALLOW_PRIVATE_PROVIDER_URLS === '1'
}

function isPrivateProviderHostname(hostname: string): boolean {
  const normalized = normalizeHost(hostname)

  if (BLOCKED_HOSTNAMES.has(normalized) || isBlockedIpAddress(normalized)) {
    return true
  }

  if (!normalized.includes('.')) {
    return true
  }

  return PRIVATE_PROVIDER_HOSTNAME_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
}

async function resolveHostname(hostname: string): Promise<string[] | null> {
  const normalized = normalizeHost(hostname)

  if (BLOCKED_HOSTNAMES.has(normalized) || isBlockedIpAddress(normalized)) {
    return [normalized]
  }

  try {
    const records = await lookup(normalized, { all: true, verbatim: true })
    return records.map(record => normalizeHost(record.address))
  } catch {
    return null
  }
}

export async function validateExternalUrl(rawUrl: string): Promise<string | null> {
  let parsed: URL

  try {
    parsed = new URL(rawUrl)
  } catch {
    return 'Invalid URL format.'
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return `URL scheme "${parsed.protocol}" is not allowed. Only http and https are permitted.`
  }

  const hostname = normalizeHost(parsed.hostname)

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return `URL hostname "${hostname}" is not allowed.`
  }

  const resolvedAddresses = await resolveHostname(hostname)

  if (!resolvedAddresses || resolvedAddresses.length === 0) {
    return 'URL hostname could not be resolved.'
  }

  for (const address of resolvedAddresses) {
    if (isBlockedIpAddress(address)) {
      if (isIP(hostname)) {
        return 'URL points to a private or reserved IP address and is not allowed.'
      }

      return `URL hostname resolves to a private or reserved IP address (${address}) and is not allowed.`
    }
  }

  return null
}

export function validateProviderBaseUrl(rawUrl: string): string | null {
  let parsed: URL

  try {
    parsed = new URL(rawUrl)
  } catch {
    return 'Invalid URL format.'
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return `URL scheme "${parsed.protocol}" is not allowed. Only http and https are permitted.`
  }

  const hostname = normalizeHost(parsed.hostname)

  if (PROVIDER_ALWAYS_BLOCKED_HOSTNAMES.has(hostname)) {
    return `URL hostname "${hostname}" is not allowed.`
  }

  if (!allowsPrivateProviderUrls() && isPrivateProviderHostname(hostname)) {
    return `URL hostname "${hostname}" is private or internal and is not allowed.`
  }

  if (parsed.search || parsed.hash) {
    return 'Provider base URLs must not include query strings or fragments.'
  }

  if (parsed.pathname && parsed.pathname !== '/' && parsed.pathname !== '/v1') {
    return 'Provider base URLs must be the server root or /v1 only.'
  }

  return null
}

export function validateEnvVarName(
  envVarName: string | undefined,
  allowedPrefixes: string[]
): string | null {
  if (!envVarName) {
    return null
  }

  if (!ENV_VAR_NAME_PATTERN.test(envVarName)) {
    return 'Environment variable names must be uppercase letters, numbers, and underscores only.'
  }

  if (allowedPrefixes.length > 0 && !allowedPrefixes.some(prefix => envVarName.startsWith(prefix))) {
    return `Environment variable names must start with one of: ${allowedPrefixes.join(', ')}`
  }

  return null
}

export function stripSecretFields<T extends Record<string, unknown>>(record: T): Omit<T, 'apiKeyEnvVar' | 'apiKey'> {
  const safeRecord = { ...record }

  delete safeRecord.apiKeyEnvVar
  delete safeRecord.apiKey

  return safeRecord
}
