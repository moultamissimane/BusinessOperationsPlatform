// WorkFlow ERP on Azure.
//
//   az group create -n rg-workflow -l francecentral
//   az deployment group create -g rg-workflow -f infra/main.bicep \
//        -p bootstrapAdminEmail=you@company.ma bootstrapAdminPassword=... postgresAdminPassword=... jwtKey=...
//
// Normally run by .github/workflows/deploy-azure.yml (see infra/README.md).
//
// Creates: Log Analytics, Container Apps environment + API app (user-assigned managed identity),
// Container Registry, PostgreSQL Flexible Server, Storage (receipts), Static Web App (frontend).

targetScope = 'resourceGroup'

@description('Region for the API, database, storage and registry.')
param location string = resourceGroup().location

@description('Static Web Apps are only available in a few regions.')
@allowed(['westus2', 'centralus', 'eastus2', 'westeurope', 'eastasia'])
param staticWebAppLocation string = 'westeurope'

@description('Short lowercase prefix used in resource names, e.g. "workflow".')
@minLength(3)
@maxLength(12)
param namePrefix string = 'workflow'

@description('Container image for the API. The first deployment uses a placeholder; the deploy workflow then rolls out the real image.')
param apiImage string = 'mcr.microsoft.com/k8se/quickstart:latest'

@description('Port the API image listens on. The placeholder image uses 80; the real image uses 8080.')
param apiPort int = 80

@description('First administrator, created only when the database has no employees.')
param bootstrapAdminEmail string

@secure()
param bootstrapAdminPassword string

@secure()
@description('PostgreSQL administrator password.')
param postgresAdminPassword string

@secure()
@description('JWT signing key: at least 32 random bytes.')
@minLength(32)
param jwtKey string

param postgresAdminUser string = 'workflow_admin'
param postgresSku string = 'Standard_B1ms'

var suffix = uniqueString(resourceGroup().id)
var acrName = toLower('${namePrefix}acr${suffix}')            // 5-50 alphanumeric
var storageName = toLower('${namePrefix}st${take(suffix, 10)}') // 3-24 lowercase alphanumeric
var postgresName = toLower('${namePrefix}-pg-${suffix}')
var databaseName = 'workflow'

// Built-in role definition ids.
var acrPullRole = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var blobDataContributorRole = 'ba92f5b4-2d11-4a4c-a7bc-d1a1ce9f3a4e'

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-logs-${suffix}'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false } // pulls use the managed identity, not shared credentials
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowSharedKeyAccess: false // the API authenticates with its managed identity only
  }

  resource blobService 'blobServices' = {
    name: 'default'
    resource receipts 'containers' = {
      name: 'receipts'
      properties: { publicAccess: 'None' }
    }
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: postgresName
  location: location
  sku: {
    name: postgresSku
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: postgresAdminUser
    administratorLoginPassword: postgresAdminPassword
    storage: { storageSizeGB: 32 }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
  }

  resource database 'databases' = {
    name: databaseName
  }

  // "0.0.0.0" means "any Azure service", which is what lets Container Apps reach the server.
  // Hardening for later: put both in a VNet and use a private endpoint instead.
  resource allowAzure 'firewallRules' = {
    name: 'AllowAzureServices'
    properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
  }
}

resource frontend 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${namePrefix}-web-${suffix}'
  location: staticWebAppLocation
  sku: { name: 'Free', tier: 'Free' }
  properties: {}
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-api-id-${suffix}'
  location: location
}

// The API pulls its image and reads/writes receipts as this identity.
resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, identity.id, acrPullRole)
  scope: acr
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRole)
  }
}

resource blobAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, identity.id, blobDataContributorRole)
  scope: storage
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', blobDataContributorRole)
  }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${namePrefix}-env-${suffix}'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

resource api 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${namePrefix}-api'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  dependsOn: [acrPull, blobAccess]
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      ingress: {
        external: true
        targetPort: apiPort
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        { server: acr.properties.loginServer, identity: identity.id }
      ]
      secrets: [
        {
          name: 'db-connection'
          // Npgsql "Require" encrypts the connection but does not verify the server certificate chain.
          // Hardening: switch to "VerifyFull" once the CA chain is confirmed inside the runtime image.
          value: 'Host=${postgres.properties.fullyQualifiedDomainName};Port=5432;Database=${databaseName};Username=${postgresAdminUser};Password=${postgresAdminPassword};SSL Mode=Require;Trust Server Certificate=true'
        }
        { name: 'jwt-key', value: jwtKey }
        { name: 'bootstrap-admin-password', value: bootstrapAdminPassword }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: apiImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'ASPNETCORE_ENVIRONMENT', value: 'Production' }
            { name: 'ConnectionStrings__Default', secretRef: 'db-connection' }
            { name: 'Jwt__Key', secretRef: 'jwt-key' }
            { name: 'Database__MigrateOnStartup', value: 'true' }
            { name: 'Seed__Enabled', value: 'false' }
            { name: 'Bootstrap__AdminEmail', value: bootstrapAdminEmail }
            { name: 'Bootstrap__AdminPassword', secretRef: 'bootstrap-admin-password' }
            { name: 'Storage__Provider', value: 'AzureBlob' }
            { name: 'Storage__AzureBlob__ServiceUri', value: storage.properties.primaryEndpoints.blob }
            { name: 'Storage__AzureBlob__Container', value: 'receipts' }
            // Tells DefaultAzureCredential which identity to use.
            { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
            // Safe here: the only way to reach the app is through the Container Apps ingress.
            { name: 'ForwardedHeaders__TrustAllProxies', value: 'true' }
            { name: 'Cors__AllowedOrigins__0', value: 'https://${frontend.properties.defaultHostname}' }
            { name: 'Frontend__BaseUrl', value: 'https://${frontend.properties.defaultHostname}' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/health', port: apiPort }
              periodSeconds: 30
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: { path: '/health', port: apiPort }
              periodSeconds: 10
              initialDelaySeconds: 5
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-load'
            http: { metadata: { concurrentRequests: '50' } }
          }
        ]
      }
    }
  }
}

output apiUrl string = 'https://${api.properties.configuration.ingress.fqdn}'
output apiAppName string = api.name
output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output staticWebAppName string = frontend.name
output staticWebAppUrl string = 'https://${frontend.properties.defaultHostname}'
output postgresServer string = postgres.properties.fullyQualifiedDomainName
