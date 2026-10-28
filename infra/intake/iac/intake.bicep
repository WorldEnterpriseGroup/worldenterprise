param location string
param apiHost string
param siteOrigin string
param allowedOrigins array
param frontDoorId string
param dataverseUrl string
param keyVaultName string
param senderAddress string
param mailFooterAddress string
param notifyEmail string
param alertEmail string
param deployPrincipalId string
param nurtureEnabled bool
param tags object

var suffix = uniqueString(resourceGroup().id)
var storageAccountName = 'stweintake${suffix}'
var functionAppName = 'fn-we-intake-${suffix}'
var planName = 'asp-we-intake-${suffix}'
var emailServiceName = 'email-we-intake-${suffix}'
var communicationServiceName = 'acs-we-intake-${suffix}'
var identityName = 'uai-we-intake-${suffix}'
var notifyLogicAppName = 'logic-we-intake-notify-${suffix}'
var workspaceName = 'log-we-intake-${suffix}'
var insightsName = 'appi-we-intake-${suffix}'
var stateContainerName = 'intake-state'
var briefsContainerName = 'briefs'
var deploymentContainerName = 'deployments'
var storageSuffix = environment().suffixes.storage
var keyVaultUri = 'https://${keyVaultName}${environment().suffixes.keyvaultDns}'

// Secret NAMES only. The value lives in the Key Vault and is never in this repository.
var unsubscribeKeySecretName = 'worldenterprise-intake-unsubscribe-key'

var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var storageQueueDataContributorRoleId = '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
var storageTableDataContributorRoleId = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
var communicationEmailOwnerRoleId = '09976791-48a7-449e-bb21-39d1a415f350'

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  tags: tags
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowCrossTenantReplication: false
    // No account key exists for anything to leak: every caller is an identity, and the brief links are user-delegation SAS.
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
    publicNetworkAccess: 'Enabled'
    accessTier: 'Hot'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  name: 'default'
  parent: storage
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

resource stateContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  name: stateContainerName
  parent: blobService
  properties: {
    publicAccess: 'None'
  }
}

resource briefsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  name: briefsContainerName
  parent: blobService
  properties: {
    publicAccess: 'None'
  }
}

resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  name: deploymentContainerName
  parent: blobService
  properties: {
    publicAccess: 'None'
  }
}

// Rate-limit counters and lock blobs are only useful for a few hours. This removes them after the shortest period the
// service supports. The suppression list and the registry are not under these prefixes and are never aged out.
resource lifecycle 'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01' = {
  name: 'default'
  parent: storage
  properties: {
    policy: {
      rules: [
        {
          name: 'expire-rate-and-lock-state'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: [
                'blockBlob'
              ]
              prefixMatch: [
                '${stateContainerName}/rate/'
                '${stateContainerName}/lock/'
              ]
            }
            actions: {
              baseBlob: {
                delete: {
                  daysAfterModificationGreaterThan: 1
                }
              }
            }
          }
        }
      ]
    }
  }
  dependsOn: [
    stateContainer
  ]
}

resource emailService 'Microsoft.Communication/emailServices@2025-09-01' = {
  name: emailServiceName
  location: 'global'
  tags: tags
  properties: {
    dataLocation: 'United States'
  }
}

resource emailDomain 'Microsoft.Communication/emailServices/domains@2025-09-01' = {
  name: 'AzureManagedDomain'
  parent: emailService
  location: 'global'
  properties: {
    domainManagement: 'AzureManaged'
    // No open or click tracking: the brief email must not report to anyone that a reader opened it.
    userEngagementTracking: 'Disabled'
  }
}

resource senderUsername 'Microsoft.Communication/emailServices/domains/senderUsernames@2025-09-01' = {
  name: 'DoNotReply'
  parent: emailDomain
  properties: {
    username: 'DoNotReply'
    displayName: 'World Enterprise'
  }
}

resource communicationService 'Microsoft.Communication/communicationServices@2025-09-01' = {
  name: communicationServiceName
  location: 'global'
  tags: tags
  properties: {
    dataLocation: 'United States'
    linkedDomains: [
      emailDomain.id
    ]
  }
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
  tags: tags
}

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: workspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Operational logs only. The service writes event names, request ids, codes and hashed client addresses, never a body,
// an email address or a link. Visitor-side analytics do not exist on the site and this does not change that.
resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: insightsName
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
  }
}

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: planName
  location: location
  kind: 'functionapp'
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true
  }
  tags: tags
}

var effectiveSender = senderAddress != '' ? senderAddress : 'DoNotReply@${emailDomain.properties.mailFromSenderDomain}'

// The notification workflow. It is told the Function's identity so the trigger accepts only that caller.
module notify 'notify.bicep' = {
  name: 'worldenterprise-intake-notify'
  params: {
    location: location
    tags: tags
    logicAppName: notifyLogicAppName
    callerPrincipalId: identity.properties.principalId
    acsEndpoint: 'https://${communicationService.properties.hostName}'
    senderAddress: effectiveSender
    notifyTo: notifyEmail
  }
}

resource notifyWorkflow 'Microsoft.Logic/workflows@2019-05-01' existing = {
  name: notifyLogicAppName
  dependsOn: [
    notify
  ]
}

resource notifyTrigger 'Microsoft.Logic/workflows/triggers@2019-05-01' existing = {
  parent: notifyWorkflow
  name: 'manual'
}

// The trigger URL without its `sig`. The Function authenticates with its managed identity instead, so the setting holds no
// credential, and the signature the platform generates for the trigger is never read into a setting, an output or a log.
var notifyCallback = notifyTrigger.listCallbackUrl()
var notifyUrl = '${notifyCallback.basePath}?api-version=${notifyCallback.queries['api-version']}&sp=${uriComponent(notifyCallback.queries.sp)}&sv=${notifyCallback.queries.sv}'

var baseSettings = [
  { name: 'AzureWebJobsStorage__accountName', value: storage.name }
  { name: 'AzureWebJobsStorage__credential', value: 'managedidentity' }
  { name: 'AzureWebJobsStorage__clientId', value: identity.properties.clientId }
  { name: 'AzureWebJobsStorage__blobServiceUri', value: 'https://${storage.name}.blob.${storageSuffix}' }
  { name: 'AzureWebJobsStorage__queueServiceUri', value: 'https://${storage.name}.queue.${storageSuffix}' }
  { name: 'AzureWebJobsStorage__tableServiceUri', value: 'https://${storage.name}.table.${storageSuffix}' }
  { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
  { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insights.properties.ConnectionString }
  { name: 'DATAVERSE_URL', value: dataverseUrl }
  { name: 'STORAGE_ACCOUNT', value: storage.name }
  { name: 'STATE_CONTAINER', value: stateContainerName }
  { name: 'BRIEFS_CONTAINER', value: briefsContainerName }
  { name: 'ACS_ENDPOINT', value: 'https://${communicationService.properties.hostName}' }
  { name: 'ACS_SENDER_ADDRESS', value: effectiveSender }
  { name: 'ALLOWED_ORIGINS', value: join(allowedOrigins, ',') }
  { name: 'SITE_ORIGIN', value: siteOrigin }
  { name: 'API_ORIGIN', value: 'https://${apiHost}' }
  { name: 'MAIL_FOOTER_ADDRESS', value: mailFooterAddress }
  { name: 'NURTURE_ENABLED', value: string(nurtureEnabled) }
  { name: 'NOTIFY_LOGICAPP_URL', value: notifyUrl }
  { name: 'UNSUBSCRIBE_KEY', value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}/secrets/${unsubscribeKeySecretName}/)' }
]

resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  tags: tags
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    keyVaultReferenceIdentity: identity.id
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}${deploymentContainerName}'
          authentication: {
            type: 'UserAssignedIdentity'
            userAssignedIdentityResourceId: identity.id
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 40
        // The smallest Flex Consumption size, with no always-ready instance: the work is I/O-bound.
        instanceMemoryMB: 512
      }
      runtime: {
        name: 'node'
        version: '24'
      }
    }
    siteConfig: {
      minTlsVersion: '1.2'
      http20Enabled: true
      ftpsState: 'Disabled'
      // The browser contract is a native form post from the site, not credentialed CORS. The server also checks the
      // Origin header itself; this setting is the platform's second line.
      cors: {
        allowedOrigins: allowedOrigins
        supportCredentials: false
      }
      // Application traffic is accepted only from the shared Front Door profile. A request straight to the
      // azurewebsites.net host is denied with 403.
      ipSecurityRestrictions: [
        {
          name: 'AllowSharedAzureFrontDoor'
          description: 'Allow only the shared Azure Front Door profile.'
          priority: 100
          action: 'Allow'
          ipAddress: 'AzureFrontDoor.Backend'
          tag: 'ServiceTag'
          headers: {
            'x-azure-fdid': [
              frontDoorId
            ]
          }
        }
        {
          name: 'DenyDirectTraffic'
          description: 'Deny all traffic that did not come through Front Door.'
          priority: 2147483647
          action: 'Deny'
          ipAddress: '0.0.0.0/0'
        }
      ]
      scmIpSecurityRestrictionsUseMain: false
      appSettings: baseSettings
    }
  }
  dependsOn: [
    stateContainer
    briefsContainer
    deploymentContainer
    storageBlobContributor
    storageQueueContributor
    storageTableContributor
    communicationEmailOwner
    notify
  ]
}

resource storageBlobContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, identity.id, 'Storage Blob Data Contributor')
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource storageQueueContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, identity.id, 'Storage Queue Data Contributor')
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageQueueDataContributorRoleId)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource storageTableContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, identity.id, 'Storage Table Data Contributor')
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageTableDataContributorRoleId)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource communicationEmailOwner 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(communicationService.id, identity.id, 'Communication and Email Service Owner')
  scope: communicationService
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', communicationEmailOwnerRoleId)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// The notification Logic App sends through the same Email API, with its own identity.
resource notifyEmailOwner 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(communicationService.id, notifyLogicAppName, 'Communication and Email Service Owner')
  scope: communicationService
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', communicationEmailOwnerRoleId)
    principalId: notify.outputs.principalId
    principalType: 'ServicePrincipal'
  }
}

// The pipeline uploads rendered briefs with its own identity (az storage blob upload --auth-mode login).
resource deployBlobContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployPrincipalId != '') {
  name: guid(storage.id, deployPrincipalId, 'Storage Blob Data Contributor')
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalId: deployPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource alertGroup 'Microsoft.Insights/actionGroups@2023-01-01' = if (alertEmail != '') {
  name: 'ag-we-intake-${suffix}'
  location: 'global'
  tags: tags
  properties: {
    groupShortName: 'weintake'
    enabled: true
    emailReceivers: [
      {
        name: 'intake-operator'
        emailAddress: alertEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

// A brief that could not be emailed is the one failure a visitor cannot see. The row is kept as delivery-failed and the
// retry sweep keeps trying; this tells a person that it is happening.
resource deliveryFailedAlert 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = {
  name: 'alert-we-intake-delivery-${suffix}'
  location: location
  tags: tags
  properties: {
    displayName: 'World Enterprise intake: brief delivery is failing'
    description: 'A brief email failed or its retries were exhausted, or a Dataverse write failed.'
    severity: 2
    enabled: true
    scopes: [
      insights.id
    ]
    evaluationFrequency: 'PT15M'
    windowSize: 'PT15M'
    // A new component has no traces table until the Function first logs, and validation would fail the first deploy.
    skipQueryValidation: true
    criteria: {
      allOf: [
        {
          // The scope is the Application Insights component, so the query uses its classic schema (traces/message), not the
          // workspace tables (AppTraces/Message).
          query: 'traces | where message has_any ("delivery_exhausted", "delivery_failed", "dataverse_write_failed")'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: alertEmail == '' ? [] : [
        alertGroup.id
      ]
    }
  }
}

output storageAccountName string = storage.name
output functionAppName string = functionApp.name
output functionOriginHost string = functionApp.properties.defaultHostName
output identityClientId string = identity.properties.clientId
output identityPrincipalId string = identity.properties.principalId
output senderDomain string = emailDomain.properties.mailFromSenderDomain
output notifyLogicAppName string = notify.outputs.workflowName
output notifyLogicAppId string = notify.outputs.workflowId
