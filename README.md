# Clipzy Pipeline

Control plane for an automated short-form video pipeline. It discovers trending source material, routes clips through detection, render, compliance, **human approval**, publish and analytics, and feeds performance back into clip selection.

![Overview dashboard](./1-dashboard.png)

*Overview dashboard running locally with seeded demo data (fictional "Demo Streamer", no real accounts or content).*

![Clips list](./2-clips.png)

## Features

- Pipeline stages with a full state machine: detected, selected, rendering, rendered, compliance, approval, scheduled, publishing, published
- Approval inbox: nothing publishes without a human decision
- Realtime event stream (SSE) and an immutable audit log of every transition
- Runtime config editable from the UI, no redeploy needed
- Role-based access: OWNER, OPERATOR, VIEWER
- Adapter interfaces for discovery, moment detection, render, caption, compliance, publish and metrics (phase 1 ships deterministic stubs)

## Tech stack

| Layer | Tools |
|-------|-------|
| App | Next.js 16.1 (App Router), React 19.2, TypeScript |
| Data | PostgreSQL 14+, Prisma 5.22 |
| Auth | NextAuth v5 (beta), credentials provider, bcrypt |
| UI | Tailwind CSS 4, Radix UI, Framer Motion, Recharts, TanStack Table |
| Realtime | Server-Sent Events (`/api/stream`) |

## Requirements

- Node.js 20.9 or newer (required by Next.js 16) and npm
- PostgreSQL 14 or newer

## Setup

```bash
git clone https://github.com/Aboodseada1/clipzy-pipeline.git
cd clipzy-pipeline
npm install
cp .env.example .env     # then fill in the values below
npm run db:push          # create the schema
npm run db:seed          # create operator accounts, demo data
npm run dev              # http://localhost:3200
```

Sign in with `SEED_OPERATOR_EMAIL` and `SEED_OPERATOR_PASSWORD` from your `.env`. There are no default credentials: the seed refuses to run without a password.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://USER:PASSWORD@localhost:5432/clipzy?schema=public` |
| `AUTH_SECRET` | Session signing secret. Generate with `openssl rand -hex 32` |
| `AUTH_URL`, `NEXTAUTH_URL` | Public URL of the app (`http://localhost:3200` locally) |
| `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL` | Display name and public URL |
| `SEED_OPERATOR_EMAIL`, `SEED_OPERATOR_PASSWORD` | Owner account created by the seed. Choose your own password |

Never commit `.env`. Only `.env.example` with placeholders belongs in the repo.

## Usage

1. **Overview**: live pipeline health, stage distribution, event stream, top candidates.
2. **Clips**: every candidate and its stage, filterable and searchable.
3. **Approvals**: approve, reject or hold each clip, with an optional note that is written to the audit log.
4. **Publishing, Sources, Triggers, Analytics, Config, Audit**: scheduling, source management, automation triggers, performance, runtime settings, and the event history.

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
- **Immutable event log** records every transition, so the dashboard answers "where is clip X and what happened to it".
- **Adapter boundaries**: discovery, moment detection, render, caption, compliance, publish and metrics are interfaces. Real providers slot in without touching orchestration.

## Runtime config

Editable from the Config page and stored in `runtime_configs`:

- `clip.minDurationSec`, `clip.maxDurationSec`, `clip.topNPerAsset`
- `scoring.weights` (hook / narrative / emotion / quotability / novelty)
- `publish.scheduleWindows`, `publish.frequencyCapPerDay`, `publish.minSpacingMin`
- `branding.watermarkText`, `branding.introBumper`
- `rights.defaultReviewOnUnknown`
- `platforms.targets`

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server on port 3200 |
| `npm run build` | Generate Prisma client and build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run db:push` / `db:migrate` | Apply schema changes |
| `npm run db:seed` | Seed accounts and demo data |

## Production

```bash
npm run build
pm2 start ecosystem.config.js
```

Reverse-proxy your domain to `127.0.0.1:3200` with Nginx. Set `proxy_buffering off` for the SSE endpoint (`/api/stream`).

## Tests

There is no automated test suite yet. `npm run lint` and `npm run build` are the current checks.
