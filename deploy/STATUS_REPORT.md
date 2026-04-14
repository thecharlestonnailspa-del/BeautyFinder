# Production Readiness Status

This file summarizes the current order of work and the estimated completion level for the first real web launch.

## Ordered Workstream

1. Lock demo and preview behavior outside local development.
   - Status: complete
2. Move owner media upload off local filesystem for staging and production.
   - Status: complete
3. Move owner and admin web auth to `HttpOnly` session cookies.
   - Status: complete
4. Add deployment blueprint and provider runbook.
   - Status: complete
5. Add provider-ready env templates and deploy smoke script.
   - Status: complete
6. Add GitHub Actions CI validation for Beauty Finder.
   - Status: complete
7. Add manual deploy-smoke workflow for staging and production verification.
   - Status: complete
8. Provision provider resources and enter real secrets in Render and Vercel.
   - Status: in progress
9. Deploy staging and run smoke checks plus manual QA.
   - Status: complete
10. Deploy production and perform cutover.
    - Status: pending

## Completion Estimate

### Repo-side production prep

- Status: `100% complete`

Reason:

- All planned code and repository preparation for the current deployment path has been added to the repo.
- The remaining work is mainly provider setup, secret entry, staging rollout, and production cutover.

### End-to-end launch program

- Status: `80% complete`

Calculation:

- Completed major launch milestones: `8 / 10`
- Remaining major launch milestones: `2 / 10`

## What Is Already Done

- Demo and preview flows are gated out of staging and production.
- Owner media uploads are prepared for object storage instead of container disk.
- Owner and admin web apps no longer rely on browser-readable access-token cookies.
- Render API blueprint exists in [render.yaml](/Users/tienhoang/Beauty%20Finder/render.yaml).
- Provider-ready secret templates exist in [deploy/env](/Users/tienhoang/Beauty%20Finder/deploy/env).
- Deployment smoke script exists in [scripts/smoke-deploy.mjs](/Users/tienhoang/Beauty%20Finder/scripts/smoke-deploy.mjs).
- GitHub Actions CI workflow exists in [.github/workflows/beauty-finder-ci.yml](/Users/tienhoang/Beauty%20Finder/.github/workflows/beauty-finder-ci.yml).
- GitHub Actions deploy smoke workflow exists in [.github/workflows/beauty-finder-deploy-smoke.yml](/Users/tienhoang/Beauty%20Finder/.github/workflows/beauty-finder-deploy-smoke.yml).
- Render staging API is live at `https://beautyfinder-api-staging.onrender.com`.
- Owner staging is live at `https://owner-dashboard-pi.vercel.app`.
- Admin staging is live at `https://admin-panel-beta-olive.vercel.app`.
- Customer web staging is live at `https://mobile-app-bice-ten.vercel.app`.
- `npm run smoke:deploy` passed against the live staging URLs.
- Manual staging QA passed for owner login, owner business save, owner image upload, owner technician roster save, admin login, admin access-session bootstrap, admin moderation write path, customer login, and customer favorites add/remove with restore.

## What Still Blocks Launch

- Dedicated staging Redis is not provisioned yet.
- Staging custom HTTPS domains are not connected yet.
- GitHub environment `staging` is not populated with deploy-smoke secrets yet.
- `Beauty Finder Deploy Smoke` has not been executed through GitHub Actions against staging yet.
- If strict environment isolation is required, staging still needs its own dedicated database and storage target instead of the temporary shared Supabase project used for testing.
- No production cutover has been performed yet.

## Launch Recommendation

- Staging is now usable for product QA and stakeholder review.
- Do not attempt production cutover before staging custom domains, Redis, and GitHub-hosted smoke checks are in place.
- Keep `backend/worker` and `backend/api-py` out of the first public launch path.
