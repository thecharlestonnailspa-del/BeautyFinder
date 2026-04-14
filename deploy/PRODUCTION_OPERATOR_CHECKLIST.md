# Production Operator Checklist

Use this file only after staging exit criteria are fully complete.

Actual launch-day execution lives in [deploy/CUTOVER_RUNBOOK.md](/Users/tienhoang/Beauty%20Finder/deploy/CUTOVER_RUNBOOK.md).
If production needs to be reverted, use [deploy/ROLLBACK_RUNBOOK.md](/Users/tienhoang/Beauty%20Finder/deploy/ROLLBACK_RUNBOOK.md).

## Objective

Complete the production launch in this order:

1. Freeze schema changes
2. Back up production database
3. Create or verify production API service
4. Enter production secrets in Render and Vercel
5. Populate GitHub environment `production`
6. Run production deploy smoke
7. Promote DNS to production domains
8. Watch logs after cutover

## Precondition

Do not start this checklist until all staging exit criteria are already true from [deploy/STAGING_OPERATOR_CHECKLIST.md](/Users/tienhoang/Beauty%20Finder/deploy/STAGING_OPERATOR_CHECKLIST.md).

Optional local validation before you paste secrets:

- `npm run check:release-env`
- After replacing placeholders in the file you will actually use, run `npm run check:release-env -- --strict deploy/env/github-smoke.production.secrets.example`
- After replacing placeholders in the file you will actually use, run `npm run check:release-env -- --strict deploy/env/render-api.production.env.example`
- Recommended local smoke file name: `deploy/env/smoke.production.local.env`
- Run local production smoke with: `npm run smoke:deploy:file -- deploy/env/smoke.production.local.env`

## Copy-Paste Values

### GitHub Environment `production`

Open:

- GitHub repository
- `Settings`
- `Environments`
- `production`
- `Environment secrets`

Create or update these secrets using [deploy/env/github-smoke.production.secrets.example](/Users/tienhoang/Beauty%20Finder/deploy/env/github-smoke.production.secrets.example):

```env
DEPLOY_SMOKE_API_URL=https://api.example.com/api
DEPLOY_SMOKE_OWNER_URL=https://owner.example.com
DEPLOY_SMOKE_ADMIN_URL=https://admin.example.com
DEPLOY_SMOKE_CUSTOMER_URL=https://app.example.com
DEPLOY_SMOKE_OWNER_EMAIL=<production-safe-owner-email>
DEPLOY_SMOKE_OWNER_PASSWORD=<production-safe-owner-password>
DEPLOY_SMOKE_ADMIN_EMAIL=<production-safe-admin-email>
DEPLOY_SMOKE_ADMIN_PASSWORD=<production-safe-admin-password>
DEPLOY_SMOKE_ACCESS_ACCOUNT_ID=
DEPLOY_SMOKE_ALLOW_SIDE_EFFECTS=false
DEPLOY_SMOKE_OWNER_BUSINESS_ID=
DEPLOY_SMOKE_OWNER_MEDIA_UPLOAD=false
DEPLOY_SMOKE_ADMIN_HOMEPAGE_BUSINESS_ID=
DEPLOY_SMOKE_ADMIN_STATUS_BUSINESS_ID=
```

Decision:

- Keep production smoke non-mutating by default
- Do not enable side effects during production cutover smoke
- Use dedicated production-safe accounts, not staging demo assumptions

### Render Production API

Use [deploy/env/render-api.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/render-api.production.env.example).

Required real values:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OWNER_MEDIA_PUBLIC_BASE_URL`
- final production `CORS_ORIGINS`

Required decided values:

- `APP_ENV=production`
- `SEED_SAMPLE_DATA=false`
- `HOST=0.0.0.0`
- `PORT=3000`
- `OWNER_MEDIA_STORAGE_DRIVER=supabase`
- `OWNER_MEDIA_STORAGE_BUCKET=owner-media`
- `OWNER_MEDIA_STORAGE_PATH_PREFIX=production`

### Vercel Production Apps

Use:

- [deploy/env/vercel-owner.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-owner.production.env.example)
- [deploy/env/vercel-admin.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-admin.production.env.example)
- [deploy/env/vercel-customer-web.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-customer-web.production.env.example)

Required final values:

- Owner `NEXT_PUBLIC_API_URL=https://api.example.com/api`
- Owner `NEXT_PUBLIC_ENABLE_PREVIEW_MODE=false`
- Admin `NEXT_PUBLIC_API_URL=https://api.example.com/api`
- Customer `EXPO_PUBLIC_API_URL=https://api.example.com/api`
- Customer `EXPO_PUBLIC_ENABLE_DEMO_MODE=false`

Optional:

- `EXPO_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY`

## Exact Cutover Sequence

1. Freeze schema changes on the branch you intend to launch.
2. Create a production DB backup.
3. Verify all production secrets are entered in Render and Vercel.
4. Run `npm run db:migrate:deploy` against production.
5. Deploy the production API.
6. Deploy owner, admin, and customer web.
7. Populate GitHub environment `production`.
8. Run workflow `Beauty Finder Deploy Smoke` with target `production`.
9. If smoke passes, switch DNS or promote the verified domains.
10. Watch logs and health immediately after cutover.

## Production Exit Criteria

Production is not complete until all of these are true:

- API health is green
- production deploy smoke passes
- owner login works on public domain
- admin login works on public domain
- no preview or demo mode is enabled
- media writes to object storage
- no immediate auth, CORS, Redis, or storage failures appear in logs

## What Not To Do

- Do not enable `SEED_SAMPLE_DATA`
- Do not use `OWNER_MEDIA_STORAGE_DRIVER=local`
- Do not run mutating production smoke checks during first cutover
- Do not promote production before smoke and manual login checks pass
