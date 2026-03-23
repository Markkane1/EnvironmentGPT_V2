# AGENTS.md
> Rules for all AI agent and Codex sessions on this project.
> Read this file at the start of every session.

## Stack
- Language: TypeScript primary, with a few Python and shell utility scripts
- Frontend: Next.js App Router with React
- Backend: Next.js Route Handlers under `src/app/api`
- Database: PostgreSQL with Prisma
- Auth: none detected in active runtime code
- Package manager: npm
- Test stack: Jest, Testing Library, Playwright

## What This App Does
EnvironmentGPT is an EPA Punjab knowledge assistant. It ingests PDF, Word, Markdown, and text documents into a PostgreSQL-backed knowledge base, uses retrieval plus provider-managed LLM routing to answer chat queries, and exposes admin screens for document, provider, connector, cache, and health management.

## Folder Structure
- `src/`
  - `app/` Next.js pages and API route handlers
  - `components/` feature and UI components
  - `hooks/` React hooks
  - `lib/` services, validators, utilities, state, monitoring, constants
  - `types/` shared TypeScript contracts
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
- `prisma/` Prisma schema and local DB artifacts only
- `public/` static assets

## File Placement Rules
- Application source -> `src/`
- Tests -> `tests/[unit|integration|components|e2e|security]`
- Test support files -> `tests/helpers` and `tests/fixtures`
- Test runner config -> `tests/config/`
- Documentation -> `docs/`
- Infrastructure manifests and proxy config -> `infra/`
- Utility scripts -> `scripts/`
- Config files -> project root
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
- Preserve the Next.js `src/` layout; do not force a separate `client/server` split
- Run the full test suite at the end of every session
- Update `docs/PROJECT_STRUCTURE.md` if the folder structure changes

## Follow-up Actions Needed
- Decide whether `src/components/admin/dashboard.tsx` should remain alongside `src/components/admin/enhanced-dashboard.tsx`
- Decide whether `src/components/chat/chat-interface.tsx` should remain alongside `src/components/chat/enhanced-chat-interface.tsx`
- Decide whether the `advanced-*` and non-advanced RAG/embedding services are both intentional public surfaces
- Decide whether `prisma/dev.db` and `prisma/push-created.db` are fixtures that should stay or local artifacts that should be removed
- Decide whether the admin surface is intentionally unauthenticated or whether an auth layer should be added
- Add a real Git repository or work inside the original repo before any large future restructures
