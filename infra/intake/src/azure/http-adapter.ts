/**
 * Maps the Functions runtime's request and response onto the service's `HttpRequestLike` and `HttpResult`. The runtime
 * request is described structurally so tests can supply a plain object.
 */

import type { HttpRequestLike, HttpResult } from '../logic/http.ts';

export interface RuntimeRequest {
  readonly method: string;
  readonly headers: { get(name: string): string | null };
  readonly query: { get(name: string): string | null };
  readonly body: AsyncIterable<Uint8Array> | null;
}

export interface RuntimeResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body?: string;
}

export function toRequestLike(request: RuntimeRequest): HttpRequestLike {
  return {
    method: request.method.toUpperCase(),
    header: (name) => request.headers.get(name) ?? undefined,
    query: (name) => request.query.get(name) ?? undefined,
    async readBody(maxBytes) {
      if (request.body === null) return '';
      const chunks: Uint8Array[] = [];
      let total = 0;
      // Leaving the loop early cancels the stream, so an oversized upload is abandoned rather than buffered.
      for await (const chunk of request.body) {
        total += chunk.byteLength;
        if (total > maxBytes) return null;
        chunks.push(chunk);
      }
      return Buffer.concat(chunks).toString('utf8');
    },
  };
}

export function toResponse(result: HttpResult): RuntimeResponse {
  return { status: result.status, headers: { ...result.headers }, ...(result.body === '' ? {} : { body: result.body }) };
}
