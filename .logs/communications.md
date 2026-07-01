# COMMUNICATIONS — Baridi.ma



## COMMUNICATION — 2026-07-01
- User confirmed: full new project kickoff, not a slice.
- User confirmed: env var values as placeholders only for now (dev fills in .env.local locally).
- User confirmed: CMI payments stubbed for MVP.

## UNDERSTAND — 2026-07-01
- User request: close the CI gap (flagged in Sprint 2 and Sprint 3 snapshots as unaddressed), then start Sprint 4.
- Scope: existing project, medium task. No .github/workflows exists yet. gh CLI authenticated as rhorba, repo has push access.
- Approved spec already exists: docs/devops-baridi-ma.md §2 defines lint -> test -> security-scan -> build -> deploy-staging -> deploy-prod. deploy stages need real infra (VPS/staging target) which does not exist yet - out of scope for this pass, will scope to lint/test/security-scan/build only and flag deploy stages as a later gap once infra exists.
- No new env vars needed for CI itself (repo secrets, not .env) - GITHUB_TOKEN is automatic; no external services (Semgrep/Trivy/Gitleaks GH Actions are free, no API keys required for OSS usage).
