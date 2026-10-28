import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

/**
 * The deployed intake service, end to end (#121). It runs only when INTAKE_E2E=1 (project `intake-e2e`, job `intake:e2e`), never
 * against the static build, and never against localhost.
 *
 * One submission goes through the public endpoint with a reserved `@e2e.invalid` address. The test then reads Dataverse back as the
 * dedicated e2e identity, replays the submission, checks the Logic App run, and finally deletes every row it created and queries
 * again for zero rows. Cleanup runs even when an assertion fails, so a red run leaves nothing behind.
 *
 * Environment (names only; values are CI variables and Key Vault secrets, never printed):
 *   INTAKE_E2E_API_URL          public endpoint, https://intake.worldenterprise.org/api/intake
 *   INTAKE_E2E_ORIGIN           the allowed site origin sent as Origin (default https://worldenterprise.org)
 *   INTAKE_E2E_DATAVERSE_URL    the Dataverse environment URL
 *   INTAKE_E2E_TENANT_ID, INTAKE_E2E_CLIENT_ID, INTAKE_E2E_CLIENT_SECRET   sp-worldenterprise-intake-e2e
 *   INTAKE_E2E_LOGICAPP_ID      optional, the notification Logic App resource id; without it the run check is skipped
 */
const ENABLED = process.env['INTAKE_E2E'] === '1';
const API_URL = process.env['INTAKE_E2E_API_URL'] ?? '';
const ORIGIN = process.env['INTAKE_E2E_ORIGIN'] ?? 'https://worldenterprise.org';
const DATAVERSE_URL = (process.env['INTAKE_E2E_DATAVERSE_URL'] ?? '').replace(/\/+$/, '');
const TENANT_ID = process.env['INTAKE_E2E_TENANT_ID'] ?? '';
const CLIENT_ID = process.env['INTAKE_E2E_CLIENT_ID'] ?? '';
const CLIENT_SECRET = process.env['INTAKE_E2E_CLIENT_SECRET'] ?? '';
const LOGICAPP_ID = process.env['INTAKE_E2E_LOGICAPP_ID'] ?? '';
const CONFIGURED = ENABLED && [API_URL, DATAVERSE_URL, TENANT_ID, CLIENT_ID, CLIENT_SECRET].every((value) => value !== '');

const POLL_MS = 3_000;
const WAIT_MS = 90_000;

interface TokenReply {
  readonly access_token?: string;
}

interface Row {
  readonly [column: string]: unknown;
}

interface LogicAppRun {
  readonly name: string;
  readonly properties: { readonly status: string; readonly correlation?: { readonly clientTrackingId?: string } };
}

/** A client-credentials token for one resource. The secret goes to the token endpoint only. */
async function token(scope: string): Promise<string> {
  const reply = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, scope }),
  });
  if (!reply.ok) throw new Error(`token request for ${scope} answered ${reply.status}`);
  const body = (await reply.json()) as TokenReply;
  if (typeof body.access_token !== 'string') throw new Error(`token request for ${scope} returned no token`);
  return body.access_token;
}

async function dataverse(bearer: string, method: string, path: string): Promise<Response> {
  return fetch(`${DATAVERSE_URL}/api/data/v9.2/${path}`, {
    method,
    headers: { Authorization: `Bearer ${bearer}`, Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' },
  });
}

async function list(bearer: string, path: string): Promise<readonly Row[]> {
  const reply = await dataverse(bearer, 'GET', path);
  if (!reply.ok) throw new Error(`GET ${path.split('?')[0]} answered ${reply.status}`);
  const body = (await reply.json()) as { value?: readonly Row[] };
  return body.value ?? [];
}

async function until<T>(what: string, probe: () => Promise<T | null>): Promise<T> {
  const deadline = Date.now() + WAIT_MS;
  for (;;) {
    const found = await probe();
    if (found !== null) return found;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

test.describe('the deployed intake service', () => {
  test.skip(!CONFIGURED, 'set INTAKE_E2E=1 and the INTAKE_E2E_* variables to run against the deployed endpoint');
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  const requestId = randomUUID();
  const email = `e2e-${requestId}@e2e.invalid`;
  let bearer = '';

  const payload = (): Record<string, unknown> => ({
    form: 'apply', requestId, audience: 'startup', name: 'E2E Intake', email, company: 'E2E Intake Check', stage: 'validating',
    seats: 'Product design x1', topic: '', message: 'Automated end-to-end check. Safe to ignore.', briefId: '', companyUrl: '',
    partnerCategory: '', investorKind: '', focus: '', offer: '', consent: true, consentUpdates: false, website: '',
    startedAt: new Date(Date.now() - 30_000).toISOString(), submittedAt: new Date().toISOString(), page: '/apply/',
  });

  const engagements = () => list(bearer, `we_engagements?$select=we_engagementid,we_status,we_kind&$filter=we_requestid eq '${requestId}'`);
  const leads = () => list(bearer, `leads?$select=leadid,subject,emailaddress1&$filter=we_requestid eq '${requestId}'`);
  const contacts = () => list(bearer, `contacts?$select=contactid&$filter=emailaddress1 eq '${email}'`);
  const accounts = () => list(bearer, `accounts?$select=accountid&$filter=we_accountkey eq 'domain:e2e.invalid'`);

  const submit = (): Promise<Response> =>
    fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN }, body: JSON.stringify(payload()) });

  test.beforeAll(async () => {
    bearer = await token(`${DATAVERSE_URL}/.default`);
  });

  test.afterAll(async () => {
    if (bearer === '') return;
    // Dependents first: the ledger row points at the Lead, Contact and Account.
    const sets: readonly (readonly [string, string, () => Promise<readonly Row[]>])[] = [
      ['we_engagements', 'we_engagementid', engagements],
      ['leads', 'leadid', leads],
      ['contacts', 'contactid', contacts],
      ['accounts', 'accountid', accounts],
    ];
    for (const [set, idColumn, read] of sets) {
      for (const row of await read()) {
        const reply = await dataverse(bearer, 'DELETE', `${set}(${String(row[idColumn])})`);
        expect([204, 404], `cleanup of ${set} answered ${reply.status}`).toContain(reply.status);
      }
    }
    expect(await engagements(), 'no engagement row is left').toHaveLength(0);
    expect(await leads(), 'no Lead is left').toHaveLength(0);
    expect(await contacts(), 'no Contact is left').toHaveLength(0);
    expect(await accounts(), 'no Account is left').toHaveLength(0);
  });

  test('a submission is accepted and stored as an engagement row and a Lead', async () => {
    const reply = await submit();
    expect(reply.status).toBe(202);

    const row = await until('the engagement row', async () => (await engagements())[0] ?? null);
    expect(row['we_kind']).toBe('apply');

    const lead = await until('the Lead', async () => (await leads())[0] ?? null);
    expect(lead['emailaddress1']).toBe(email);
    expect(String(lead['subject'])).toContain(requestId.slice(0, 8));
    expect(await contacts()).toHaveLength(1);
  });

  test('replaying the submission is answered 200 and writes nothing new', async () => {
    const reply = await submit();
    expect(reply.status).toBe(200);
    expect(await engagements()).toHaveLength(1);
    expect(await leads()).toHaveLength(1);
    expect(await contacts()).toHaveLength(1);
  });

  test('the ledger row records that the inbox was notified', async () => {
    const row = await until('the notified time', async () => {
      const [first] = await list(bearer, `we_engagements?$select=we_notifiedat&$filter=we_requestid eq '${requestId}'`);
      return first?.['we_notifiedat'] ? first : null;
    });
    expect(row['we_notifiedat']).toBeTruthy();
  });

  test('the notification Logic App ran for the request and succeeded', async () => {
    test.skip(LOGICAPP_ID === '', 'INTAKE_E2E_LOGICAPP_ID is not set, so the run is not checked');
    const arm = await token('https://management.azure.com/.default');
    const run = await until('the Logic App run', async () => {
      const reply = await fetch(`https://management.azure.com${LOGICAPP_ID}/runs?api-version=2019-05-01&$top=25`, { headers: { Authorization: `Bearer ${arm}` } });
      expect(reply.ok, `listing Logic App runs answered ${reply.status}`).toBe(true);
      const body = (await reply.json()) as { value?: readonly LogicAppRun[] };
      const found = (body.value ?? []).find((item) => item.properties.correlation?.clientTrackingId === requestId);
      return found !== undefined && found.properties.status !== 'Running' ? found : null;
    });
    expect(run.properties.status).toBe('Succeeded');
  });
});
