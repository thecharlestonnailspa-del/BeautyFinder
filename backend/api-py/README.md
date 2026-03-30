# Beauty Finder FastAPI Backend

This service is the Python migration target for the current NestJS API.

It is intentionally scaffolded to run in parallel with `backend/api` so you can
migrate module by module without breaking the working application.

## Goals

- keep the current API contract reachable during migration
- move business logic into explicit Python domains
- use FastAPI only after the new backend is ready for real traffic

## Layout

```text
app/
  api/          -> routers, request dependencies, HTTP boundary
  core/         -> config, shared errors, JWT helpers
  db/           -> SQLAlchemy engine and session wiring
  domains/      -> domain services per feature area
  schemas/      -> Pydantic request/response models
  tests/        -> pure Python tests for the shared backend brain
```

## Install

Use a dedicated virtual environment.

```bash
python3 -m venv backend/api-py/.venv
```

```bash
source backend/api-py/.venv/bin/activate
```

```bash
pip install -e "backend/api-py[dev]"
```

## Run

```bash
python3 -m uvicorn --app-dir backend/api-py app.main:app --reload --host 127.0.0.1 --port 8001
```

Or use the root script, which now runs the project-local virtualenv directly:

```bash
npm run dev:backend:api-py
```

The scaffold keeps the `/api/*` prefix so frontend migration can happen without
changing every client at once.

## Current State

- `GET /api/health` is implemented
- `GET /api/health` now reports database schema drift, including missing required
  tables such as `Payment`
- auth is now migrated for `login`, `register/customer`, `register/business`,
  `session`, and `me`
- public businesses, availability, bookings, payments, notifications, and
  favorites are now implemented
- advertising payments are now implemented for owner-run platform campaigns:
  owners can create and pay ad campaigns, and admins can apply discounts
- messaging is now implemented for conversation list, message list, and send
- owner business reads are migrated for `/api/businesses/owner/manage` and
  `/api/businesses/owner/{ownerId}/manage`
- owner business writes are started with
  `/api/businesses/{id}/owner-profile` and
  `/api/businesses/{id}/owner-media/image`
- static owner uploads are mounted at `/uploads/*`
- admin read and moderation endpoints are now implemented for overview,
  homepage businesses, business queue, reviews, conversations, and audit actions
- JWT parsing and DB session wiring are in place for future module migration
- the shared backend brain now lives in `app/core/*`:
  role policies, authorization scope resolution, and data processors for text,
  dates, money, collections, and notifications

## Suggested Migration Order

1. `health`
2. `auth`
3. `businesses` and `search`
4. `bookings`
5. `payments`
6. `notifications`
7. `messaging`
8. `admin`

## Notes

- Keep `backend/api` as the source of truth until the Python service reaches
  functional parity.
- Generate the final TypeScript client from FastAPI OpenAPI once the contract is
  stable.
