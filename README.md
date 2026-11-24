# Clipzy

Autonomous short-form content pipeline control plane. Discovers trending source
material, routes clips through detection → render → compliance → human approval
→ publish → analytics, and feeds performance back into clip selection.

## Stack

- Next.js 16 (App Router) + React 19
- Prisma + PostgreSQL
- NextAuth (credentials) with RBAC (OWNER / OPERATOR / VIEWER)
- Tailwind v4 + Radix UI + framer-motion
- SSE-based realtime event stream

## Setup

```bash
npm install
cp .env.example .env      # then edit DATABASE_URL / AUTH_SECRET
npm run db:push           # create schema
npm run db:seed           # seed operator + demo data
npm run dev               # http://localhost:3200
```

The seed creates two operator accounts:

- `ops@clipzy.aaseada.com` (OWNER)
- `friend@clipzy.aaseada.com` (OPERATOR)

Password for both: `clipzy-launch-2026` (override via `SEED_OPERATOR_PASSWORD`).

## Database

This app expects PostgreSQL on `db.scorpion.codes` (per the operator spec).
Locally the cluster may need starting:

```bash
pg_ctlcluster 16 main start
sudo -u postgres createuser lobster -s
sudo -u postgres psql -c "ALTER USER lobster WITH PASSWORD '26843545';"
sudo -u postgres createdb clipzy -O lobster
npm run db:push
```

`DATABASE_URL` in `.env` should point at the reachable host/port for your
environment.

## Pipeline architecture

```
DETECTED → SELECTED → RENDERING → RENDERED → COMPLIANCE
                                              ↓
                                  (flag?) COMPLIANCE_FLAG → APPROVAL
                                  (pass?) APPROVAL
                                              ↓
                                          APPROVED → SCHEDULED → PUBLISHING → PUBLISHED
```

Key guarantees:

- **Approval is mandatory** before any publish (phase 1 policy).
- **Idempotency keys** on every clip and publish task prevent duplicates.
- **Global pause** (`pipeline.paused` flag) halts all stages; operators keep control.
- **Immutable event log** records every transition; the dashboard answers
  "where is clip X and what happened to it".
- **Adapter boundaries** — discovery / moment detection / render / caption /
  compliance / publish / metrics are interfaces. Phase 1 ships deterministic
  stubs; real providers slot in without touching orchestration.

## Config without redeploy

All tunables live in `runtime_configs` and are editable from the Config page:

- `clip.minDurationSec`, `clip.maxDurationSec`, `clip.topNPerAsset`
- `scoring.weights` (hook / narrative / emotion / quotability / novelty)
- `publish.scheduleWindows`, `publish.frequencyCapPerDay`, `publish.minSpacingMin`
- `branding.watermarkText`, `branding.introBumper`
- `rights.defaultReviewOnUnknown`
- `platforms.targets`

## Production

```bash
npm run build
pm2 start ecosystem.config.js
```

Nginx should reverse-proxy `clipzy.aaseada.com` to `127.0.0.1:3200`, with the
SSE endpoint (`/api/stream`) configured with `proxy_buffering off`.
