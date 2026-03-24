# PROJECT_STRUCTURE.md

Audit date: 2026-03-24

This workspace is split into `frontend/` and `backend/`, with shared test infrastructure in `tests/`, deployment assets in `infra/`, and one-off utilities in `scripts/`. Generated and local database artifacts may exist locally but should be treated as non-source output.

## 0. POST-AUDIT UPDATES

- Added CI automation under `.github/workflows/ci.yml`.
- Added frontend auth/runtime support modules:
  - `frontend/src/app/api/auth/logout/route.ts`
  - `frontend/src/lib/api-errors.ts`
  - `frontend/src/lib/runtime-config.ts`
- Expanded test surfaces with:
  - `tests/integration/performance/`
  - `tests/integration/security/`
  - new component coverage in `tests/components/*.test.ts[x]`
  - new e2e coverage in `tests/e2e/auth.spec.ts`, `tests/e2e/settings.spec.ts`, `tests/e2e/vibecode.spec.ts`, and `tests/e2e/seed.ts`
  - new backend/model coverage in `tests/unit/models/` and additional `tests/unit/*.test.ts`
- Removed retired files:
  - `frontend/src/components/documents/advanced-search.tsx`
  - `frontend/src/components/ui/sidebar.tsx`
  - `tests/e2e/accessibility.spec.ts`
  - `tests/e2e/performance.spec.ts`

## 1. FULL FILE INVENTORY

### source

- `backend/src/app/`
- `backend/src/app/api/`
- `backend/src/app/api/admin/`
- `backend/src/app/api/admin/connectors/`
- `backend/src/app/api/admin/health/`
- `backend/src/app/api/admin/health/full/`
- `backend/src/app/api/admin/pipeline/`
- `backend/src/app/api/admin/providers/`
- `backend/src/app/api/cache/`
- `backend/src/app/api/chat/`
- `backend/src/app/api/documents/`
- `backend/src/app/api/export/`
- `backend/src/app/api/feedback/`
- `backend/src/app/api/health/`
- `backend/src/app/api/ingest/`
- `backend/src/app/api/metrics/`
- `backend/src/app/api/query/`
- `backend/src/app/api/sessions/`
- `backend/src/app/api/stats/`
- `backend/src/app/api/upload/`
- `backend/src/middleware/`
- `backend/src/app/api/users/`
- `backend/src/lib/`
- `backend/src/lib/constants/`
- `backend/src/lib/monitoring/`
- `backend/src/lib/security/`
- `backend/src/lib/services/`
- `backend/src/lib/utils/`
- `backend/src/lib/validators/`
- `backend/src/types/`
- `backend/src/app/api/route.ts`
- `backend/src/app/api/auth/login/route.ts`
- `backend/src/app/api/auth/logout/route.ts`
- `backend/src/app/api/auth/refresh/route.ts`
- `backend/src/app/api/admin/connectors/route.ts`
- `backend/src/app/api/admin/health/full/route.ts`
- `backend/src/app/api/admin/pipeline/route.ts`
- `backend/src/app/api/admin/providers/route.ts`
- `backend/src/app/api/cache/route.ts`
- `backend/src/app/api/chat/route.ts`
- `backend/src/app/api/documents/route.ts`
- `backend/src/app/api/export/route.ts`
- `backend/src/app/api/feedback/route.ts`
- `backend/src/app/api/health/route.ts`
- `backend/src/app/api/ingest/route.ts`
- `backend/src/app/api/metrics/route.ts`
- `backend/src/app/api/query/route.ts`
- `backend/src/app/api/sessions/route.ts`
- `backend/src/app/api/stats/route.ts`
- `backend/src/app/api/upload/route.ts`
- `backend/src/app/api/users/route.ts`
- `backend/src/middleware/auth.ts`
- `backend/src/lib/db.ts`
- `backend/src/lib/route-middleware.ts`
- `backend/src/lib/constants/index.ts`
- `backend/src/lib/monitoring/health.ts`
- `backend/src/lib/monitoring/health-response.ts`
- `backend/src/lib/security/rate-limiter.ts`
- `backend/src/lib/services/advanced-embedding-service.ts`
- `backend/src/lib/services/advanced-rag-service.ts`
- `backend/src/lib/services/chat-service.ts`
- `backend/src/lib/services/conversation-memory.ts`
- `backend/src/lib/services/data-connector-service.ts`
- `backend/src/lib/services/document-ingestion-service.ts`
- `backend/src/lib/services/document-service.ts`
- `backend/src/lib/services/embedding-service.ts`
- `backend/src/lib/services/index.ts`
- `backend/src/lib/services/llm-provider-registry.ts`
- `backend/src/lib/services/llm-router-service.ts`
- `backend/src/lib/services/prompt-template-service.ts`
- `backend/src/lib/services/query-processor.ts`
- `backend/src/lib/services/rag-service.ts`
- `backend/src/lib/services/response-cache.ts`
- `backend/src/lib/services/vector-store-service.ts`
- `backend/src/lib/utils/document-extraction.ts`
- `backend/src/lib/utils/document-upload.ts`
- `backend/src/lib/utils/document-utils.ts`
- `backend/src/lib/utils/index.ts`
- `backend/src/lib/validators/index.ts`
- `backend/src/types/index.ts`
- `frontend/src/app/`
- `frontend/src/app/403/`
- `frontend/src/app/api/`
- `frontend/src/app/api/auth/`
- `frontend/src/app/api/auth/login/`
- `frontend/src/app/api/auth/session/`
- `frontend/src/app/admin/`
- `frontend/src/app/login/`
- `frontend/src/app/settings/`
- `frontend/src/components/`
- `frontend/src/components/admin/`
- `frontend/src/components/chat/`
- `frontend/src/components/documents/`
- `frontend/src/components/settings/`
- `frontend/src/components/ui/`
- `frontend/src/hooks/`
- `frontend/src/lib/`
- `frontend/src/lib/constants/`
- `frontend/src/lib/i18n/`
- `frontend/src/lib/utils.ts`
- `frontend/src/lib/app-settings.ts`
- `frontend/src/lib/store.ts`
- `frontend/src/types/`
- `frontend/src/app/layout.tsx`
- `frontend/src/app/page.tsx`
- `frontend/src/app/403/page.tsx`
- `frontend/src/app/admin/page.tsx`
- `frontend/src/app/api/auth/login/route.ts`
- `frontend/src/app/api/auth/session/route.ts`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/settings/page.tsx`
- `frontend/src/app/globals.css`
- `frontend/src/lib/auth.ts`
- `frontend/src/middleware.ts`
- `frontend/src/components/admin/connectors-settings-panel.tsx`
- `frontend/src/components/admin/enhanced-dashboard.tsx`
- `frontend/src/components/admin/providers-settings-panel.tsx`
- `frontend/src/components/chat/enhanced-chat-interface.tsx`
- `frontend/src/components/chat/sidebar.tsx`
- `frontend/src/components/chat/source-panel.tsx`
- `frontend/src/components/documents/advanced-search.tsx`
- `frontend/src/components/documents/document-list.tsx`
- `frontend/src/components/documents/document-upload-modal.tsx`
- `frontend/src/components/settings/app-settings-provider.tsx`
- `frontend/src/components/settings/settings-panel.tsx`
- `frontend/src/components/ui/accordion.tsx`
- `frontend/src/components/ui/alert-dialog.tsx`
- `frontend/src/components/ui/alert.tsx`
- `frontend/src/components/ui/aspect-ratio.tsx`
- `frontend/src/components/ui/avatar.tsx`
- `frontend/src/components/ui/badge.tsx`
- `frontend/src/components/ui/breadcrumb.tsx`
- `frontend/src/components/ui/button.tsx`
- `frontend/src/components/ui/calendar.tsx`
- `frontend/src/components/ui/card.tsx`
- `frontend/src/components/ui/carousel.tsx`
- `frontend/src/components/ui/chart.tsx`
- `frontend/src/components/ui/checkbox.tsx`
- `frontend/src/components/ui/collapsible.tsx`
- `frontend/src/components/ui/command.tsx`
- `frontend/src/components/ui/context-menu.tsx`
- `frontend/src/components/ui/dialog.tsx`
- `frontend/src/components/ui/drawer.tsx`
- `frontend/src/components/ui/dropdown-menu.tsx`
- `frontend/src/components/ui/form.tsx`
- `frontend/src/components/ui/hover-card.tsx`
- `frontend/src/components/ui/input-otp.tsx`
- `frontend/src/components/ui/input.tsx`
- `frontend/src/components/ui/label.tsx`
- `frontend/src/components/ui/menubar.tsx`
- `frontend/src/components/ui/navigation-menu.tsx`
- `frontend/src/components/ui/pagination.tsx`
- `frontend/src/components/ui/popover.tsx`
- `frontend/src/components/ui/progress.tsx`
- `frontend/src/components/ui/radio-group.tsx`
- `frontend/src/components/ui/resizable.tsx`
- `frontend/src/components/ui/scroll-area.tsx`
- `frontend/src/components/ui/select.tsx`
- `frontend/src/components/ui/separator.tsx`
- `frontend/src/components/ui/sheet.tsx`
- `frontend/src/components/ui/sidebar.tsx`
- `frontend/src/components/ui/simple-markdown.tsx`
- `frontend/src/components/ui/skeleton.tsx`
- `frontend/src/components/ui/slider.tsx`
- `frontend/src/components/ui/sonner.tsx`
- `frontend/src/components/ui/switch.tsx`
- `frontend/src/components/ui/table.tsx`
- `frontend/src/components/ui/tabs.tsx`
- `frontend/src/components/ui/textarea.tsx`
- `frontend/src/components/ui/toast.tsx`
- `frontend/src/components/ui/toaster.tsx`
- `frontend/src/components/ui/toggle-group.tsx`
- `frontend/src/components/ui/toggle.tsx`
- `frontend/src/components/ui/tooltip.tsx`
- `frontend/src/hooks/use-mobile.ts`
- `frontend/src/hooks/use-toast.ts`
- `frontend/src/lib/constants/index.ts`
- `frontend/src/lib/i18n/translations.ts`
- `frontend/src/lib/utils.ts`
- `frontend/src/lib/app-settings.ts`
- `frontend/src/lib/store.ts`
- `frontend/src/types/index.ts`

### test

- `tests/components/`
- `tests/config/`
- `tests/e2e/`
- `tests/fixtures/`
- `tests/helpers/`
- `tests/integration/`
- `tests/security/`
- `tests/unit/`
- `tests/components/admin-dashboard.test.tsx`
- `tests/components/chat-regressions.test.tsx`
- `tests/components/home-page.test.tsx`
- `tests/components/page-wrappers.test.tsx`
- `tests/components/settings-pages.test.tsx`
- `tests/components/source-panel-contract.test.tsx`
- `tests/config/jest.backend.config.ts`
- `tests/config/jest.config.ts`
- `tests/config/jest.frontend.config.ts`
- `tests/config/jest.setup.ts`
- `tests/config/playwright.config.ts`
- `tests/e2e/accessibility.spec.ts`
- `tests/e2e/admin.spec.ts`
- `tests/e2e/chat.spec.ts`
- `tests/e2e/performance.spec.ts`
- `tests/e2e/test-helpers.ts`
- `tests/fixtures/index.ts`
- `tests/helpers/index.ts`
- `tests/helpers/auth.ts`
- `tests/integration/admin-api-routes.test.ts`
- `tests/integration/admin-connectors-route.test.ts`
- `tests/integration/auth-login-route.test.ts`
- `tests/integration/auth-refresh-route.test.ts`
- `tests/integration/documents-route-contract.test.ts`
- `tests/integration/health-route-contract.test.ts`
- `tests/integration/infra-route.test.ts`
- `tests/integration/ingest-route.test.ts`
- `tests/integration/public-api-routes.test.ts`
- `tests/integration/stats-route-contract.test.ts`
- `tests/integration/upload-route.test.ts`
- `tests/security/rate-limiter.test.ts`
- `tests/unit/advanced-rag-service.test.ts`
- `tests/unit/conversation-memory.test.ts`
- `tests/unit/document-service.test.ts`
- `tests/unit/document-upload.test.ts`
- `tests/unit/embedding-service-basic.test.ts`
- `tests/unit/embedding-service.test.ts`
- `tests/unit/env-example.test.ts`
- `tests/unit/llm-provider-registry.test.ts`
- `tests/unit/llm-router-service.test.ts`
- `tests/unit/prompt-template.test.ts`
- `tests/unit/query-processor.test.ts`
- `tests/unit/response-cache.test.ts`

### config

- `.env`
- `.env.example`
- `.env.local`
- `.gitignore`
- `components.json`
- `docker-compose.prod.yml`
- `docker-compose.yml`
- `Dockerfile.backend`
- `Dockerfile.frontend`
- `eslint.config.mjs`
- `package.json`
- `package-lock.json`
- `README.md`
- `backend/package.json`
- `backend/.env.example`
- `backend/.gitignore`
- `backend/next.config.ts`
- `backend/next-env.d.ts`
- `backend/tsconfig.json`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260323120000_add_refresh_tokens/migration.sql`
- `frontend/package.json`
- `frontend/next.config.ts`
- `frontend/next-env.d.ts`
- `frontend/postcss.config.mjs`
- `frontend/tailwind.config.ts`
- `frontend/tsconfig.json`
- `next-env.d.ts`
- `tsconfig.json`

### docs

- `docs/ENVIRONMENT_SETUP.md`
- `docs/GAP_AUDIT.md`
- `docs/PROJECT_STRUCTURE.md`
- `docs/USER_GUIDE.md`
- `docs/VLLM_INTEGRATION_GUIDE.md`
- `docs/worklog.md`
- `docs/testing/CODEXTESTING.md`
- `docs/testing/SECURITY_TESTING.md`

### generated

- `.next/`
- `node_modules/`
- `tsconfig.tsbuildinfo`

### scripts

- `scripts/clean.cjs`
- `scripts/deploy.sh`
- `scripts/dev.cjs`
- `scripts/docker-entrypoint.sh`
- `scripts/ensure-prisma-db.cjs`
- `scripts/generate_admin_guide.py`
- `scripts/generate_api_docs.py`
- `scripts/generate_user_guide.py`
- `scripts/seed.ts`
- `scripts/start-e2e-server.cjs`

### unknown

- `backend/prisma/`
- `frontend/public/`
- `frontend/public/logo.svg`
- `frontend/public/robots.txt`
- `infra/`

## 2. PROBLEMS FOUND

### Duplicate or near-duplicate files

- `backend/src/lib/services/embedding-service.ts` and `backend/src/lib/services/advanced-embedding-service.ts`
- `backend/src/lib/services/rag-service.ts` and `backend/src/lib/services/advanced-rag-service.ts`

### Test files with no single identifiable corresponding source file

- `tests/integration/admin-api-routes.test.ts`
- `tests/integration/public-api-routes.test.ts`
- `tests/unit/env-example.test.ts`
- `tests/helpers/index.ts`
- `tests/fixtures/index.ts`
- `tests/e2e/accessibility.spec.ts`
- `tests/e2e/admin.spec.ts`
- `tests/e2e/chat.spec.ts`
- `tests/e2e/performance.spec.ts`

### Source files with no corresponding test file

- Most `frontend/src/components/ui/*` wrappers
- `frontend/src/components/admin/connectors-settings-panel.tsx`
- `frontend/src/components/admin/providers-settings-panel.tsx`
- `frontend/src/components/documents/advanced-search.tsx`
- `frontend/src/components/documents/document-list.tsx`
- `frontend/src/components/documents/document-upload-modal.tsx`
- `frontend/src/hooks/use-mobile.ts`
- `frontend/src/lib/app-settings.ts`
- `frontend/src/lib/i18n/translations.ts`
- `frontend/src/lib/store.ts`
- `frontend/src/lib/utils.ts`
- `backend/src/app/api/cache/route.ts`
- `backend/src/app/api/export/route.ts`
- `backend/src/app/api/feedback/route.ts`
- `backend/src/app/api/metrics/route.ts`
- `backend/src/app/api/query/route.ts`
- `backend/src/app/api/sessions/route.ts`
- `backend/src/app/api/users/route.ts`
- `backend/src/app/api/admin/pipeline/route.ts`
- `backend/src/app/api/admin/providers/route.ts`
- `backend/src/lib/db.ts`
- `backend/src/lib/services/chat-service.ts`
- `backend/src/lib/services/data-connector-service.ts`
- `backend/src/lib/services/document-ingestion-service.ts`
- `backend/src/lib/services/vector-store-service.ts`

### Config duplicates

- No duplicate root Jest, Playwright, TypeScript, or `.env.example` files were found

### Temp or generated files that should not normally be committed

- `.next/`
- `node_modules/`
- `backend/prisma/*.db`
- `tsconfig.tsbuildinfo`

### Organization observations

- The workspace split is now the dominant structure and should be preserved
- Root-level config is limited to shared tooling and workspace orchestration
- `frontend/` and `backend/` each own their local framework configs
- `tests/` is correctly separated into unit, integration, components, e2e, security, config, helpers, and fixtures
- `infra/` contains deployment and observability assets

## 3. INFERRED PROJECT PROFILE

- **Language:** TypeScript primary, with a few Python and shell utility scripts
- **Frontend:** Next.js (React, App Router)
- **Backend:** Next.js Route Handlers under `backend/src/app/api`
- **Database:** PostgreSQL with Prisma
- **Auth method:** 15-minute JWT access tokens with DB-backed refresh tokens and httpOnly cookie protection on frontend admin routes
- **Package manager:** npm
- **Test runner:** Jest and Playwright
- **Monorepo:** yes
  - `frontend/`
  - `backend/`
- **File uploads:** yes
- **Existing tests:** yes
  - 28 Jest test files
  - 4 Playwright spec files
  - 3 support modules under `tests/helpers`, `tests/fixtures`, and `tests/e2e`

## FLAGGED FOR REVIEW

- `backend/src/lib/services/embedding-service.ts`
  - Reason: internal compatibility layer overlaps with `advanced-embedding-service.ts`
- `backend/src/lib/services/rag-service.ts`
  - Reason: internal compatibility layer overlaps with `advanced-rag-service.ts`

## DECISIONS

- `frontend/src/components/admin/enhanced-dashboard.tsx` is the single admin dashboard surface.
- `frontend/src/components/chat/enhanced-chat-interface.tsx` is the single chat surface.
- The `advanced-*` RAG and embedding services are the only public service surfaces; the non-advanced services remain internal compatibility layers.
- Local Prisma SQLite database files should remain ignored and be deleted when generated locally.
- Admin and management routes are intentionally authenticated.
- Keep the workspace split intact for future changes and continue working inside Git.

