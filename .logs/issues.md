# ISSUES — Baridi.ma



## ISSUE — 2026-07-01 — RESOLVED
- docker-compose postgres failed to bind host port 5432 (already allocated by unrelated atlas-events project). Fixed by remapping to 5433:5432 in docker-compose.yml + .env.example.

## ISSUE — 2026-07-01 — RESOLVED
- Refresh-token cookie incorrectly marked Secure in local dev because isProduction was derived from NODE_ENV, which next start hardcodes to "production" regardless of real environment. Fixed with explicit COOKIE_SECURE env var.
