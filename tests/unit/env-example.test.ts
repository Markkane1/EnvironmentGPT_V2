import fs from 'fs'
import path from 'path'

describe('.env.example', () => {
  it('only lists environment variables that are referenced by the app or deployment tooling', () => {
    const envExamplePath = path.resolve(process.cwd(), '.env.example')
    const contents = fs.readFileSync(envExamplePath, 'utf8')

    const listedVariables = contents
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split('=')[0])

    const referencedVariables = new Set([
      'NODE_ENV',
      'PORT',
      'NEXT_PUBLIC_APP_URL',
      'DATABASE_URL',
      'VLLM_BASE_URL',
      'VLLM_FALLBACK_URL',
      'VLLM_FALLBACK2_URL',
      'AQI_API_URL',
      'AQI_API_KEY',
      'WEATHER_API_URL',
      'WEATHER_API_KEY',
      'RATE_LIMIT_WINDOW',
      'RATE_LIMIT_MAX',
      'RATE_LIMIT_BLOCK_DURATION',
      'RATE_LIMIT_CHAT_WINDOW',
      'RATE_LIMIT_CHAT_MAX',
      'RATE_LIMIT_CHAT_BLOCK_DURATION',
      'RATE_LIMIT_UPLOAD_WINDOW',
      'RATE_LIMIT_UPLOAD_MAX',
      'RATE_LIMIT_UPLOAD_BLOCK_DURATION',
      'RATE_LIMIT_AUTH_WINDOW',
      'RATE_LIMIT_AUTH_MAX',
      'RATE_LIMIT_AUTH_BLOCK_DURATION',
    ])

    expect(listedVariables.every((variable) => referencedVariables.has(variable))).toBe(true)
  })
})
