# WorkFlow ERP — Backend

ASP.NET Core 8 Web API · EF Core 8 · PostgreSQL · JWT auth. Response shapes mirror the React app's `src/types.ts`.

## Run it

```bash
# from the repo root: PostgreSQL + API, migrated and seeded with the demo company
docker compose up --build
# port clash?  API_PORT=8090 DB_PORT=5440 docker compose up --build
```

- API `http://localhost:8080` · Swagger UI `http://localhost:8080/swagger` · health `GET /health`
- Demo logins (password `Password123!`): `imane.b@workflow-erp.ma` (Director, all permissions),
  `karim.alami@workflow-erp.ma` (approves leave/expenses), `sara.t@workflow-erp.ma` (HR),
  `yassine.m@workflow-erp.ma` / `mehdi.c@workflow-erp.ma` (staff)

Without Docker for the API itself: run a Postgres, then `dotnet run --project src/WorkFlow.Api`
(Development settings in `appsettings.Development.json` expect `localhost:5432`, user/db `workflow`).

## Tests

Integration tests boot the real API against a throwaway PostgreSQL database (migrations + seed). One extra test exercises
Azure Blob storage and runs only when `WORKFLOW_TEST_AZURITE` is set to an Azurite connection string.

```bash
WORKFLOW_TEST_PG="Host=localhost;Port=5432;Username=workflow;Password=workflow_dev" dotnet test
```

## API

| Area | Endpoints | Permission |
|---|---|---|
| Auth | `POST /api/auth/login`, `refresh`, `logout`, `forgot-password`, `reset-password` · `GET /me` · `POST /change-password` | public · signed in |
| Employees | `GET/POST /api/employees`, `GET/PUT /api/employees/{id}` | `emp_read` / `emp_write` |
| Lookups | `GET /api/departments`, `/roles`, `/permissions` · `POST` departments/roles | any / `sys_admin` |
| Projects | `GET/POST /api/projects`, `GET/PUT /api/projects/{id}` | `prj_read` / `prj_write` |
| Tasks | `GET/POST /api/tasks`, `GET/PUT /api/tasks/{id}`, `PATCH /api/tasks/{id}/status` | `prj_read` / `tsk_manage` (assignee may change own status) |
| Leave | `GET/POST /api/leaves`, `GET /api/leaves/{id}`, `GET /api/leaves/balance`, `POST /api/leaves/{id}/review` | `lev_request` / `lev_approve` |
| Expenses | `GET/POST /api/expenses`, `PUT /api/expenses/{id}`, `POST …/review`, `POST/GET …/receipt` | `exp_submit` / `exp_approve` |
| Dashboard | `GET /api/dashboard` | managers see the organisation, others see their own |
| Audit | `GET /api/audit-logs` (filters + paging) | `aud_view` |

### Rules worth knowing

- **Audit**: every create/update/status change writes user, role, action, entity, old → new value, UTC timestamp and client IP
  *in the same transaction* as the change. The audit table has no update/delete endpoints.
- **Separation of duties**: nobody can review their own leave request or expense; a request can only be reviewed once (`409` otherwise).
  Rejections and change requests require a comment; approving an expense requires a receipt.
- **No self-promotion**: unless you hold `sys_admin`, you can only grant or revoke permissions you hold yourself.
- **Visibility**: staff see only their own leave/expenses; approvers see everyone's.
- **Receipts**: PDF/PNG/JPEG ≤ 5 MB, content-sniffed, stored under a generated key (`IReceiptStorage`: local disk or Azure Blob).
  Downloads need the `Authorization` header, so the frontend must fetch them as a blob rather than using a bare `<img src>`.
- **Leave days and balance**: annual leave counts Mon–Fri; sick/exceptional count calendar days. Annual leave is capped at
  `Leave:AnnualDaysPerYear` (18, the Moroccan statutory 1.5 days/month) per calendar year; pending and approved requests count,
  rejected ones give the days back.
- **Sessions**: access tokens last 15 minutes; refresh tokens last 7 days, work once and rotate. Only a hash is stored.
  Presenting an already-rotated token revokes every session for that user; logout or a password change just kills the tokens
  concerned. Permissions and terminations are re-checked on each refresh.
- **Passwords**: 8–128 characters with a letter and a digit, BCrypt-hashed. Changing one signs out other devices.
  `forgot-password` always answers 202 (no account discovery); reset links are single-use, expire after 30 minutes, and only
  the newest one works. Login, forgot and reset share a 10/min per-IP limit; refresh has its own (60/min).
- Enums travel as the frontend's display strings (`"In Progress"`, `"Annual leave"`, `"Changes Requested"`).
  Timestamps are ISO-8601 UTC — the UI formats them ("15 Sep 2026 14:32").

## Configuration

| Setting (env var) | Purpose |
|---|---|
| `ConnectionStrings__Default` | PostgreSQL connection string |
| `Jwt__Key` | ≥ 32-byte signing secret — **required**, startup fails without it |
| `Database__MigrateOnStartup` | apply EF migrations on boot |
| `Seed__Enabled`, `Seed__DemoPassword` | load demo data into an empty DB — keep **off** in production |
| `Bootstrap__AdminEmail`, `Bootstrap__AdminPassword` | production first run: on an empty DB, create the reference data and this one administrator (no-op once any employee exists) |
| `Storage__Provider` | `Local` (disk) or `AzureBlob` (`Storage__AzureBlob__ServiceUri` + managed identity; `ConnectionString` for the Azurite emulator) |
| `Email__Smtp__Host` / `Port` / `User` / `Password` / `UseSsl` | outgoing mail for password reset; unset means nothing is sent |
| `Frontend__BaseUrl` | origin used to build reset links |
| `Leave__AnnualDaysPerYear` | annual leave entitlement (default 18) |
| `RateLimiting__LoginPermitsPerMinute`, `RateLimiting__RefreshPermitsPerMinute` | per-IP limits (10 / 60) |
| `Cors__AllowedOrigins__0` | frontend origin |
| `ForwardedHeaders__TrustAllProxies` | set `true` only when the API is reachable *solely* through your proxy (e.g. Azure Container Apps ingress); otherwise clients could spoof the IP recorded in the audit log |
| `Storage__ReceiptsPath` | receipt directory (mount a volume) |

## Migrations

```bash
dotnet tool install --global dotnet-ef --version 8.0.11
dotnet ef migrations add <Name> -p src/WorkFlow.Api -o Data/Migrations
```
