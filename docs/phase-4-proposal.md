# Phase 4 Proposal Report

## What Landed

- Vitest is now the API unit test runner, which keeps TypeScript tests fast without adding Nest-specific Jest overhead.
- Docker Compose is scoped to the local backend stack that matters most for day-to-day work: Postgres, Redis, and the API.
- The API container now bootstraps Prisma schema sync and seed data on startup so a fresh local stack is usable with one command.

## Why This Approach

- Vitest is a better fit than Jest for the current test suite because the repo mainly has service/controller unit tests, not DOM-heavy frontend tests or deep Nest testing module mocks.
- Compose only includes backend infrastructure because owner/admin/mobile already have effective local dev loops outside Docker, and putting them into the first compose pass would slow iteration without solving a current blocker.
- The container startup flow favors quick local setup over perfect production image minimalism. That is the right tradeoff for this phase.

## Recommended Next Steps

1. Add API integration tests that hit the Nest app over HTTP against the Compose Postgres/Redis stack.
2. Split Docker into `dev` and `prod` targets once deployments need smaller images and stricter startup behavior.
3. Replace `prisma db push` in container startup with versioned Prisma migrations before production rollout.
4. Add CI jobs for `lint`, `typecheck`, `vitest`, and optionally `docker compose config` validation on pull requests.
5. Add Compose profiles later if you want optional services such as the worker or a frontend preview stack.
