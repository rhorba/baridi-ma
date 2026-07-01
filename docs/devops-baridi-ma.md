# DevOps Foundation: Baridi.ma
**Architecture**: docs/architecture-baridi-ma.md
**Security**: docs/security-baridi-ma.md
**Version**: 1.0 | **Date**: 2026-07-01 | **Author**: DevOps/DevSecOps

## 1. Environment Strategy
| Environment | Purpose | Deploy Trigger |
|---|---|---|
| local | Development | `docker-compose up` |
| staging | QA / Preview | Auto on PR merge to `main` |
| production | Live pilot users | Manual tag / approved release |

## 2. CI Pipeline (GitHub Actions)
```yaml
stages:
  - lint            # ESLint + TypeScript check, all 5 services + web app
  - test            # unit + integration (Testcontainers for Postgres/TimescaleDB); fail if combined coverage < 80%
  - security-scan   # Semgrep (SAST), Trivy (SCA — dependency CVEs), Gitleaks (secrets)
  - build           # Docker image per service (5 backend + 1 web)
  - deploy-staging  # auto on PR merge to main
  - deploy-prod     # manual approval gate
```

Per CLAUDE.md rule 11: CI must be monitored on every push. If CI is RED, stop other work, diagnose, fix, and re-push until GREEN before any SHIP phase.

## 3. Infrastructure
- **Hosting**: Single VPS or small managed cloud instance (e.g. a $20-40/mo droplet-class VM) — sufficient for pilot scale (10-50 shipments), no K8s (YAGNI)
- **Compute**: Docker Compose running all 6 containers (web BFF + 5 services) + Postgres/TimescaleDB + Mosquitto MQTT broker
- **Database**: Self-hosted Postgres+TimescaleDB container for MVP, with scheduled `pg_dump` backups to object storage (RPO 15min target from System Design — achieved via WAL archiving, not just daily dumps)
- **Secrets**: Env vars via `.env` files on the host for MVP (never committed — `.env.example` is the template), injected into containers via Docker Compose `env_file`
- **Monitoring**: Docker's `json-file` log driver for MVP (stdout structured JSON logs from each service); revisit a real log aggregator (e.g. Grafana Loki) post-MVP if debugging across 6 services in raw logs becomes painful

## 4. Security Scanning Gates
| Scanner | Scan Type | Fail Threshold |
|---|---|---|
| Semgrep | SAST — code vulnerabilities | Critical findings |
| Trivy | SCA — dependency CVEs (also scans built Docker images) | Critical CVEs |
| Gitleaks | Secrets detection | Any secrets found |

## 5. Docker Setup
```dockerfile
# Representative Dockerfile for a backend service (Fastify/TS)
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 4000
USER node
CMD ["node", "dist/main.js"]
```

`docker-compose.yml` (local dev) orchestrates: `web` (Next.js), `auth-service`, `shipment-service`, `ingestion-service`, `alerting-service`, `compliance-service`, `postgres` (with TimescaleDB extension), `mosquitto` (MQTT broker), and a `sensor-simulator` container that publishes fake readings for local testing (per PRD constraint: no real hardware yet).

## 6. Monitoring Baseline
| Signal | Tool | Alert Threshold |
|---|---|---|
| Logs | Docker `json-file` driver, `docker compose logs` | Error rate > 5/min → manual review (no auto-alerting yet at pilot scale) |
| Metrics | None yet (YAGNI — no proven need) | Revisit if pilot reveals a specific performance question |
| Uptime | Simple external ping/healthcheck (e.g. UptimeRobot free tier) on the web BFF | Downtime > 2min |

## 7. Video Recording (per CLAUDE.md rule 9)
At each project version completion (sprint end with user-facing changes), run Playwright E2E covering: Shipper creates shipment → Carrier accepts → sensor readings ingested → alert fires on breach → Receiver views history → compliance PDF exported. Save to `.recordings/v[version]-[date].webm`.
