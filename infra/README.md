# Azure deployment

`main.bicep` creates everything in one resource group:

| Resource | Purpose |
|---|---|
| Container Apps (environment + `workflow-api`) | Runs the API image, external HTTPS ingress, 1–3 replicas |
| User-assigned managed identity | The API's identity: pulls from ACR and reads/writes receipts (no keys, no passwords) |
| Container Registry (Basic) | Holds the API image; admin user disabled |
| PostgreSQL Flexible Server 16 (Burstable B1ms) | The database |
| Storage account + `receipts` container | Receipt files; shared-key access disabled, identity-only |
| Static Web App | Hosts the built React app |
| Log Analytics | Container logs |

## What was and wasn't verified

- `main.bicep` **compiles** with the Bicep CLI with no errors or warnings.
- The API image, the first-run bootstrap, blob storage code (against the Azurite emulator) and the frontend build are tested locally.
- The **deployment itself has not been run**: it needs your subscription. Expect to fix small things on the first run
  (quota, region availability, name collisions). Report or adjust and re-run; the deployment is idempotent.

## One-time setup

1. **Create an identity for GitHub to deploy as (OIDC, no stored secret):**
   ```bash
   az ad app create --display-name workflow-erp-deploy          # note the appId
   az ad sp create --id <appId>
   az role assignment create --assignee <appId> --role Owner --scope /subscriptions/<subscriptionId>
   az ad app federated-credential create --id <appId> --parameters '{
     "name": "github-main", "issuer": "https://token.actions.githubusercontent.com",
     "subject": "repo:<owner>/<repo>:ref:refs/heads/main", "audiences": ["api://AzureADTokenExchange"]}'
   ```
   `Owner` is needed because the template assigns roles to the API's identity; scope it to the resource group once it exists.
2. **Add these GitHub repository secrets:**

   | Secret | Value |
   |---|---|
   | `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` | from step 1 |
   | `POSTGRES_ADMIN_PASSWORD` | strong random password |
   | `JWT_KEY` | at least 32 random bytes, e.g. `openssl rand -base64 48` |
   | `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | the first administrator (8+ chars, letter and digit) |

3. Run **Actions → Deploy to Azure → Run workflow.** It deploys the infrastructure, builds the image in ACR, rolls it out,
   waits for `/health`, then builds the frontend against the new API URL and publishes it.

Sign in with the bootstrap administrator, then create real employees from the UI. There is no demo data in Azure.

## Known hardening items

- The database allows "Azure services" through its firewall. A private endpoint + VNet is the stronger setup.
- The API connects as the PostgreSQL admin with `SSL Mode=Require; Trust Server Certificate=true` (encrypted, but the
  server certificate isn't verified). Use a least-privilege app role and `VerifyFull` once the CA chain is confirmed.
- Outgoing email (password reset) needs an SMTP host: set `Email__Smtp__*` on the Container App. Until then reset requests are
  accepted but no email is sent (a warning is logged; the link is never logged).
- Rate limits are per client IP and kept in memory per replica.
