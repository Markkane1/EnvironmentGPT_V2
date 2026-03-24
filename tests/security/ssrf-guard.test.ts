jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}))

import { lookup } from 'node:dns/promises'
import {
  stripSecretFields,
  validateEnvVarName,
  validateExternalUrl,
  validateProviderBaseUrl,
} from '@/lib/security/ssrf-guard'

const mockLookup = lookup as jest.Mock

describe('ssrf guard', () => {
  const originalAllowPrivateProviderUrls = process.env.ALLOW_PRIVATE_PROVIDER_URLS

  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.ALLOW_PRIVATE_PROVIDER_URLS
  })

  afterAll(() => {
    if (originalAllowPrivateProviderUrls === undefined) {
      delete process.env.ALLOW_PRIVATE_PROVIDER_URLS
    } else {
      process.env.ALLOW_PRIVATE_PROVIDER_URLS = originalAllowPrivateProviderUrls
    }
  })

  it('rejects non-http schemes', async () => {
    await expect(validateExternalUrl('file:///etc/passwd')).resolves.toContain('not allowed')
  })

  it('rejects hostnames that resolve to private addresses', async () => {
    mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }])

    await expect(validateExternalUrl('https://example.com')).resolves.toContain('private or reserved')
  })

  it('allows public http endpoints', async () => {
    mockLookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }])

    await expect(validateExternalUrl('https://example.com')).resolves.toBeNull()
  })

  it('rejects private and internal provider base URLs by default', () => {
    expect(validateProviderBaseUrl('http://vllm:8000')).toContain('private or internal')
    expect(validateProviderBaseUrl('http://localhost:11434/v1')).toContain('private or internal')
    expect(validateProviderBaseUrl('http://192.168.1.25:11434')).toContain('private or internal')
  })

  it('allows private provider base URLs only when explicitly opted in', () => {
    process.env.ALLOW_PRIVATE_PROVIDER_URLS = '1'

    expect(validateProviderBaseUrl('http://vllm:8000')).toBeNull()
    expect(validateProviderBaseUrl('http://localhost:11434/v1')).toBeNull()
  })

  it('rejects provider base URLs with unsupported paths', () => {
    expect(validateProviderBaseUrl('https://api.openai.com/custom/path')).toContain('server root or /v1 only')
  })

  it('enforces allowed environment variable prefixes', () => {
    expect(validateEnvVarName('PROVIDER_OPENAI_KEY', ['PROVIDER_'])).toBeNull()
    expect(validateEnvVarName('SECRET_OPENAI_KEY', ['PROVIDER_'])).toContain('must start with one of')
    expect(validateEnvVarName('OPENAI_API_KEY', [])).toBeNull()
  })

  it('removes secret fields from API responses', () => {
    expect(stripSecretFields({
      id: 'provider-1',
      name: 'OpenAI',
      apiKeyEnvVar: 'PROVIDER_OPENAI_KEY',
      apiKey: 'secret',
    })).toEqual({
      id: 'provider-1',
      name: 'OpenAI',
    })
  })
})
