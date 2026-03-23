# EnvironmentGPT

EnvironmentGPT is a Next.js workspace for EPA Punjab that combines a frontend knowledge assistant, backend ingestion and retrieval APIs, live data connector administration, and PostgreSQL-backed persistence. Users can upload supported documents, ask environmental questions about Punjab, inspect cited sources, and manage providers, connectors, cache, and system health from the admin UI.

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
- Docker Desktop if you want to use the optional compose helpers
- Playwright browsers for E2E: `npx playwright install`

## Installation
```bash
npm install
copy .env.example .env.local
```

If you are using a local PostgreSQL instance, set `DATABASE_URL` in `.env.local` before running the database scripts.

## Running Locally
Start both apps through the root orchestrator:

```bash
npm run dev
```

Run a single workspace if needed:

```bash
npm run dev:frontend
npm run dev:backend
```

Useful supporting commands:

```bash
npm run build
npm run build:frontend
npm run build:backend
npm run lint
npm run db:init
npm run db:push
npm run db:generate
npm run db:migrate
npm run db:reset
npm run db:seed
npm run db:setup
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
|-- backend/
|   |-- src/
|   |-- prisma/
|   |-- next.config.ts
|   |-- package.json
|   `-- tsconfig.json
|-- frontend/
|   |-- src/
|   |-- public/
|   |-- next.config.ts
|   |-- package.json
|   `-- tsconfig.json
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
|-- .env.example
|-- .gitignore
|-- package.json
`-- tsconfig.json
```

## Environment Variables
See [.env.example](/c:/Users/IS/OneDrive/Desktop/EnvironmentGPT/ZZZ/ENVIRONMENTGPT_V2/.env.example) for the canonical list. The current runtime reads or seeds around these values:

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
- [docs/PROJECT_STRUCTURE.md](/c:/Users/IS/OneDrive/Desktop/EnvironmentGPT/ZZZ/ENVIRONMENTGPT_V2/docs/PROJECT_STRUCTURE.md)
- [docs/ENVIRONMENT_SETUP.md](/c:/Users/IS/OneDrive/Desktop/EnvironmentGPT/ZZZ/ENVIRONMENTGPT_V2/docs/ENVIRONMENT_SETUP.md)
- [docs/USER_GUIDE.md](/c:/Users/IS/OneDrive/Desktop/EnvironmentGPT/ZZZ/ENVIRONMENTGPT_V2/docs/USER_GUIDE.md)
- [docs/VLLM_INTEGRATION_GUIDE.md](/c:/Users/IS/OneDrive/Desktop/EnvironmentGPT/ZZZ/ENVIRONMENTGPT_V2/docs/VLLM_INTEGRATION_GUIDE.md)
- [docs/testing/CODEXTESTING.md](/c:/Users/IS/OneDrive/Desktop/EnvironmentGPT/ZZZ/ENVIRONMENTGPT_V2/docs/testing/CODEXTESTING.md)
- [docs/testing/SECURITY_TESTING.md](/c:/Users/IS/OneDrive/Desktop/EnvironmentGPT/ZZZ/ENVIRONMENTGPT_V2/docs/testing/SECURITY_TESTING.md)
- Deployment and proxy assets live under `infra/`
- [AGENTS.md](/c:/Users/IS/OneDrive/Desktop/EnvironmentGPT/ZZZ/ENVIRONMENTGPT_V2/AGENTS.md)
