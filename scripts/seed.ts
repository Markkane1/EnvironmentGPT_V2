// =====================================================
// EPA Punjab EnvironmentGPT - Database Seed Script
// Seeds vLLM providers with fallback chain
// =====================================================

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// vLLM Provider Configuration
// All providers use OpenAI-compatible /v1/chat/completions endpoint
const VLLM_PROVIDERS = [
  {
    name: 'vllm-qwen3-30b',
    displayName: 'Qwen3-30B-A3B (vLLM)',
    providerType: 'openai_compat',
    baseUrl: process.env.VLLM_BASE_URL || 'http://localhost:8000/v1',
    apiKeyEnvVar: null, // No API key needed for local vLLM
    modelId: 'Qwen/Qwen3-30B-A3B',
    defaultParams: {
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 0.9,
      repetition_penalty: 1.05
    },
    role: 'primary',
    priority: 1,
    isActive: true,
    healthStatus: 'unknown'
  },
  {
    name: 'vllm-mistral-small',
    displayName: 'Mistral Small 3.1 (vLLM)',
    providerType: 'openai_compat',
    baseUrl: process.env.VLLM_FALLBACK_URL || process.env.VLLM_BASE_URL || 'http://localhost:8001/v1',
    apiKeyEnvVar: null,
    modelId: 'mistralai/Mistral-Small-3.1-24B-Instruct-2503',
    defaultParams: {
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 0.9
    },
    role: 'fallback_1',
    priority: 2,
    isActive: true,
    healthStatus: 'unknown'
  },
  {
    name: 'vllm-qwen3-8b',
    displayName: 'Qwen3-8B (vLLM)',
    providerType: 'openai_compat',
    baseUrl: process.env.VLLM_FALLBACK2_URL || process.env.VLLM_BASE_URL || 'http://localhost:8002/v1',
    apiKeyEnvVar: null,
    modelId: 'Qwen/Qwen3-8B',
    defaultParams: {
      temperature: 0.7,
      max_tokens: 2048,
      top_p: 0.9
    },
    role: 'fallback_2',
    priority: 3,
    isActive: true,
    healthStatus: 'unknown'
  }
]

// Sample Data Connectors for Punjab environmental data
const DATA_CONNECTORS = [
  {
    name: 'punjab-aqi',
    displayName: 'Punjab Air Quality Index',
    connectorType: 'aqi',
    endpointUrl: process.env.AQI_API_URL || 'https://api.waqi.info/feed/punjab/',
    apiKeyEnvVar: 'AQI_API_KEY',
    authMethod: 'api_key',
    authHeader: 'token',
    requestMethod: 'GET',
    injectAs: 'system_context',
    injectionTemplate: `
## Live Air Quality Data for Punjab
- AQI Value: {{aqi}}
- Dominant Pollutant: {{dominentpol}}
- Location: {{city.name}}
- Last Updated: {{time.s}}

This is real-time air quality data. Use this to inform your response about current air conditions.
`,
    refreshIntervalSec: 300, // 5 minutes
    cacheEnabled: true,
    cacheTtlSec: 300,
    topics: [
      { topic: 'air_quality', priority: 1 },
      { topic: 'general', priority: 10 }
    ]
  },
  {
    name: 'punjab-weather',
    displayName: 'Punjab Weather Data',
    connectorType: 'weather',
    endpointUrl: process.env.WEATHER_API_URL || 'https://api.openweathermap.org/data/2.5/weather',
    apiKeyEnvVar: 'WEATHER_API_KEY',
    authMethod: 'api_key',
    authHeader: 'appid',
    requestMethod: 'GET',
    injectAs: 'system_context',
    injectionTemplate: `
## Current Weather Conditions
- Temperature: {{main.temp}}°C
- Humidity: {{main.humidity}}%
- Conditions: {{weather.0.description}}
- Wind Speed: {{wind.speed}} m/s

Consider weather conditions when discussing air quality or environmental conditions.
`,
    refreshIntervalSec: 1800, // 30 minutes
    cacheEnabled: true,
    cacheTtlSec: 1800,
    topics: [
      { topic: 'climate', priority: 1 },
      { topic: 'air_quality', priority: 5 }
    ]
  }
]

async function main() {
  console.log('🌱 Starting database seed...')
  console.log('')

  // ========================================
  // Seed LLM Providers
  // ========================================
  console.log('📦 Seeding LLM Providers...')

  for (const provider of VLLM_PROVIDERS) {
    const existing = await prisma.lLMProvider.findUnique({
      where: { name: provider.name }
    })

    if (existing) {
      console.log(`  ↻ Updating existing provider: ${provider.displayName}`)
      await prisma.lLMProvider.update({
        where: { name: provider.name },
        data: {
          displayName: provider.displayName,
          baseUrl: provider.baseUrl,
          modelId: provider.modelId,
          defaultParams: JSON.stringify(provider.defaultParams),
          role: provider.role,
          priority: provider.priority,
          isActive: provider.isActive
        }
      })
    } else {
      console.log(`  ✓ Creating provider: ${provider.displayName}`)
      await prisma.lLMProvider.create({
        data: {
          name: provider.name,
          displayName: provider.displayName,
          providerType: provider.providerType,
          baseUrl: provider.baseUrl,
          apiKeyEnvVar: provider.apiKeyEnvVar,
          modelId: provider.modelId,
          defaultParams: JSON.stringify(provider.defaultParams),
          role: provider.role,
          priority: provider.priority,
          isActive: provider.isActive,
          healthStatus: provider.healthStatus
        }
      })
    }
  }

  // ========================================
  // Seed Data Connectors
  // ========================================
  console.log('')
  console.log('🔌 Seeding Data Connectors...')

  for (const connector of DATA_CONNECTORS) {
    const existing = await prisma.dataConnector.findUnique({
      where: { name: connector.name }
    })

    if (existing) {
      console.log(`  ↻ Updating existing connector: ${connector.displayName}`)
      await prisma.dataConnector.update({
        where: { name: connector.name },
        data: {
          displayName: connector.displayName,
          endpointUrl: connector.endpointUrl,
          injectionTemplate: connector.injectionTemplate,
          refreshIntervalSec: connector.refreshIntervalSec,
          cacheTtlSec: connector.cacheTtlSec
        }
      })
    } else {
      console.log(`  ✓ Creating connector: ${connector.displayName}`)
      const created = await prisma.dataConnector.create({
        data: {
          name: connector.name,
          displayName: connector.displayName,
          connectorType: connector.connectorType,
          endpointUrl: connector.endpointUrl,
          apiKeyEnvVar: connector.apiKeyEnvVar,
          authMethod: connector.authMethod,
          authHeader: connector.authHeader,
          requestMethod: connector.requestMethod,
          injectAs: connector.injectAs,
          injectionTemplate: connector.injectionTemplate,
          refreshIntervalSec: connector.refreshIntervalSec,
          cacheEnabled: connector.cacheEnabled,
          cacheTtlSec: connector.cacheTtlSec,
          isActive: true,
          topicMappings: {
            create: connector.topics.map(t => ({
              topic: t.topic,
              priority: t.priority,
              isActive: true
            }))
          }
        }
      })
      console.log(`    └─ Created ${connector.topics.length} topic mappings`)
    }
  }

  // ========================================
  // Summary
  // ========================================
  console.log('')
  console.log('✅ Seed completed!')
  console.log('')

  const providerCount = await prisma.lLMProvider.count()
  const connectorCount = await prisma.dataConnector.count()

  console.log('📊 Summary:')
  console.log(`   LLM Providers: ${providerCount}`)
  console.log(`   Data Connectors: ${connectorCount}`)
  console.log('')

  // Display fallback chain
  const providers = await prisma.lLMProvider.findMany({
    where: { isActive: true },
    orderBy: { priority: 'asc' }
  })

  console.log('🔗 Fallback Chain:')
  for (const p of providers) {
    const roleIcon = p.role === 'primary' ? '⭐' : p.role === 'fallback_1' ? '🔶' : '🔹'
    console.log(`   ${roleIcon} ${p.role.toUpperCase().padEnd(10)}: ${p.displayName}`)
    console.log(`      Model: ${p.modelId}`)
    console.log(`      URL: ${p.baseUrl}`)
  }

  console.log('')
  console.log('⚠️  Configuration Required:')
  console.log('   Set these environment variables for production:')
  console.log('   - VLLM_BASE_URL (default: http://localhost:8000/v1)')
  console.log('   - VLLM_FALLBACK_URL (optional, for fallback 1)')
  console.log('   - VLLM_FALLBACK2_URL (optional, for fallback 2)')
  console.log('   - AQI_API_KEY (for Punjab AQI connector)')
  console.log('   - WEATHER_API_KEY (for weather connector)')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
