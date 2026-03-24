# DISCOVERY

This discovery document is grounded in the actual repository, not the template prompt. The codebase is a Next.js monorepo with:

- `backend/`: Next.js Route Handlers, Prisma, PostgreSQL
- `frontend/`: Next.js App Router, React, Zustand
- Auth: JWT access tokens plus refresh tokens

The prompt asked for Express and Mongoose surfaces. This repo does not use Express route files or Mongoose models. The sections below map the equivalent real implementation exhaustively.

## 1. API ROUTES

### Backend Route Handlers (`backend/src/app/api`)

Auth legend:

- `Public`: no auth required
- `JWT`: `Authorization: Bearer <access-token>`
- `Admin JWT`: valid JWT with `role === 'admin'`
- `Admin Key`: `Authorization: Bearer <ADMIN_API_KEY>` or `X-API-Key`
- `Cookie-authenticated`: route itself is public, but behavior depends on the `refreshToken` httpOnly cookie

| Method | Path | Auth | What it does | Inputs | Success | Error cases |
| --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/api` | Public | Service discovery / basic service status | None | `200 { success, service, version, status: 'ok' }` | No explicit error branch |
| `GET` | `/api/health` | Public | Public health probe for uptime/load balancers | None | `200` or `503` with `{ status, version, timestamp }` | `503` on degraded/unhealthy checks or exception |
| `GET` | `/api/metrics` | Admin Key | Prometheus-style health metrics | None | `200 text/plain` metrics body | `401` missing key, `403` wrong key, `503` if `ADMIN_API_KEY` missing or health collection fails |
| `POST` | `/api/auth/login` | Public | Authenticates a user and issues access + refresh tokens | JSON body `{ username, password }` | `200 { success: true, token, expiresIn: '15m', user }` plus `refreshToken` httpOnly cookie | `400` validation, `401` invalid credentials/inactive user, `500` |
| `POST` | `/api/auth/logout` | Cookie-authenticated | Revokes matching refresh token and clears refresh cookie | No body; reads `refreshToken` cookie | `200 { success: true, message }` and expired cookie | `500` |
| `POST` | `/api/auth/refresh` | Cookie-authenticated | Rotates refresh token and returns a new access token | No body; reads `refreshToken` cookie | `200 { success: true, token, expiresIn, user }` plus rotated refresh cookie | `401` missing/invalid/revoked/expired refresh token, `500` |
| `GET` | `/api/admin/health/full` | Admin JWT | Full internal health payload for admin UI | None | `200` or `503 { success, health }` | `401/403` auth failure, `503`, `500`-style degraded fallback |
| `GET` | `/api/admin/pipeline` | Admin JWT | Pipeline stats or health | Query `action=health?` | Default `200 { success, stats }`; `action=health` returns `{ success, health }` | `401/403`, `500` |
| `POST` | `/api/admin/pipeline` | Admin JWT | Runs a query through the LLM router pipeline | JSON `{ query, sessionId?, audienceType?, category?, location?, conversationHistory?[] }` | `200` router result payload | `400` validation, `401/403`, `500` |
| `GET` | `/api/admin/connectors` | Admin JWT | Lists connectors or runs connector actions | Query supports `action=stats|test|clear-cache`, `id`, `topic` | `{ success, connectors }`, `{ success, stats }`, `{ success, result }`, or `{ success, message: 'Cache cleared' }` | `401/403`, `500` |
| `POST` | `/api/admin/connectors` | Admin JWT | Creates a data connector | JSON connector config including `name`, `displayName?`, `connectorType`, `endpointUrl`, `apiKeyEnvVar?`, `authMethod?`, `authHeader?`, `requestMethod?`, `requestBodyTemplate?`, `responseMapping?`, `injectAs?`, `injectionTemplate?`, `refreshIntervalSec?`, `cacheEnabled?`, `cacheTtlSec?`, `topics?[]` | `200 { success, connector }` | `400` validation/SSRF/env-var-name failures, `401/403`, `500` |
| `PUT` | `/api/admin/connectors` | Admin JWT | Updates a connector | Same as create plus required `id` | `200 { success, connector }` | `400`, `404`, `401/403`, `500` |
| `DELETE` | `/api/admin/connectors` | Admin JWT | Deletes a connector | Query `id` | `200 { success: true, message: 'Connector deleted' }` | `400` missing id, `404`, `401/403`, `500` |
| `GET` | `/api/admin/providers` | Admin JWT | Lists providers or runs provider actions | Query supports `action=test|stats|health|chain`, `id` | `{ success, providers }`, `{ success, stats }`, `{ success, health }`, `{ success, chain }`, or `{ success, result }` | `400` missing `id` for `test`, `401/403`, `500` |
| `POST` | `/api/admin/providers` | Admin JWT | Creates an LLM provider | JSON `{ name, displayName?, providerType?, baseUrl, modelId, apiKeyEnvVar?, role?, isActive?, priority?, defaultParams?, timeoutSeconds?, maxTokens?, temperature?, notes? }` | `200 { success, provider }` | `400` validation/baseUrl/env-var-name failures, `401/403`, `500` |
| `PUT` | `/api/admin/providers` | Admin JWT | Updates an LLM provider | Same as create, partial, with required `id` | `200 { success, provider }` | `400`, `404`, `401/403`, `500` |
| `DELETE` | `/api/admin/providers` | Admin JWT | Soft-disables a provider | Query `id` | `200 { success: true, message: 'Provider disabled' }` | `400` missing id or attempt to delete only active primary, `404`, `401/403`, `500` |
| `GET` | `/api/admin/system/providers` | Admin JWT | Spec-aligned provider list endpoint | None | `200 { success, providers }` | `401/403`, `500` |
| `POST` | `/api/admin/system/providers` | Admin JWT | Spec-aligned provider create endpoint | Same body as `/api/admin/providers` `POST` | `200 { success, provider }` | Same errors as `/api/admin/providers` `POST` |
| `PUT` | `/api/admin/system/providers/[id]` | Admin JWT | Path-param variant for provider update | Path `id`, JSON partial provider fields | `200 { success, provider }` | `400`, `404`, `401/403`, `500` |
| `DELETE` | `/api/admin/system/providers/[id]` | Admin JWT | Path-param variant for provider disable | Path `id` | `200 { success: true, message }` | `400`, `404`, `401/403`, `500` |
| `POST` | `/api/admin/system/providers/[id]/test` | Admin JWT | Sends a lightweight test prompt to a single provider | Path `id`, optional JSON `{ message? }` | `200` on provider success or `502 { success, latencyMs, error }` on provider-level failure | `400` validation, `401/403`, `500` |
| `GET` | `/api/cache` | Admin JWT | Returns response-cache stats/config | None | `200 { success, stats, popularQueries, config }` | `401/403`, `500` |
| `POST` | `/api/cache` | Admin JWT | Cache management endpoint | JSON `{ action: 'clear'|'invalidate'|'invalidate_old'|'cleanup'|'toggle', params? }` | Action-specific payload such as `{ success, invalidated }`, `{ success, cleaned }`, `{ success, enabled }` | `400` invalid action/pattern, `401/403`, `500` |
| `POST` | `/api/chat` | Public or optional JWT | Main chat endpoint, supports JSON or SSE streaming response generation | JSON `ChatBody = { message, sessionId?, documentIds?, audience?, filters?, stream? }` | JSON `200 { success, response, sources, sessionId, messageId, timestamp, confidence, metadata }` or SSE stream with metadata + delta chunks | `400` validation, `401` only if an auth header is present but invalid, `500` |
| `GET` | `/api/chat` | JWT | Returns one chat session or recent conversations | Query `sessionId?` | `200 { success, session }` or `200 { success, sessions }` | `401`, `403` cross-user access, `404`, `500` |
| `DELETE` | `/api/chat` | JWT | Deletes a chat session | Query `id` | `200 { success: true }` | `400` missing id, `403`, `404`, `500` |
| `GET` | `/api/documents` | JWT | Lists/searches documents or returns one document | Query supports `id`, `category`, `reportSeries`, `yearFrom`, `yearTo`, `audience`, `q`, `page`, `pageSize`, `query`, `limit` | `200 { success, document }` or list/search payload `{ success, documents, total, page, pageSize, hasMore, timestamp }` | `401`, `403`, `404`, `500` |
| `POST` | `/api/documents` | Admin JWT | Creates a document record directly | JSON `CreateDoc = { title, content, category, audience?, source?, sourceUrl?, reportSeries?, year?, author?, tags?, language?, fileType?, fileSize? }` | `201 { success, document, timestamp }` | `400` validation, `401/403`, `500` |
| `PATCH` | `/api/documents` | JWT | Legacy single-document fetch by query string, not an update | Query `id` | `200 { success, document, timestamp }` | `400`, `403`, `404`, `500` |
| `DELETE` | `/api/documents` | JWT | Deletes a document if owner/admin | Query `id` | `200 { success, timestamp }` | `400`, `403`, `404`, `500` |
| `GET` | `/api/export` | JWT | Exports chat/documents/stats as downloadable files | Query `type=chat|documents|stats`, `format=json|csv|txt`, `sessionId?` | `200` download response with content headers | `400` invalid type/format or missing chat `sessionId`, `403`, `404`, `500` |
| `POST` | `/api/feedback` | JWT | Saves feedback on an assistant message | JSON `FeedbackBody = { messageId, rating: 1..5, comment? }` | `201 { success, feedback, timestamp }` | `400` validation, `403`, `404`, `500` |
| `GET` | `/api/feedback` | JWT | Returns feedback for one message or overall stats | Query `messageId?` | `200 { success, feedback, timestamp }` or `200 { success, statistics, timestamp }` | `403`, `404`, `500` |
| `POST` | `/api/ingest` | JWT | Ingests a document into chunked/embedded RAG storage | JSON `CreateDoc` or multipart form with `file` and metadata `title?`, `category?`, `audience?`, `author?`, `year?`, `tags` | `201 { success, document: { id, title, category, chunksCreated }, message, timestamp }` | `400` validation/file errors, `401`, `500` |
| `GET` | `/api/ingest` | JWT | Returns ingest/indexing status for one document or lists documents with chunk counts | Query `documentId?` | `200 { success, status, timestamp }` or `200 { success, documents, timestamp }` | `401`, `403`, `404`, `500` |
| `PUT` | `/api/ingest` | JWT | Reindexes an existing document into chunks + embeddings | JSON `{ documentId }` | `200 { success, message, chunksCreated, timestamp }` | `400`, `403`, `404`, `500` |
| `DELETE` | `/api/ingest` | JWT | Deletes a document through the ingest surface | Query `id` | `200 { success, message, timestamp }` | `400`, `403`, `404`, `500` |
| `POST` | `/api/query` | JWT | Analyzes a query for scope, intent, category, filters, and follow-ups | JSON `{ query }` | `200 { success, analysis }` | `400` validation, `401`, `500` |
| `GET` | `/api/query` | JWT | Returns suggested follow-up questions by category | Query `category?` | `200 { success, suggestions }` | `401`, `500` |
| `GET` | `/api/sessions` | JWT | Returns one session or recent sessions | Query `id?`, `limit?` | `200 { success, session, timestamp }` or `200 { success, sessions, timestamp }` | `401`, `403`, `404`, `500` |
| `POST` | `/api/sessions` | JWT | Creates a chat session | JSON `CreateSessionBody = { title?, documentId? }` | `201 { success, session, timestamp }` | `400` validation, `401`, `500` |
| `DELETE` | `/api/sessions` | JWT | Deletes a chat session | Query `id` | `200 { success: true, timestamp }` | `400`, `403`, `404`, `500` |
| `GET` | `/api/stats` | Admin JWT | Returns system/admin statistics | Query `type=overview|documents|chat|feedback|health|config` | `200 { success, statistics|health|config, timestamp? }` | `400` invalid type, `401/403`, `500` |
| `POST` | `/api/upload` | JWT | Multipart-oriented upload endpoint for documents | Multipart form `{ file?, content?, title?, category, audience?, author?, year?, tags }` | `201 { success, document, message, timestamp }` | `400` validation/file/content errors, `401`, `500` |
| `GET` | `/api/upload` | JWT | Returns processing/status info for one uploaded document | Query `documentId` | `200 { success, status, timestamp }` | `400`, `403`, `404` |
| `GET` | `/api/users` | Admin JWT | Lists users | Query `role?` | `200 { success, users }` | `401/403`, `500` |
| `POST` | `/api/users` | Admin JWT | Creates a user | JSON `{ email, username?, password?, name, role?, department? }` | `201 { success, user }` | `400` validation, `409` duplicate email/username, `401/403`, `500` |
| `PATCH` | `/api/users` | Admin JWT | Updates a user | Query `id`, JSON partial user fields | `200 { success, user }` | `400`, `404`, `401/403`, `500` |
| `DELETE` | `/api/users` | Admin JWT | Soft-deactivates a user | Query `id` | `200 { success: true, message }` | `400`, `404`, `401/403`, `500` |

### Frontend API Proxy Routes (`frontend/src/app/api`)

These are browser-facing frontend routes that proxy or verify backend auth.

| Method | Path | Auth | What it does | Inputs | Success | Error cases |
| --- | --- | --- | --- | --- | --- | --- |
| `POST` | `/api/auth/login` | Public | Proxies login to backend, then stores access token and refresh token as frontend cookies | JSON `{ username, password }` | `200 { success: true, user }` and sets `token` + `refreshToken` cookies | Mirrors backend auth failure status, or `502` if backend is unreachable or does not issue refresh token |
| `GET` | `/api/auth/session` | Cookie-based | Verifies the frontend access token, optionally refreshes via backend refresh endpoint | No body; reads `token` and `refreshToken` cookies | `200 { authenticated: true, role, userId }` | `200 { authenticated: false, role: null }` with cookies cleared when verification/refresh fails |

## 2. REACT PAGES & COMPONENTS

### App Pages (`frontend/src/app`)

#### `/`

- Renders:
  - Main chat shell with the left sidebar, top header, and `EnhancedChatInterface`.
- API calls:
  - None directly in the page component.
- User interactions:
  - Toggle sidebar.
  - Navigate to `/admin`.
  - Open EPA Punjab external site.
- Conditional rendering:
  - Header menu button only shows when sidebar is collapsed.

#### `/login`

- Renders:
  - Admin login form with username/password fields and auth error alert.
- API calls:
  - `POST /api/auth/login` via frontend proxy route.
- User interactions:
  - Type username/password.
  - Submit sign-in form.
  - Navigate back to `/`.
- Conditional rendering:
  - Error alert only when login fails.
  - Submit button switches to `Signing in...` while pending.

#### `/admin`

- Renders:
  - `EnhancedAdminDashboard`.
- API calls:
  - None directly in page component.
- User interactions:
  - Delegated entirely to dashboard.
- Conditional rendering:
  - Access is guarded before render by frontend proxy middleware.

#### `/settings`

- Renders:
  - `SettingsPanel`.
- API calls:
  - None directly in page component.
- User interactions:
  - Delegated to settings panel.
- Conditional rendering:
  - None in page wrapper.

#### `/403`

- Renders:
  - Admin-role denial page with buttons to return home or sign in as admin.
- API calls:
  - None.
- User interactions:
  - Navigate to `/` or `/login`.
- Conditional rendering:
  - None.

#### `layout.tsx`

- Renders:
  - Global HTML shell, `AppSettingsProvider`, and toast container.
- API calls:
  - None.
- User interactions:
  - None directly.
- Conditional rendering:
  - Theme changes are applied indirectly through `AppSettingsProvider`.

### Major Components

#### `EnhancedChatInterface`

- Renders:
  - Empty-state landing prompt, message list, composer, loading state, source panel trigger, feedback/regenerate/copy controls.
- API calls:
  - `POST /api/chat` with `stream: true`
  - `POST /api/feedback`
- User interactions:
  - Type chat prompt.
  - Submit with button or Enter.
  - Choose suggested starter questions.
  - Copy assistant responses.
  - Regenerate latest assistant response.
  - Mark helpful/unhelpful feedback.
  - Start a new chat.
  - Open source panel.
- Conditional rendering:
  - Empty welcome state when no messages exist.
  - Loader bubble while waiting for non-stream response.
  - Source drawer/panel only when sources are enabled and present.
  - Feedback buttons only for latest assistant message.
  - Streaming cursor only while SSE response is active.

#### `Sidebar`

- Renders:
  - Collapsed or expanded left sidebar with filters, docs tab, history tab, and upload modal trigger.
- API calls:
  - `GET /api/sessions?limit=...`
  - `GET /api/sessions?id=...`
  - `DELETE /api/sessions?id=...`
- User interactions:
  - Collapse/expand sidebar.
  - Start new chat.
  - Select audience/category/report series.
  - Search documents by title text.
  - Open docs/history tabs.
  - Open upload modal.
  - Load a session from history.
  - Delete a session from history.
  - Navigate to `/settings`.
- Conditional rendering:
  - Entire collapsed vs expanded layouts.
  - History skeletons while loading sessions.
  - Empty state text for "No recent chats".
  - Upload modal on demand.

#### `SourcePanel`

- Renders:
  - Source list, confidence badge, expandable excerpts, metadata, and source actions.
- API calls:
  - None.
- User interactions:
  - Expand/collapse a source card.
  - Close panel.
  - Trigger `View Document` callback.
  - Copy citation to clipboard.
- Conditional rendering:
  - Empty "No sources available" state when sources array is empty.
  - Confidence badge color/label changes by score.
  - Expanded source details only for selected item.

#### `EnhancedAdminDashboard`

- Renders:
  - Admin header, stats cards, overview/documents/analytics/feedback/providers/connectors/system tabs, document preview dialog, upload modal.
- API calls:
  - `GET /api/stats?type=overview`
  - `GET /api/stats?type=chat`
  - `GET /api/stats?type=documents`
  - `GET /api/stats?type=feedback`
  - `GET /api/stats?type=health`
  - `GET /api/cache`
  - `POST /api/cache` with `{ action: 'clear' }`
  - `GET /api/documents?id=...`
  - `DELETE /api/documents?id=...`
- User interactions:
  - Refresh stats.
  - Switch tabs.
  - Search/filter recent documents.
  - Open upload modal.
  - View/download/delete document.
  - Clear cache.
- Conditional rendering:
  - Loading skeleton while initial stats load.
  - Empty states for missing documents/feedback/analytics.
  - Health badges vary by status.
  - Preview dialog switches between loading, selected document, and empty states.

#### `ProvidersSettingsPanel`

- Renders:
  - Provider stats cards, provider table, add/edit dialog, fallback-chain explainer.
- API calls:
  - `GET /api/admin/providers`
  - `GET /api/admin/providers?action=stats`
  - `GET /api/admin/providers?action=test&id=...`
  - `GET /api/admin/providers?action=health`
  - `POST /api/admin/providers`
  - `PUT /api/admin/providers`
  - `DELETE /api/admin/providers?id=...`
- User interactions:
  - Refresh providers/stats.
  - Run health check.
  - Add provider.
  - Edit provider.
  - Toggle provider active state.
  - Test provider.
  - Delete provider.
- Conditional rendering:
  - Loading/empty states.
  - Test result text inline per provider.
  - Dialog resets when closed.
  - Status/role badges depend on provider state.

#### `ConnectorsSettingsPanel`

- Renders:
  - Connector stats cards, connector table, add/edit dialog, test-result dialog, injection-method explainer.
- API calls:
  - `GET /api/admin/connectors`
  - `GET /api/admin/connectors?action=stats`
  - `GET /api/admin/connectors?action=test&id=...`
  - `GET /api/admin/connectors?action=clear-cache`
  - `POST /api/admin/connectors`
  - `PUT /api/admin/connectors`
  - `DELETE /api/admin/connectors?id=...`
- User interactions:
  - Refresh connectors/stats.
  - Clear connector cache.
  - Add connector.
  - Edit connector.
  - Toggle connector active state.
  - Test connector.
  - Delete connector.
  - Pre-fill AQI example.
  - Add/remove topic mappings.
- Conditional rendering:
  - Loading/empty states.
  - Test-result dialog only when a test has run.
  - Cache TTL input only when caching is enabled.

#### `SettingsPanel`

- Renders:
  - Appearance, chat/history, data management, and version cards.
- API calls:
  - `GET /api/export?type=stats&format=json` when exporting.
- User interactions:
  - Change theme.
  - Toggle source display.
  - Change max history items.
  - Save settings.
  - Export stats JSON.
  - Clear local stored data.
- Conditional rendering:
  - Save button shows `Saving...` or `Saved`.
  - Theme icon depends on selected theme.

#### `AppSettingsProvider`

- Renders:
  - Nothing visible; it applies theme classes/data attributes to `<html>`.
- API calls:
  - None.
- User interactions:
  - None direct.
- Conditional rendering:
  - Reacts to `theme === 'system'` by listening to `prefers-color-scheme`.

#### `DocumentList`

- Renders:
  - Search box, upload button, list of documents, empty state, loading skeletons.
- API calls:
  - `GET /api/documents`
  - `DELETE /api/documents?id=...`
- User interactions:
  - Search documents.
  - Select document.
  - Open upload flow.
  - Delete document from dropdown menu.
- Conditional rendering:
  - Skeletons while loading.
  - Empty state when no docs exist.
  - Upload action only if `onUploadClick` prop is provided.

#### `DocumentUploadModal`

- Renders:
  - Modal form for file upload or manual text entry.
- API calls:
  - `POST /api/upload` when a file is attached.
  - `POST /api/documents` when only text content is entered.
- User interactions:
  - Choose file.
  - Fill title/category/audience/content.
  - Submit upload.
  - Close modal.
- Conditional rendering:
  - File metadata preview when a file is selected.
  - Content label changes when file is present.
  - Submit disabled until required fields exist.

#### `AdvancedSearch`

- Renders:
  - Debounced document search, expandable filters, search history badges, results list.
- API calls:
  - `GET /api/documents` with search/filter query params.
- User interactions:
  - Type query.
  - Toggle filters.
  - Filter by category, audience, year range.
  - Clear filters.
  - Submit search.
  - Reuse search history.
  - Select result document.
- Conditional rendering:
  - Filter panel toggle.
  - Search history only when query is empty and history exists.
  - Loader while search runs.
  - Empty result state.

## 3. PRISMA MODELS

Source: `backend/prisma/schema.prisma`

Important note:

- Prisma models here do not support Mongoose-style schema hooks, virtuals, or inline validators.
- No Prisma client middleware is registered in `backend/src/lib/db.ts`.
- Validation is handled primarily with Zod schemas in `backend/src/lib/validators/index.ts`.

### `User`

- Fields:
  - `id: String` primary key, default `cuid()`
  - `email: String`
  - `username: String?`
  - `passwordHash: String?`
  - `name: String`
  - `role: String` default `'viewer'`
  - `department: String?`
  - `isActive: Boolean` default `true`
  - `createdAt: DateTime` default `now()`
  - `updatedAt: DateTime` auto-updated
- Required fields:
  - `id`, `email`, `name`, `role`, `isActive`, `createdAt`, `updatedAt`
- Unique fields:
  - `email`
  - `username`
- Relations:
  - `chatSessions`, `documents`, `feedback`, `refreshTokens`, `llmProvidersAdded`
- Validators/middleware/hooks:
  - None at Prisma-model layer
  - Route-level Zod validation for create/update user payloads
  - Password hashing happens in route logic, not model hooks

### `RefreshToken`

- Fields:
  - `id: String` primary key
  - `userId: String`
  - `hashedToken: String`
  - `expiresAt: DateTime`
  - `revoked: Boolean` default `false`
  - `createdAt: DateTime` default `now()`
  - `updatedAt: DateTime` auto-updated
- Required fields:
  - `id`, `userId`, `hashedToken`, `expiresAt`, `revoked`, `createdAt`, `updatedAt`
- Unique fields:
  - `hashedToken`
- Indexes:
  - `userId`, `expiresAt`, `revoked`
- Validators/middleware/hooks:
  - None at model layer

### `Document`

- Fields:
  - `id: String`
  - `ownerId: String?`
  - `title: String`
  - `content: String`
  - `summary: String?`
  - `source: String?`
  - `sourceUrl: String?`
  - `category: String?`
  - `reportSeries: String?`
  - `year: Int?`
  - `audience: String` default `'General Public'`
  - `author: String?`
  - `tags: String?` stored JSON string
  - `language: String` default `'en'`
  - `fileSize: Int?`
  - `fileType: String?`
  - `isActive: Boolean` default `true`
  - `createdAt: DateTime`
  - `updatedAt: DateTime`
- Required fields:
  - `id`, `title`, `content`, `audience`, `language`, `isActive`, `createdAt`, `updatedAt`
- Unique fields:
  - None
- Indexes:
  - `ownerId`, `category`, `year`, `isActive`
- Validators/middleware/hooks:
  - None at model layer
  - Zod create/update document validation is route/service-level

### `DocumentChunk`

- Fields:
  - `id: String`
  - `documentId: String`
  - `content: String`
  - `chunkIndex: Int`
  - `embedding: String?` stored JSON string
  - `metadata: String?` stored JSON string
  - `createdAt: DateTime`
- Required fields:
  - `id`, `documentId`, `content`, `chunkIndex`, `createdAt`
- Unique fields:
  - None
- Indexes:
  - `documentId`, `chunkIndex`
- Validators/middleware/hooks:
  - None at model layer

### `ChatSession`

- Fields:
  - `id: String`
  - `userId: String?`
  - `documentId: String?`
  - `title: String?`
  - `createdAt: DateTime`
  - `updatedAt: DateTime`
- Required fields:
  - `id`, `createdAt`, `updatedAt`
- Unique fields:
  - None
- Indexes:
  - `userId`, `documentId`, `updatedAt`
- Validators/middleware/hooks:
  - None at model layer

### `ChatMessage`

- Fields:
  - `id: String`
  - `sessionId: String`
  - `role: String`
  - `content: String`
  - `sources: String?` stored JSON string
  - `metadata: String?` stored JSON string
  - `createdAt: DateTime`
- Required fields:
  - `id`, `sessionId`, `role`, `content`, `createdAt`
- Unique fields:
  - None
- Indexes:
  - `sessionId`, `createdAt`
- Validators/middleware/hooks:
  - None at model layer

### `Feedback`

- Fields:
  - `id: String`
  - `messageId: String`
  - `userId: String?`
  - `rating: Int`
  - `comment: String?`
  - `createdAt: DateTime`
- Required fields:
  - `id`, `messageId`, `rating`, `createdAt`
- Unique fields:
  - None
- Indexes:
  - `messageId`, `rating`
- Validators/middleware/hooks:
  - None at model layer
  - Zod feedback validation enforces `rating` 1..5

### `SystemConfig`

- Fields:
  - `id: String`
  - `key: String`
  - `value: String`
  - `description: String?`
  - `updatedAt: DateTime`
- Required fields:
  - `id`, `key`, `value`, `updatedAt`
- Unique fields:
  - `key`
- Validators/middleware/hooks:
  - None

### `AnalyticsEvent`

- Fields:
  - `id: String`
  - `eventType: String`
  - `userId: String?`
  - `sessionId: String?`
  - `documentId: String?`
  - `metadata: String?`
  - `createdAt: DateTime`
- Required fields:
  - `id`, `eventType`, `createdAt`
- Unique fields:
  - None
- Indexes:
  - `eventType`, `createdAt`
- Validators/middleware/hooks:
  - None

### `AuditLog`

- Fields:
  - `id: String`
  - `action: String`
  - `entityType: String`
  - `entityId: String`
  - `userId: String?`
  - `oldData: String?`
  - `newData: String?`
  - `createdAt: DateTime`
- Required fields:
  - `id`, `action`, `entityType`, `entityId`, `createdAt`
- Unique fields:
  - None
- Indexes:
  - `action`, `entityType`, `entityId`, `createdAt`
- Validators/middleware/hooks:
  - None

### `LLMProvider`

- Fields:
  - `id: String`
  - `name: String`
  - `displayName: String`
  - `providerType: String` default `'openai_compat'`
  - `baseUrl: String`
  - `apiKeyEnvVar: String?`
  - `modelId: String`
  - `defaultParams: String?` default `'{}'`
  - `role: String` default `'available'`
  - `priority: Int` default `100`
  - `isActive: Boolean` default `true`
  - `timeoutSeconds: Int` default `120`
  - `maxTokens: Int` default `1024`
  - `temperature: Float` default `0.1`
  - `notes: String?`
  - `healthStatus: String` default `'unknown'`
  - `lastHealthCheck: DateTime?`
  - `requestCount: Int` default `0`
  - `errorCount: Int` default `0`
  - `avgLatencyMs: Float?`
  - `addedBy: String?`
  - `createdAt: DateTime`
  - `updatedAt: DateTime`
- Required fields:
  - `id`, `name`, `displayName`, `providerType`, `baseUrl`, `modelId`, `role`, `priority`, `isActive`, `timeoutSeconds`, `maxTokens`, `temperature`, `healthStatus`, `requestCount`, `errorCount`, `createdAt`, `updatedAt`
- Unique fields:
  - `name`
- Indexes:
  - `role`, `isActive`, `priority`
- Validators/middleware/hooks:
  - None at model layer
  - URL/env-var validation is enforced in admin provider routes/services

### `DataConnector`

- Fields:
  - `id: String`
  - `name: String`
  - `displayName: String`
  - `connectorType: String`
  - `endpointUrl: String`
  - `apiKeyEnvVar: String?`
  - `authMethod: String` default `'none'`
  - `authHeader: String?`
  - `requestMethod: String` default `'GET'`
  - `requestBodyTemplate: String?`
  - `responseMapping: String?`
  - `injectAs: String` default `'system_context'`
  - `injectionTemplate: String?`
  - `isActive: Boolean` default `true`
  - `refreshIntervalSec: Int` default `300`
  - `cacheEnabled: Boolean` default `true`
  - `cacheTtlSec: Int` default `300`
  - `lastFetchedAt: DateTime?`
  - `lastFetchStatus: String?`
  - `lastFetchError: String?`
  - `requestCount: Int` default `0`
  - `errorCount: Int` default `0`
  - `addedBy: String?`
  - `createdAt: DateTime`
  - `updatedAt: DateTime`
- Required fields:
  - `id`, `name`, `displayName`, `connectorType`, `endpointUrl`, `authMethod`, `requestMethod`, `injectAs`, `isActive`, `refreshIntervalSec`, `cacheEnabled`, `cacheTtlSec`, `requestCount`, `errorCount`, `createdAt`, `updatedAt`
- Unique fields:
  - `name`
- Indexes:
  - `connectorType`, `isActive`
- Validators/middleware/hooks:
  - None at model layer
  - URL/env-var validation is enforced in admin connector routes/services

### `ConnectorTopicMapping`

- Fields:
  - `id: String`
  - `connectorId: String`
  - `topic: String`
  - `priority: Int` default `100`
  - `isActive: Boolean` default `true`
  - `conditions: String?` default `'{}'`
- Required fields:
  - `id`, `connectorId`, `topic`, `priority`, `isActive`
- Unique fields:
  - Composite unique: `(connectorId, topic)`
- Indexes:
  - `topic`, `isActive`
- Validators/middleware/hooks:
  - None

### `ConnectorCache`

- Fields:
  - `id: String`
  - `connectorId: String`
  - `cacheKey: String`
  - `data: String`
  - `fetchedAt: DateTime`
  - `expiresAt: DateTime`
- Required fields:
  - `id`, `connectorId`, `cacheKey`, `data`, `fetchedAt`, `expiresAt`
- Unique fields:
  - Composite unique: `(connectorId, cacheKey)`
- Indexes:
  - `connectorId`, `expiresAt`
- Validators/middleware/hooks:
  - None

### `LLMRequestLog`

- Fields:
  - `id: String`
  - `providerId: String?`
  - `sessionId: String?`
  - `messageId: String?`
  - `query: String?`
  - `modelUsed: String?`
  - `requestTokens: Int?`
  - `responseTokens: Int?`
  - `latencyMs: Int?`
  - `status: String`
  - `errorMessage: String?`
  - `fallbackFrom: String?`
  - `fallbackTo: String?`
  - `createdAt: DateTime`
- Required fields:
  - `id`, `status`, `createdAt`
- Unique fields:
  - None
- Indexes:
  - `providerId`, `sessionId`, `status`, `createdAt`
- Validators/middleware/hooks:
  - None

## 4. AUTHENTICATION SURFACES

### How auth works

- Access tokens:
  - JWT, signed with `HS256`
  - Payload contains `userId` and `role`
  - Lifetime is 15 minutes
- Refresh tokens:
  - Random 48-byte value
  - Stored hashed in PostgreSQL `RefreshToken`
  - Lifetime is 7 days
  - Rotated on refresh
- Backend auth enforcement:
  - `backend/src/middleware/auth.ts` contains JWT verification middleware and admin-role check
  - `backend/src/lib/route-middleware.ts` adapts those middleware functions into Next.js route handlers
- Frontend route protection:
  - `frontend/src/proxy.ts` blocks `/admin` unless the user is an admin
  - If access token is expired, frontend attempts refresh before redirecting
- Separate admin API-key auth:
  - `backend/src/lib/auth.ts` protects `/api/metrics` with `ADMIN_API_KEY`
  - This is distinct from JWT login auth

### Where tokens are stored

- Frontend browser cookies:
  - Access token cookie: `token`
  - Refresh token cookie: `refreshToken`
- Cookie flags:
  - Frontend cookies use `httpOnly`, `sameSite: 'strict'`, `path: '/'`
  - `secure` is enabled in production on the frontend auth helper
  - Backend refresh cookie is always issued as `httpOnly`, `secure: true`, `sameSite: 'strict'`
- Local/session storage:
  - Auth tokens are not stored in `localStorage`
  - UI preferences and chat/session UI state are stored in `localStorage` via Zustand persistence

### Routes that require JWT auth

- `GET /api/admin/health/full`
- `GET /api/admin/pipeline`
- `POST /api/admin/pipeline`
- `GET /api/admin/connectors`
- `POST /api/admin/connectors`
- `PUT /api/admin/connectors`
- `DELETE /api/admin/connectors`
- `GET /api/admin/providers`
- `POST /api/admin/providers`
- `PUT /api/admin/providers`
- `DELETE /api/admin/providers`
- `GET /api/admin/system/providers`
- `POST /api/admin/system/providers`
- `PUT /api/admin/system/providers/[id]`
- `DELETE /api/admin/system/providers/[id]`
- `POST /api/admin/system/providers/[id]/test`
- `GET /api/cache`
- `POST /api/cache`
- `GET /api/chat`
- `DELETE /api/chat`
- `GET /api/documents`
- `POST /api/documents`
- `PATCH /api/documents`
- `DELETE /api/documents`
- `GET /api/export`
- `POST /api/feedback`
- `GET /api/feedback`
- `POST /api/ingest`
- `GET /api/ingest`
- `PUT /api/ingest`
- `DELETE /api/ingest`
- `POST /api/query`
- `GET /api/query`
- `GET /api/sessions`
- `POST /api/sessions`
- `DELETE /api/sessions`
- `GET /api/stats`
- `POST /api/upload`
- `GET /api/upload`
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users`
- `DELETE /api/users`

### Routes that are admin-role restricted

- All `/api/admin/**` routes
- `GET /api/cache`
- `POST /api/cache`
- `POST /api/documents`
- `GET /api/stats`
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users`
- `DELETE /api/users`

### Routes that are owner-scoped after auth

- `GET /api/chat?sessionId=...`
- `DELETE /api/chat?id=...`
- `GET /api/documents?id=...`
- `PATCH /api/documents?id=...`
- `DELETE /api/documents?id=...`
- `GET /api/export?type=chat&sessionId=...`
- `POST /api/feedback`
- `GET /api/feedback?messageId=...`
- `GET /api/ingest?documentId=...`
- `PUT /api/ingest`
- `DELETE /api/ingest?id=...`
- `GET /api/sessions?id=...`
- `DELETE /api/sessions?id=...`
- `GET /api/upload?documentId=...`

### Public or partially public auth surfaces

- `POST /api/auth/login`: public
- `POST /api/auth/logout`: public route, but effective behavior depends on refresh cookie
- `POST /api/auth/refresh`: public route, but effective behavior depends on refresh cookie
- `POST /api/chat`: anonymous allowed unless an auth header is sent, in which case it must be valid
- `GET /api`: public
- `GET /api/health`: public
- `GET /api/metrics`: not JWT-based; protected by admin API key instead

### Frontend route protection

- `/admin` and `/admin/:path*` are protected by `frontend/src/proxy.ts`
- Behavior:
  - Valid admin token => allow
  - Valid non-admin token => redirect to `/403`
  - Expired token + valid refresh token => refresh, then allow or redirect `/403`
  - No valid auth => redirect to `/login`
- Playwright bypass:
  - Only when `PLAYWRIGHT_TEST=1`
  - Only outside production
  - Only on `localhost` or `127.0.0.1`

## 5. EXTERNAL DEPENDENCIES

### External services and APIs

- PostgreSQL
  - Primary application database via Prisma
- OpenAI-compatible LLM endpoints
  - Configurable provider registry supports local `vLLM`, `Ollama`, Azure OpenAI, and other OpenAI-compatible APIs
- WAQI / World Air Quality Index API
  - Seeded example connector via `AQI_API_URL` and `AQI_API_KEY`
- OpenWeather API
  - Seeded example connector via `WEATHER_API_URL` and `WEATHER_API_KEY`

### Runtime SDKs / libraries used to integrate external systems

- `@prisma/client` / Prisma
  - Database ORM/client
- `jsonwebtoken`
  - JWT signing and verification on backend
- `bcryptjs`
  - Password hashing
- `pdf-parse`
  - PDF text extraction
- `mammoth`
  - DOCX parsing
- `word-extractor`
  - Word document extraction
- `sharp`
  - File/image processing support in the ingest stack

### Frontend/runtime support libraries

- `next`, `react`, `react-dom`
  - App framework/runtime
- `zustand`
  - Client state persistence
- `zod`
  - Request validation
- `@radix-ui/*`
  - UI primitives
- `lucide-react`
  - Icons

## 6. ENVIRONMENT VARIABLES

Only app-relevant env vars are listed here; internal Next.js/framework build vars are intentionally excluded.

### Core app

- `DATABASE_URL`
  - PostgreSQL connection string for Prisma
- `JWT_SECRET`
  - Secret used to sign and verify JWT access tokens
- `ADMIN_API_KEY`
  - Static API key used by `/api/metrics`
- `BACKEND_URL`
  - Frontend proxy target for backend auth/refresh calls; defaults to `http://localhost:3001`
- `NODE_ENV`
  - Controls production/dev behavior such as secure cookie handling and query logging
- `PLAYWRIGHT_TEST`
  - Enables local admin-route bypass in frontend proxy and affects some backend chat test behavior

### Rate limiting

- `TRUST_PROXY_HEADERS`
  - If set to `1`, rate limiter trusts `x-forwarded-for` / `x-real-ip`
- `RATE_LIMIT_CHAT_WINDOW`
- `RATE_LIMIT_CHAT_MAX`
- `RATE_LIMIT_CHAT_BLOCK_DURATION`
- `RATE_LIMIT_UPLOAD_WINDOW`
- `RATE_LIMIT_UPLOAD_MAX`
- `RATE_LIMIT_UPLOAD_BLOCK_DURATION`
- `RATE_LIMIT_WINDOW`
- `RATE_LIMIT_MAX`
- `RATE_LIMIT_BLOCK_DURATION`
- `RATE_LIMIT_ADMIN_WINDOW`
- `RATE_LIMIT_ADMIN_MAX`
- `RATE_LIMIT_ADMIN_BLOCK_DURATION`
- `RATE_LIMIT_AUTH_WINDOW`
- `RATE_LIMIT_AUTH_MAX`
- `RATE_LIMIT_AUTH_BLOCK_DURATION`
  - All of the above override per-endpoint rate-limit windows, maxima, and block durations

### Local provider / connector bootstrapping

- `VLLM_BASE_URL`
  - Primary seeded LLM provider base URL
- `VLLM_FALLBACK_URL`
  - First fallback seeded LLM provider base URL
- `VLLM_FALLBACK2_URL`
  - Second fallback seeded LLM provider base URL
- `AQI_API_URL`
  - Seeded AQI connector endpoint
- `WEATHER_API_URL`
  - Seeded weather connector endpoint
- `AQI_API_KEY`
  - API key for AQI connector
- `WEATHER_API_KEY`
  - API key for weather connector

### PostgreSQL bootstrap scripts

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DB`
  - Used by local helper scripts to construct or validate `DATABASE_URL`

### Dynamic env var references stored in DB

- `LLMProvider.apiKeyEnvVar`
  - Admin-configured provider records can reference arbitrary env var names for provider secrets
- `DataConnector.apiKeyEnvVar`
  - Admin-configured connector records can reference arbitrary env var names for connector secrets

## 7. UNFINISHED OR RISKY CODE

### TODOs and placeholders

- `backend/src/lib/services/advanced-rag-service.ts`
  - `TODO` notes native streaming support should eventually move into the provider registry layer.
- `backend/src/lib/services/embedding-service.ts`
  - Contains an explicit "placeholder" comment for actual embedding generation.

### Hardcoded values that should probably be dynamic

- `frontend/src/components/chat/sidebar.tsx`
  - "Knowledge Base Stats" cards display `--` placeholders rather than live document/chunk counts.
- `frontend/src/components/chat/sidebar.tsx`
  - Footer `Help` button is visually present but does not navigate or open a help surface.
- `frontend/src/app/page.tsx`
  - Header badge text `Phase 6 Complete` is hardcoded.
- `frontend/src/components/settings/settings-panel.tsx`
  - Version badges `v2.0.0` and `Phase 6-7` are hardcoded.
- `frontend/src/components/chat/sidebar.tsx`
  - `selectedReportSeries` state is captured in UI but not sent into chat queries or document queries.

### UI that appears functional but is weakly or not fully wired

- `frontend/src/components/documents/advanced-search.tsx`
  - `hasEmbedding` filter exists in component state but is never sent to the backend.
- `frontend/src/components/chat/sidebar.tsx`
  - Document title search field is local UI state and is not connected to the docs tab or chat request filters.
- `frontend/src/components/admin/connectors-settings-panel.tsx`
  - Cache clear success uses `alert(...)` instead of integrated UI feedback.

### Async code with weak error handling or developer-only feedback

- `frontend/src/components/chat/sidebar.tsx`
  - Session load/delete failures only log to console; there is no user-visible error state.
- `frontend/src/components/documents/document-list.tsx`
  - Fetch/delete failures only log to console.
- `frontend/src/components/documents/advanced-search.tsx`
  - Search failures only log to console.
- `frontend/src/components/admin/providers-settings-panel.tsx`
  - Several failure paths only log to console; save/toggle/delete actions have no user-visible failure feedback.
- `frontend/src/components/admin/connectors-settings-panel.tsx`
  - Same pattern as providers panel.
- `frontend/src/components/admin/enhanced-dashboard.tsx`
  - `fetchStats()` failure only logs to console.

### Potentially confusing or risky route behavior

- `PATCH /api/documents`
  - This is not an update route; it behaves as a legacy single-document fetch by query string.
- `POST /api/chat`
  - Accepts anonymous requests unless an auth header is sent; that is intentional but materially changes threat surface.
- `frontend/src/lib/auth.ts`
  - Frontend verifies JWTs using `JWT_SECRET`. This means the frontend server layer must know the signing secret, which is functional but expands secret distribution.
- `backend/src/lib/security/rate-limiter.ts`
  - In-memory store only. Comments indicate Redis should be used in production for multi-instance correctness.
- `backend/src/lib/security/rate-limiter.ts`
  - If `TRUST_PROXY_HEADERS` is not enabled, client identifier collapses to `'unknown'`, which can cause coarse rate limiting across users.
- `backend/src/lib/security/ssrf-guard.ts`
  - Local/private provider hosts are intentionally allowed for admin-configured providers except metadata endpoints; this is an acknowledged SSRF tradeoff.

### Direct database access / sanitization review

- No obvious raw user-controlled SQL was found.
- Prisma is the primary DB access layer, which parameterizes values rather than string-concatenating SQL.
- Validation coverage is generally good at route boundaries through Zod.
- The only raw SQL observed was `SELECT 1` in health checks, with no user input.
- User-controlled query params and request bodies mostly pass through typed parsing before Prisma usage.

### Other implementation notes worth carrying into testing

- `.env` and local DB artifacts are ignored in `.gitignore`.
- Prisma local `.db` artifacts are also ignored, indicating they are not intended fixtures.
- AGENTS.md is stale about auth; active runtime code clearly has JWT auth plus protected admin routing.
