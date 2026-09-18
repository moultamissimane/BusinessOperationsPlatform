# WorkFlow ERP

A lightweight ERP for a company: employees and permissions, projects and tasks, leave, expenses with receipts, a manager
dashboard, and an audit trail that records who changed what, when, and from where.

| Layer | Stack |
|---|---|
| Frontend | React 19 · TypeScript · Vite · Tailwind (`src/`) |
| Backend | ASP.NET Core 8 · EF Core 8 · JWT auth (`backend/`) |
| Database | PostgreSQL 16 |
| Infrastructure | Docker Compose · GitHub Actions · Azure (Bicep in `infra/`) |

## Run it locally

```bash
docker compose up --build        # PostgreSQL + API (migrated, seeded) + Mailhog for reset emails
npm install
npm run dev                      # http://localhost:3000, proxies /api to the API
```

Sign in with a demo account (password `Password123!`): `imane.b@workflow-erp.ma` (director, everything),
`karim.alami@workflow-erp.ma` (approves leave and expenses), `sara.t@workflow-erp.ma` (HR),
`yassine.m@workflow-erp.ma` (engineer). The login screen shows these as one-click buttons in development.

Ports already taken?
`API_PORT=8090 DB_PORT=5440 MAILHOG_UI_PORT=8026 docker compose up --build`, then
`API_PROXY_TARGET=http://localhost:8090 npm run dev`.

- API reference: `http://localhost:8080/swagger` · password-reset emails: `http://localhost:8025`

## What's where

| Path | Contents |
|---|---|
| `src/` | React app. `api/client.ts` handles tokens and refresh; `context/` holds auth and data state. |
| `backend/` | The API and its tests. See [backend/README.md](backend/README.md) for endpoints and rules. |
| `infra/` | Azure infrastructure (Bicep). See [infra/README.md](infra/README.md). |
| `e2e/` | Browser test that drives the real UI against the real API. |
| `.github/workflows/` | `backend-ci`, `frontend-ci`, and a manual `deploy-azure`. |

## Tests

```bash
# Backend: 63 integration tests against a real PostgreSQL
cd backend && WORKFLOW_TEST_PG="Host=localhost;Port=5432;Username=workflow;Password=workflow_dev" dotnet test

# Frontend type-check and production build
npm run lint && npm run build

# Browser end-to-end (stack and dev server running; see e2e/e2e.mjs)
cd e2e && npm install && npx playwright install chromium && LOGIN_RATE_LIMIT=1000 npm test
```

## Notes

- The frontend keeps the short-lived access token in memory and the rotating refresh token in `localStorage`
  so a reload keeps you signed in. That trade-off is documented in `src/api/client.ts`.
- Configure a separately hosted frontend with `VITE_API_BASE_URL` at build time.
