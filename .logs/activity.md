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

## VIDEO_RECORDED — 2026-07-01
- .recordings/v0.2-2026-07-01.webm
- Scenario: shipper registers/logs in -> views empty shipment list -> creates a shipment via UI form -> sees it on detail page -> assigns a carrier via on-page form -> carrier logs in -> transitions status via UI buttons (created -> in_transit).
- Covers the new critical flow shipped in Sprint 2 (shipment management, Epic 2). Recorded via e2e/tests/shipment-flow.spec.ts against the live docker-compose stack.

## ACTIVITY — 2026-07-01
- Batch 1 (Story 3.1) complete: Ingestion Service built (MQTT subscriber on sensors/+/readings, app-layer device-token validation via new Shipment Service internal endpoint, append-only idempotent TimescaleDB writes via ON CONFLICT DO NOTHING, Postgres NOTIFY with embedded thresholds per SDR-2). Shipment Service now auto-provisions one device+token per shipment at creation (transactional), returned once in the create-shipment response.
- 79 tests passing this batch (55 shipment-service incl. new device-provisioning + internal-validate tests, 24 ingestion-service). 100% stmt/func/line coverage, 90-93% branch on both services.
- Live-verified full real flow: created a shipment via curl -> got a real deviceToken -> published an actual MQTT message via mosquitto_pub (not a mock) -> confirmed the reading landed in TimescaleDB (direct SQL query) and via the internal readings API. Also verified unknown-device and malformed-payload rejection paths live (logged as warnings, discarded, no crash).
- Bug found and fixed: SHIPMENT_SERVICE_URL was missing from ingestion-service's docker-compose environment (same class of bug as Sprint 2's AUTH_SERVICE_URL gap) - caught before it caused a runtime failure this time, by checking docker-compose.yml proactively before live-testing rather than after hitting the error.

## ACTIVITY — 2026-07-01
- Batch 2 (Story 3.2) complete: standalone sensor simulator (simulator/), a small testable state machine (normal readings with occasional multi-reading excursions) publishing over real MQTT. Added to docker-compose as an opt-in "simulator" profile service (not started by default, since it needs a real device token that only exists after a shipment is created).
- 5 tests passing, 100% coverage on the core simulate.ts logic.
- Live-verified: ran the containerized simulator against a real device token for ~14s at a fast interval with elevated excursion probability. Got exactly the expected pattern in TimescaleDB: 4 elevated readings (~10.1C, above the 8C threshold) followed by a return to baseline (~4C) - confirms the excursion state machine, MQTT publishing, device validation, and TimescaleDB writes all work together correctly end-to-end with zero manual intervention.

## ACTIVITY — 2026-07-01
- Batch 3 (Story 3.3) complete: Alerting Service built (Postgres LISTEN/NOTIFY consumer per SDR-2, threshold breach detection for temp+humidity, 5-minute debounce per shipment+reason, alert persistence, email via nodemailer with SMTP-or-logging-fallback per ADR-4-style stub pattern). New internal GET /internal/alerts endpoint for the (Batch 4) Shipment Service proxy.
- 26 tests passing, 98.85% stmt/func/line, 96% branch coverage.
- Live-verified the full pipeline end-to-end: MQTT publish -> Ingestion -> NOTIFY -> Alerting -> threshold breach detected -> alert persisted -> email logged (SMTP stub) -> retrievable via internal API. Also verified normal readings correctly produce no alert, and the internal-token guard rejects unauthenticated requests.
- Operational incident (not a code bug): an earlier `timeout 12 docker compose --profile simulator run --rm ...` command from Batch 2 did not reliably terminate the container - it kept running orphaned for 14 minutes across multiple subsequent docker compose down/up cycles (simulator has its own compose profile, so default `docker compose down` does not touch it), publishing ~140 extra readings once mosquitto reconnected. Serendipitously became a real stress test of the debounce logic: only ONE alert was created despite dozens of recurring breaches over ~90 seconds of continuous publishing, confirming debounce works correctly under real uncontrolled load. Cleaned up orphaned container + polluted test data. Lesson: `timeout` piped into `docker compose run` does not reliably propagate termination to the container - verify with `docker ps` after, don't assume it stopped.

## ACTIVITY — 2026-07-01
- Batch 4 (Story 3.4) complete: Shipment Service gained ownership-checked GET /shipments/:id/readings and /alerts (proxying to Ingestion/Alerting internal APIs, reusing the extracted findShipmentForViewer ownership helper). BFF gained matching proxy routes. Shipment detail page now shows a live Recharts temperature chart (with threshold reference lines) and an alerts list, polling every 5s.
- UX gap closed: the device token was only ever returned once (at shipment creation) but the UI discarded it on redirect, leaving no way for a real user to configure a sensor/simulator. Added a one-time reveal banner on the detail page (carried via redirect query param) with a dismiss button.
- 65 shipment-service tests + 38 web tests passing, both ~98-100% coverage. Extended Playwright E2E suite with a full live-data flow: create shipment via UI -> capture device token from the reveal banner -> publish a real breaching reading via MQTT from the test itself -> reload -> verify the chart and alert appear in the browser. All 3 E2E specs passing.
- Bug found and fixed: added INGESTION_SERVICE_URL/ALERTING_SERVICE_URL depends_on edges to shipment-service, creating a circular Docker Compose dependency (ingestion-service already depended on shipment-service from Batch 1) that broke the entire stack startup ("dependency cycle detected"). Fixed by dropping the new depends_on edges - not needed at runtime since telemetry-client.ts already tolerates the other service not being ready (returns empty array on fetch failure).
- Found and fixed E2E test flakiness: 3 parallel Playwright workers caused real resource contention against the single-instance Docker stack (not a code bug - confirmed by rerunning with --workers=1, 100% reliable). Set workers:1 in playwright.config.ts, documented as consistent with the System Design doc's vertical-scaling-only MVP decision.

## ACTIVITY — 2026-07-01
- Resumed session: docker compose up -d --build (all 8 containers up, postgres healthy), migrations confirmed already applied (001-005), all 6 services confirmed healthy (5 via /health 200, web via / 200 - Next.js BFF has no /health route). Full Playwright E2E suite rerun fresh: 3/3 passing (auth-flow, shipment-flow, alerting-flow).

## VIDEO_RECORDED — 2026-07-01
- .recordings/v0.3-2026-07-01.webm
- Scenario: shipper creates a shipment via UI -> captures device token from the one-time reveal banner -> a real breaching sensor reading is published over live MQTT -> page reloads -> live temperature chart (with threshold reference lines) and the resulting alert both appear in the browser, polling-driven.
- Covers the new critical flow shipped in Sprint 3 (sensor ingestion + threshold alerting + live tracking UI, Epic 3). Recorded via e2e/tests/alerting-flow.spec.ts against the live docker-compose stack.

## PLAN — 2026-07-01
- Batch 1: CI workflow (coverage thresholds in vitest configs, .github/workflows/ci.yml with lint/test/security-scan/build jobs on GitHub-hosted runners, compliance test:coverage script).
- Batch 2: Self-hosted runner registration + .github/workflows/deploy.yml (deploy-staging auto on push to main, deploy-prod manual-approval on tags), both on the local machine acting as the pilot-scale VPS.
- Batch 3: Push, verify CI green, verify runner + deploy-staging fire live, log and ship, then move to Sprint 4.

## ACTIVITY — 2026-07-01
- Batch 1 (CI workflow) complete: .github/workflows/ci.yml added (lint, test+coverage, security-scan [Semgrep/Trivy/Gitleaks], build matrix over all 6 Docker images), runs on GitHub-hosted ubuntu-latest runners.
- Added enforced 80% coverage thresholds (statements/branches/functions/lines) to all 6 logic-bearing vitest.config.ts files - turns the manual per-sprint coverage check into an automated CI gate. Verified locally first: full test:coverage run across all workspaces passes clean, exit code 0, no threshold failures.
- compliance service (still a Sprint-1 health-check stub, no logic yet) given a minimal vitest.config.ts with passWithNoTests:true so its empty test suite doesn't break the CI test job; coverage gate deferred until Sprint 4 (Story 4.1) adds real logic.
- Added root package.json test:coverage script (npm run test:coverage --workspaces --if-present).

## ACTIVITY — 2026-07-01
- CI: green on main (2c488a1). First fully-passing run of the new pipeline - security-scan, lint, test (80% coverage gate held on all workspaces on a clean GitHub-hosted runner too, not just locally), and all 6 Docker image builds all passed. Batch 1 (CI workflow) is complete and verified live, not just written.

## ACTIVITY — 2026-07-01
- Batch 2 (self-hosted runner + deploy workflow) in progress: registered this machine as a GitHub Actions self-hosted runner (name baridi-ma-local, labels self-hosted/baridi-ma/pilot-vps) via config.cmd. Created GitHub Environments "staging" (no gate, auto-deploy) and "production" (required-reviewer gate: rhorba) via gh api.
- Per user's choice, NOT installed as a persistent Windows service yet - running as a foreground background process for this session only (run.cmd via Start-Process), confirmed online via GitHub API. Revisit persistent-service install in a future session if auto-deploy proves useful.
- Added .github/workflows/deploy.yml: deploy-staging (auto, triggered on CI success on main via workflow_run, runs on the self-hosted runner: checkout + docker compose up -d --build + migrate) and deploy-prod (manual-approval gated via the production environment, triggered on v* tags).
- Caught and fixed a real bug in the first draft before pushing: the deploy jobs had no actions/checkout step, so there would have been no git repo in the runner's workspace at all - custom git fetch/reset commands would have failed immediately.
- Flagged to user (not blocking): the runner checks out into a separate _work clone: if the auto-deployed staging stack and this dev-folder's manually-run stack are both up at once, they'll collide on the same docker-compose container names and host ports since both folders share the name "baridi-ma".

## ACTIVITY — 2026-07-01
- Batch 2 (deploy workflow) complete after 3 live iterations of rule-11 diagnose-fix-repush: (1) runner checkout had no .env - fixed with a one-time seeded .env + clean:false; (2) shell:bash resolved to Windows' built-in WSL bash stub - fixed via GITHUB_PATH to prefer Git Bash; (3) a literal Windows path-with-spaces in a custom shell: field hit a runner-internal bug - fixed by using GITHUB_PATH instead of a literal shell path. Final deploy-staging run (28548520510) succeeded end-to-end.
- Batch 3 (verify) complete: live-verified the auto-deployed stack, not just the green checkmark - all 8 containers up, Postgres healthy, all 6 services responding 200 on their health/root endpoints. Full pipeline proven live: push to main -> CI green -> deploy-staging fires automatically on the self-hosted runner -> real working stack.
- Tore down the auto-deployed staging stack afterward (docker compose down in the runner's checkout) to free the shared host ports for regular dev-folder work, per the port-collision risk flagged earlier. Confirmed no orphaned containers.
- CI/CD gap (flagged as an open item in Sprint 2 and Sprint 3 snapshots) is now fully closed: lint/test/security-scan/build run on GitHub-hosted runners on every push; deploy-staging auto-deploys to this pilot-scale host on every CI-green push to main; deploy-prod is manual-approval-gated on version tags. Self-hosted runner currently running as a foreground process for this session only (not a persistent Windows service, per user's choice) - revisit persistent install in a future session if continuous auto-deploy proves valuable.

## BATCH_1_VERIFY — 2026-07-02
- Sprint 4 Batch 1 (Compliance Service backend, Story 4.1) implemented and verified.
- Shipment Service: added internal GET /internal/shipments/:id (internal-token only, no JWT) for Compliance Service to resolve ownership/status/device. 4 new tests, all passing (47/47 shipment suite total).
- Compliance Service built out from stub: db.ts, jwt-auth.ts, error-handler.ts, internal-auth.ts, schemas.ts, shipment-client.ts, ingestion-client.ts, hash.ts (SHA-256 of canonicalized reading set), pdf.ts (pdf-lib certificate), storage.ts (filesystem-backed, COMPLIANCE_STORAGE_DIR env var), routes.ts (POST /compliance/:shipmentId/export).
- Export endpoint: JWT + internal-token dual auth (ADR-1/Security baseline §7), role check (receiver/admin only), IDOR-safe 404 for non-owning receivers, 400 if not yet delivered, idempotent via unique constraint on compliance.exports.shipment_id (200 on replay, 201 on first generation, race-safe via unique-violation catch-and-refetch).
- docker-compose.yml: compliance-service now gets SHIPMENT_SERVICE_URL, INGESTION_SERVICE_URL, COMPLIANCE_STORAGE_DIR env vars + a new compliance_data named volume for PDF persistence. .env.example updated with COMPLIANCE_STORAGE_DIR.
- Tests: 27 compliance-service tests (7 files) + 4 new shipment-service tests, all passing.
- Coverage: compliance-service 94.25% stmts/94.25% lines/89.47% branch/100% funcs (gate 80%, enforced via vitest.config.ts thresholds). shipment-service 98.93%. Both above rule-6 gate.
- Lint: clean (apps/web ESLint, only workspace with a lint script). Build: both services compile clean via tsc.
- Security: Semgrep (p/owasp-top-ten + p/secrets) on all new/changed files — 0 findings. Gitleaks/Trivy not run locally (not installed); will run in CI per rule 11 on push.
- NOT pushed yet — this is Batch 1 of 3 for Sprint 4 (Batch 2: BFF proxy + export UI button; Batch 3: E2E, v0.4 video, final push). Per rule 7, push happens at sprint end, not per-batch.

## BATCH_2_VERIFY — 2026-07-02
- Sprint 4 Batch 2 (BFF proxy + export UI, Story 4.2) implemented and verified.
- BFF: new COMPLIANCE_SERVICE_URL env var (docker-compose web service + .env.example). New proxy route apps/web/app/api/shipments/[id]/compliance-export/route.ts — POST, JWT-gated like other proxies, but streams the upstream response body/content-type/x-reading-hash through unchanged (PDF on success, JSON on error) instead of re-serializing as JSON.
- UI: shipment detail page gets an "Export Compliance PDF" button, visible only when shipment.status === 'delivered' AND (role === 'admin' OR (role === 'receiver' AND receiverId === user.id)). Click triggers the proxy route, converts the response to a Blob, and downloads it via a temporary anchor element.
- Tests: 3 new BFF route tests (401 guard, binary passthrough with headers, JSON error passthrough) — 100% coverage on the new route. Full apps/web suite: 41/41 passing, 100% stmts/lines coverage.
- Build: next build compiles clean, new route appears in the route manifest. Lint: clean (next lint via ESLint).
- Security: Semgrep (p/owasp-top-ten + p/secrets) on new/changed files — 0 findings.
- Full workspace re-run (all 6 workspaces) after Batch 2 changes: all green, no regressions.
- NOT pushed yet — this is Batch 2 of 3. Batch 3 remaining: Playwright E2E covering the full delivered -> export -> download flow, v0.4 video recording, then push + confirm CI green per rule 7/9/11.

## BATCH_3_VERIFY — 2026-07-02
- Sprint 4 Batch 3 (E2E + video + close-out) complete.
- Bringing the stack up live surfaced two real bugs, both diagnosed and fixed (rule-11-style diagnose-fix-repush, applied locally before push since this was pre-push verification):
  1. `docker compose up --build` failed entirely for compliance-service and ingestion-service with `archive/tar: unknown file mode` — root cause: no root .dockerignore existed, so each service's local node_modules (with an npm-workspaces symlink to packages/shared-types) got included in the build context and choked Docker's tar-based context transfer. Fixed by adding a root .dockerignore (node_modules, dist, .next, coverage, e2e artifacts, .recordings, compliance storage).
  2. Compliance export failed live with two sequential errors, both real: (a) BFF proxy route sent `Content-Type: application/json` with no body on the export POST — Fastify's default JSON parser rejects that combination before the route handler runs (`FST_ERR_CTP_EMPTY_JSON_BODY`). Fixed by not using the internal-fetch `internalHeaders()` helper for this bodyless call. (b) After that fix, PDF writes failed with `EACCES` — the `compliance_data` named volume is created root-owned by Docker on first mount, but the container runs as the unprivileged `node` user. Fixed via the standard Docker pattern: pre-create and chown `/data/compliance` to `node:node` in the Dockerfile before `USER node`, so Docker's "copy image content into a freshly-created empty named volume" behavior carries the right ownership. Had to remove and let Docker recreate the already-root-owned volume once for the fix to take effect.
- New E2E spec: e2e/tests/compliance-export-flow.spec.ts — shipper creates shipment -> assigns carrier -> carrier moves created -> in_transit -> delivered -> receiver logs in, sees the Export Compliance PDF button (not visible at any earlier status), downloads it, verifies real PDF magic bytes, and verifies a second click re-downloads the identical file (idempotency, live not just unit-tested).
- Full E2E suite (all 4 specs: auth-flow, shipment-flow, alerting-flow, compliance-export-flow) passed live against the real stack after fixes.
- v0.4 video recorded and saved to .recordings/v0.4-2026-07-02.webm (compliance-export-flow spec, full delivered -> export -> download -> re-download flow).
- Stack torn down cleanly afterward (docker compose down), confirmed zero orphaned baridi-ma containers via docker ps -a.
- Security: Semgrep (p/owasp-top-ten + p/secrets) on all Batch 3 changed/new files (Dockerfile, BFF route fix, .dockerignore, E2E spec) — 0 findings.
- Sprint 4 (Epic 4: Compliance Export) is now fully complete: Stories 4.1 (Compliance Service backend) and 4.2 (BFF proxy + export UI) both done, tested, verified live, and video-recorded.

## CI_CHECK — 2026-07-02
- Push db29fe5 to origin/main: CI went RED. lint and test jobs passed; security-scan failed at the Gitleaks step with "unknown revision or path not in the working tree" trying to diff 6bd0d34^..db29fe5.
- Root cause: this push contained 3 commits (Sprint 4 Batches 1-3). Gitleaks correctly computes the full push commit range (oldest-pushed-commit^..HEAD) to scan, but the security-scan job's actions/checkout@v4 step used the default shallow checkout (fetch-depth: 1), so the older commits/parents in that range were never fetched onto the runner — a latent bug that only a multi-commit push exposes (single-commit pushes in Sprints 1-3 never hit this path).
- Fix: added `fetch-depth: 0` to the security-scan job's checkout step in .github/workflows/ci.yml. Per rule 11: stopped all other work, diagnosed, fixed, re-pushing now.

## CI_CHECK — 2026-07-02 (green)
- Re-push d82c618 (the fetch-depth fix): CI fully GREEN — lint, test (80%+ coverage gate enforced), security-scan (Semgrep/Trivy/Gitleaks all clean), and all 6 build-matrix images (web, auth, shipment, ingestion, alerting, compliance) all passed. Sprint 4 is shipped and CI-verified per rule 11.
- Deploy workflow: queued, not yet run — the self-hosted runner "baridi-ma-local" is offline (it runs as a foreground process only, not a persistent service, per prior session's explicit note; it stops when the machine sleeps/reboots or the process is killed). This is a known, previously-flagged limitation, not a new issue. deploy-staging will pick up once the runner is manually restarted; CI itself (lint/test/security/build, which is what rule 11 gates) is unaffected since it runs on GitHub-hosted runners.

## BATCH_1_VERIFY — Sprint 5 — 2026-07-02
- Sprint 5 Batch 1 (backend: Story 5.1 admin user list/deactivate + Story 5.2 owner-email enrichment) implemented and verified.
- Auth Service: new services/auth/src/admin-routes.ts (GET /auth/admin/users, PATCH /auth/admin/users/:id/deactivate — both admin-only via inline jwtVerify+role check, self-deactivation blocked). Fixed a real security gap: /auth/refresh now checks is_active before minting a new access token (previously a deactivated user's still-valid 7-day refresh token kept working). New GET /internal/users/by-ids batch lookup endpoint for cross-service display resolution.
- Shipment Service: GET /shipments now attaches shipperEmail/carrierEmail/receiverEmail (via the new batch lookup, one round trip) only in admin responses — every other role already has ownership context.
- Shared types: added AdminUserSummary and AdminShipment (extends Shipment) to packages/shared-types.
- Tests: auth-service 43 tests (31 in the main integration file, up from 27; 12 new: 4 by-ids, 8 admin routes), shipment-service 73 tests (up from 69; 5 new: 3 internal-client unit, 1 owner-email integration, plus the earlier count). Coverage: auth-service 97.95%, shipment-service 98.99% — both clear the 80% gate.
- Security: Semgrep found the known Fastify reply.send() XSS false-positive on the new deactivate endpoint (same pattern flagged in Sprint 2) — suppressed with the established nosemgrep + rationale comment, rescanned clean (0 findings).
- Not pushed yet — Batch 2 (BFF proxy routes + admin UI) is next.

## BATCH_2_VERIFY — Sprint 5 — 2026-07-02
- Sprint 5 Batch 2 (BFF proxy + admin UI, Stories 5.1/5.2 frontend) implemented and verified.
- BFF: GET /api/admin/users, PATCH /api/admin/users/[id]/deactivate — same bodyless-PATCH Content-Type pitfall as Sprint 4's compliance-export route caught and avoided proactively this time (not left to be found live).
- UI: new /admin/users page (table + Deactivate button, hidden for the admin's own row and already-deactivated users), "Admin" link on the dashboard for role===admin, /admin added to middleware.ts's PROTECTED_PATHS. Shipments list now shows shipper/carrier/receiver emails inline for admin viewers.
- Tests: 5 new BFF route tests + 2 new middleware tests. Full apps/web suite: 48/48 passing, 100% stmt/line coverage. Full 6-workspace re-run after the shared-types change (AdminShipment/AdminUserSummary added): all green, no regressions.
- Build/lint clean, Semgrep 0 findings.
- Not pushed yet — Batch 3 (E2E, v0.5 video, push, CI-green, final Sprint 5/project close-out) is next.

## BATCH_3_VERIFY — Sprint 5 — 2026-07-02
- Sprint 5 Batch 3 (E2E + video + close-out) complete.
- Stack rebuilt clean (fresh network/containers, persistent postgres_data/compliance_data volumes reused correctly — the Sprint 4 volume-ownership fix held up). All 6 services healthy, migrations already-applied (idempotent).
- New E2E spec e2e/tests/admin-flow.spec.ts, 2 tests: (1) admin lists users, deactivates one (self-deactivation button correctly absent on the admin's own row), and the deactivated user is confirmed unable to log in afterward — a real HTTP 401, not just a UI-state check; (2) admin sees shipper/receiver emails (and "—" for no carrier) on the shipments list, verifying Story 5.2 end-to-end. Added `pg` as an e2e devDependency to seed an admin account by promoting a normally-registered user via direct SQL (admin has no self-service signup path, matching a real deployment's seeding story).
- Full E2E suite (6 specs: auth, shipment, alerting, compliance-export, 2x admin-flow) passed live on first run — no bugs found this batch (Batches 1-2's proactive fixes, e.g. avoiding the bodyless-PATCH Content-Type issue up front, paid off).
- v0.5 video recorded and saved to .recordings/v0.5-2026-07-02.webm (admin list/deactivate flow).
- Stack torn down cleanly (docker compose down), zero orphaned containers confirmed.
- Security: Semgrep (p/owasp-top-ten + p/secrets) on new E2E files — 0 findings.
- Sprint 5 (Epic 5: Admin Panel) is now fully complete: Stories 5.1 (admin list/deactivate users + refresh-gap fix) and 5.2 (admin shipment oversight with owner emails) both done, tested, verified live, and video-recorded. This was the last sprint per docs/stories-baridi-ma.md's Sprint Allocation table.

## CI_CHECK — 2026-07-02 (Sprint 5, green on first push)
- Push 1343a8c to origin/main: CI fully GREEN on the first try (lint, test w/ 80%+ coverage gate, security-scan, all 6 build-matrix images). The fetch-depth fix from Sprint 4's close-out held up correctly for this multi-commit push too.

## S3_MIGRATION_VERIFY — 2026-07-02
- Post-MVP scope (user-requested, beyond the planned 5-sprint backlog): moved Compliance Service PDF storage from a local Docker volume to S3-compatible storage.
- docker-compose.yml: added minio (S3-compatible server) + minio-init (one-shot bucket bootstrap via mc, compliance-service depends_on service_completed_successfully rather than just minio being healthy). Replaced compliance_data volume with minio_data.
- Compliance Service: added @aws-sdk/client-s3, rewrote storage.ts to PUT/GET against S3 instead of local fs (forcePathStyle only when a custom S3_ENDPOINT is set, so the same code works unmodified against real AWS S3 — just unset S3_ENDPOINT and use real credentials/region). Dockerfile's local-dir chown step removed (no longer needed).
- DB: migration 006_compliance_storage_key.sql renames compliance.exports.file_path to storage_key and truncates the table (clean cutover — pre-launch dev-only data).
- Tests: storage.test.ts rewritten to mock S3Client.prototype.send; compliance.integration.test.ts's storage.js mock is now a stateful in-memory fake (keeps idempotency/race tests behaviorally real without a live S3 dependency in the fast suite). 28 compliance-service tests passing, 94.76% coverage.
- Live verification: full stack rebuilt with MinIO, migration applied live, all 6 services healthy, minio-init exited 0 (bucket created), full E2E suite (6 specs) passed including compliance-export-flow — and directly confirmed via `mc ls` that a real PDF object landed in the bucket (not just that the HTTP flow reported success). Stack torn down cleanly, zero orphaned containers.
- Security: Semgrep (p/owasp-top-ten + p/secrets) — 0 findings.
- Not pushed yet — Batch 2 (persistent deploy runner) is next.

## CI_CHECK — 2026-07-02 (S3 migration push, red -> fixed)
- Push 7dae800 went RED on 3 jobs: lint and test both failed at `npm ci` ("can only install packages when package.json and package-lock.json are in sync" — missing the entire @aws-sdk/client-s3 dependency tree), and security-scan failed at Gitleaks (2 false-positive generic-api-key matches on `Key: "shipment-1.pdf"` in the new S3 storage test — an S3 object key, not a secret).
- Root cause 1: ran `npm install --workspace=@baridi-ma/compliance-service` locally (which did update the root package-lock.json on disk) but only staged services/compliance, db/migrations, docker-compose.yml, and .env.example when committing — never staged the modified package-lock.json.
- Root cause 2: Gitleaks' generic-api-key rule pattern-matches on `Key: "..."` regardless of context; same class of false positive as the 2 already allowlisted in Sprint 3 (.gitleaks.toml), but a new specific instance.
- Fix: staged and committed package-lock.json; added inline `// gitleaks:allow` comments (same precision-over-breadth approach as Semgrep's nosemgrep comments) to the 2 flagged lines rather than a path-wide allowlist. Verified locally: `npm ci` now succeeds (lock file in sync).
- Per rule 11: stopped all other work, diagnosed, fixed, re-pushing now.

## CI_CHECK — 2026-07-02 (S3 migration, green after fix)
- Push cd72630: CI fully GREEN — lint, test w/ coverage gate, security-scan (Gitleaks now passes with the inline allow comments), all 6 builds. S3/MinIO migration is now fully shipped.
