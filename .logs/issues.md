# ISSUES — Baridi.ma



## ISSUE — 2026-07-01 — RESOLVED
- docker-compose postgres failed to bind host port 5432 (already allocated by unrelated atlas-events project). Fixed by remapping to 5433:5432 in docker-compose.yml + .env.example.

## ISSUE — 2026-07-01 — RESOLVED
- Refresh-token cookie incorrectly marked Secure in local dev because isProduction was derived from NODE_ENV, which next start hardcodes to "production" regardless of real environment. Fixed with explicit COOKIE_SECURE env var.

## ISSUE — 2026-07-01
- Found via first-ever real CI run (never caught in 3 prior sprints since `lint` was apparently never actually exercised end-to-end): apps/web had zero ESLint config, so `next lint` fell back to an interactive first-run prompt, which fails non-interactively in CI.
- Fix: added apps/web/eslint.config.mjs (next/core-web-vitals + next/typescript flat config), added eslint + eslint-config-next devDependencies.
- Once lint could actually run, it surfaced 2 real pre-existing issues: (1) 7 files across the app used raw `<a href>` for internal navigation instead of next/link's `<Link>` (no-html-link-for-pages) - fixed by swapping all 7; (2) apps/web/app/shipments/page.tsx's data-fetch useEffect was missing `authFetch` in its deps array, only safe by accident because auth-context.tsx's authFetch wasn't memoized so the missing dep never mattered in practice, but the shipment-detail page already listed `authFetch` in its own deps assuming stability. Root-fixed by wrapping authFetch in useCallback([accessToken]) in auth-context.tsx (not just silencing the lint rule), then adding it to the list page's deps too.
- Verified all fixes live: full E2E suite (3 specs) rerun successfully against a rebuilt web container.
