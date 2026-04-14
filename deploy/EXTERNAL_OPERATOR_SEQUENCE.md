# External Operator Sequence

Use this file when you need the shortest possible outside-the-repo execution order.

## Staging First

1. GitHub
   Open repository `Settings` -> `Environments` -> `staging` -> `Environment secrets`.
   Copy values from [deploy/env/github-smoke.secrets.example](/Users/tienhoang/Beauty%20Finder/deploy/env/github-smoke.secrets.example).
   If your staging still uses the seeded smoke accounts, the workflow can now run even with no staging secrets because it auto-fills the repo defaults.
   Keep:
   - `DEPLOY_SMOKE_ALLOW_SIDE_EFFECTS=false`
   - `DEPLOY_SMOKE_OWNER_MEDIA_UPLOAD=false`
   - all mutating smoke IDs blank

2. Render
   Open service `beautyfinder-api-staging` -> `Environment`.
   Copy values from [deploy/env/render-api.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/render-api.staging.env.example).
   Make sure:
   - `APP_ENV=staging`
   - `OWNER_MEDIA_STORAGE_PATH_PREFIX=staging`
   - `REDIS_URL` points to a dedicated staging Redis

3. Vercel Owner
   Open project `owner-dashboard` -> `Settings` -> `Environment Variables`.
   Copy values from [deploy/env/vercel-owner.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-owner.staging.env.example).

4. Vercel Admin
   Open project `admin-panel` -> `Settings` -> `Environment Variables`.
   Copy values from [deploy/env/vercel-admin.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-admin.staging.env.example).

5. Vercel Customer Web
   Open project `mobile-app` -> `Settings` -> `Environment Variables`.
   Copy values from [deploy/env/vercel-customer-web.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-customer-web.staging.env.example).

6. Optional local smoke before GitHub Actions
   Copy [deploy/env/smoke.staging.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/smoke.staging.env.example) to `deploy/env/smoke.staging.local.env`.
   Fill real passwords.
   Run `npm run smoke:deploy:file -- deploy/env/smoke.staging.local.env`.

7. GitHub Actions
   Open `Actions` -> `Beauty Finder Deploy Smoke` -> `Run workflow`.
   Choose target `staging`.
   Wait for pass.

8. Domains
   Bind staging HTTPS domains for API, owner, admin, and customer web.
   Update `CORS_ORIGINS` in Render to the final staging domains.
   Update GitHub `staging` secrets to the same final URLs.
   Re-run `Beauty Finder Deploy Smoke`.

## Production Only After Staging Passes

1. Prepare production secrets from:
   - [deploy/env/render-api.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/render-api.production.env.example)
   - [deploy/env/vercel-owner.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-owner.production.env.example)
   - [deploy/env/vercel-admin.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-admin.production.env.example)
   - [deploy/env/vercel-customer-web.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-customer-web.production.env.example)
   - [deploy/env/github-smoke.production.secrets.example](/Users/tienhoang/Beauty%20Finder/deploy/env/github-smoke.production.secrets.example)

2. Back up the production database.

3. Render
   Enter production API values.
   Make sure:
   - `APP_ENV=production`
   - `SEED_SAMPLE_DATA=false`
   - `OWNER_MEDIA_STORAGE_PATH_PREFIX=production`

4. Vercel
   Enter production API URL into owner, admin, and customer web projects.

5. GitHub
   Populate environment `production`.
   Keep production smoke non-mutating.

6. Migrate and deploy
   Run `npm run db:migrate:deploy` against production.
   Deploy API.
   Deploy owner, admin, and customer web.

7. Smoke
   Run `Beauty Finder Deploy Smoke` with target `production`.

8. Cutover
   If smoke passes, execute [deploy/CUTOVER_RUNBOOK.md](/Users/tienhoang/Beauty%20Finder/deploy/CUTOVER_RUNBOOK.md).
   If anything fails, execute [deploy/ROLLBACK_RUNBOOK.md](/Users/tienhoang/Beauty%20Finder/deploy/ROLLBACK_RUNBOOK.md).
