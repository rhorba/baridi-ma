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

## ISSUE — 2026-07-01
- First deploy-staging run failed: the self-hosted runner's checkout (_work/baridi-ma/baridi-ma, a separate clone from the dev folder) has no .env file - correctly never committed, but docker compose up needs it. Log also showed noisy-but-nonfatal fnm CommandNotFoundException from the user's global PowerShell profile being auto-loaded by the default GitHub Actions Windows shell.
- Fix: (1) manually copied this host's working .env into the runner's checkout once (matches docs/devops-baridi-ma.md Sec 3 "env vars via .env files on the host"); (2) set clean:false on actions/checkout so that untracked .env survives future checkouts instead of being wiped by git clean; (3) switched job shell to bash to bypass the Windows PowerShell profile entirely; (4) added npm ci before npm run migrate since the runner's checkout also has no node_modules yet - would have failed at the migration step next had this not been caught proactively.

## ISSUE — 2026-07-01
- Second deploy-staging failure: shell:bash resolved to Windows' built-in system32\bash.exe (a WSL launcher stub with no WSL distro installed) instead of Git Bash, since System32 precedes Git's install dir in this host's PATH. Error: "execvpe(/bin/bash) failed: No such file or directory".
- Fix: pin the job's default shell to the explicit Git Bash path (C:\Program Files\Git\bin\bash.exe) instead of relying on PATH resolution of the bare "bash" name.
