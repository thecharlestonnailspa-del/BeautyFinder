# Staging Operator Checklist

Use this file when you need to finish the remaining staging release work quickly.

## Objective

Complete the remaining external staging tasks in this order:

1. Populate GitHub environment `staging`
2. Run GitHub deploy smoke
3. Provision staging Redis
4. Bind staging custom domains

Optional local validation before you paste secrets:

- `npm run check:release-env`
- After replacing placeholders in the file you will actually use, run `npm run check:release-env -- --strict deploy/env/github-smoke.secrets.example`
- After replacing placeholders in the file you will actually use, run `npm run check:release-env -- --strict deploy/env/render-api.staging.env.example`
- Recommended local smoke file name: `deploy/env/smoke.staging.local.env`
- Run local staging smoke with: `npm run smoke:deploy:file -- deploy/env/smoke.staging.local.env`

## Copy-Paste Values

### GitHub Environment `staging`

Open:

- GitHub repository
- `Settings`
- `Environments`
- `staging`
- `Environment secrets`

Create or update these secrets:

```env
DEPLOY_SMOKE_API_URL=https://beautyfinder-api-staging.onrender.com/api
DEPLOY_SMOKE_OWNER_URL=https://owner-dashboard-pi.vercel.app
DEPLOY_SMOKE_ADMIN_URL=https://admin-panel-beta-olive.vercel.app
DEPLOY_SMOKE_CUSTOMER_URL=https://mobile-app-bice-ten.vercel.app
DEPLOY_SMOKE_OWNER_EMAIL=lina@polishedstudio.app
DEPLOY_SMOKE_OWNER_PASSWORD=<real staging owner password>
DEPLOY_SMOKE_ADMIN_EMAIL=admin@beautyfinder.app
DEPLOY_SMOKE_ADMIN_PASSWORD=<real staging admin password>
DEPLOY_SMOKE_ACCESS_ACCOUNT_ID=
DEPLOY_SMOKE_OWNER_BUSINESS_ID=
DEPLOY_SMOKE_ALLOW_SIDE_EFFECTS=false
DEPLOY_SMOKE_OWNER_MEDIA_UPLOAD=false
DEPLOY_SMOKE_ADMIN_HOMEPAGE_BUSINESS_ID=
DEPLOY_SMOKE_ADMIN_STATUS_BUSINESS_ID=
```

Decision:

- Keep `DEPLOY_SMOKE_ALLOW_SIDE_EFFECTS=false`
- Keep `DEPLOY_SMOKE_OWNER_MEDIA_UPLOAD=false`
- Leave `DEPLOY_SMOKE_ACCESS_ACCOUNT_ID` blank
- Leave `DEPLOY_SMOKE_OWNER_BUSINESS_ID` blank
- Leave `DEPLOY_SMOKE_ADMIN_HOMEPAGE_BUSINESS_ID` blank
- Leave `DEPLOY_SMOKE_ADMIN_STATUS_BUSINESS_ID` blank

Optional advanced smoke targets from seeded staging data:

- `DEPLOY_SMOKE_ACCESS_ACCOUNT_ID=user-owner-1`
- `DEPLOY_SMOKE_OWNER_BUSINESS_ID=biz-1`
- `DEPLOY_SMOKE_ADMIN_HOMEPAGE_BUSINESS_ID=biz-1`

Only use those optional values together with `DEPLOY_SMOKE_ALLOW_SIDE_EFFECTS=true`.

### Render Service `beautyfinder-api-staging`

Open:

- Render
- service `beautyfinder-api-staging`
- `Environment`

Target values:

```env
APP_ENV=staging
SEED_SAMPLE_DATA=false
HOST=0.0.0.0
PORT=3000
RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW_MS=60000
AUTH_RATE_LIMIT_MAX=10
AUTH_RATE_LIMIT_WINDOW_MS=60000
PAYMENT_TAX_RATE=0.08
OWNER_MEDIA_STORAGE_DRIVER=supabase
OWNER_MEDIA_STORAGE_BUCKET=owner-media
OWNER_MEDIA_STORAGE_PATH_PREFIX=staging
CORS_ORIGINS=https://owner-dashboard-pi.vercel.app,https://admin-panel-beta-olive.vercel.app,https://mobile-app-bice-ten.vercel.app
DATABASE_URL=<real staging postgres url>
REDIS_URL=<real staging redis url>
JWT_SECRET=<real staging jwt secret>
SUPABASE_URL=<real staging supabase url>
SUPABASE_SERVICE_ROLE_KEY=<real staging supabase service role key>
OWNER_MEDIA_PUBLIC_BASE_URL=<real staging public media base url>
```

Decision:

- `REDIS_URL` should now point to a dedicated staging Redis instance
- Do not use local storage
- Keep `OWNER_MEDIA_STORAGE_PATH_PREFIX=staging`

### Vercel Owner Project

Open:

- Vercel project `owner-dashboard`
- `Settings`
- `Environment Variables`

```env
NEXT_PUBLIC_API_URL=https://beautyfinder-api-staging.onrender.com/api
NEXT_PUBLIC_ENABLE_PREVIEW_MODE=false
```

### Vercel Admin Project

Open:

- Vercel project `admin-panel`
- `Settings`
- `Environment Variables`

```env
NEXT_PUBLIC_API_URL=https://beautyfinder-api-staging.onrender.com/api
```

### Vercel Customer Web Project

Open:

- Vercel project `mobile-app`
- `Settings`
- `Environment Variables`

```env
EXPO_PUBLIC_API_URL=https://beautyfinder-api-staging.onrender.com/api
EXPO_PUBLIC_ENABLE_DEMO_MODE=false
EXPO_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY=<optional>
```

## Run GitHub Deploy Smoke

After the GitHub secrets are entered:

1. Open `Actions`
2. Open workflow `Beauty Finder Deploy Smoke`
3. Click `Run workflow`
4. Choose target `staging`
5. Start run

Expected result:

- workflow passes
- owner login passes
- admin login passes
- customer routes pass
- logout checks return `401` after session clear

Optional local dry run before the GitHub workflow:

1. Copy [deploy/env/smoke.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/smoke.staging.env.example) to `deploy/env/smoke.staging.local.env`
2. Replace placeholder passwords with real staging values
3. Run `npm run smoke:deploy:file -- deploy/env/smoke.staging.local.env`

Optional advanced result when side effects are intentionally enabled:

- access-session bootstrap passes
- owner business round-trip passes
- homepage placement smoke passes

## Provision Staging Redis

Minimum decision:

- create one dedicated staging Redis instance
- set its connection string in Render as `REDIS_URL`
- redeploy the staging API after saving the variable

Acceptance check:

- `GET /api/health` remains `200`
- no Redis connection errors appear in Render logs after deploy

## Bind Staging Custom Domains

Target outcome:

- API custom domain over HTTPS
- owner custom domain over HTTPS
- admin custom domain over HTTPS
- customer web custom domain over HTTPS

After domains are live:

1. update `CORS_ORIGINS` in Render to the final custom domains
2. update GitHub `staging` secrets to the same final domains
3. rerun `Beauty Finder Deploy Smoke`

## Staging Exit Criteria

Staging is considered complete only when all of these are true:

- GitHub `staging` secrets are populated
- `Beauty Finder Deploy Smoke` passes for `staging`
- dedicated staging Redis is live
- staging custom domains are live over HTTPS
- Render logs show no immediate auth, CORS, storage, or Redis issues

## What Not To Do

- Do not set `DEPLOY_SMOKE_ALLOW_SIDE_EFFECTS=true` unless you intentionally want storage writes or owner-facing moderation notifications
- Do not set `DEPLOY_SMOKE_ALLOW_SIDE_EFFECTS=true` for routine production-like smoke unless you are deliberately validating mutating paths
- Do not move to production before the staging exit criteria above are met
- Do not add `backend/worker` or `backend/api-py` to the first public launch path
