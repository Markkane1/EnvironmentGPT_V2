# EnvironmentGPT

EnvironmentGPT is a Next.js application for EPA Punjab that combines document ingestion, retrieval-augmented chat, provider-managed LLM routing, live connector enrichment, and admin monitoring. Users can upload supported documents into the knowledge base, ask environmental questions about Punjab, inspect sources, and manage providers, connectors, cache, and system health from the admin UI.

## Tech Stack
- Next.js 16 with React 19
- TypeScript
- Prisma
- PostgreSQL
- Zustand
- Jest + Testing Library
- Playwright

## Prerequisites
- Node.js 20 or newer recommended
- npm
- PostgreSQL 14+ available locally or remotely
- Docker Desktop if you want to use `docker compose` helpers
- Playwright browsers installed for E2E: `npx playwright install`

## Installation
```bash
npm install
copy .env.example .env.local
npm run db:up
npm run db:push
npm run db:seed
```

If you do not want to use Docker for PostgreSQL, set `DATABASE_URL` in `.env.local` to a running PostgreSQL instance before `npm run db:push`.

## Running Locally
Start the app:

```bash
npm run dev
```

Useful supporting commands:

```bash
npm run db:up
npm run db:down
npm run db:push
npm run db:generate
npm run db:seed
npm run db:setup
npm run build
npm run start
```

## Running Tests
Jest subsets:

```bash
npm run test:unit -- --runInBand
npm run test:integration -- --runInBand
npm run test:components -- --runInBand
npm run test:security -- --runInBand
```

Playwright:

```bash
npm run test:e2e
```

Full Jest suite:

```bash
npm test -- --runInBand
```

## Folder Structure
```text
.
|-- src/
|   |-- app/
|   |-- components/
|   |-- hooks/
|   |-- lib/
|   `-- types/
|-- tests/
|   |-- unit/
|   |-- integration/
|   |-- components/
|   |-- e2e/
|   |-- security/
|   |-- config/
|   |-- helpers/
|   `-- fixtures/
|-- docs/
|-- infra/
|-- scripts/
|-- prisma/
`-- public/
```

## Environment Variables
See [.env.example](/c:/Users/IS/OneDrive/Desktop/EnvironmentGPT/ZZZ/EnvironmentGPT_vLLM_Updated/.env.example) for the canonical list. The current runtime reads or seeds around these values:

- `NODE_ENV`
- `PORT`
- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
- `VLLM_BASE_URL`
- `VLLM_FALLBACK_URL`
- `VLLM_FALLBACK2_URL`
- `AQI_API_URL`
- `AQI_API_KEY`
- `WEATHER_API_URL`
- `WEATHER_API_KEY`
- `RATE_LIMIT_WINDOW`
- `RATE_LIMIT_MAX`
- `RATE_LIMIT_BLOCK_DURATION`
- `RATE_LIMIT_CHAT_WINDOW`
- `RATE_LIMIT_CHAT_MAX`
- `RATE_LIMIT_CHAT_BLOCK_DURATION`
- `RATE_LIMIT_UPLOAD_WINDOW`
- `RATE_LIMIT_UPLOAD_MAX`
- `RATE_LIMIT_UPLOAD_BLOCK_DURATION`
- `RATE_LIMIT_AUTH_WINDOW`
- `RATE_LIMIT_AUTH_MAX`
- `RATE_LIMIT_AUTH_BLOCK_DURATION`

## Supported Document Uploads
- `.pdf`
- `.doc`
- `.docx`
- `.md`
- `.markdown`
- `.txt`

## Further Documentation
- [docs/PROJECT_STRUCTURE.md](/c:/Users/IS/OneDrive/Desktop/EnvironmentGPT/ZZZ/EnvironmentGPT_vLLM_Updated/docs/PROJECT_STRUCTURE.md)
- [docs/ENVIRONMENT_SETUP.md](/c:/Users/IS/OneDrive/Desktop/EnvironmentGPT/ZZZ/EnvironmentGPT_vLLM_Updated/docs/ENVIRONMENT_SETUP.md)
- [docs/USER_GUIDE.md](/c:/Users/IS/OneDrive/Desktop/EnvironmentGPT/ZZZ/EnvironmentGPT_vLLM_Updated/docs/USER_GUIDE.md)
- [docs/VLLM_INTEGRATION_GUIDE.md](/c:/Users/IS/OneDrive/Desktop/EnvironmentGPT/ZZZ/EnvironmentGPT_vLLM_Updated/docs/VLLM_INTEGRATION_GUIDE.md)
- Deployment and proxy assets live under `infra/`
- [AGENTS.md](/c:/Users/IS/OneDrive/Desktop/EnvironmentGPT/ZZZ/EnvironmentGPT_vLLM_Updated/AGENTS.md)
- [CODEXTESTING.md](/c:/Users/IS/OneDrive/Desktop/EnvironmentGPT/ZZZ/EnvironmentGPT_vLLM_Updated/docs/testing/CODEXTESTING.md)
- [SECURITY_TESTING.md](/c:/Users/IS/OneDrive/Desktop/EnvironmentGPT/ZZZ/EnvironmentGPT_vLLM_Updated/docs/testing/SECURITY_TESTING.md)
