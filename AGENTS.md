# AGENTS.md
> Rules for all AI agent and Codex sessions on this project.
> Read this file at the start of every session.

## Stack
- Language: TypeScript primary, with a few Python and shell utility scripts
- Frontend: Next.js App Router with React in `frontend/`
- Backend: Next.js Route Handlers in `backend/src/app/api`
- Database: PostgreSQL with Prisma
- Auth: JWT-based admin auth with frontend route protection and backend auth endpoints
- Package manager: npm
- Test stack: Jest, Testing Library, Playwright

## What This App Does
EnvironmentGPT is an EPA Punjab knowledge assistant. It ingests PDF, Word, Markdown, and text documents into a PostgreSQL-backed knowledge base, uses retrieval plus provider-managed LLM routing to answer chat queries, and exposes admin screens for document, provider, connector, cache, and health management.

## Folder Structure
- `frontend/`
  - `src/app/` frontend pages and layouts
  - `src/components/` feature and UI components
  - `src/hooks/` React hooks
  - `src/lib/` frontend state, constants, helpers, and utilities
  - `src/types/` shared frontend-facing contracts
- `backend/`
  - `src/app/api/` backend route handlers
  - `src/lib/` services, validators, utilities, monitoring, security, and DB access
  - `src/types/` backend-facing contracts
  - `prisma/` Prisma schema and local DB artifacts
- `tests/`
  - `unit/`
  - `integration/`
  - `components/`
  - `e2e/`
  - `security/`
  - `config/`
  - `helpers/`
  - `fixtures/`
- `docs/` documentation and audit reports
- `infra/` deployment, proxy, monitoring, and Kubernetes assets
- `scripts/` local/dev/deploy/bootstrap utilities

## File Placement Rules
- Application source -> `frontend/src/` or `backend/src/`
- Tests -> `tests/[unit|integration|components|e2e|security]`
- Test support files -> `tests/helpers` and `tests/fixtures`
- Test runner config -> `tests/config/`
- Documentation -> `docs/`
- Infrastructure manifests and proxy config -> `infra/`
- Utility scripts -> `scripts/`
- Config files -> project root, `frontend/`, or `backend/` only when they are workspace-local configs
- Never create `.md` report files in root except `README.md` and `AGENTS.md`
- Never leave temp, draft, backup, or debug files in the repo

## Test Rules
- Always run the full Jest suite after writing, moving, or modifying tests
- Run Playwright when UI flows or `tests/e2e` are touched
- Never finish a session with a failing test
- Never finish a session with unresolved Critical or High findings
- Fix broken import paths immediately after any file move
- Log bugs found to `docs/BUGS_FOUND.md`
- Log security findings to `docs/SECURITY_AUDIT.md`

## Coding Conventions
- TypeScript with `strict` enabled in the main project config
- React function components and async/await are the default style
- Named exports are preferred in shared code; default exports are mainly used for Next.js page/layout files
- No semicolons in most app code
- Single quotes are the dominant string style
- Two-space indentation is the prevailing convention
- Use `@/` imports for app code instead of deep relative imports when possible

## Session Rules
- Read `AGENTS.md` before starting every session
- Preserve the Next.js workspace split; do not collapse `frontend/` and `backend/`
- Run the full test suite at the end of every session
- Update `docs/PROJECT_STRUCTURE.md` if the folder structure changes

## Current Decisions
- `frontend/src/components/admin/enhanced-dashboard.tsx` is the only admin dashboard implementation. The legacy `dashboard.tsx` has been retired.
- `frontend/src/components/chat/enhanced-chat-interface.tsx` is the canonical chat surface. Any remaining callers should target the enhanced implementation only.
- Only the `advanced-*` RAG/embedding services are public service surfaces. `embedding-service.ts` and `rag-service.ts` are internal compatibility layers until their remaining internal callers are migrated.
- `backend/prisma/*.db` files are local SQLite artifacts for ad hoc development and must remain ignored and untracked in this PostgreSQL project.
- The admin surface is intentionally authenticated. Any `PLAYWRIGHT_TEST` bypass is test-only and must not be treated as product behavior.
- The project is already inside a Git repository, and future broad refactors must continue to happen under Git.
