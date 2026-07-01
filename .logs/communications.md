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

## UNDERSTAND — 2026-07-01
- Sprint 4 (Epic 4: Compliance Export), Stories 4.1-4.2. Scope already fully defined in docs/stories-baridi-ma.md, docs/prd-baridi-ma.md (FR-5), docs/architecture-baridi-ma.md (ADR-3: synchronous PDF gen via pdf-lib, already a compliance-service dependency), docs/database-baridi-ma.md (compliance.exports table + 005_compliance_schema.sql already exist from Sprint 1 scaffold), docs/security-baridi-ma.md (SHA-256 hash of reading set for tamper-evidence).
- Access: FR-5 says Receiver/Admin (not just Receiver as the story's user-story framing implies) - consistent with the established Admin-bypass pattern in Auth/Shipment services this project has used every sprint so far.
- Only real open design question: compliance.exports has a UNIQUE constraint on shipment_id (one export per shipment for MVP) - what happens on a second export request for the same shipment?
- No new env vars needed (no new external services - pdf-lib is a local library, file_path is a local volume path per the DB doc).
