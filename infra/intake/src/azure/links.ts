/**
 * Mints the read-only, 48-hour links to private brief blobs. The SAS is signed with a user delegation key obtained through
 * the Function's managed identity, so no storage account key exists anywhere. The key is cached and renewed well before the
 * longest SAS signed with it would outlive it. The start time is backdated five minutes so clock skew cannot make a
 * fresh link fail.
 */

import { BlobSASPermissions, generateBlobSASQueryParameters, SASProtocol, type UserDelegationKey } from '@azure/storage-blob';

import { SAS_CLOCK_SKEW_MS, SAS_TTL_MS } from '../logic/schedule.ts';
import type { BriefEntry, BriefLinks } from '../service/ports.ts';

export interface DelegationKeySource {
  get(startsOn: Date, expiresOn: Date): Promise<UserDelegationKey>;
}

export interface SasLinksOptions {
  readonly accountName: string;
  readonly container: string;
  readonly keys: DelegationKeySource;
}

const KEY_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000;
const KEY_RENEW_MARGIN_MS = SAS_TTL_MS + 60 * 60 * 1000;

export class SasLinks implements BriefLinks {
  private readonly options: SasLinksOptions;
  private key: { readonly value: UserDelegationKey; readonly expiresAt: number } | null = null;

  constructor(options: SasLinksOptions) {
    this.options = options;
  }

  private async delegationKey(now: number): Promise<UserDelegationKey> {
    if (this.key !== null && this.key.expiresAt - now > KEY_RENEW_MARGIN_MS) return this.key.value;
    const expiresAt = now + KEY_LIFETIME_MS;
    const value = await this.options.keys.get(new Date(now - SAS_CLOCK_SKEW_MS), new Date(expiresAt));
    this.key = { value, expiresAt };
    return value;
  }

  async mintLink(entry: BriefEntry, now: number): Promise<string> {
    const key = await this.delegationKey(now);
    const token = generateBlobSASQueryParameters(
      {
        containerName: this.options.container,
        blobName: entry.pdfPath,
        permissions: BlobSASPermissions.parse('r'),
        startsOn: new Date(now - SAS_CLOCK_SKEW_MS),
        expiresOn: new Date(now + SAS_TTL_MS),
        protocol: SASProtocol.Https,
        contentType: 'application/pdf',
        contentDisposition: `attachment; filename="${entry.id}-v${entry.version}.pdf"`,
      },
      key,
      this.options.accountName,
    ).toString();
    const path = entry.pdfPath.split('/').map(encodeURIComponent).join('/');
    return `https://${this.options.accountName}.blob.core.windows.net/${this.options.container}/${path}?${token}`;
  }
}
