# Launch Checklist

Use this checklist for the first real staging rollout and the later production cutover.

## Working Assumptions

- Backend launch target: `backend/api`
- Web launch targets:
  - `frontend/owner-dashboard`
  - `frontend/admin-panel`
  - `frontend/mobile-app` as customer web
- Out of scope for v1 launch:
  - `backend/api-py`
  - `backend/worker`
  - native Expo store release

## Fill In First

- Staging API domain: `https://beautyfinder-api-staging.onrender.com`
- Staging owner domain: `https://owner-dashboard-pi.vercel.app`
- Staging admin domain: `https://admin-panel-beta-olive.vercel.app`
- Staging customer web domain: `https://mobile-app-bice-ten.vercel.app`
- Production API domain: `________________`
- Production owner domain: `________________`
- Production admin domain: `________________`
- Production customer web domain: `________________`
- Render staging service name: `beautyfinder-api-staging`
- Render production service name: `________________`
- Vercel owner project name: `owner-dashboard`
- Vercel admin project name: `admin-panel`
- Vercel customer web project name: `mobile-app`

## Repo Prep

- [x] Demo and preview flows are disabled outside local development.
- [x] Owner media uploads use object storage for staging and production.
- [x] Owner and admin web auth use `HttpOnly` session cookies.
- [x] Render API blueprint exists in [render.yaml](/Users/tienhoang/Beauty%20Finder/render.yaml).
- [x] Deployment runbook exists in [DEPLOYMENT.md](/Users/tienhoang/Beauty%20Finder/DEPLOYMENT.md).
- [x] Provider-ready env templates exist in [deploy/env](/Users/tienhoang/Beauty%20Finder/deploy/env).
- [x] Smoke script exists as `npm run smoke:deploy`.
- [x] GitHub Actions CI workflow exists for repository validation.
- [x] Manual GitHub Actions deploy-smoke workflow exists for staging and production validation.

## Staging Setup

- [ ] Create managed staging Postgres.
- [ ] Create managed staging Redis.
- [x] Create staging Supabase storage bucket or equivalent storage target.
- [x] Create Render staging API service from [render.yaml](/Users/tienhoang/Beauty%20Finder/render.yaml).
- [x] Copy secrets from [render-api.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/render-api.staging.env.example).
- [x] Set real `CORS_ORIGINS` for staging owner/admin/customer web domains.
- [x] Run `npm run db:migrate:deploy` against staging.
- [x] Create Vercel owner staging project.
- [x] Copy secrets from [vercel-owner.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-owner.staging.env.example).
- [x] Create Vercel admin staging project.
- [x] Copy secrets from [vercel-admin.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-admin.staging.env.example).
- [x] Create Vercel customer web staging project.
- [x] Copy secrets from [vercel-customer-web.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-customer-web.staging.env.example).
- [ ] Bind staging custom domains over HTTPS.

Current temporary staging note:

- Staging validation is currently using the shared Supabase project and bucket for testing.
- `REDIS_URL` is still unset, so Redis-dependent behavior is not part of the current staging sign-off.

## Staging Verification

- [x] `GET /api/health` returns `200`.
- [x] Owner login works in staging.
- [x] Admin login works in staging.
- [x] Owner business edit saves correctly.
- [x] Owner image upload succeeds and points to object storage.
- [x] Owner technician roster save works.
- [x] Admin business moderation works.
- [x] Admin account access session works.
- [x] Customer web app loads main routes.
- [x] `npm run smoke:deploy` passes with staging values from [smoke.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/smoke.staging.env.example).
- [ ] GitHub environment `staging` is populated with smoke-test secrets from [github-smoke.secrets.example](/Users/tienhoang/Beauty%20Finder/deploy/env/github-smoke.secrets.example).
- [ ] `Beauty Finder Deploy Smoke` workflow passes for `staging`.

## Production Setup

- [ ] Freeze schema changes before production cutover.
- [ ] Create production DB backup.
- [ ] Create Render production API service.
- [ ] Copy secrets from [render-api.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/render-api.production.env.example).
- [ ] Set production `CORS_ORIGINS` to the real public web origins.
- [ ] Run `npm run db:migrate:deploy` against production.
- [ ] Create or update Vercel owner production project.
- [ ] Copy secrets from [vercel-owner.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-owner.production.env.example).
- [ ] Create or update Vercel admin production project.
- [ ] Copy secrets from [vercel-admin.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-admin.production.env.example).
- [ ] Create or update Vercel customer web production project.
- [ ] Copy secrets from [vercel-customer-web.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-customer-web.production.env.example).
- [ ] Bind production domains over HTTPS.

## Production Go/No-Go

- [ ] API health is green.
- [ ] Owner login works on the public domain.
- [ ] Admin login works on the public domain.
- [ ] Smoke test passes on production-safe credentials.
- [ ] `Beauty Finder Deploy Smoke` workflow passes for `production`.
- [ ] No preview or demo mode is enabled.
- [ ] Media upload writes to object storage.
- [ ] Logs show no immediate auth, CORS, or storage failures.

## After Launch

- [ ] Monitor logs for 24 to 48 hours.
- [ ] Add deployment promotion workflow if you want automated staging or production releases.
- [ ] Replace or remove seeded staging credentials when no longer needed.
- [ ] Decide whether `backend/worker` will be productionized or removed from the launch path.
