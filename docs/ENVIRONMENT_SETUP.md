# EPA Punjab EnvironmentGPT - Environment Setup

## Requirements
- Node.js 20+ recommended
- npm
- PostgreSQL 14+
- Docker Desktop if you want to use the provided compose helpers

## Environment Variables
Copy `.env.example` to `.env.local` and set values appropriate for your machine.

Core values used by the current runtime:

```bash
NODE_ENV=development
PORT=3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/environmentgpt?schema=public
VLLM_BASE_URL=http://localhost:8000/v1
VLLM_FALLBACK_URL=http://localhost:8001/v1
VLLM_FALLBACK2_URL=http://localhost:8002/v1
AQI_API_URL=https://api.waqi.info/feed/punjab/
AQI_API_KEY=replace-with-your-waqi-token
WEATHER_API_URL=https://api.openweathermap.org/data/2.5/weather
WEATHER_API_KEY=replace-with-your-openweather-token
```

Rate-limit values are also defined in `.env.example`.

## Installation
```bash
npm install
npm run db:setup
npm run dev
```

If you are not using the default local PostgreSQL credentials, set `DATABASE_URL` or the `POSTGRES_*` variables before running `npm run db:setup`.

## Useful Commands
```bash
npm run db:push
npm run db:generate
npm run db:seed
npm run db:setup
npm run dev
npm run build
npm run dev:backend
npm run dev:frontend
```

## Structure Notes
- App source lives in `frontend/src/` and `backend/src/`
- Tests live in `tests/`
- Utility scripts live in `scripts/`
- Prisma schema stays in `backend/prisma/schema.prisma`

## Troubleshooting
- Database errors: verify `DATABASE_URL` and make sure PostgreSQL is running
- Build issues: remove `.next/` and reinstall with `npm install`
- Provider or connector issues: confirm env var names match the `apiKeyEnvVar` values configured in the admin UI
