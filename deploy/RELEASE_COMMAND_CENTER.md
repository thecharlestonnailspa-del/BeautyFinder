# Release Command Center

This file is the operational command center for the current Beauty Finder release.

Fast operator handoff:

- [deploy/EXTERNAL_OPERATOR_SEQUENCE.md](/Users/tienhoang/Beauty%20Finder/deploy/EXTERNAL_OPERATOR_SEQUENCE.md)
- [deploy/STAGING_OPERATOR_CHECKLIST.md](/Users/tienhoang/Beauty%20Finder/deploy/STAGING_OPERATOR_CHECKLIST.md)
- [deploy/PRODUCTION_OPERATOR_CHECKLIST.md](/Users/tienhoang/Beauty%20Finder/deploy/PRODUCTION_OPERATOR_CHECKLIST.md)
- [deploy/CUTOVER_RUNBOOK.md](/Users/tienhoang/Beauty%20Finder/deploy/CUTOVER_RUNBOOK.md)
- [deploy/ROLLBACK_RUNBOOK.md](/Users/tienhoang/Beauty%20Finder/deploy/ROLLBACK_RUNBOOK.md)
- [deploy/INCIDENT_LOG_TEMPLATE.md](/Users/tienhoang/Beauty%20Finder/deploy/INCIDENT_LOG_TEMPLATE.md)

## Current Decision

- Release track: `staging hardening before production`
- Backend launch target: `backend/api`
- Web launch targets:
  - `frontend/owner-dashboard`
  - `frontend/admin-panel`
  - `frontend/mobile-app`
- Explicitly not in first public launch:
  - `backend/api-py`
  - `backend/worker`
  - native app-store release

## Repo Status

- Repo-side validation is green:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run test:backend:api-py`
  - `npm run build`
- Staging URLs currently live:
  - API: `https://beautyfinder-api-staging.onrender.com`
  - Owner: `https://owner-dashboard-pi.vercel.app`
  - Admin: `https://admin-panel-beta-olive.vercel.app`
  - Customer web: `https://mobile-app-bice-ten.vercel.app`

## Today's Priority

1. Populate GitHub environment `staging` with deploy-smoke secrets from [deploy/env/github-smoke.secrets.example](/Users/tienhoang/Beauty%20Finder/deploy/env/github-smoke.secrets.example).
2. Run `Beauty Finder Deploy Smoke` for `staging`.
3. Provision dedicated staging Redis and wire `REDIS_URL` into Render.
4. Bind staging custom HTTPS domains.

Optional local guard before entering provider values:

- `npm run check:release-env`
- After replacing placeholders in the file you will actually use, run `npm run check:release-env -- --strict deploy/env/github-smoke.secrets.example`
- Recommended local smoke file names are ignored by git:
  - `deploy/env/smoke.staging.local.env`
  - `deploy/env/smoke.production.local.env`
- To run smoke from a filled local file:
  - `npm run smoke:deploy:file -- deploy/env/smoke.staging.local.env`

## Exact Secrets To Enter

### Render staging API

Use [deploy/env/render-api.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/render-api.staging.env.example).

You still need real values for:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OWNER_MEDIA_PUBLIC_BASE_URL`

Already decided values:

- `APP_ENV=staging`
- `SEED_SAMPLE_DATA=false`
- `HOST=0.0.0.0`
- `PORT=3000`
- `CORS_ORIGINS=https://owner-dashboard-pi.vercel.app,https://admin-panel-beta-olive.vercel.app,https://mobile-app-bice-ten.vercel.app`
- `OWNER_MEDIA_STORAGE_DRIVER=supabase`
- `OWNER_MEDIA_STORAGE_BUCKET=owner-media`
- `OWNER_MEDIA_STORAGE_PATH_PREFIX=staging`

### Vercel staging apps

Use these files:

- [deploy/env/vercel-owner.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-owner.staging.env.example)
- [deploy/env/vercel-admin.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-admin.staging.env.example)
- [deploy/env/vercel-customer-web.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-customer-web.staging.env.example)

Already decided values:

- Owner `NEXT_PUBLIC_API_URL=https://beautyfinder-api-staging.onrender.com/api`
- Owner `NEXT_PUBLIC_ENABLE_PREVIEW_MODE=false`
- Admin `NEXT_PUBLIC_API_URL=https://beautyfinder-api-staging.onrender.com/api`
- Customer `EXPO_PUBLIC_API_URL=https://beautyfinder-api-staging.onrender.com/api`
- Customer `EXPO_PUBLIC_ENABLE_DEMO_MODE=false`

Optional:

- `EXPO_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY`

### GitHub environment `staging`

Use [deploy/env/github-smoke.secrets.example](/Users/tienhoang/Beauty%20Finder/deploy/env/github-smoke.secrets.example).

Safe default:

- leave `DEPLOY_SMOKE_ACCESS_ACCOUNT_ID` blank
- leave `DEPLOY_SMOKE_OWNER_BUSINESS_ID` blank
- leave `DEPLOY_SMOKE_ADMIN_HOMEPAGE_BUSINESS_ID` blank
- `DEPLOY_SMOKE_ALLOW_SIDE_EFFECTS=false`
- leave `DEPLOY_SMOKE_OWNER_MEDIA_UPLOAD` blank or `false`
- leave `DEPLOY_SMOKE_ADMIN_STATUS_BUSINESS_ID` blank unless you intentionally want an audit entry and owner notification

Optional explicit smoke targets from seeded data:

- `DEPLOY_SMOKE_ACCESS_ACCOUNT_ID=user-owner-1`
- `DEPLOY_SMOKE_OWNER_BUSINESS_ID=biz-1`
- `DEPLOY_SMOKE_ADMIN_HOMEPAGE_BUSINESS_ID=biz-1`

Credentials still need real staging values:

- `DEPLOY_SMOKE_OWNER_PASSWORD`
- `DEPLOY_SMOKE_ADMIN_PASSWORD`

## Go/No-Go Rule

Do not move to production until all of these are true:

- staging Redis is provisioned
- staging custom domains are bound over HTTPS
- GitHub `staging` deploy-smoke workflow passes
- no auth/CORS/storage issues appear in staging logs

## Production Trigger

Only start production setup after the previous section is complete. When that happens, use:

- [deploy/env/render-api.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/render-api.production.env.example)
- [deploy/env/vercel-owner.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-owner.production.env.example)
- [deploy/env/vercel-admin.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-admin.production.env.example)
- [deploy/env/vercel-customer-web.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-customer-web.production.env.example)

Production remains blocked until the real production domains, DB backup plan, and provider secrets are ready.
When staging exit criteria are complete, execute the actual launch from [deploy/CUTOVER_RUNBOOK.md](/Users/tienhoang/Beauty%20Finder/deploy/CUTOVER_RUNBOOK.md).
