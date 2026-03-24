# Bugs Found

## 2026-03-23

- Fixed a frontend/backend Jest resolver break where `next/server` and `next/link` were no longer resolvable across the split workspace test setup.
- Fixed backend build-time type suppression by removing `ignoreBuildErrors` and resolving the underlying TypeScript issues in route middleware, auth role typing, conversation memory, and utility typing.
- Fixed upload handling so file-only uploads no longer fail when `title` is omitted and the title is derived from the sanitized filename.
- Fixed the admin LLM provider route so it no longer rejects intended internal provider endpoints such as `http://vllm:8000` and `http://localhost:11434/v1`.
- Fixed the admin providers API so `GET /api/admin/providers?action=test&id=...` can test a single provider instead of only running the global health check.
- Fixed the admin connectors API so common env var names such as `AQI_API_KEY` and `WEATHER_API_KEY` are accepted instead of being blocked by a hardcoded `CONNECTOR_` prefix requirement.

## 2026-03-24

- Fixed the admin provider and connector panels so initial list-load failures surface a visible error banner instead of being silently overwritten by later stats refreshes.
- Restored root-workspace build reproducibility by pointing frontend workspace scripts at the root Next.js binary, so `npm run build` now succeeds from the repo root.
- Restricted the Playwright admin-auth bypass to non-production localhost requests so a stray `PLAYWRIGHT_TEST=1` no longer disables admin auth on arbitrary hosts.
- Fixed the local Prisma/e2e bootstrap scripts so they derive fallback PostgreSQL credentials from `POSTGRES_*` environment variables instead of hardcoding `postgres:postgres`.
- Updated environment setup docs and `.env.example` so the documented commands and database configuration match the current split-workspace runtime.
- Fixed refresh-token rotation so `/api/auth/refresh` now replaces the stored hashed refresh token and reissues the cookie on every successful refresh.
- Fixed proxy-aware rate limiting so forwarded IP headers are ignored unless `TRUST_PROXY_HEADERS=1` is explicitly enabled.
- Fixed an N+1 lookup in `advanced-rag-service` by batching source document fetches with a single `findMany` query.
- Reduced chat provider failover overhead by removing hot-path preflight health probes from the LLM registry request path.
- Parallelized live connector enrichment and batched ingest reindex embeddings to cut avoidable sequential latency in admin and ingestion flows.
- Restored the missing `reindexDocumentSchema` definition in the ingest route so backend type-checking and production builds pass again.
- Removed fake sidebar controls that had local state but no downstream behavior, including the no-op document selection hook, dead report-series filter, and dead sidebar search field.
- Fixed admin provider and connector dialogs so they disable submission while saves are in flight and no longer allow duplicate form submits.
- Fixed the dashboard and settings surfaces so stats refresh and export failures are visible in the UI instead of being silent or console-only.
- Fixed the settings panel so delayed persisted-store hydration no longer clobbers freshly edited values on mobile/slower renders before save.
- Fixed duplicated frontend backend-URL fallback logic by centralizing it in `frontend/src/lib/runtime-config.ts`.
- Removed the remaining production-service console log in `vector-store-service` and cleared the residual Radix/Next warning noise from the mobile source panel and root layout.
- Removed orphaned frontend components that were no longer imported anywhere in the app (`advanced-search.tsx` and the unused shadcn `ui/sidebar.tsx` scaffold).
