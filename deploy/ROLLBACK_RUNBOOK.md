# Production Rollback Runbook

Use this file when a production launch or post-launch deploy needs to be rolled back.

For incident notes, copy [deploy/INCIDENT_LOG_TEMPLATE.md](/Users/tienhoang/Beauty%20Finder/deploy/INCIDENT_LOG_TEMPLATE.md).

Primary rule:

- stabilize customer impact first
- do not stack new deploys on top of a failing deploy
- do not run new schema changes during first-response rollback

## When To Use This

Run this rollback process if any of these are true:

- API health is failing after deploy
- owner or admin login is broken on the public domain
- broad CORS or auth failures appear
- Redis or storage failures are causing live request errors
- a web deploy shipped the wrong API URL or wrong environment flags
- the production smoke workflow fails after a deploy and the issue is not fixed quickly

## First 5 Minutes

1. Stop all new deploy attempts.
2. Record the failing time window and the current commit SHA or deployment ID.
3. Open:
   - Render production logs
   - Vercel deployment history for owner, admin, and customer web
   - GitHub Actions run that failed
   - DNS or provider dashboard if the issue started after domain promotion
4. Identify the smallest affected scope:
   - one Vercel app
   - API only
   - shared config or secrets
   - DNS or domain promotion
   - schema or data incompatibility

## Decision Rule

Choose the smallest rollback that restores service.

- If the issue is isolated to one web app, roll back only that app.
- If the issue is API-side, roll back the API before touching web apps.
- If the issue began at DNS promotion, revert DNS before changing app code.
- If a schema migration caused incompatibility, do not rush into database restore during the first response window.

## Web-Only Rollback

Use this path when the problem is isolated to owner, admin, or customer web.

1. Roll back the affected Vercel project to the previous known-good deployment.
2. Confirm the project still points to the correct production API URL.
3. Re-test the affected login or route on the public domain.
4. Leave unaffected apps untouched.

Acceptance check:

- affected app loads correctly
- API health remains green
- smoke or manual route check passes for the affected app

## API Rollback

Use this path when the failure is in `backend/api`.

1. Redeploy the previous known-good API image or release in Render.
2. Wait for `GET /api/health` to return `200`.
3. Re-test owner login, admin login, and one customer route.
4. Watch logs for recurring `5xx`, CORS, Redis, or storage errors.

Acceptance check:

- API health is green
- auth flows recover
- logs stop showing the failing error pattern

## Config Or Secret Rollback

Use this path when the failure was caused by wrong provider values.

Examples:

- wrong `CORS_ORIGINS`
- wrong `NEXT_PUBLIC_API_URL`
- wrong `EXPO_PUBLIC_API_URL`
- wrong `APP_ENV`
- wrong `OWNER_MEDIA_STORAGE_PATH_PREFIX`

Steps:

1. Restore the last known-good provider values in Render or Vercel.
2. Redeploy only the service that consumed the bad value.
3. Re-check the affected flow.

Acceptance check:

- the broken flow recovers
- the fixed service matches the intended production values

## DNS Rollback

Use this path when the issue started at or immediately after domain promotion.

1. Revert DNS to the previously verified target.
2. Confirm HTTPS and routing recover on the public domain.
3. Keep the newer deployment online but unpromoted until the root cause is fixed.

Acceptance check:

- public domains resolve to the last known-good target
- public traffic is stable again

## Migration Or Schema Incident

Use this path when the new schema is not compatible with the previous API behavior.

1. Confirm whether the previous API can safely run against the migrated schema.
2. If it can, redeploy the previous API immediately.
3. If it cannot, stop automatic rollback and move to incident mode:
   - keep public traffic on the most stable deploy available
   - prepare a forward fix or controlled database restore plan
4. Do not run another migration as a guess.
5. Do not restore the database unless data loss risk, downtime impact, and restore steps are explicitly understood.

Decision:

- default to a forward fix over emergency database restore unless service is fully unavailable and restore is the only safe path

## After Rollback

1. Re-run the smallest possible verification:
   - API health
   - owner login
   - admin login
   - customer home route
2. If the rollback path touched public routing, also verify HTTPS and domain resolution.
3. Keep monitoring logs for at least 15 minutes.
4. Record:
   - what failed
   - which component was rolled back
   - rollback time
   - current live deployment ID or commit SHA

## Do Not Do These During Rollback

- do not enable preview or demo mode
- do not enable mutating smoke checks
- do not deploy unrelated fixes during the first rollback
- do not run another migration during first response
- do not delete storage objects or production data as part of ad hoc debugging

## Exit Rule

Rollback is considered complete only when:

- API health is green
- the previously broken user path works again
- logs are stable for at least 15 minutes
- the live deployment or DNS target has been recorded
