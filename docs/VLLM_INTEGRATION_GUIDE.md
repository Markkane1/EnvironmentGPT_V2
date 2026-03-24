# vLLM Integration Guide for EnvironmentGPT

This guide explains how to set up and configure vLLM with EnvironmentGPT for the dynamic LLM provider system.

## Architecture Overview

EnvironmentGPT uses a **dynamic LLM provider registry** with automatic fallback:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   User Query    │────▶│   LLM Router     │────▶│  Data Connectors │
└─────────────────┘     │                  │     │  (AQI, Weather)  │
                        │  ┌───────────┐   │     └─────────────────┘
                        │  │ Primary   │   │              │
                        │  │ Qwen3-30B │   │              ▼
                        │  └─────┬─────┘   │     ┌─────────────────┐
                        │        │ Fallback │     │ Context Builder │
                        │        ▼         │     └─────────────────┘
                        │  ┌───────────┐   │              │
                        │  │ Fallback 1│   │              ▼
                        │  │ Mistral   │   │     ┌─────────────────┐
                        │  └─────┬─────┘   │     │  LLM Generation │
                        │        │ Fallback │     └─────────────────┘
                        │        ▼         │
                        │  ┌───────────┐   │
                        │  │ Fallback 2│   │
                        │  │ Qwen3-8B  │   │
                        │  └───────────┘   │
                        └──────────────────┘
```

## Default Provider Configuration

| Role | Model | Purpose |
|------|-------|---------|
| Primary | Qwen3-30B-A3B | Default for all queries - high quality responses |
| Fallback 1 | Mistral Small 3.1 | Backup when primary unavailable |
| Fallback 2 | Qwen3-8B | Final fallback - faster, smaller model |

All providers use the OpenAI-compatible `/v1/chat/completions` API endpoint.

## Quick Start

### 1. Start vLLM Server(s)

```bash
# Primary: Qwen3-30B-A3B (port 8000)
vllm serve Qwen/Qwen3-30B-A3B \
  --port 8000 \
  --host 0.0.0.0 \
  --tensor-parallel-size 2 \
  --gpu-memory-utilization 0.9

# Fallback 1: Mistral Small 3.1 (port 8001)
vllm serve mistralai/Mistral-Small-3.1-24B-Instruct-2503 \
  --port 8001 \
  --host 0.0.0.0 \
  --gpu-memory-utilization 0.8

# Fallback 2: Qwen3-8B (port 8002)
vllm serve Qwen/Qwen3-8B \
  --port 8002 \
  --host 0.0.0.0
```

### 2. Configure Environment Variables

Create or update your `.env` file:

```env
# vLLM Server URLs
VLLM_BASE_URL=http://localhost:8000/v1
VLLM_FALLBACK_URL=http://localhost:8001/v1
VLLM_FALLBACK2_URL=http://localhost:8002/v1

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/environmentgpt?schema=public"

# Optional: External API keys for data connectors
AQI_API_KEY=your_aqi_api_key
WEATHER_API_KEY=your_openweather_api_key
```

### 3. Initialize Database

```bash
# Run database setup with seed
npm run db:setup

# Or run individual commands:
npx prisma generate
npx prisma db push
npm run db:seed
```

### 4. Start EnvironmentGPT

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm run start
```

## Admin Panel Configuration

Access the Admin Panel at `/admin` to:

1. **View Provider Status**
   - See health status of all providers
   - Monitor request counts and latency
   - View fallback chain configuration

2. **Manage Providers**
   - Add new OpenAI-compatible providers
   - Change provider roles (primary/fallback)
   - Activate/deactivate providers
   - Update base URLs and model IDs

3. **Configure Data Connectors**
   - Add live data sources (AQI, weather, water quality)
   - Set up topic-based triggering
   - Configure cache settings

## API Endpoints

### Provider Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/providers` | List all providers |
| GET | `/api/admin/providers?action=stats` | Get provider statistics |
| GET | `/api/admin/providers?action=health` | Run health check |
| GET | `/api/admin/providers?action=chain` | Get fallback chain |
| POST | `/api/admin/providers` | Add new provider |
| PUT | `/api/admin/providers` | Update provider |
| DELETE | `/api/admin/providers?id=xxx` | Delete provider |

### Connector Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/connectors` | List all connectors |
| POST | `/api/admin/connectors` | Add new connector |
| PUT | `/api/admin/connectors` | Update connector |
| DELETE | `/api/admin/connectors?id=xxx` | Delete connector |

## Example: Adding a New Provider

### Via API

```bash
curl -X POST http://localhost:3000/api/admin/providers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "deepseek-chat",
    "displayName": "DeepSeek Chat",
    "providerType": "openai_compat",
    "baseUrl": "https://api.deepseek.com/v1",
    "apiKeyEnvVar": "DEEPSEEK_API_KEY",
    "modelId": "deepseek-chat",
    "role": "available",
    "priority": 100
  }'
```

### Via Admin Panel

1. Go to `/admin`
2. Navigate to "Providers" tab
3. Click "Add Provider"
4. Fill in the configuration
5. Set the API key in your `.env` file: `DEEPSEEK_API_KEY=your_key`

## Fallback Chain Behavior

When a request fails, the system automatically tries the next provider:

```
Primary (Qwen3-30B) → Fallback 1 (Mistral) → Fallback 2 (Qwen3-8B) → Available providers
```

Failure conditions that trigger fallback:
- HTTP 5xx errors from vLLM server
- Connection timeout (> 60 seconds)
- Invalid response format
- Rate limiting (HTTP 429)

## Monitoring and Logs

### Check Provider Health

```bash
curl http://localhost:3000/api/admin/providers?action=health
```

### View Pipeline Statistics

```bash
curl http://localhost:3000/api/admin/pipeline
```

### LLM Request Logs

All LLM requests are logged in the `LLMRequestLog` table with:
- Provider used
- Model used
- Latency
- Success/failure status
- Fallback chain (if fallback occurred)

## Production Deployment

### Docker Compose

```yaml
version: '3.8'
services:
  vllm-primary:
    image: vllm/vllm-openai:latest
    ports:
      - "8000:8000"
    environment:
      - MODEL_NAME=Qwen/Qwen3-30B-A3B
    command: >
      --host 0.0.0.0
      --port 8000
      --tensor-parallel-size 2
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 2
              capabilities: [gpu]

  vllm-fallback:
    image: vllm/vllm-openai:latest
    ports:
      - "8001:8000"
    environment:
      - MODEL_NAME=mistralai/Mistral-Small-3.1-24B-Instruct-2503
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  environmentgpt:
    build: .
    ports:
      - "3000:3000"
    environment:
      - VLLM_BASE_URL=http://vllm-primary:8000/v1
      - VLLM_FALLBACK_URL=http://vllm-fallback:8000/v1
    depends_on:
      - vllm-primary
      - vllm-fallback
```

### Kubernetes

See `infra/kubernetes/deployment.yml` for complete Kubernetes configuration.

## Troubleshooting

### Provider Shows as "Unhealthy"

1. Check vLLM server is running: `curl http://localhost:8000/v1/models`
2. Check logs for errors
3. Verify GPU memory is sufficient
4. Run health check from admin panel

### "No active LLM providers configured"

Run the seed script:
```bash
npm run db:seed
```

### Fallback Chain Not Working

1. Check provider roles in database
2. Verify `isActive` is true for all providers
3. Check `healthStatus` - unhealthy providers are skipped

### High Latency

1. Check GPU utilization
2. Consider reducing `max_tokens` in provider config
3. Enable response caching
4. Use smaller model as primary

## Model Specifications

| Model | Parameters | Context Length | Recommended GPU |
|-------|------------|----------------|-----------------|
| Qwen3-30B-A3B | 30B (A3B) | 32K | 2x A100 80GB |
| Mistral Small 3.1 | 24B | 128K | 1x A100 80GB |
| Qwen3-8B | 8B | 32K | 1x RTX 4090 |

## Support

For issues and feature requests, contact EPA Punjab IT team or create an issue in the project repository.
