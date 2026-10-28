// The notification workflow: a Consumption Logic App that emails the World Enterprise inbox when the intake Function has
// stored a submission. It has one HTTP trigger and one action, and its definition is the JSON file in git, so the workflow
// is reviewed and deployed like the rest of the template.
//
// Who may call it: the trigger carries an Entra authorization policy that accepts only a token of the intake Function's
// user-assigned managed identity (issuer, audience and object id). There is no shared access signature to leak, and a
// caller without that token is refused before the workflow runs.
//
// What it may do: its own system-assigned identity sends through the Azure Communication Services Email REST API. The
// role assignment that lets it do so is made in intake.bicep, next to the Communication Services resource.

param location string
param tags object

@description('Name of the Logic App. Computed by the caller so the role assignment on it has a name known at the start of the deployment.')
param logicAppName string

@description('Object id of the intake Function\'s user-assigned managed identity: the one caller the trigger accepts.')
param callerPrincipalId string

@description('Communication Services endpoint, https://<resource>.communication.azure.com.')
param acsEndpoint string

@description('The sender address the notification comes from.')
param senderAddress string

@description('The inbox that is told about a new submission.')
param notifyTo string

resource workflow 'Microsoft.Logic/workflows@2019-05-01' = {
  name: logicAppName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    state: 'Enabled'
    definition: loadJsonContent('../logicapps/we-intake-notify.definition.json')
    parameters: {
      acsEndpoint: {
        value: acsEndpoint
      }
      senderAddress: {
        value: senderAddress
      }
      notifyTo: {
        value: notifyTo
      }
    }
    accessControl: {
      triggers: {
        openAuthenticationPolicies: {
          policies: {
            'we-intake-function': {
              type: 'AAD'
              claims: [
                {
                  name: 'iss'
                  value: 'https://sts.windows.net/${tenant().tenantId}/'
                }
                {
                  name: 'aud'
                  // The audience a Consumption request trigger validates an Entra token against. It is fixed by the service, not by the cloud environment.
                  #disable-next-line no-hardcoded-env-urls
                  value: 'https://management.core.windows.net/'
                }
                {
                  name: 'oid'
                  value: callerPrincipalId
                }
              ]
            }
          }
        }
      }
    }
  }
}

output workflowName string = workflow.name
output workflowId string = workflow.id
output principalId string = workflow.identity.principalId
