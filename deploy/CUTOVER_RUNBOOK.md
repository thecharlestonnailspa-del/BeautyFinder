# Production Cutover Runbook

Use this file on the actual production launch day.

Prerequisite:

- staging exit criteria from [deploy/STAGING_OPERATOR_CHECKLIST.md](/Users/tienhoang/Beauty%20Finder/deploy/STAGING_OPERATOR_CHECKLIST.md) are fully complete
- production values are prepared from [deploy/PRODUCTION_OPERATOR_CHECKLIST.md](/Users/tienhoang/Beauty%20Finder/deploy/PRODUCTION_OPERATOR_CHECKLIST.md)
- production env files have been checked with `npm run check:release-env -- --strict <file>`

## Launch Scope

Production launch path:

- `backend/api`
- `frontend/owner-dashboard`
- `frontend/admin-panel`
- `frontend/mobile-app`

Explicitly out of scope:

- `backend/api-py`
- `backend/worker`
- native app-store release

## Operator Rule

One person can execute this runbook, but do not overlap steps.
Finish the current step, verify the acceptance check, then move forward.

## T-60 Minutes

1. Freeze schema and deployment changes on the release branch.
2. Open these dashboards side by side:
   - Render production API service
   - Vercel owner project
   - Vercel admin project
   - Vercel customer web project
   - GitHub Actions
   - database provider
3. Confirm the production secrets packet you will use:
   - [deploy/env/render-api.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/render-api.production.env.example)
   - [deploy/env/vercel-owner.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-owner.production.env.example)
   - [deploy/env/vercel-admin.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-admin.production.env.example)
   - [deploy/env/vercel-customer-web.production.env.example](/Users/tienhoang/Beauty%20Finder/deploy/env/vercel-customer-web.production.env.example)
   - [deploy/env/github-smoke.production.secrets.example](/Users/tienhoang/Beauty%20Finder/deploy/env/github-smoke.production.secrets.example)

Acceptance check:

- all dashboards are open
- all production secrets are already prepared

## T-45 Minutes

1. Create a production database backup or snapshot.
2. Verify the production API values again:
   - `APP_ENV=production`
   - `SEED_SAMPLE_DATA=false`
   - `OWNER_MEDIA_STORAGE_DRIVER=supabase`
   - `OWNER_MEDIA_STORAGE_PATH_PREFIX=production`
   - `CORS_ORIGINS` matches the final public web domains
3. Verify production smoke remains non-mutating:
   - `DEPLOY_SMOKE_ALLOW_SIDE_EFFECTS=false`
   - `DEPLOY_SMOKE_OWNER_MEDIA_UPLOAD=false`
   - leave all mutating smoke IDs blank

Acceptance check:

- database backup completed successfully
- production env values match the decisions above

## T-30 Minutes

1. Enter or re-check production secrets in Render and Vercel.
2. Populate GitHub environment `production`.
3. Run `npm run check:release-env`.

Acceptance check:

- Render, Vercel, and GitHub all contain the expected values
- local release-env validation passes

## T-20 Minutes

1. Run `npm run db:migrate:deploy` against production.
2. Deploy the production API.
3. Wait for `GET /api/health` to return `200`.

Acceptance check:

- migrations succeed
- API deploy succeeds
- health check is green

Stop condition:

- if migrations fail, stop the cutover
- if API health is not green, redeploy the previous known-good API before changing anything else

## T-10 Minutes

1. Deploy owner dashboard.
2. Deploy admin panel.
3. Deploy customer web.
4. Verify each app points to `https://<production-api-domain>/api`.

Acceptance check:

- all three web deploys succeed
- no preview or demo flag is enabled

Stop condition:

- if one web deploy fails, do not switch traffic or promote domains yet

## T-5 Minutes

1. Run GitHub workflow `Beauty Finder Deploy Smoke` with target `production`.
2. Confirm the workflow stays non-mutating.
3. Manually verify:
   - owner login
   - admin login
   - customer home route
   - one salon detail route

Acceptance check:

- GitHub production smoke passes
- manual login checks pass

Stop condition:

- if smoke fails, stop the cutover and roll back the failed component first

## T-0

1. Promote DNS or switch the final production domains.
2. Confirm HTTPS is valid on:
   - API
   - owner
   - admin
   - customer web
3. Re-check API health and app reachability on the public domains.

Acceptance check:

- public domains resolve correctly
- HTTPS is valid everywhere
- health and first-page load checks pass

## T+5 Minutes

Watch logs and provider dashboards for:

- `401` or auth loops
- CORS failures
- Redis connection failures
- storage upload failures
- spike in `5xx` responses

Keep monitoring until the system has remained stable for at least 15 minutes.

## T+15 Minutes

If all checks remain green:

1. mark the cutover complete
2. record the deployment versions or commit SHA
3. keep passive monitoring for the next 24 to 48 hours

## Rollback Triggers

Roll back immediately if any of these occur after cutover:

- production smoke fails and the cause is not fixed within 10 minutes
- API health is not stable
- owner or admin login is broken
- broad CORS failures appear across public domains
- storage or media upload is failing for normal usage
- Redis is down or causing request failures

If rollback is required, execute [deploy/ROLLBACK_RUNBOOK.md](/Users/tienhoang/Beauty%20Finder/deploy/ROLLBACK_RUNBOOK.md).

## Rollback Order

1. Roll back the affected Vercel app if the failure is isolated to owner, admin, or customer web.
2. Redeploy the previous known-good API if the failure is API-side.
3. Revert DNS or stop promoting traffic if the public domain switch caused the issue.
4. Do not run another schema change during rollback.
5. Do not enable preview, demo, or mutating smoke flags to work around launch issues.

## Completion Rule

Production cutover is complete only when:

- API health is green
- GitHub production smoke passes
- owner login works
- admin login works
- customer web loads on the public domain
- no immediate auth, CORS, Redis, or storage failures appear in logs
