# Incident Log Template

Copy this template when a staging or production deploy incident happens.

## Incident Header

- Date:
- Time started:
- Environment: `staging` or `production`
- Reported by:
- Current live commit SHA or deployment ID:
- Previous known-good commit SHA or deployment ID:

## Symptoms

- User-visible symptom:
- First failing route or action:
- First failing timestamp:
- Error class:
  - `API`
  - `owner web`
  - `admin web`
  - `customer web`
  - `DNS`
  - `secrets/config`
  - `schema/migration`

## Impact

- Affected users:
- Affected domains:
- Revenue or booking impact:
- Is login broken:
- Is admin access broken:
- Is customer browsing broken:

## Evidence

- Render log link or note:
- Vercel deployment ID:
- GitHub Actions run:
- Health check result:
- Screenshot or reproduction note:

## Decision

- Chosen path:
  - `rollback web`
  - `rollback API`
  - `rollback DNS`
  - `restore config`
  - `forward fix`
- Why this path was chosen:
- Who approved the decision:

## Actions Taken

1.
2.
3.

## Current State

- Current live deployment:
- Current DNS target:
- API health:
- Owner login:
- Admin login:
- Customer web home route:
- Logs stable for 15 minutes:

## Follow-Up

- Root cause:
- Permanent fix:
- Preventive action:
- Ticket or issue link:
