import type { BlobCondition, BlobPort, BlobRead } from '../src/azure/blob.ts';

/** An in-memory container with real ETag and lease semantics, so the stores built on `BlobPort` are tested against the rules they rely on. */
export class MemoryBlobPort implements BlobPort {
  readonly blobs = new Map<string, { text: string; etag: number }>();
  readonly leases = new Map<string, string>();
  puts: string[] = [];
  /** Number of upcoming conditional puts to report as a conflict, to simulate losing a race. */
  forceConflicts = 0;
  private counter = 0;
  private leaseCounter = 0;

  get(name: string): Promise<BlobRead | null> {
    const blob = this.blobs.get(name);
    return Promise.resolve(blob === undefined ? null : { text: blob.text, etag: String(blob.etag) });
  }

  put(name: string, text: string, condition: BlobCondition): Promise<'ok' | 'conflict'> {
    if (this.forceConflicts > 0 && condition.kind !== 'any') {
      this.forceConflicts -= 1;
      return Promise.resolve('conflict');
    }
    const existing = this.blobs.get(name);
    if (condition.kind === 'absent' && existing !== undefined) return Promise.resolve('conflict');
    if (condition.kind === 'etag' && (existing === undefined || String(existing.etag) !== condition.etag)) return Promise.resolve('conflict');
    this.counter += 1;
    this.blobs.set(name, { text, etag: this.counter });
    this.puts.push(name);
    return Promise.resolve('ok');
  }

  delete(name: string): Promise<void> {
    this.blobs.delete(name);
    return Promise.resolve();
  }

  list(prefix: string, limit: number): Promise<readonly string[]> {
    return Promise.resolve([...this.blobs.keys()].filter((name) => name.startsWith(prefix)).slice(0, limit));
  }

  acquireLease(name: string): Promise<string | null> {
    if (this.leases.has(name)) return Promise.resolve(null);
    this.leaseCounter += 1;
    const id = `lease-${this.leaseCounter}`;
    this.leases.set(name, id);
    if (!this.blobs.has(name)) this.blobs.set(name, { text: '', etag: ++this.counter });
    return Promise.resolve(id);
  }

  releaseLease(name: string, leaseId: string): Promise<void> {
    if (this.leases.get(name) === leaseId) this.leases.delete(name);
    return Promise.resolve();
  }
}
