/**
 * Builds the service's dependencies from the SDKs. Runs once per cold start. Every credential is the Function's
 * user-assigned managed identity (`AZURE_CLIENT_ID` selects it); there is no connection string or account key in any
 * setting.
 */

import { EmailClient } from '@azure/communication-email';
import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';

import type { Contract } from '../logic/contract.ts';
import { newRequestId, newToken } from '../logic/crypto.ts';
import { createLogger, type LogSink } from '../logic/log.ts';
import type { Deps } from '../service/deps.ts';
import { BlobBriefRegistry, BlobLock, BlobRateStore, BlobSuppression } from './blob.ts';
import { SdkBlobPort } from './blob-sdk.ts';
import type { IntakeConfig } from './config.ts';
import { DataverseClient, DataverseCrm, DataverseEngagements } from './dataverse.ts';
import { SasLinks } from './links.ts';
import { AcsMailer, noopNotifier, WebhookNotifier } from './mailer.ts';

const consoleSink: LogSink = {
  write(level, line) {
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.info(line);
  },
};

export function buildDeps(config: IntakeConfig, contract: Contract): Deps {
  const credential = new DefaultAzureCredential();
  const clock = { now: () => Date.now() };

  const blobService = new BlobServiceClient(`https://${config.storageAccount}.blob.core.windows.net`, credential);
  const state = new SdkBlobPort(blobService.getContainerClient(config.stateContainer));
  const briefs = new SdkBlobPort(blobService.getContainerClient(config.briefsContainer));

  const dataverse = new DataverseClient({
    baseUrl: config.dataverseUrl,
    fetch,
    getToken: async () => {
      const token = await credential.getToken(`${config.dataverseUrl}/.default`);
      return token.token;
    },
  });

  const email = new EmailClient(config.acsEndpoint, credential);

  return {
    contract,
    settings: {
      allowedOrigins: config.allowedOrigins,
      siteOrigin: config.siteOrigin,
      apiOrigin: config.apiOrigin,
      unsubscribeKey: config.unsubscribeKey,
      nurtureEnabled: config.nurtureEnabled,
      footerAddress: config.footerAddress,
    },
    clock,
    ids: { requestId: newRequestId, token: newToken },
    rate: new BlobRateStore(state),
    lock: new BlobLock(state, { clock }),
    engagements: new DataverseEngagements(dataverse),
    crm: new DataverseCrm(dataverse),
    suppression: new BlobSuppression(state),
    registry: new BlobBriefRegistry(briefs, clock),
    links: new SasLinks({
      accountName: config.storageAccount,
      container: config.briefsContainer,
      keys: { get: (startsOn, expiresOn) => blobService.getUserDelegationKey(startsOn, expiresOn) },
    }),
    mailer: new AcsMailer({ client: email, senderAddress: config.senderAddress }),
    notifier: config.webhook === null ? noopNotifier : new WebhookNotifier({ url: config.webhook.url, secret: config.webhook.secret, fetch }),
    log: createLogger(consoleSink),
  };
}
