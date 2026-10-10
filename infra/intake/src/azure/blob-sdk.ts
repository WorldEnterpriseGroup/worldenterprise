/**
 * The Azure Storage SDK behind `BlobPort`. This is the only file that calls the blob data plane for state. It is covered by
 * the deploy-time `intake:verify` job and by review rather than by unit tests, because faking the SDK would test the fake.
 */

import type { ContainerClient } from '@azure/storage-blob';

import type { BlobCondition, BlobPort, BlobRead } from './blob.ts';
import { StateError } from './blob.ts';

function statusOf(error: unknown): number {
  const status = typeof error === 'object' && error !== null ? (error as { statusCode?: unknown }).statusCode : undefined;
  return typeof status === 'number' ? status : 0;
}

async function readAll(stream: NodeJS.ReadableStream | undefined): Promise<string> {
  if (stream === undefined) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  return Buffer.concat(chunks).toString('utf8');
}

export class SdkBlobPort implements BlobPort {
  private readonly container: ContainerClient;

  constructor(container: ContainerClient) {
    this.container = container;
  }

  async get(name: string): Promise<BlobRead | null> {
    try {
      const response = await this.container.getBlobClient(name).download();
      return { text: await readAll(response.readableStreamBody), etag: response.etag ?? '' };
    } catch (error) {
      if (statusOf(error) === 404) return null;
      throw new StateError(`blob_get_${statusOf(error)}`);
    }
  }

  async put(name: string, text: string, condition: BlobCondition): Promise<'ok' | 'conflict'> {
    const conditions = condition.kind === 'absent' ? { ifNoneMatch: '*' } : condition.kind === 'etag' ? { ifMatch: condition.etag } : undefined;
    try {
      await this.container.getBlockBlobClient(name).upload(text, Buffer.byteLength(text), {
        blobHTTPHeaders: { blobContentType: 'application/json' },
        ...(conditions === undefined ? {} : { conditions }),
      });
      return 'ok';
    } catch (error) {
      const status = statusOf(error);
      if (status === 409 || status === 412) return 'conflict';
      throw new StateError(`blob_put_${status}`);
    }
  }

  async delete(name: string): Promise<void> {
    try {
      await this.container.getBlobClient(name).delete();
    } catch (error) {
      if (statusOf(error) === 404) return;
      throw new StateError(`blob_delete_${statusOf(error)}`);
    }
  }

  async list(prefix: string, limit: number): Promise<readonly string[]> {
    const names: string[] = [];
    try {
      for await (const blob of this.container.listBlobsFlat({ prefix })) {
        names.push(blob.name);
        if (names.length >= limit) break;
      }
    } catch (error) {
      throw new StateError(`blob_list_${statusOf(error)}`);
    }
    return names;
  }

  async acquireLease(name: string, seconds: number): Promise<string | null> {
    const lease = this.container.getBlobClient(name).getBlobLeaseClient();
    try {
      return (await lease.acquireLease(seconds)).leaseId ?? null;
    } catch (error) {
      const status = statusOf(error);
      if (status === 409) return null;
      if (status !== 404) throw new StateError(`blob_lease_${status}`);
    }
    // The lock blob does not exist yet: create it, then lease it. A 'conflict' means another instance created it a moment
    // ago, which is fine: the lease attempt below decides who holds it.
    await this.put(name, '', { kind: 'absent' });
    try {
      return (await lease.acquireLease(seconds)).leaseId ?? null;
    } catch (error) {
      if (statusOf(error) === 409) return null;
      throw new StateError(`blob_lease_${statusOf(error)}`);
    }
  }

  async releaseLease(name: string, leaseId: string): Promise<void> {
    try {
      await this.container.getBlobClient(name).getBlobLeaseClient(leaseId).releaseLease();
    } catch (error) {
      throw new StateError(`blob_release_${statusOf(error)}`);
    }
  }
}
