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

- Staging API domain: `________________`
- Staging owner domain: `________________`
- Staging admin domain: `________________`
- Staging customer web domain: `________________`
- Production API domain: `________________`
- Production owner domain: `________________`
- Production admin domain: `________________`
- Production customer web domain: `________________`
- Render staging service name: `________________`
- Render production service name: `________________`
- Vercel owner project name: `________________`
- Vercel admin project name: `________________`
- Vercel customer web project name: `________________`

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
- [ ] Create staging Supabase storage bucket or equivalent storage target.
- [ ] Create Render staging API service from [render.yaml](/Users/tienhoang/Beauty%20Finder/render.yaml).
- [ ] Copy secrets from [render-api.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/render-api.staging.env.example).
- [ ] Set real `CORS_ORIGINS` for staging owner/admin/customer web domains.
- [ ] Run `npm run db:migrate:deploy` against staging.
- [ ] Create Vercel owner staging project.
- [ ] Copy secrets from [vercel-owner.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-owner.staging.env.example).
- [ ] Create Vercel admin staging project.
- [ ] Copy secrets from [vercel-admin.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-admin.staging.env.example).
- [ ] Create Vercel customer web staging project.
- [ ] Copy secrets from [vercel-customer-web.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-customer-web.staging.env.example).
- [ ] Bind staging custom domains over HTTPS.

## Staging Verification

- [ ] `GET /api/health` returns `200`.
- [ ] Owner login works in staging.
- [ ] Admin login works in staging.
- [ ] Owner business edit saves correctly.
- [ ] Owner image upload succeeds and points to object storage.
- [ ] Owner technician roster save works.
- [ ] Admin business moderation works.
- [ ] Admin account access session works.
- [ ] Customer web app loads main routes.
- [ ] `npm run smoke:deploy` passes with staging values from [smoke.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/smoke.staging.env.example).
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
