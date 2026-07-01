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
