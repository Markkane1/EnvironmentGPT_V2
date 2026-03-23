jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}))

import { lookup } from 'node:dns/promises'
import {
  stripSecretFields,
  validateEnvVarName,
  validateExternalUrl,
} from '@/lib/security/ssrf-guard'

const mockLookup = lookup as jest.Mock

describe('ssrf guard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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

  it('enforces allowed environment variable prefixes', () => {
    expect(validateEnvVarName('PROVIDER_OPENAI_KEY', ['PROVIDER_'])).toBeNull()
    expect(validateEnvVarName('SECRET_OPENAI_KEY', ['PROVIDER_'])).toContain('must start with one of')
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
