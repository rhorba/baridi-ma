# ACTIVITY — Baridi.ma



## MILESTONE — 2026-07-01
- PRD approved: docs/prd-baridi-ma.md. MVP scope: auth+roles, shipment CRUD, MQTT ingestion, threshold alerting, compliance PDF export, admin panel. CMI payments, GPS maps, mobile apps, marketplace deferred.

## MILESTONE — 2026-07-01
- System design approved: docs/system-design-baridi-ma.md. 5 services (Auth, Shipment, Ingestion, Alerting, Compliance/PDF), no message broker beyond MQTT, shared Postgres instance with per-service schemas.

## MILESTONE — 2026-07-01
- Architecture approved: docs/architecture-baridi-ma.md. Next.js BFF + 5 Fastify/TS services, synchronous PDF export, stubbed PaymentProvider adapter.

## MILESTONE — 2026-07-01
- Security baseline approved: docs/security-baridi-ma.md. JWT auth, RBAC+ownership checks, no MFA for MVP, append-only sensor readings, SHA-256 hashed compliance PDFs.

## MILESTONE — 2026-07-01
- Database design approved: docs/database-baridi-ma.md. 5 schemas, TimescaleDB hypertable for sensor_readings, append-only enforced via revoked grants.

## MILESTONE — 2026-07-01
- UX foundation approved: docs/ux-baridi-ma.md. Personas, IA, 3 core flows, shipment-detail wireframe.

## MILESTONE — 2026-07-01
- UI foundation approved: docs/ui-baridi-ma.md. Tailwind v4 + shadcn/ui, status-color tokens, Recharts.

## MILESTONE — 2026-07-01
- Test strategy approved: docs/test-strategy-baridi-ma.md. Risk-based pyramid, ATDD scenarios per FR, adversarial checklist, 80% coverage gate.

## MILESTONE — 2026-07-01
- DevOps foundation approved: docs/devops-baridi-ma.md. Single VPS + Docker Compose, GitHub Actions CI (lint/test/security-scan/build/deploy), sensor-simulator container.

## PUSH — 2026-07-01
- Commit 0d9e2e2 "docs: foundation documents for baridi-ma" pushed to origin/main.
- All 10 foundation docs approved and shipped: PRD, system-design, architecture, security, database, ux, ui, test-strategy, devops, stories.

## ACTIVITY — 2026-07-01
- Batch 1 (Story 1.1) complete: npm workspaces monorepo (apps/web, services/{auth,shipment,ingestion,alerting,compliance}, packages/shared-types), docker-compose.yml (Postgres+TimescaleDB, Mosquitto, 6 services), migration files 001-005 + runner (db/migrate.js), Fastify health-check pattern verified working (auth-service returns 200 at /health).
- Fixed critical fast-jwt JWT-bypass CVE (bumped @fastify/jwt to ^10.1.0) and nodemailer CVEs (bumped to ^9.0.3) found via npm audit before any code shipped on them.
- Known accepted issue: postcss <8.5.10 bundled internally by next@15.5.19 (moderate XSS in CSS stringify) - not fixable without downgrading Next; low real risk (no user-supplied CSS reaches it). Revisit when Next ships a patched postcss.
- All 6 workspaces build cleanly (npm run build). docker compose config validated syntactically; full docker-compose up --build not yet run (deferred to VERIFY).

## ACTIVITY — 2026-07-01
- Full docker-compose up --build verified end-to-end: all 6 services healthy, migrations applied to live TimescaleDB container, hypertable confirmed (ingestion.sensor_readings).
- Fixed port conflict: host 5432 was taken by an unrelated local project (atlas-events-postgres-1). Remapped baridi-ma postgres to host 5433 (internal Docker network unaffected). Updated .env / .env.example accordingly.

## ACTIVITY — 2026-07-01
- Batch 2 (Story 1.2) complete: Auth Service built with register/login/refresh/me. 10 unit tests + 6 integration tests (Testcontainers, real Postgres) all passing. Verified live against Docker container: register, login (access 15m + refresh 7d tokens), /auth/me with and without token, admin self-registration correctly blocked (400).
- Security additions beyond literal story text, consistent with approved Security baseline: (1) public /auth/register restricted to shipper/carrier/receiver only, admin excluded to prevent privilege escalation; (2) access+refresh token pair per Security doc §3, not a single JWT; (3) fail-fast on missing JWT_SECRET rather than a hardcoded dev fallback secret.
- Renamed env vars: NEXTAUTH_SECRET/NEXTAUTH_URL (leftover from initial env guess, unused since we are not using NextAuth.js) replaced with JWT_SECRET + INTERNAL_SERVICE_TOKEN (Security doc §7 service-to-service trust, to be used by BFF in Batch 3).
- Fixed high-severity undici CVE pulled in transitively by testcontainers (bumped testcontainers ^10 -> ^12). Only postcss-in-Next-internals (previously accepted, moderate) remains in npm audit.

## ACTIVITY — 2026-07-01
- Batch 3 (Story 1.3) complete: BFF wired to Auth Service. Login/register/dashboard pages (Tailwind v4 + UI-doc design tokens), API routes (register/login/refresh/logout/me) proxying to Auth Service with x-internal-token forwarding, BFF-side JWT verification on /api/auth/me (ADR-1), refresh-token httpOnly cookie, middleware.ts route protection.
- Verified live end-to-end through the BFF (not just Auth Service directly): register, login sets httpOnly+SameSite=strict cookie, refresh works, logout clears cookie, admin self-registration blocked (400), /dashboard redirects to /login when logged out and vice versa.
- Found and fixed a real bug during live verification: cookie Secure flag was driven by NODE_ENV, but next start always hardcodes NODE_ENV=production regardless of actual deployment env, so the cookie was marked Secure even in local HTTP dev. Only worked by accident because Chrome/curl special-case localhost as a secure context - would have broken on any other hostname. Fixed with an explicit COOKIE_SECURE env var (default true, set false only for local dev).

## ACTIVITY — 2026-07-01
- Fixed real bug found by E2E test: logout cleared session state but never navigated away from /dashboard (client-side state change, not a page load, so middleware.ts never re-ran to redirect). Dashboard logout button now calls router.push("/login") after logout().
- .gitignore fix: .recordings/ was being ignored entirely, contradicting CLAUDE.md rule 9 which mandates committing version-completion videos. Removed that line; added e2e/output and test-results excludes instead (raw Playwright artifacts, not the curated recording).

## VIDEO_RECORDED — 2026-07-01
- .recordings/v0.1-2026-07-01.webm
- Scenario: register (shipper role) -> login -> dashboard (welcome message + role shown) -> logout -> redirected to /login.
- This is the only user-facing flow shipped in Sprint 1 (auth). Recorded via e2e/tests/auth-flow.spec.ts against the live docker-compose stack.

## PUSH — 2026-07-01
- Commit 40774df "feat: Sprint 1 foundation" pushed to origin/main.
- Commit d9164df "fix: redirect to login after logout; add E2E recording for v0.1" pushed to origin/main.

## ACTIVITY — 2026-07-01
- Batch 1 (Story 2.1) complete: Shipment Service built with full defense-in-depth (JWT self-verification, x-internal-token guard, per-resource ownership checks). POST/GET /shipments, GET /shipments/:id.
- Added Auth Service internal endpoint GET /internal/users/lookup (x-internal-token protected) so Shipment Service can resolve a receiver email to a real user id instead of trusting an arbitrary client-supplied UUID - this is the app-layer FK enforcement the Database doc called for.
- 58 tests passing (30 auth-service, 28 shipment-service), 100% stmt/func/line coverage, 94-100% branch on both services.
- Bugs found and fixed via live verification (not caught by mocked unit tests): (1) AUTH_SERVICE_URL was never wired into shipment-service's docker-compose environment, causing fetch failed at runtime; (2) that failure leaked a raw error message to the client (Security baseline violation) - added a global error handler (masks 5xx details, passes through 4xx messages) to both auth-service and shipment-service.
- Live-verified: shipment creation with real Auth Service lookup, role-scoped listing, IDOR protection (404 not 403 for non-owned shipments, avoiding existence leaks), admin bypass.

## ACTIVITY — 2026-07-01
- Batch 2 (Story 2.2) complete: PATCH /shipments/:id/assign-carrier (Shipper/Admin, resolves carrier email, only while status=created) and PATCH /shipments/:id/status (Carrier/Admin, enforces created->in_transit->delivered/cancelled transition graph). Both write to shipment.audit_log.
- 51 tests passing in shipment-service (100% stmt/func/line, 94.18% branch). Caught a real mock-leak bug in a status-check-short-circuit test during development, fixed before it caused flaky cascading failures.
- Live-verified: assign-carrier, invalid transition rejection (created->delivered blocked), valid transitions (created->in_transit->delivered), terminal-state protection (no transitions out of delivered/cancelled), audit log entries confirmed via direct DB query.

## ACTIVITY — 2026-07-01
- Batch 3 (Story 2.3) complete: BFF shipment proxy routes (GET/POST /api/shipments, GET/PATCH /api/shipments/[id]/*) with shared requireBearerToken helper (refactored /api/auth/me to use it too). Shipment list, new-shipment form, and detail pages with role-conditional assign-carrier and status-update UI. Added shared Shipment type to shared-types.
- 34 web tests passing (100% stmt/func/line, 98.07% branch on logic-bearing files). Extended Playwright E2E suite with a full shipment flow: shipper creates shipment via UI -> sees it in list/detail -> assigns carrier via on-page form -> carrier logs in -> transitions status via UI buttons. Both E2E tests passing, run live in a real browser against the full stack (not curl-only).
- middleware.ts extended to protect /shipments routes.
