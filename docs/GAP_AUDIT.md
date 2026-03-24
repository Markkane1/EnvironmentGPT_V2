# GAP AUDIT

All audited gaps listed below have been fixed in the current codebase and regression-covered.

## PRIORITISED FIX ORDER

1. `GAP-002` `High` Feedback buttons are visible in chat but do not submit any feedback.
2. `GAP-003` `High` Settings page advertises preferences that the app never applies.
3. `GAP-004` `High` Admin dashboard requests analytics and recent-item fields the stats API never returns.
4. `GAP-005` `High` Admin document-management actions are rendered but not wired to working handlers.
5. `GAP-006` `High` Health and monitoring config promise cache/LLM/metrics checks that are not real.
6. `GAP-001` `Medium` Constants still advertise unsupported spreadsheet, presentation, and image ingestion.
7. `GAP-007` `Medium` Connector test API can fail until the in-memory connector cache has been preloaded.
8. `GAP-008` `Medium` `.env.example` and setup docs advertise unsupported auth, cache, metrics, backup, and flag settings.
9. `GAP-009` `Medium` Shared types and service exports promise fields and symbols the implementation does not actually provide.
10. `GAP-010` `Medium` Several tests claim route/component coverage while asserting fabricated data or `expect(true)`.

## [GAP-001] Unsupported Ingestion Types Still Advertised

- **Status:**         Fixed
- **Type:**           CONSTANT / ENUM DRIFT
- **Severity:**       Medium
- **Claimed in:**     `src/lib/constants/index.ts:178`
- **Missing in:**     `src/lib/utils/document-extraction.ts:67`
- **Description:**    The shared constants still advertise spreadsheet, presentation, and image file families, but the real extraction pipeline only handles Markdown, text, PDF, DOCX, and DOC.
- **User impact:**    Any UI or integration built from the constants can claim support for files that the backend will reject with `Unsupported file type`.
- **Fix required:**   Make the advertised file-type config match the implemented ingestion pipeline, or implement end-to-end handlers for every listed family.
- **Test required:**  A regression test that asserts every advertised upload type maps to a real extractor or is absent from the supported constants.

## [GAP-002] Chat Feedback Controls Are UI-Only

- **Status:**         Fixed
- **Type:**           PHANTOM FEATURE
- **Severity:**       High
- **Claimed in:**     `src/components/chat/enhanced-chat-interface.tsx:263`
- **Missing in:**     `src/components/chat/enhanced-chat-interface.tsx:263`
- **Description:**    Both chat UIs render helpful/not-helpful controls, but clicking them only flips Zustand modal state. There is no rendered feedback modal, no direct POST to `/api/feedback`, and no route payload wiring from the assistant message ID.
- **User impact:**    Users can click rating controls and nothing user-visible happens, so feedback appears supported but is silently lost.
- **Fix required:**   Wire assistant messages to the backend `messageId`, submit ratings from the visible controls or a real modal, and render success/error feedback in the UI.
- **Test required:**  A component/integration test that sends a chat response with a backend message ID, clicks helpful/not-helpful, and verifies `/api/feedback` is called with the correct payload.

## [GAP-003] Settings Panel Promises Preferences The App Never Applies

- **Status:**         Fixed
- **Type:**           CONFIG / FEATURE FLAG DRIFT
- **Severity:**       High
- **Claimed in:**     `src/components/settings/settings-panel.tsx:180`
- **Missing in:**     `src/app/layout.tsx:1`
- **Description:**    The settings UI exposes display language, RTL support, theme, show sources, auto-save sessions, max history items, and notifications, but those values are only stored in local storage. The application shell, chat views, sidebar session loading, and source rendering do not consume most of them.
- **User impact:**    Users can spend time changing preferences that have no effect on the interface or behavior.
- **Fix required:**   Either implement each exposed setting end to end where it is consumed, or remove unsupported controls so the settings screen only exposes real behavior.
- **Test required:**  Component and integration tests that verify each remaining setting materially changes rendering or behavior after save and reload.

## [GAP-004] Admin Dashboard Expects Stats Fields The Backend Never Returns

- **Status:**         Fixed
- **Type:**           ROUTE / HANDLER MISMATCH
- **Severity:**       High
- **Claimed in:**     `src/components/admin/enhanced-dashboard.tsx:82`
- **Missing in:**     `src/app/api/stats/route.ts:66`
- **Description:**    The enhanced admin dashboard expects `avgResponseTime`, `recentlyAdded`, and `recentFeedback`, and it renders an analytics tab as if those datasets exist. The stats route only returns aggregate counts and category/year buckets.
- **User impact:**    Admin screens show empty recent-activity sections, `0ms avg` latency, and placeholder analytics despite presenting those features as available.
- **Fix required:**   Extend the stats API to return the fields the dashboard consumes, and replace placeholder analytics cards with real data visualizations or honest summaries.
- **Test required:**  Integration tests for `/api/stats` that assert the admin contract includes latency, recent documents, and recent feedback, plus component tests that render those values.

## [GAP-005] Admin Document Management Actions Are Inert

- **Status:**         Fixed
- **Type:**           PHANTOM FEATURE
- **Severity:**       High
- **Claimed in:**     `src/components/admin/enhanced-dashboard.tsx:422`
- **Missing in:**     `src/components/admin/enhanced-dashboard.tsx:422`
- **Description:**    The admin documents tab renders Upload, View, Download, and Delete actions, but those buttons have no working handlers, no viewer state, and no download flow.
- **User impact:**    The admin UI looks like a usable document-management console, but the visible actions do nothing.
- **Fix required:**   Wire upload to a real modal/flow, implement document viewing and downloading, and connect delete to the existing API with list refresh.
- **Test required:**  Component and route tests that click each admin document action and assert the expected modal, request, or downloaded payload occurs.

## [GAP-006] Health And Monitoring Checks Are Mostly Cosmetic

- **Status:**         Fixed
- **Type:**           STUB / PLACEHOLDER
- **Severity:**       High
- **Claimed in:**     `infra/monitoring/prometheus.yml:26`
- **Missing in:**     `src/app/api/health/route.ts:38`
- **Description:**    Monitoring config scrapes `/api/metrics`, but that route does not exist. The health route also reports cache health without touching the cache and reports LLM health by importing the SDK rather than checking configured providers.
- **User impact:**    Operators get green health signals and monitoring configuration that do not reflect whether cache, providers, or metrics are actually working.
- **Fix required:**   Implement a real metrics endpoint, use actual cache round-trip checks, and base LLM health on configured provider state rather than SDK presence.
- **Test required:**  Integration tests that hit `/api/health` and `/api/metrics` and verify cache/provider failure conditions surface correctly.

## [GAP-007] Connector Test Endpoint Depends On Hidden Cache State

- **Status:**         Fixed
- **Type:**           INCOMPLETE PIPELINE
- **Severity:**       Medium
- **Claimed in:**     `src/app/api/admin/connectors/route.ts:45`
- **Missing in:**     `src/lib/services/data-connector-service.ts:756`
- **Description:**    The admin connectors API exposes `action=test`, but `testConnector()` reads only the in-memory map and does not load connectors from the database when the service cache is cold.
- **User impact:**    Testing a connector can incorrectly return `Connector not found` until some other route has already populated the service cache.
- **Fix required:**   Ensure `testConnector()` resolves the connector from fresh state before testing, or force cache loading in the route before dispatch.
- **Test required:**  A route test that calls `action=test` on a cold service instance and still reaches the connector fetch path.

## [GAP-008] Environment Example And Setup Docs Advertise Unsupported Runtime Features

- **Status:**         Fixed
- **Type:**           DOCUMENTATION / REALITY MISMATCH
- **Severity:**       Medium
- **Claimed in:**     `.env.example:20`
- **Missing in:**     `src/app/api/admin/providers/route.ts:22`
- **Description:**    The environment example and setup docs advertise NextAuth, Ollama/OpenAI direct config, Redis cache, metrics flags, feature flags, backup settings, admin bootstrap credentials, and rate-limit variable names that the application does not consume or consumes under different names.
- **User impact:**    Operators can configure the project according to the published docs and still end up with features that do nothing or protections that are never applied.
- **Fix required:**   Trim `.env.example` and setup docs to the env vars the code really uses, and align variable names with the runtime implementation.
- **Test required:**  A documentation/config regression check that verifies every env var listed in `.env.example` is referenced by the application or deployment scripts.

## [GAP-009] Shared Types And Service Exports Do Not Match Runtime Contracts

- **Status:**         Fixed
- **Type:**           CONSTANT / ENUM DRIFT
- **Severity:**       Medium
- **Claimed in:**     `src/types/index.ts:126`
- **Missing in:**     `src/components/chat/source-panel.tsx:108`
- **Description:**    Shared types omit fields and symbols the app actually uses. `SourceReference` lacks `year` and `source`, `ChatResponse` omits `confidence`, the repo imports a `Message` type that is never exported, `FeatureFlags` omits `voiceInputEnabled` and `exportEnabled`, and `src/lib/services/index.ts` re-exports types that do not exist.
- **User impact:**    Type-checking is disabled in builds because the published app contract and implementation disagree, making real regressions easier to miss.
- **Fix required:**   Align the shared types and service barrel exports with the actual route/component contracts and remove nonexistent exports.
- **Test required:**  Type-level regression coverage via `tsc --noEmit` for the touched surfaces, plus unit tests that assert source metadata and chat responses include the expected fields.

## [GAP-010] Several Test Suites Only Pretend To Cover The App

- **Status:**         Fixed
- **Type:**           TEST / IMPLEMENTATION MISMATCH
- **Severity:**       Medium
- **Claimed in:**     `src/__tests__/components/components.test.tsx:141`
- **Missing in:**     `src/__tests__/api/routes.test.ts:120`
- **Description:**    Multiple suites claim route or component coverage while asserting `expect(true)`, rendering fake markup instead of real components, or constructing synthetic response objects instead of calling real handlers.
- **User impact:**    Regressions can slip through while the test suite still reports passing coverage for functionality it never exercised.
- **Fix required:**   Replace placeholder assertions with real component and route tests for the audited behavior, or delete misleading suites that provide no signal.
- **Test required:**  Real tests that import the actual components/routes, drive the broken path, and assert observable behavior rather than fabricated objects.
