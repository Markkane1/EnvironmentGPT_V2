# Performance Findings

## Resolved in this sweep

- `backend/src/lib/services/document-service.ts`
  - Replaced per-chunk `documentChunk.create()` calls with a single `createMany()` bulk insert. This removed the write-amplification path that scaled linearly with chunk count during ingestion.
  - Reworked `getStatistics()` to use `count()` plus `groupBy()` instead of loading every active document into memory.
- `backend/src/lib/services/rag-service.ts`
  - Replaced per-source `document.findUnique()` lookups with a single batched `document.findMany()` fetch for the top-ranked source documents.
- `backend/src/app/api/documents/route.ts`
  - Added hard clamps for `pageSize` and `limit` at `100`.
  - Collection responses now truncate oversized `content` payloads and omit nested `chunks` data. Full document bodies are still available from the single-document `id` lookup.
- `backend/src/app/api/stats/route.ts`
  - Feedback stats now use `count()`, `aggregate()`, and `groupBy()` instead of scanning all feedback rows in memory.
- `backend/prisma/schema.prisma`
  - Added hot-path indexes for fields actively filtered or sorted in runtime code:
    - `User.role`
    - `User.isActive`
    - `Document.reportSeries`
    - `Document.audience`
    - `Document.createdAt`
    - `ChatSession.createdAt`
    - `ChatMessage.role`
    - `Feedback.userId`

## Review Results

### N+1 query review

- Collection routes were reviewed for per-item DB lookups.
- The real N+1 patterns found were in document chunk persistence and legacy RAG source hydration. Both are now fixed.
- No additional list-route N+1 pattern remains in the audited route handlers after this pass.

### Large payload review

- Public document collection endpoints were the main payload risk because they allowed arbitrary page sizes and returned full document bodies. Both issues are now fixed.
- Admin provider and connector list routes remain intentionally unpaginated because they expose bounded configuration registries rather than user-scaled content sets. No large nested blobs are returned from those routes.

### Async error-handling review

- DB-facing route handlers already use `try/catch`.
- The route files without local `try/catch` are thin wrappers or health/metrics endpoints that already fail closed and do not expose unsafe rejection paths:
  - `backend/src/app/api/admin/system/providers/[id]/route.ts`
  - `backend/src/app/api/health/route.ts`
  - `backend/src/app/api/metrics/route.ts`

### Memory leak review

- No route-local event listeners were found.
- The backend timers found during the scan are lifecycle-managed:
  - `backend/src/lib/security/rate-limiter.ts` uses a module cleanup timer with `.unref()`
  - `backend/src/lib/services/response-cache.ts` exposes `stopCleanupTimer()` and also `.unref()`s the interval
- No additional timer or listener leak required code changes in this sweep.

## Regression Coverage

- `tests/integration/performance/document-route-performance.test.ts`
- `tests/integration/performance/backend-performance-regressions.test.ts`
