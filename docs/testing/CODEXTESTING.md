# CODEXTESTING.md

## Project Profile
- Language: TypeScript
- Framework: Next.js App Router with React
- Backend: Next.js Route Handlers
- Database: PostgreSQL with Prisma
- Auth: none detected in active runtime code
- Package manager: npm

## Testing Stack
- Unit, integration, component, and security tests: Jest + `ts-jest` + Testing Library
- E2E tests: Playwright
- Database/model tests: Prisma against PostgreSQL

Install commands:
```bash
npm install
npx playwright install
```

## Tooling Setup Prompt
```text
Set up and validate the test tooling for this Next.js + Prisma project.
Use Jest for unit/integration/component/security tests and Playwright for E2E.
Keep application source in src/ and tests in tests/.
Verify:
- tests/config/jest.config.ts points at tests/
- tests/config/playwright.config.ts points at tests/e2e
- @/ aliases resolve to src/
- Prisma tests do not silently hit production data
Run:
1. npm test -- --runInBand
2. npm run test:e2e -- --list
Report any broken imports, missing env vars, or path issues before adding new tests.
```

## Session 0 — Discovery
```text
Read AGENTS.md and docs/PROJECT_STRUCTURE.md first.
Inventory current tests under tests/unit, tests/integration, tests/components, tests/e2e, and tests/security.
List uncovered areas in src/app/api, src/components, and src/lib/services.
Do not write tests yet; produce a prioritized test gap list first.
```

## Session 1 — Unit Tests
```text
Write or improve unit tests for pure logic in src/lib/services, src/lib/utils, src/lib/security, and src/lib/constants.
Prefer deterministic tests with no network and no real DB writes.
Run: npm run test:unit -- --runInBand
```

## Session 2 — Integration Tests
```text
Write integration tests for Next.js route handlers in src/app/api.
Cover request validation, error handling, DB interaction boundaries, and response contracts.
Mock external LLM and connector calls explicitly.
Run: npm run test:integration -- --runInBand
```

## Session 3 — Model Tests
```text
Focus on Prisma-backed behavior: schema assumptions, document/session/feedback persistence, and seed compatibility.
Use a dedicated test database configuration and never reuse production credentials.
Run the relevant Jest subset plus any required Prisma setup commands before assertions.
```

## Session 4 — Component Tests
```text
Write component tests for React UI in src/components and page wrappers under src/app.
Prioritize chat flows, admin panels, settings persistence, and document upload UX.
Mock fetch and browser APIs in tests/config/jest.setup.ts-compatible ways.
Run: npm run test:components -- --runInBand
```

## Session 5 — E2E Tests
```text
Use Playwright for user-visible flows: home chat, admin dashboard, document upload, and settings.
Keep tests in tests/e2e and helpers in tests/e2e/test-helpers.ts.
Run: npm run test:e2e
```

## Session 6 — Security Tests
```text
Audit rate limiting, input validation, admin/API exposure, file upload parsing, and prompt-injection boundaries.
Write security-oriented Jest tests under tests/security where feasible.
Run: npm run test:security -- --runInBand
```

## Session 7 — Performance Checks
```text
Measure route latency, cache behavior, and heavy document-ingestion paths.
Use repeatable local runs and avoid noisy network-dependent benchmarks.
Capture regressions as numeric before/after notes, not vague impressions.
```

## Session 8 — Vibe Code Audit
```text
Audit for duplicate implementations, dead components, stale route wrappers, and mismatched tests.
Prefer deleting or consolidating duplicate surfaces instead of preserving parallel versions without reason.
Update docs/PROJECT_STRUCTURE.md if the folder layout changes.
```

## Session 9 — Coverage Report
```text
Generate a coverage report, identify weak areas, and raise thresholds only after meaningful test quality exists.
Run:
1. npm run test:coverage -- --runInBand
2. Summarize file-level gaps
Target thresholds:
- Statements >= 35
- Branches >= 30
- Functions >= 35
- Lines >= 35
```

## General Rules
- Keep tests under `tests/`, never recreate `src/__tests__`
- Prefer contract assertions over `expect(true)` style placeholders
- Mock external services, not the code path under test
- Keep DB and filesystem side effects explicit
- Run the smallest relevant subset during iteration, then run the full Jest suite before finishing
- If Playwright tests are touched, run them before finishing

## Bug Log Format
```md
# BUGS_FOUND.md

## [BUG-YYYYMMDD-001] Short title
- Area:
- Severity:
- Reproduction:
- Expected:
- Actual:
- Root cause:
- Fix:
- Test added:
```

## Final Checklist
- `AGENTS.md` reviewed
- Tests placed in the correct `tests/*` folder
- No broken import paths after file moves
- Jest passes with `npm test -- --runInBand`
- Playwright config still resolves `tests/e2e` from `tests/config/playwright.config.ts`
- Prisma/DB-dependent tests use safe credentials
- New bugs logged to `docs/BUGS_FOUND.md`
- Structure changes reflected in `docs/PROJECT_STRUCTURE.md`
