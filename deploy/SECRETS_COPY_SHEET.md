# Secrets Copy Sheet

Use this file when you want the shortest copy-paste source for provider setup.

Run workflow link:

- https://github.com/thecharlestonnailspa-del/BeautyFinder/actions/workflows/beauty-finder-deploy-smoke.yml

## GitHub `staging`

Open:

- `Settings`
- `Environments`
- `staging`
- `Environment secrets`

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
DEPLOY_SMOKE_ALLOW_SIDE_EFFECTS=false
DEPLOY_SMOKE_OWNER_BUSINESS_ID=
DEPLOY_SMOKE_OWNER_MEDIA_UPLOAD=false
DEPLOY_SMOKE_ADMIN_HOMEPAGE_BUSINESS_ID=
DEPLOY_SMOKE_ADMIN_STATUS_BUSINESS_ID=
```

## Render `beautyfinder-api-staging`

Open:

- service `beautyfinder-api-staging`
- `Environment`

```env
APP_ENV=staging
SEED_SAMPLE_DATA=false
DATABASE_URL=<real staging postgres url>
REDIS_URL=<real staging redis url>
JWT_SECRET=<real staging jwt secret>
HOST=0.0.0.0
PORT=3000
CORS_ORIGINS=https://owner-dashboard-pi.vercel.app,https://admin-panel-beta-olive.vercel.app,https://mobile-app-bice-ten.vercel.app
RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW_MS=60000
AUTH_RATE_LIMIT_MAX=10
AUTH_RATE_LIMIT_WINDOW_MS=60000
PAYMENT_TAX_RATE=0.08
OWNER_MEDIA_STORAGE_DRIVER=supabase
SUPABASE_URL=<real staging supabase url>
SUPABASE_SERVICE_ROLE_KEY=<real staging supabase service role key>
OWNER_MEDIA_STORAGE_BUCKET=owner-media
OWNER_MEDIA_PUBLIC_BASE_URL=<real staging public media base url>
OWNER_MEDIA_STORAGE_PATH_PREFIX=staging
```

## Vercel `owner-dashboard`

```env
NEXT_PUBLIC_API_URL=https://beautyfinder-api-staging.onrender.com/api
NEXT_PUBLIC_ENABLE_PREVIEW_MODE=false
```

## Vercel `admin-panel`

```env
NEXT_PUBLIC_API_URL=https://beautyfinder-api-staging.onrender.com/api
```

## Vercel `mobile-app`

```env
EXPO_PUBLIC_API_URL=https://beautyfinder-api-staging.onrender.com/api
EXPO_PUBLIC_ENABLE_DEMO_MODE=false
EXPO_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY=<optional>
```

## Local Smoke Run

1. Copy [deploy/env/smoke.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/smoke.staging.env.example) to `deploy/env/smoke.staging.local.env`
2. Replace the password placeholders
3. Run:

```bash
npm run smoke:deploy:file -- deploy/env/smoke.staging.local.env
```

## Click Order To Test

1. Fill GitHub `staging` secrets
2. Fill Render staging API env
3. Fill Vercel env vars for owner, admin, customer web
4. Optionally run local smoke
5. Open workflow link above
6. Click `Run workflow`
7. Choose `staging`
8. Start run
