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
   - Status: pending
9. Deploy staging and run smoke checks plus manual QA.
   - Status: pending
10. Deploy production and perform cutover.
    - Status: pending

## Completion Estimate

### Repo-side production prep

- Status: `100% complete`

Reason:

- All planned code and repository preparation for the current deployment path has been added to the repo.
- The remaining work is mainly provider setup, secret entry, staging rollout, and production cutover.

### End-to-end launch program

- Status: `70% complete`

Calculation:

- Completed major launch milestones: `7 / 10`
- Remaining major launch milestones: `3 / 10`

## What Is Already Done

- Demo and preview flows are gated out of staging and production.
- Owner media uploads are prepared for object storage instead of container disk.
- Owner and admin web apps no longer rely on browser-readable access-token cookies.
- Render API blueprint exists in [render.yaml](/Users/tienhoang/Beauty%20Finder/render.yaml).
- Provider-ready secret templates exist in [deploy/env](/Users/tienhoang/Beauty%20Finder/deploy/env).
- Deployment smoke script exists in [scripts/smoke-deploy.mjs](/Users/tienhoang/Beauty%20Finder/scripts/smoke-deploy.mjs).
- GitHub Actions CI workflow exists in [.github/workflows/beauty-finder-ci.yml](/Users/tienhoang/Beauty%20Finder/.github/workflows/beauty-finder-ci.yml).
- GitHub Actions deploy smoke workflow exists in [.github/workflows/beauty-finder-deploy-smoke.yml](/Users/tienhoang/Beauty%20Finder/.github/workflows/beauty-finder-deploy-smoke.yml).

## What Still Blocks Launch

- Real staging and production infrastructure is not provisioned yet.
- Real secrets and public domains are not connected yet.
- No staging smoke run has been executed against deployed URLs yet.
- No production cutover has been performed yet.

## Launch Recommendation

- Proceed to staging first.
- Do not attempt production cutover before staging smoke checks and manual QA pass.
- Keep `backend/worker` and `backend/api-py` out of the first public launch path.
