# Vibecode Audit

## 2026-03-24

### Fake UI Elements

- Fixed `frontend/src/components/chat/sidebar.tsx` so the documents tab no longer passes a no-op `onSelectDocument` handler into `DocumentList`.
- Removed the non-functional sidebar report-series filter and sidebar document search controls because they had local state but no downstream behavior.
- Replaced the sidebar footer `Help` button with a real external link to `APP_CONFIG.organizationUrl`.

### Hardcoded Values

- Fixed `frontend/src/app/page.tsx` to use `APP_CONFIG.organizationUrl` instead of repeating the EPA Punjab URL inline.
- Fixed `frontend/src/app/api/auth/login/route.ts` to use `getBackendUrl()` instead of duplicating a literal backend fallback URL.
- Fixed `frontend/src/lib/auth.ts` and `frontend/next.config.ts` to share `frontend/src/lib/runtime-config.ts` instead of repeating the backend fallback URL in multiple runtime paths.
- Kept provider and connector example URLs in the admin forms. Those are instructional placeholders, not runtime-coupled production values.

### Missing Loading Or Error States

- Fixed `frontend/src/components/chat/sidebar.tsx` to show visible session-load and knowledge-base-stats errors.
- Fixed `frontend/src/components/admin/enhanced-dashboard.tsx` to show a dashboard-level alert when stats refresh fails and to toast cache-clear failures.
- Fixed `frontend/src/components/settings/settings-panel.tsx` to show an in-flight export state and prevent repeated export clicks.
- Fixed `frontend/src/components/settings/settings-panel.tsx` so persisted-store hydration no longer overwrites in-progress edits on slower/mobile renders.
- Preserved and extended visible error handling in:
  - `frontend/src/components/admin/providers-settings-panel.tsx`
  - `frontend/src/components/admin/connectors-settings-panel.tsx`
  - `frontend/src/components/documents/document-list.tsx`

### Double Submit Vulnerabilities

- Fixed `frontend/src/components/admin/providers-settings-panel.tsx` by adding `isSaving` guards and disabled submit/cancel actions during save.
- Fixed `frontend/src/components/admin/connectors-settings-panel.tsx` by adding `isSaving` guards and disabled submit/cancel actions during save.

### Console Error Hygiene

- Added browser-level coverage for every real app page:
  - `/`
  - `/login`
  - `/403`
  - `/settings`
  - `/admin`
- Verified those pages load without `console.error`, page crashes, or unhandled promise rejections in Playwright.

### Orphaned Code Cleanup

- Removed `frontend/src/components/documents/advanced-search.tsx` because it was not imported anywhere in the frontend.
- Removed `frontend/src/components/ui/sidebar.tsx` because it was not imported anywhere in the frontend and had become dead shadcn scaffold.

### Tests Added Or Updated

- Updated component regressions for:
  - `tests/components/providers-settings-panel.test.tsx`
  - `tests/components/connectors-settings-panel.test.tsx`
  - `tests/components/admin-dashboard.test.tsx`
  - `tests/components/settings-pages.test.tsx`
  - `tests/components/home-page.test.tsx`
- Added `tests/components/sidebar.test.tsx`
- Added `tests/e2e/vibecode.spec.ts`

### Remaining Notes

- No fake UI elements found in the active surfaces after cleanup.
- Removed a production-path `console.log` from `backend/src/lib/services/vector-store-service.ts`.
- Replaced the residual `TODO` marker in `backend/src/lib/services/advanced-rag-service.ts` with a concrete implementation note.
- Added the required `data-scroll-behavior="smooth"` and mobile source-panel description so the app no longer emits the previous Next.js and Radix accessibility warnings during Playwright runs.
- No new Critical or High findings remain from this audit pass.
