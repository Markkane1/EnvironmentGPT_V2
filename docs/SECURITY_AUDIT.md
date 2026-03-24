# Security Audit

## 2026-03-23

- Hardened JWT validation to require `HS256` and an `exp` claim, and added coverage for expired and `alg:none` token rejection.
- Enforced authenticated access on sensitive backend routes including `stats`, `cache`, `feedback`, and `query`, with ownership checks on feedback-linked message access.
- Added request-size enforcement in the live backend proxy layer before route parsing, plus server-side filename sanitization for upload and ingest flows.
- Added/verified strict `httpOnly` cookie handling for frontend access and refresh tokens, with refresh-based recovery for expired access tokens on admin-gated routes.
- Removed Next `ignoreBuildErrors` bypasses and restored real TypeScript validation in build.
- `npm audit --json` now reports `0` critical and `0` high findings. Remaining dependency findings are `1` low and `2` moderate (`diff`, `lodash`, `lodash-es`).
- `retire.js` still reports a medium-severity Lodash signature inside vendored Next frontend runtime bundles under `frontend/node_modules/next/dist/compiled/*`. This is framework-supplied code, not application source, and remains the only frontend library residue from the final scan.

## 2026-03-24

- Fixed: `frontend/src/proxy.ts` now limits the Playwright-only `/admin` auth bypass to localhost requests in non-production environments.
- Fixed: `backend/src/lib/security/ssrf-guard.ts` now blocks private, loopback, and single-label internal provider base URLs by default. Local provider development remains available only behind the explicit `ALLOW_PRIVATE_PROVIDER_URLS=1` opt-in.
- Fixed: `backend/src/lib/security/rate-limiter.ts` now ignores forwarded IP headers by default and only trusts them when `TRUST_PROXY_HEADERS=1` is explicitly configured behind a trusted proxy.
- Fixed: `backend/src/app/api/auth/refresh/route.ts` now rotates refresh tokens on successful use, updating the stored hash and reissuing the cookie to shrink replay windows.
