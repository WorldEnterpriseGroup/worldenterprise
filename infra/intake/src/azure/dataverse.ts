/**
 * Dataverse Web API adapter for the engagement table, Accounts and Contacts. It talks to the API with an injected `fetch`
 * and token source, so tests run it against a scripted fake and the Function wires in the managed identity.
 *
 * Errors carry a status and a stable code and nothing else: a Dataverse or network error message can echo the request URL,
 * and the request URL can hold an email address in an OData $filter.
 */

import { odataString } from '../logic/text.ts';
import {
  ACCOUNT_KEY_COLUMN, ENGAGEMENT_SELECT, ENTITY_SET, engagementFromRow, STATUS, type AccountPlan, type ContactMatch, type EngagementRecord,
} from '../logic/mapping.ts';
import { NURTURE_STAGES } from '../logic/mail.ts';
import type { CreateOutcome, CrmStore, EngagementPatch, EngagementStore } from '../service/ports.ts';

export class DataverseError extends Error {
  readonly code: string;
  readonly statusCode: number;
  constructor(code: string, statusCode: number) {
    super(code);
    this.name = 'DataverseError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface DataverseOptions {
  /** `https://<org>.crm.dynamics.com`, no trailing slash. */
  readonly baseUrl: string;
  readonly getToken: () => Promise<string>;
  readonly fetch: typeof fetch;
  readonly timeoutMs?: number;
  /** Waits before the single retry of a 429 or 503. Replaced in tests. */
  readonly sleep?: (ms: number) => Promise<void>;
}

interface Reply {
  readonly status: number;
  readonly json: Readonly<Record<string, unknown>> | null;
  readonly entityId: string | null;
}

const API = '/api/data/v9.2/';
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_RETRY_WAIT_MS = 5000;
const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function realSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** A string literal inside a key path segment: quotes doubled, then percent-encoded. */
function keyLiteral(value: string): string {
  return encodeURIComponent(value.replaceAll("'", "''"));
}

export class DataverseClient {
  private readonly options: DataverseOptions;

  constructor(options: DataverseOptions) {
    this.options = options;
  }

  async request(method: string, path: string, body?: Readonly<Record<string, unknown>>, headers: Readonly<Record<string, string>> = {}): Promise<Reply> {
    const send = async (): Promise<Response> => {
      let token: string;
      try {
        token = await this.options.getToken();
      } catch {
        // The credential error can carry tenant and client details; only the stable code leaves this adapter.
        throw new DataverseError('dataverse_token', 0);
      }
      try {
        return await this.options.fetch(`${this.options.baseUrl}${API}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json; charset=utf-8' }),
            ...headers,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        });
      } catch (error) {
        throw new DataverseError(error instanceof Error && error.name === 'TimeoutError' ? 'dataverse_timeout' : 'dataverse_network', 0);
      }
    };

    let response = await send();
    if (response.status === 429 || response.status === 503) {
      const wait = Math.min(Number(response.headers.get('retry-after') ?? '1') * 1000 || 1000, MAX_RETRY_WAIT_MS);
      await (this.options.sleep ?? realSleep)(wait);
      response = await send();
    }

    const entityId = GUID.exec(response.headers.get('odata-entityid') ?? '')?.[0] ?? null;
    let json: Readonly<Record<string, unknown>> | null = null;
    if (response.status !== 204 && response.headers.get('content-type')?.includes('json') === true) {
      try {
        json = asRecord(await response.json());
      } catch {
        // A body that is not JSON is treated as absent; the status code alone decides the outcome.
        json = null;
      }
    }
    return { status: response.status, json, entityId };
  }

  /** A request whose only acceptable outcomes are listed; anything else is an error with the status as its code. */
  async expect(accepted: readonly number[], method: string, path: string, body?: Readonly<Record<string, unknown>>, headers?: Readonly<Record<string, string>>): Promise<Reply> {
    const reply = await this.request(method, path, body, headers);
    if (!accepted.includes(reply.status)) throw new DataverseError(`dataverse_http_${reply.status}`, reply.status);
    return reply;
  }

  async list(path: string): Promise<readonly Readonly<Record<string, unknown>>[]> {
    const reply = await this.expect([200], 'GET', path);
    const value = reply.json?.['value'];
    return Array.isArray(value) ? value.map(asRecord).filter((row): row is Readonly<Record<string, unknown>> => row !== null) : [];
  }
}

function query(parts: Readonly<Record<string, string>>): string {
  return Object.entries(parts).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
}

function patchBody(patch: EngagementPatch): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (patch.status !== undefined) body['we_status'] = STATUS[patch.status];
  if (patch.deliveryAttempts !== undefined) body['we_deliveryattempts'] = patch.deliveryAttempts;
  if (patch.lastAttemptAt !== undefined) body['we_lastattemptat'] = patch.lastAttemptAt.toISOString();
  if (patch.deliveredAt !== undefined) body['we_deliveredat'] = patch.deliveredAt.toISOString();
  if (patch.briefVersion !== undefined) body['we_briefversion'] = patch.briefVersion;
  if (patch.nurtureStage !== undefined) body['we_nurturestage'] = patch.nurtureStage;
  if (patch.nurtureNextAt !== undefined) body['we_nurturenextat'] = patch.nurtureNextAt === null ? null : patch.nurtureNextAt.toISOString();
  return body;
}

export class DataverseEngagements implements EngagementStore {
  private readonly client: DataverseClient;

  constructor(client: DataverseClient) {
    this.client = client;
  }

  private async first(filter: string): Promise<EngagementRecord | null> {
    const rows = await this.client.list(`${ENTITY_SET}?${query({ $select: ENGAGEMENT_SELECT.join(','), $filter: filter, $top: '1' })}`);
    const [row] = rows;
    return row === undefined ? null : engagementFromRow(row);
  }

  getByRequestId(requestId: string): Promise<EngagementRecord | null> {
    return this.first(`we_requestid eq ${odataString(requestId)}`);
  }

  getByTokenHash(tokenHash: string): Promise<EngagementRecord | null> {
    return this.first(`we_tokenhash eq ${odataString(tokenHash)}`);
  }

  /**
   * An upsert on the `we_requestid` alternate key with `If-None-Match: *` creates the row or answers 412 when it exists, so
   * two concurrent posts of one request id cannot both create. It never overwrites.
   */
  async createIfAbsent(requestId: string, row: Readonly<Record<string, unknown>>): Promise<CreateOutcome> {
    const reply = await this.client.request('PATCH', `${ENTITY_SET}(we_requestid='${keyLiteral(requestId)}')`, row, { 'If-None-Match': '*' });
    if (reply.status === 204 || reply.status === 201) return 'created';
    if (reply.status === 412) return 'exists';
    throw new DataverseError(`dataverse_http_${reply.status}`, reply.status);
  }

  async update(id: string, patch: EngagementPatch): Promise<void> {
    await this.client.expect([204], 'PATCH', `${ENTITY_SET}(${id})`, patchBody(patch), { 'If-Match': '*' });
  }

  async listDeliveryPending(staleBefore: Date, limit: number): Promise<readonly EngagementRecord[]> {
    const filter = `we_kind eq 'brief-request' and (we_status eq ${STATUS['delivery-failed']} or (we_status eq ${STATUS.received} and we_deliveryattempts eq 0 and createdon lt ${staleBefore.toISOString()}))`;
    const rows = await this.client.list(`${ENTITY_SET}?${query({ $select: ENGAGEMENT_SELECT.join(','), $filter: filter, $orderby: 'createdon asc', $top: String(limit) })}`);
    return rows.map(engagementFromRow);
  }

  async listNurtureDue(now: Date, limit: number): Promise<readonly EngagementRecord[]> {
    const filter = `we_status eq ${STATUS.delivered} and we_consentupdates eq true and we_nurturestage lt ${NURTURE_STAGES} and we_nurturenextat le ${now.toISOString()}`;
    const rows = await this.client.list(`${ENTITY_SET}?${query({ $select: ENGAGEMENT_SELECT.join(','), $filter: filter, $orderby: 'we_nurturenextat asc', $top: String(limit) })}`);
    return rows.map(engagementFromRow);
  }
}

export class DataverseCrm implements CrmStore {
  private readonly client: DataverseClient;

  constructor(client: DataverseClient) {
    this.client = client;
  }

  /** Upserts on the `we_accountkey` alternate key without overwriting: 412 means it exists, and the existing id is read. */
  async ensureAccount(plan: AccountPlan): Promise<{ readonly id: string }> {
    const path = `accounts(${ACCOUNT_KEY_COLUMN}='${keyLiteral(plan.key)}')`;
    const created = await this.client.request('PATCH', path, { ...plan.fields, [ACCOUNT_KEY_COLUMN]: plan.key }, { 'If-None-Match': '*', Prefer: 'return=representation' });
    if (created.status === 201 || created.status === 204) {
      const id = created.entityId ?? (typeof created.json?.['accountid'] === 'string' ? created.json['accountid'] : null);
      if (id !== null) return { id };
    } else if (created.status !== 412) {
      throw new DataverseError(`dataverse_http_${created.status}`, created.status);
    }
    const rows = await this.client.list(`accounts?${query({ $select: 'accountid', $filter: `${ACCOUNT_KEY_COLUMN} eq ${odataString(plan.key)}`, $top: '1' })}`);
    const id = rows[0]?.['accountid'];
    if (typeof id !== 'string') throw new DataverseError('dataverse_account_missing', 0);
    return { id };
  }

  async findContactsByEmail(email: string): Promise<readonly ContactMatch[]> {
    const rows = await this.client.list(`contacts?${query({ $select: 'contactid', $filter: `emailaddress1 eq ${odataString(email)} and statecode eq 0`, $top: '3' })}`);
    return rows.flatMap((row) => (typeof row['contactid'] === 'string' ? [{ id: row['contactid'] }] : []));
  }

  async createContact(fields: Readonly<Record<string, unknown>>): Promise<ContactMatch> {
    const reply = await this.client.expect([201, 204], 'POST', 'contacts', fields, { Prefer: 'return=representation' });
    const id = reply.entityId ?? (typeof reply.json?.['contactid'] === 'string' ? reply.json['contactid'] : null);
    if (id === null) throw new DataverseError('dataverse_contact_missing', 0);
    return { id };
  }

  async markContactOptedOut(contactId: string): Promise<void> {
    await this.client.expect([204], 'PATCH', `contacts(${contactId})`, { donotbulkemail: true }, { 'If-Match': '*' });
  }

  async contactOfEngagement(engagementId: string): Promise<string | null> {
    const reply = await this.client.expect([200], 'GET', `${ENTITY_SET}(${engagementId})?${query({ $select: '_we_contact_value' })}`);
    const value = reply.json?.['_we_contact_value'];
    return typeof value === 'string' ? value : null;
  }
}
