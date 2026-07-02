# METRICS — Baridi.ma



## SPRINT_1_VERIFY — 2026-07-01
- Auth Service: 100% stmt/branch/func/line coverage (22 tests: 10 unit + 12 integration via Testcontainers, incl. adversarial cases from Test Strategy §4 - JWT type confusion, forged/deleted-user tokens, malformed payloads).
- Web BFF: 100% stmt/func/line, 97.22% branch (24 tests: route handlers, JWT verification, cookie handling, middleware redirects). Coverage scoped to logic-bearing files per Test Strategy tiers (pages/layout/config excluded as E2E-tier, verified live instead).
- Combined coverage for Sprint 1 business logic: 100% (well above the 80% gate).
- Shipment/Ingestion/Alerting/Compliance: health-check-only stubs, zero business logic yet (scaffolded in Story 1.1, logic arrives Stories 2.1/3.1/3.3/4.1). Verified live via manual health checks, not unit tests - coverage gate not applicable to code not yet written.
- Security scan: Semgrep (SAST) 0 findings across 508 rules / 148 files. Gitleaks (secrets) 0 leaks (added .gitleaks.toml). Trivy (SCA) 0 critical/high CVEs, prod + dev deps.
- Bug fix: tsconfig.base.json missing noEmitOnError allowed a past TS6059 error to silently emit 6 stale/wrong .js files directly into src/ (bypassing .gitignore dist/ pattern). Fixed: noEmitOnError:true added, stale files deleted, full rebuild verified clean.

## SPRINT_SNAPSHOT — Sprint 1 — 2026-07-01
- Stories completed: 1.1 (monorepo+Docker scaffold), 1.2 (Auth Service), 1.3 (BFF auth middleware). All 3 of Sprint 1's planned stories shipped.
- Tests: 46 automated (22 auth-service, 24 web) + 1 E2E (Playwright, video recorded) = 47 total, all passing.
- Coverage: 100% on all logic-bearing code in both services with business logic this sprint (auth-service, web BFF).
- Security: Semgrep 0 findings, Gitleaks 0 leaks, Trivy 0 critical/high CVEs (prod+dev deps).
- CI: not yet set up (Sprint 1 built local Docker Compose infra; DevOps doc's GitHub Actions pipeline is Sprint-2+ scope, no CI to monitor yet - rule 11 not yet applicable).
- Bugs found and fixed during Sprint 1: cookie Secure-flag env detection bug, logout navigation bug, 6 stray stale compiled JS/d.ts files from a silent tsc emit-on-error gap, .gitignore incorrectly excluding mandated video recordings, npm port conflict with unrelated local project.
- Video: .recordings/v0.1-2026-07-01.webm (auth flow: register->login->dashboard->logout).
- Pushed: commits 40774df, d9164df to origin/main.

## SPRINT_2_VERIFY — 2026-07-01
- Auth Service: 100% stmt/branch/func/line coverage, 30 tests (added internal user-lookup endpoint + error handler this sprint).
- Shipment Service: 100% stmt/func/line, 94.18% branch, 51 tests (create/list/detail, carrier assignment, status transitions, ownership/IDOR checks, adversarial cases).
- Web BFF: 100% stmt/func/line, 98.07% branch, 34 tests (shipment proxy routes, shared requireBearerToken helper).
- Total: 115 unit/integration tests + 2 Playwright E2E tests (both run live against the full stack in a real browser), all passing.
- Combined coverage for Sprint 2 business logic: well above the 80% gate on all 3 workspaces.
- Security scan: Semgrep found 3 blocking findings (XSS rule false-positive - Express-specific rule misfiring on Fastify's safe JSON reply.send(), verified not exploitable, frontend also auto-escapes via React) - suppressed with justified inline nosemgrep comments, rescanned clean (0 findings, 508 rules / 166 files). Gitleaks 0 leaks. Trivy 0 critical/high CVEs.
- Live verification: all 6 services healthy, full shipment lifecycle (create->assign carrier->in_transit->delivered) verified via curl AND via Playwright browser automation, audit log confirmed via direct DB query.
- Stories 2.1-2.3 (Epic 2: Shipment Management) fully complete.

## SPRINT_SNAPSHOT — Sprint 2 — 2026-07-01
- Stories completed: 2.1 (Shipment CRUD), 2.2 (carrier assignment + status transitions), 2.3 (list/detail UI + BFF wiring). All 3 of Sprint 2's planned stories shipped.
- Tests: 115 unit/integration (30 auth-service, 51 shipment-service, 34 web) + 2 E2E (Playwright, video recorded) = 117 total, all passing.
- Coverage: 100% stmt/func/line on all 3 workspaces with business logic (auth-service, shipment-service, web BFF), 94-100% branch.
- Security: Semgrep 0 findings (1 false positive found+suppressed with justification), Gitleaks 0 leaks, Trivy 0 critical/high CVEs.
- CI: still not set up (local Docker Compose + manual scans remain the verification method; GitHub Actions pipeline from devops-baridi-ma.md doc remains unbuilt - flagged as a gap to address, since rule 11 CI monitoring cannot apply until CI exists).
- Bugs found and fixed during Sprint 2: missing AUTH_SERVICE_URL wiring for shipment-service in docker-compose (caused runtime fetch failures), leaked internal error messages to clients (added shared error handler to both backend services), a test mock-leak causing cascading failures, Semgrep Express-rule false positive on Fastify's safe reply.send().
- Video: .recordings/v0.2-2026-07-01.webm (shipment management flow).
- Pushed: commits d3281f4, 30a9bca to origin/main.

## SPRINT_3_VERIFY — 2026-07-01
- Auth Service: 100% stmt/branch/func/line, 30 tests.
- Shipment Service: 98.88% stmt/line, 89.56% branch, 100% func, 65 tests.
- Ingestion Service: 100% stmt/func/line, 92.68% branch, 24 tests.
- Alerting Service: 98.85% stmt/line, 96% branch, 100% func, 26 tests.
- Web BFF: 100% stmt/func/line, 98.21% branch, 38 tests.
- Simulator: 100% stmt/branch/func/line, 5 tests.
- Total: 188 unit/integration tests + 3 Playwright E2E tests (all run live in a real browser against the full stack), all passing.
- Combined coverage for Sprint 3 business logic: well above the 80% gate on all 6 workspaces.
- Security scan: Semgrep found 4 more instances of the known Fastify reply.send() false-positive (suppressed with the established nosemgrep pattern) plus one REAL finding - simulator/Dockerfile ran as root, missing USER directive (fixed, now consistent with all 5 other service Dockerfiles). Rescanned clean (0 findings, 508 rules / 197 files). Gitleaks found 2 false positives in .claude/settings.local.json (our own documented dev-only placeholder token appearing in local command history, a file that is gitignored by the user's global gitignore and will never be committed) - added to .gitleaks.toml allowlist for signal cleanliness, rescanned clean. Trivy 0 critical/high CVEs across all 3 lockfiles (root workspace, simulator, e2e).
- Live verification: full stack (8 containers) health-checked, migrations applied, and the complete 3-spec Playwright E2E suite (auth flow, shipment flow, live-tracking-with-real-MQTT-publish flow) run twice for reliability confirmation, both runs 100% passing.
- Stories 3.1-3.4 (Epic 3: Sensor Ingestion \& Alerting) fully complete - the core cold-chain value proposition now works end-to-end.

## SPRINT_SNAPSHOT — Sprint 3 — 2026-07-01
- Stories completed: 3.1 (MQTT ingestion), 3.2 (sensor simulator), 3.3 (threshold alerting), 3.4 (live tracking UI). All 4 of Sprint 3's planned stories shipped.
- Tests: 188 unit/integration (30 auth-service, 65 shipment-service, 24 ingestion-service, 26 alerting-service, 38 web, 5 simulator) + 3 E2E (Playwright, video recorded) = 191 total, all passing.
- Coverage: 98-100% stmt/func/line on all 6 workspaces with business logic this sprint, 89.56-100% branch.
- Security: Semgrep 0 findings (4 more known Fastify false positives suppressed, 1 real finding fixed - simulator/Dockerfile missing USER directive, ran as root), Gitleaks 0 leaks (2 false positives allowlisted), Trivy 0 critical/high CVEs.
- CI: still not set up - flagged again as a gap; GitHub Actions pipeline from devops-baridi-ma.md remains unbuilt. Recommend prioritizing early in Sprint 4 since rule 11 cannot apply without it.
- Bugs found and fixed during Sprint 3: missing SHIPMENT_SERVICE_URL wiring for ingestion-service in docker-compose, a `timeout | docker compose run` termination-propagation gap that left a simulator container orphaned for 14 minutes (serendipitously stress-tested and confirmed debounce logic), a device-token UX gap (token discarded on redirect, fixed with one-time reveal banner), a circular Docker Compose dependency cycle, E2E flakiness from parallel workers against a single-instance stack (fixed via workers:1), simulator Dockerfile running as root.
- Video: .recordings/v0.3-2026-07-01.webm (sensor ingestion + live chart + alerting flow).
- Pushed: commit 647ed40 to origin/main (code); video pushed separately this session.

## Sprint 4 — Batch 1 (Compliance Service backend) — 2026-07-02
- compliance-service: 94.25% stmts, 89.47% branch, 100% funcs, 94.25% lines (27 tests / 7 files)
- shipment-service (incremental, new internal endpoint): 98.93% stmts, 89.91% branch, 100% funcs, 98.93% lines (69 tests / 6 files, whole suite)
- Gate: 80% combined — PASSED for both services.

## Sprint 4 (Epic 4: Compliance Export) — SNAPSHOT — 2026-07-02
- Stories complete: 4.1 (Compliance Service backend), 4.2 (BFF proxy + export UI). Sprint 4 closed.
- New/changed test totals this sprint: shipment-service +4 tests (69 total), compliance-service 27 new tests across 7 files (all-new service), apps/web +3 tests (41 total), e2e +1 new spec (4 total specs, all passing live).
- Coverage: compliance-service 94.25%, shipment-service 98.93%, apps/web 100% stmts — all clear the 80% gate (rule 6).
- 3 real bugs found only once the stack ran live (not caught by unit/integration tests — all infra/runtime-environment classes of bug): missing root .dockerignore breaking multi-service docker builds; Fastify rejecting Content-Type:application/json on a bodyless POST; Docker named-volume root-ownership blocking non-root PDF writes. All 3 fixed and re-verified live before push.
- v0.4 video: .recordings/v0.4-2026-07-02.webm.

## Sprint 5 (Epic 5: Admin Panel) — SNAPSHOT — 2026-07-02
- Stories complete: 5.1 (admin list/deactivate users + refresh is_active fix), 5.2 (admin shipment oversight with owner emails). Sprint 5 closed — this was the last sprint per docs/stories-baridi-ma.md's Sprint Allocation table.
- Coverage: auth-service 97.95%, shipment-service 98.99%, apps/web 100% stmts — all clear the 80% gate.
- No bugs found during live E2E this sprint (unlike Sprint 4) — Batches 1-2's proactive fixes (e.g. avoiding the bodyless-PATCH Content-Type issue up front instead of discovering it live) worked as intended.
- v0.5 video: .recordings/v0.5-2026-07-02.webm.

## PROJECT MVP COMPLETE — 2026-07-02
- All 5 sprints shipped: Epic 1 (Foundation & Auth), Epic 2 (Shipment Management), Epic 3 (Sensor Ingestion & Alerting), Epic 4 (Compliance Export), Epic 5 (Admin Panel). All 13 stories from docs/stories-baridi-ma.md complete. All 6 FRs from docs/prd-baridi-ma.md (FR-1 through FR-6) delivered and verified live.
- Final automated test count: 241 unit/integration tests across 6 workspaces (web 48, auth 43, shipment 73, ingestion 24, alerting 26, compliance 27) + 6 E2E specs (auth, shipment, alerting, compliance-export, admin-flow x2) run live against the full Docker Compose stack in a real browser — 247 total, all passing.
- CI/CD: GitHub Actions pipeline (lint, test w/ enforced 80% coverage gate, security-scan, 6-image build matrix) green on every push since Sprint 4. Self-hosted deploy-staging runner exists but is not a persistent service (known, user-accepted limitation — restart manually when needed; does not affect CI).
- 5 video recordings across versions v0.1-v0.5 documenting each sprint's core flow live in a browser.
- No open issues or unresolved risks beyond the already-accepted postcss dev-dependency advisory (.logs/risks.md) and the non-persistent deploy runner (both pre-existing, user-acknowledged, non-blocking for MVP).
