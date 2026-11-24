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

Set `SEED_OPERATOR_EMAIL` and `SEED_OPERATOR_PASSWORD` in `.env` before seeding.
The seed creates an OWNER account and a collaborator (OPERATOR) account that use
that password. There are no default credentials.

## Database

PostgreSQL 14+ is required. Create a database and point `DATABASE_URL` in `.env`
at it (for example `postgresql://USER:PASSWORD@localhost:5432/clipzy?schema=public`).
Then run `npm run db:push`.

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

Nginx should reverse-proxy your domain to `127.0.0.1:3200`, with the
SSE endpoint (`/api/stream`) configured with `proxy_buffering off`.
