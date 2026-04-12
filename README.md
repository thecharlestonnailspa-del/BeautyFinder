# Beauty Finder

Beauty marketplace monorepo with a Prisma + Supabase Postgres NestJS API, an experimental FastAPI migration scaffold, a customer Expo app shell, a Next.js owner dashboard, and a Next.js admin panel.

## Repo Layout

- `frontend/` contains user-facing apps
- `backend/` contains the API and background worker
- `packages/` contains shared types, validation, and SDK code

Quick map:

- `frontend/admin-panel` -> admin web app
- `frontend/owner-dashboard` -> owner web app
- `frontend/mobile-app` -> customer Expo app
- `backend/api` -> NestJS API
- `backend/api-py` -> FastAPI migration scaffold
- `backend/worker` -> background worker

## Current Local Status

- API is wired for a real Supabase Postgres database through Prisma.
- `backend/api-py` now exists as a parallel FastAPI scaffold for Python-first backend growth.
- Owner dashboard boots on `http://127.0.0.1:3001`.
- Admin panel boots on `http://127.0.0.1:3002`.
- Mobile app typechecks, exports a web build, and now includes salon detail pages, favorites, booking UI, and Google Maps previews.
- Worker app starts in live or offline fallback mode and builds cleanly.
- `npm run db:setup` now runs `prisma migrate deploy` and only seeds sample data when `SEED_SAMPLE_DATA=true`.

## Requirements

- Node.js 20+ or 22+
- npm 10+

## Install

```bash
npm install
```

Useful workspace-wide quality commands:

```bash
npm run format
```

```bash
npm run lint
```

```bash
npm run test
```

```bash
npm run test:api:watch
```

## Environment

Use separate env files per environment. Do not reuse the local development env for production.

- Local development: start from [`.env.example`](/Users/tienhoang/Beauty%20Finder/.env.example)
- Staging: start from [`.env.staging.example`](/Users/tienhoang/Beauty%20Finder/.env.staging.example)
- Production: start from [`.env.production.example`](/Users/tienhoang/Beauty%20Finder/.env.production.example)

Local `.env.example` is for development defaults only. Production should use its own provider-managed secrets and variables.

Local example:

```env
APP_ENV=local
SEED_SAMPLE_DATA=true
PORT=3000
HOST=127.0.0.1
JWT_SECRET=replace-with-a-long-random-secret
JWT_TTL_SECONDS=604800
CORS_ORIGINS=http://127.0.0.1:3001,http://127.0.0.1:3002,http://127.0.0.1:8081
RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW_MS=60000
AUTH_RATE_LIMIT_MAX=10
AUTH_RATE_LIMIT_WINDOW_MS=60000
PAYMENT_TAX_RATE=0.08
OWNER_MEDIA_STORAGE_DRIVER=local
OWNER_MEDIA_UPLOAD_DIR=backend/api/uploads
OWNER_MEDIA_STORAGE_PATH_PREFIX=
NEXT_PUBLIC_API_URL=http://127.0.0.1:3000/api
NEXT_PUBLIC_ENABLE_PREVIEW_MODE=true
EXPO_PUBLIC_API_URL=http://127.0.0.1:3000/api
EXPO_PUBLIC_ENABLE_DEMO_MODE=true
EXPO_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY=
DATABASE_URL=postgresql://postgres.your-project-ref:YOUR_PASSWORD@aws-1-us-east-1.pooler.supabase.com:5432/postgres
REDIS_URL=redis://localhost:6379
```

For Supabase, use the session-mode connection string on port `5432`. Replace `YOUR_PASSWORD` with the real database password, and URL-encode it if it contains special characters.

`JWT_SECRET` must be set to a real secret before the API starts. The server now rejects placeholder values such as `replace-me`.

Database commands:

- `npm run db:setup` runs `prisma migrate deploy` and then seeds sample data only when `SEED_SAMPLE_DATA=true`
- `npm run db:migrate:deploy` applies committed Prisma migrations without seeding
- `npm run db:push:local` is only for local development when you explicitly want schema sync without migrations
- `npm run db:seed:sample` seeds sample Beauty Finder data, but only when `SEED_SAMPLE_DATA=true` and `APP_ENV` is not `production`
- `npm run db:migrate:resolve:baseline` marks the initial migration as already applied on an existing database that was previously managed by `db push`

Environment flags:

- `APP_ENV=local|staging|production` controls bootstrap behavior and seed safety
- `SEED_SAMPLE_DATA=true` is allowed in local or staging only
- `SEED_SAMPLE_DATA=false` is required for production

Redis is still optional in local development. It is not required for startup today, and the health endpoint now reports whether the configured Redis instance is reachable.

`CORS_ORIGINS` is a comma-separated allowlist for browser clients. If you do not set it, the API allows the local owner, admin, and Expo web development origins by default. The API also exposes the rate-limit headers so browser clients can inspect throttling behavior.

The API also applies in-memory rate limits by default:

- `RATE_LIMIT_MAX=120` per `RATE_LIMIT_WINDOW_MS=60000` for general traffic
- `AUTH_RATE_LIMIT_MAX=10` per `AUTH_RATE_LIMIT_WINDOW_MS=60000` for `POST /api/auth/login` and the register endpoints

`PAYMENT_TAX_RATE` controls the local checkout tax estimate used by the new payment receipt flow. If you do not set it, the API defaults to `0.08`.

`EXPO_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY` is optional. If you set it, the customer app uses the official Google Maps embed URL on web. If you leave it blank, the app falls back to a generic Google Maps iframe and still provides an "Open in Google Maps" action.

`NEXT_PUBLIC_ENABLE_PREVIEW_MODE` and `EXPO_PUBLIC_ENABLE_DEMO_MODE` should stay `false` in staging and production. They are only meant for local preview and seeded-demo flows during development.

Owner media uploads now support two storage modes:

- `OWNER_MEDIA_STORAGE_DRIVER=local` for local development only
- `OWNER_MEDIA_STORAGE_DRIVER=supabase` for staging and production

When you use Supabase storage, configure:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OWNER_MEDIA_STORAGE_BUCKET`
- optional `OWNER_MEDIA_PUBLIC_BASE_URL`
- optional `OWNER_MEDIA_STORAGE_PATH_PREFIX`

Staging and production now reject `OWNER_MEDIA_STORAGE_DRIVER=local` at startup, so media is not written to ephemeral container storage in deployed environments.

## Run

Start each app in a separate terminal:

```bash
npm run db:setup
```

```bash
npm run dev:api
```

Equivalent grouped command:

```bash
npm run dev:backend:api
```

Experimental Python backend:

```bash
npm run dev:backend:api-py
```

```bash
npm run dev:owner
```

Equivalent grouped command:

```bash
npm run dev:frontend:owner
```

```bash
npm run dev:admin
```

Equivalent grouped command:

```bash
npm run dev:frontend:admin
```

Optional mobile shell:

```bash
npm run dev:mobile
```

Equivalent grouped command:

```bash
npm run dev:frontend:mobile
```

```bash
npm run dev:worker
```

Equivalent grouped command:

```bash
npm run dev:backend:worker
```

## Docker Compose

For a one-command local backend stack with Postgres, Redis, and the API:

```bash
npm run docker:up
```

The API container waits for Postgres and Redis, runs `prisma db push`, seeds the sample data, and then starts on `http://127.0.0.1:3000/api`.

Useful Compose commands:

```bash
npm run docker:down
```

```bash
npm run docker:reset
```

The current Compose setup is intended for local development. It is not yet a hardened production deployment flow.

## FastAPI Migration Track

If you want to move the backend toward Python, start in `backend/api-py`.

- `GET /api/health` is implemented there
- the main router tree is scaffolded for `auth`, `businesses`, `bookings`, `messaging`, `notifications`, `payments`, and `admin`
- the NestJS API remains the production-ready path until the Python service reaches parity

Python scaffold quick start:

```bash
python3 -m venv backend/api-py/.venv
```

```bash
source backend/api-py/.venv/bin/activate
```

```bash
pip install -e "backend/api-py[dev]"
```

## Production Start

Build everything first:

```bash
npm run build
```

Then start the production servers:

```bash
npm run start:api
```

```bash
npm run start:owner
```

```bash
npm run start:admin
```

## Verified Ports

- API: `http://127.0.0.1:3000/api`
- Owner dashboard: `http://127.0.0.1:3001`
- Admin panel: `http://127.0.0.1:3002`
- Expo dev server: `http://127.0.0.1:8081` by default
- Postgres via Compose: `127.0.0.1:5432`
- Redis via Compose: `127.0.0.1:6379`

## Seeded Auth

New sign-ins now issue standard JWT bearer tokens, and `POST /api/auth/login` only accepts email/password credentials.

Seeded credentials:

- Customer: `ava@beautyfinder.app` / `mock-password`
- Owner: `lina@polishedstudio.app` / `mock-password`
- Admin: `admin@beautyfinder.app` / `mock-password`

Example login body:

```json
{
  "email": "ava@beautyfinder.app",
  "password": "mock-password"
}
```

Send the token as:

```http
Authorization: Bearer <jwt-access-token>
```

## Useful API Routes

Public routes:

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/register/customer`
- `POST /api/auth/register/business`
- `GET /api/businesses`
- `GET /api/businesses/:id`
- `GET /api/categories`
- `GET /api/services?businessId=biz-1`
- `GET /api/availability?businessId=biz-1&serviceId=svc-1`
- `GET /api/search?category=nail&city=New York`

Protected routes:

- `GET /api/auth/session`
- `GET /api/auth/me`
- `GET /api/bookings?userId=user-customer-1&role=customer`
- `POST /api/bookings`
- `GET /api/payments?userId=user-customer-1&role=customer`
- `POST /api/payments/checkout`
- `GET /api/messaging/conversations?userId=user-customer-1`
- `GET /api/messaging/conversations/conv-1/messages`
- `POST /api/messaging/conversations/conv-1/messages`
- `GET /api/favorites`
- `POST /api/favorites/biz-2`
- `DELETE /api/favorites/biz-2`
- `GET /api/notifications?userId=user-owner-1`
- `GET /api/notifications/preferences`
- `PUT /api/notifications/preferences`
- `POST /api/notifications/read`
- `GET /api/admin/overview`
- `GET /api/users`

## Verified Flow

For local or staging, once `DATABASE_URL` contains the real Supabase password, run:

1. `npm run db:setup`
2. `npm run dev:api`
3. `npm run dev:owner`
4. `npm run dev:admin`

Then verify:

1. `GET /api/health`
2. `POST /api/auth/login` with a seeded email/password
3. `GET /api/businesses`
4. `POST /api/bookings`
5. `GET /api/notifications?userId=user-owner-1`
6. `GET /api/admin/overview`

On the customer app, you can now:

1. open the home screen
2. tap `View details and book`
3. preview the salon map and address
4. choose a service
5. choose an open slot
6. submit the booking directly from the UI

## Deploy

Use [DEPLOYMENT.md](/Users/tienhoang/Beauty%20Finder/DEPLOYMENT.md) as the current deployment runbook.

The repo is deployment-ready, but final public URLs, provider credentials, and production secrets still have to be created in your own hosting accounts.

Provider-ready env templates now live in [deploy/env](/Users/tienhoang/Beauty%20Finder/deploy/env), and the deploy smoke script is available as `npm run smoke:deploy`.

Recommended deployment split:

- API: Render Web Service using [backend/api/Dockerfile](/Users/tienhoang/Beauty%20Finder/backend/api/Dockerfile)
- Owner dashboard: Vercel project rooted at `frontend/owner-dashboard`
- Admin panel: Vercel project rooted at `frontend/admin-panel`
- Customer app: Vercel project rooted at `frontend/mobile-app`

### API on Render

Create a new Render Web Service and choose Docker.

- Dockerfile Path: `backend/api/Dockerfile`
- Health Check Path: `/api/health`
- Start Command: `node scripts/start-api-container.mjs`
- Pre-Deploy Command: `npm run db:migrate:deploy`
- Required environment variables:
- `DATABASE_URL`
- `JWT_SECRET`
- `APP_ENV=production`
- `SEED_SAMPLE_DATA=false`
- `HOST=0.0.0.0`
- `PORT=3000`
- `CORS_ORIGINS=https://your-owner-domain,https://your-admin-domain,https://your-customer-domain`
- `REDIS_URL=redis://your-redis-host:6379`

Production notes:

- Do not run `npm run db:setup` in production because it can trigger optional sample-seed logic.
- Do not use the local `.env` values directly in production.
- Run Prisma migrations through the provider pre-deploy step or a separate release job with `npm run db:migrate:deploy`.

### Staging API

For staging, use a separate database and a separate env set.

- `APP_ENV=staging`
- `SEED_SAMPLE_DATA=true` only if you want sample marketplace data in staging
- Start command can remain `node scripts/start-api-container.mjs`
- Bootstrap command can be `node scripts/bootstrap-db.mjs` when you intentionally want migrations plus optional sample seed in a staging deployment

### Owner Dashboard on Vercel

Create a Vercel project with:

- Root Directory: `frontend/owner-dashboard`
- Install Command: `npm install`
- Build Command: `npm run build --workspace @beauty-finder/owner-dashboard`
- Environment variable:
- `NEXT_PUBLIC_API_URL=https://your-api-domain/api`

### Admin Panel on Vercel

Create a Vercel project with:

- Root Directory: `frontend/admin-panel`
- Install Command: `npm install`
- Build Command: `npm run build --workspace @beauty-finder/admin-panel`
- Environment variable:
- `NEXT_PUBLIC_API_URL=https://your-api-domain/api`

### Customer App on Vercel

Create a Vercel project with:

- Root Directory: `frontend/mobile-app`
- Install Command: `npm install`
- Build Command: `npm run build --workspace @beauty-finder/mobile-app`
- Output Directory: `dist`
- Environment variables:
- `EXPO_PUBLIC_API_URL=https://your-api-domain/api`
- `EXPO_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY=your-google-maps-embed-key`

The customer app includes [frontend/mobile-app/vercel.json](/Users/tienhoang/Beauty%20Finder/frontend/mobile-app/vercel.json) so SPA routes such as `/salons/biz-1` rewrite back to `index.html` on Vercel.

## Provider Notes

- Vercel monorepos: import one project per app directory. Source: https://vercel.com/docs/monorepos/
- Vercel `vercel.json` supports `outputDirectory` and `rewrites` for SPA routing. Source: https://vercel.com/docs/project-configuration/vercel-json
- Render supports building directly from a Dockerfile and lets you specify a Dockerfile path in the dashboard. Source: https://render.com/docs/docker

## Remaining Gaps

- Redis-backed queues/cache are not wired in yet.
- CI/CD is not yet defined in this repo, so deploy promotion is still manual.
- Sample seed is opt-in and blocked in production, but staging still needs an intentional `SEED_SAMPLE_DATA=true|false` decision.
- Worker auth and scheduling are still not production-grade.
- Expo native store release config is still missing.
- Expo native simulator/device behavior still depends on the local Xcode/Android toolchain.
