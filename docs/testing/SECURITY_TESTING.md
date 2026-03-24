# SECURITY_TESTING.md

This project is a Next.js + React + Prisma + PostgreSQL application with document upload, RAG chat, admin APIs, and provider/connector integrations. No active JWT or session-based auth layer was detected in runtime route handling.

## Session 1 — Discovery And Threat Model
- Map all externally reachable surfaces under `src/app/api`
- Identify trust boundaries: browser, route handlers, Prisma, uploaded files, LLM providers, data connectors
- Record high-risk assets: documents, chat history, provider config, connector secrets, feedback, stats
- Output findings to `docs/SECURITY_AUDIT.md`

## Session 2 — Auth And Authorization Surface
- Because no active auth was detected, test whether admin endpoints are intentionally public
- Review `/admin` and `/api/admin/*`, `/api/users`, `/api/cache`, `/api/export`, and `/api/stats`
- Verify whether route protection is missing or intentionally omitted
- If auth is added later, replace this session with session/cookie authorization tests

## Session 3 — Input Validation And Abuse Controls
- Review Zod/custom validation on chat, upload, ingest, feedback, sessions, users, and admin routes
- Test malformed JSON, oversized inputs, invalid enum values, and empty payloads
- Verify rate limiting in `src/lib/security/rate-limiter.ts` and related tests
- Confirm error responses are explicit and do not leak stack traces

## Session 4 — SQL Injection And Data Access Safety
- Review Prisma query construction in services and route handlers
- Check any raw SQL usage or unsafe string interpolation
- Test search/filter/query parameters for injection-like payloads
- Confirm admin/provider/connector update paths do not allow unintended field writes

## Session 5 — File Upload And Document Parsing
- Test upload handling for `.pdf`, `.doc`, `.docx`, `.md`, `.markdown`, and `.txt`
- Verify unsupported files are rejected cleanly
- Check file size limits, parser error handling, and binary/text boundary handling
- Look for path traversal, content-type spoofing, decompression bombs, and unsafe parser assumptions

## Session 6 — React / Next Frontend Security
- Review chat rendering, markdown rendering, source panels, settings persistence, and admin UI
- Test for XSS through chat content, document content, source excerpts, and admin previews
- Verify no secrets or internal config values are leaked into client bundles
- Check navigation and fetch usage for unsafe assumptions

## Session 7 — LLM / RAG / Prompt Injection
- Review document ingestion, retrieval, connector injection, and prompt assembly
- Test prompt injection from document content and live connector content
- Verify system prompt boundaries and source attribution behavior
- Check whether malicious uploaded documents can poison answers or override instructions

## Session 8 — Dependency, Container, And Infra Audit
- Run `npm audit`
- Review `Dockerfile`, `docker-compose.yml`, `docker-compose.prod.yml`, `infra/proxy/Caddyfile`, `infra/proxy/nginx.conf`, and `infra/monitoring/*`
- Check for unnecessary services, weak defaults, exposed ports, and stale infra assumptions
- Confirm health and metrics routes do not leak more than intended

## Session 9 — Secrets, Logging, And Operational Hardening
- Review `.env.example`, runtime env usage, and secret naming
- Confirm API keys are sourced from env vars and not hardcoded
- Check logs, exported data, metrics, and health routes for secret leakage
- Review document export and chat export paths for excessive data exposure

## Commands
```bash
npm run test:security -- --runInBand
npm run test:integration -- --runInBand
npm audit
```

## Output Format
Log findings in `docs/SECURITY_AUDIT.md` using:

```md
## [SEC-001] Short title
- Severity:
- Area:
- Affected files:
- Risk:
- Reproduction:
- Recommended fix:
- Test coverage:
```
