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

## ISSUE — 2026-07-01
- Third deploy-staging failure: a literal Windows path with spaces in `shell:` ("C:\Program Files\Git\bin\bash.exe -e {0}") hit a runner-internal bug: "Second path fragment must not be a drive or UNC name" - the Actions runner's path-combination logic can't handle an absolute custom-shell path containing spaces on this runner version.
- Fix: switched to the officially supported PATH-extension mechanism ($GITHUB_PATH) - a "Prefer Git Bash on PATH" step (running under plain powershell, before bash is needed) prepends Git's bin dir for all later steps in the job, then those steps use plain `shell: bash` (bare name, no literal path).

## ISSUE — 2026-07-02 — RESOLVED (persistent deploy runner)
- Goal: make the self-hosted GitHub Actions runner "baridi-ma-local" persistent (Windows service, manual start) instead of a foreground `run.cmd` process that dies when the terminal closes.
- Attempt 1: `config.cmd --runasservice` requires Administrator privileges for the actual OS service creation step; the interactive shell wasn't elevated. Had the user run it themselves in an elevated PowerShell — registration succeeded, but the service still failed to start with Win32 error 1068 ("the service or dependency group failed to start"), reproducible via Start-Service, sc.exe start, and the services.msc GUI alike (ruling out a CLI/session-token quirk).
- Root cause of 1068: the installer's default service Log On account (NT AUTHORITY\NETWORK SERVICE) couldn't successfully start the runner process on this machine. Fixed by switching the service's Log On account to "Local System account" (Compte système local) via services.msc's Connexion/Log On tab — service started immediately after.
- Second-order issue once running as SYSTEM: the first real job (`deploy-staging`) failed at `actions/checkout` with "detected dubious ownership" — the existing `_work\baridi-ma\baridi-ma` checkout directory was owned by the interactive user (moham) from all prior foreground-mode runs, and Git refuses to operate across an ownership mismatch when running as SYSTEM. Fixed with a system-wide git config (applies regardless of HOME, unlike the per-job temp-HOME safe.directory checkout already sets): `git config --system --add safe.directory C:/Users/moham/actions-runners/baridi-ma/_work/baridi-ma/baridi-ma`.
- Third-order issue: that same failed checkout attempt (before the safe.directory fix) deleted-and-reinitialized the work directory contents, wiping the manually-seeded `.env` file from the Sprint-4-era fix (docs note: runner checkout never gets `.env` via git, by design — it's gitignored). Re-copied the host's working `.env` into the runner's checkout to fix.
- After all 3 fixes: re-ran the same Deploy workflow run (`gh run rerun --failed`) and it completed successfully end-to-end (checkout -> docker compose rebuild -> migrations) entirely through the persistent service, no terminal window involved. Live-verified: web and compliance-service both returned 200 on their health endpoints on the runner host afterward.
- Final state: service `actions.runner.rhorba-baridi-ma.baridi-ma-local` — Status: Running, StartType: Manual (per the original ask: persistent but not auto-start-on-boot), Log On account: Local System.
- Cleanup: removed temporary diagnostic log files created on the runner host during troubleshooting (service-install.log, service-start*.log, direct-run.log, gitconfig-fix.log, set-manual.log).
