targetScope = 'subscription'

@description('One resource group for the World Enterprise intake service.')
param resourceGroupName string = 'rg-worldenterprise-intake'

@description('Azure region for the Function App, storage account and monitoring resources.')
param location string = 'eastus'

@description('The public hostname that fronts the Function (the Front Door custom domain).')
param apiHost string = 'intake.worldenterprise.org'

@description('The public site origin. Form pages post from here; unsubscribe and thanks links point here.')
param siteOrigin string = 'https://worldenterprise.org'

@description('Browser origins allowed to post to the intake API. The apex and www hosts of the site.')
param allowedOrigins array = [
  'https://worldenterprise.org'
  'https://www.worldenterprise.org'
]

@description('The shared Azure Front Door profile id (a GUID) allowed to reach the Function origin (OP-FD).')
param frontDoorId string

@description('The Dataverse environment URL, https://<org>.crm.dynamics.com (OP-DV).')
param dataverseUrl string

@description('Key Vault that holds the two intake secrets.')
param keyVaultName string = 'omlab-secrets'

@description('Resource group of that Key Vault.')
param keyVaultResourceGroup string = 'Om-Labs'

@description('Optional. A verified custom sender address on a domain the operator has verified in Azure Communication Services (OP-MAIL). Empty uses the Azure-managed domain.')
param senderAddress string = ''

@description('Optional. The mailing address printed in the email footer. Empty omits the line.')
param mailFooterAddress string = ''

@description('Optional. A signed-webhook receiver for new engagements. Empty disables the webhook, and its secret is then not set.')
param webhookUrl string = ''

@description('Optional. Where delivery-failure alerts go. Empty deploys the alert rule without an action group.')
param alertEmail string = ''

@description('Optional. Object id of the pipeline identity that uploads rendered briefs. Empty skips the role assignment.')
param deployPrincipalId string = ''

@description('Whether the day 3, 10 and 21 follow-up emails run. Stays false until the privacy notice states the CRM use and counsel has reviewed the sequence (OP-RETAIN, OP-COUNSEL).')
param nurtureEnabled bool = false

var tags = {
  environment: 'demo'
  managedBy: 'iac'
  project: 'worldenterprise'
  service: 'intake'
  dataClassification: 'lead-metadata'
}

resource intakeResourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

module intake 'intake.bicep' = {
  name: 'worldenterprise-intake'
  scope: intakeResourceGroup
  params: {
    location: location
    apiHost: apiHost
    siteOrigin: siteOrigin
    allowedOrigins: allowedOrigins
    frontDoorId: frontDoorId
    dataverseUrl: dataverseUrl
    keyVaultName: keyVaultName
    senderAddress: senderAddress
    mailFooterAddress: mailFooterAddress
    webhookUrl: webhookUrl
    alertEmail: alertEmail
    deployPrincipalId: deployPrincipalId
    nurtureEnabled: nurtureEnabled
    tags: tags
  }
}

module keyVaultAccess 'keyvault-access.bicep' = {
  name: 'worldenterprise-intake-keyvault-access'
  scope: resourceGroup(keyVaultResourceGroup)
  params: {
    keyVaultName: keyVaultName
    principalId: intake.outputs.identityPrincipalId
  }
}

output resourceGroupName string = intakeResourceGroup.name
output storageAccountName string = intake.outputs.storageAccountName
output functionAppName string = intake.outputs.functionAppName
output functionOriginHost string = intake.outputs.functionOriginHost
output identityClientId string = intake.outputs.identityClientId
output senderDomain string = intake.outputs.senderDomain
