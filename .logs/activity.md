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
