# Deployment Runbook

This is the current deployment source of truth for Beauty Finder.

Execution checklist: [deploy/LAUNCH_CHECKLIST.md](/Users/tienhoang/Beauty%20Finder/deploy/LAUNCH_CHECKLIST.md)

Status summary: [deploy/STATUS_REPORT.md](/Users/tienhoang/Beauty%20Finder/deploy/STATUS_REPORT.md)

## Target Topology

- API: `backend/api` on Render using [backend/api/Dockerfile](/Users/tienhoang/Beauty%20Finder/backend/api/Dockerfile)
- Owner dashboard: `frontend/owner-dashboard` on Vercel
- Admin panel: `frontend/admin-panel` on Vercel
- Customer web app: `frontend/mobile-app` on Vercel
- Database: managed Postgres
- Redis: managed Redis
- Owner media: Supabase Storage

Explicitly out of scope for the first production launch:

- `backend/api-py`
- `backend/worker` as a standalone production service
- Expo native App Store / Play Store release

## Why This Topology

- `backend/api` is still the authoritative backend.
- Owner and admin web auth now use first-party `HttpOnly` cookies, so each app should stay on its own HTTPS origin.
- Media uploads now require object storage, so production should not mount or rely on container disks.

## Provider Setup

### Render

Use the root [render.yaml](/Users/tienhoang/Beauty%20Finder/render.yaml) as the baseline API service definition.

Recommended setup:

1. Create one Render web service for `staging`.
2. Create a second Render web service for `production`.
3. Keep `autoDeploy` disabled until secrets, migrations, and smoke tests are in place.
4. Set the health check to `/api/health`.
5. Run `npm run db:migrate:deploy` as the pre-deploy or release migration step.

The blueprint intentionally only defines the API service. Database, Redis, and Supabase Storage should be managed separately so staging and production stay isolated.

Provider-ready env templates live in [deploy/env](/Users/tienhoang/Beauty%20Finder/deploy/env).

### Vercel

Create one Vercel project per app:

- Owner dashboard:
  - Root Directory: `frontend/owner-dashboard`
  - Framework: Next.js
  - Install Command: `npm install`
  - Build Command: `npm run build --workspace @beauty-finder/owner-dashboard`
- Admin panel:
  - Root Directory: `frontend/admin-panel`
  - Framework: Next.js
  - Install Command: `npm install`
  - Build Command: `npm run build --workspace @beauty-finder/admin-panel`
- Customer web app:
  - Root Directory: `frontend/mobile-app`
  - Framework: Other
  - Install Command: `npm install`
  - Build Command: `npm run build --workspace @beauty-finder/mobile-app`
  - Output Directory: `dist`

`frontend/mobile-app` already includes [vercel.json](/Users/tienhoang/Beauty%20Finder/frontend/mobile-app/vercel.json) for SPA rewrites.

## Secrets Matrix

### API service

Required:

- `APP_ENV=staging|production`
- `SEED_SAMPLE_DATA=false` in production
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `HOST=0.0.0.0`
- `PORT=3000`
- `CORS_ORIGINS`
- `OWNER_MEDIA_STORAGE_DRIVER=supabase`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OWNER_MEDIA_STORAGE_BUCKET`
- `OWNER_MEDIA_PUBLIC_BASE_URL`
- `OWNER_MEDIA_STORAGE_PATH_PREFIX`

Recommended defaults:

- `RATE_LIMIT_MAX=120`
- `RATE_LIMIT_WINDOW_MS=60000`
- `AUTH_RATE_LIMIT_MAX=10`
- `AUTH_RATE_LIMIT_WINDOW_MS=60000`
- `PAYMENT_TAX_RATE=0.08`

### Owner dashboard

- `NEXT_PUBLIC_API_URL=https://<api-domain>/api`
- `NEXT_PUBLIC_ENABLE_PREVIEW_MODE=false`

### Admin panel

- `NEXT_PUBLIC_API_URL=https://<api-domain>/api`

### Customer web app

- `EXPO_PUBLIC_API_URL=https://<api-domain>/api`
- `EXPO_PUBLIC_ENABLE_DEMO_MODE=false`
- `EXPO_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY=<optional>`

## Domain Plan

Staging example:

- `staging-api.example.com`
- `staging-owner.example.com`
- `staging-admin.example.com`
- `staging-app.example.com`

Production example:

- `api.example.com`
- `owner.example.com`
- `admin.example.com`
- `app.example.com`

`CORS_ORIGINS` on the API must exactly list the deployed browser origins for the owner, admin, and customer web apps.

## Deployment Order

### First staging rollout

1. Provision staging Postgres, Redis, and Supabase Storage.
2. Fill the Render API secrets from [deploy/env/render-api.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/render-api.staging.env.example).
3. Deploy the API.
4. Run `npm run db:migrate:deploy` against staging.
5. Set app secrets from:
   - [deploy/env/vercel-owner.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-owner.staging.env.example)
   - [deploy/env/vercel-admin.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-admin.staging.env.example)
   - [deploy/env/vercel-customer-web.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-customer-web.staging.env.example)
6. Deploy owner, admin, and customer web.
7. Bind custom domains and verify HTTPS.

### Production cutover

1. Freeze schema changes.
2. Back up the production database.
3. Fill the Render API secrets from [deploy/env/render-api.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/render-api.production.env.example).
4. Run `npm run db:migrate:deploy`.
5. Set app secrets from:
   - [deploy/env/vercel-owner.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-owner.production.env.example)
   - [deploy/env/vercel-admin.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-admin.production.env.example)
   - [deploy/env/vercel-customer-web.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-customer-web.production.env.example)
6. Deploy the API.
7. Deploy owner, admin, and customer web.
8. Switch DNS or promote the verified production domains.

## Smoke Test Checklist

Run this after every staging or production deploy:

1. `GET /api/health` returns `200`.
2. Owner login works and sets a session cookie.
3. Admin login works and redirects into the admin dashboard.
4. Owner can edit a business profile.
5. Owner can upload a business image and the returned URL points to Supabase Storage.
6. Owner can edit the technician roster.
7. Admin can approve or reject a business.
8. Admin can start and end an account access session.
9. Admin can update homepage ordering.
10. Customer web can load home, salon detail, and booking flow pages.
11. Owner and admin logout clears the local session and forces a fresh sign-in.

You can automate the basic checks with:

```bash
npm run smoke:deploy
```

Use [deploy/env/smoke.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/smoke.staging.env.example) as the template for the required smoke-test environment variables.

If you want the same verification in GitHub Actions after deploys, populate environment secrets from [deploy/env/github-smoke.secrets.example](/Users/tienhoang/Beauty%20Finder/deploy/env/github-smoke.secrets.example) and run [.github/workflows/beauty-finder-deploy-smoke.yml](/Users/tienhoang/Beauty%20Finder/.github/workflows/beauty-finder-deploy-smoke.yml).

## Known Non-Launch Items

- The worker is still demo-grade and should not be deployed as a production background processor yet.
- `backend/api-py` is still a migration track, not a production service.
- Native Expo release config is still missing.

## Rollback Notes

- If a web deploy fails after the API is healthy, roll back the affected Vercel project first.
- If an API deploy fails but the migration has already run, redeploy the previous known-good API image before changing schema again.
- Do not restore preview/demo flags in staging or production during rollback.
