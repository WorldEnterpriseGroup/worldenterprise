/**
 * Applies `definition.json` to a Dataverse environment through the Web API. Idempotent: every step looks first and creates
 * only what is missing, so a rerun after a partial failure, or against an environment that already has the objects, is
 * safe. It never deletes and never changes an existing object.
 *
 * This is the designated workflow's code (the manual `intake:dataverse` job); nobody runs it against a real environment by
 * hand. It reads `DATAVERSE_URL`, `INTAKE_IDENTITY_CLIENT_ID` (the Function's managed identity, from the Bicep output) and a
 * short-lived bearer token in `DATAVERSE_TOKEN` that the job obtains from its federated credential. The token is never
 * logged. Output names the objects only.
 *
 *   node dataverse/apply.ts              apply
 *   node dataverse/apply.ts --bootstrap  once per environment, by an operator who administers it: create the business unit and
 *                                        register the pipeline identity (INTAKE_AZURE_CLIENT_ID) in it, then stop
 *   node dataverse/apply.ts --validate   check definition.json offline and exit
 *
 * Optional inputs: `INTAKE_AZURE_CLIENT_ID` (the pipeline identity, ensured as an application user) and `INTAKE_E2E_CLIENT_ID`
 * (the e2e read-back identity, ensured with its Read and Delete role). Each is skipped when unset.
 */

import { readFileSync } from 'node:fs';

import { DataverseClient, DataverseError } from '../src/azure/dataverse.ts';
import {
  attributeBody, entityBody, keyBody, logicalName, lookupBody, parseDefinition, privilegeNamesFor,
  type Column, type Definition, type Extension, type KeyDefinition, type PersonName, type RoleSpec, type Table,
} from './metadata.ts';

export class ApplyError extends Error {
  readonly step: string;
  constructor(step: string, detail: string) {
    super(`${step}: ${detail}`);
    this.name = 'ApplyError';
    this.step = step;
  }
}

export interface ApplyInputs {
  readonly definition: Definition;
  readonly client: DataverseClient;
  readonly baseUrl: string;
  /** Client id of the Function's user-assigned managed identity. Empty skips registering it (before the first deploy). */
  readonly identityClientId: string;
  /** Client id of the pipeline identity (`INTAKE_AZURE_CLIENT_ID`). When set, it is registered as an application user holding `definition.deployUser.role`. */
  readonly deployClientId?: string | undefined;
  /** Client id of the e2e read-back identity (`INTAKE_E2E_CLIENT_ID`). When set, the Read and Delete role and its application user are applied. */
  readonly e2eClientId?: string | undefined;
  readonly log: (line: string) => void;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly keyPollAttempts?: number;
  readonly keyPollMs?: number;
}

export interface ApplySummary {
  readonly created: readonly string[];
  readonly existing: readonly string[];
}

type Json = Readonly<Record<string, unknown>>;

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function quote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function realSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class Applier {
  private readonly inputs: ApplyInputs;
  private readonly created: string[] = [];
  private readonly existing: string[] = [];
  private readonly solutionHeader: Record<string, string>;

  constructor(inputs: ApplyInputs) {
    this.inputs = inputs;
    this.solutionHeader = { 'MSCRM.SolutionUniqueName': inputs.definition.solution.uniqueName };
  }

  private note(kind: 'created' | 'existing', name: string): void {
    (kind === 'created' ? this.created : this.existing).push(name);
    this.inputs.log(`${kind === 'created' ? 'created ' : 'exists  '} ${name}`);
  }

  private async send(step: string, accepted: readonly number[], method: string, path: string, body?: Json, headers?: Record<string, string>): Promise<{ readonly status: number; readonly json: Json | null; readonly entityId: string | null }> {
    const reply = await this.inputs.client.request(method, path, body, headers);
    if (!accepted.includes(reply.status)) {
      const error = reply.json?.['error'];
      const message = typeof error === 'object' && error !== null && typeof (error as Json)['message'] === 'string' ? String((error as Json)['message']).slice(0, 300) : '';
      throw new ApplyError(step, `HTTP ${reply.status}${message === '' ? '' : ` ${message}`}`);
    }
    return reply;
  }

  /** The first id of a query, or null. */
  private async findId(step: string, collection: string, idColumn: string, filter: string): Promise<string | null> {
    const reply = await this.send(step, [200], 'GET', `${collection}?$select=${idColumn}&$filter=${encodeURIComponent(filter)}&$top=1`);
    const value = reply.json?.['value'];
    const first = Array.isArray(value) ? (value[0] as Json | undefined) : undefined;
    const id = first?.[idColumn];
    return typeof id === 'string' ? id : null;
  }

  private async exists(step: string, path: string): Promise<boolean> {
    const reply = await this.send(step, [200, 404], 'GET', path);
    return reply.status === 200;
  }

  private idFrom(step: string, reply: { readonly entityId: string | null; readonly json: Json | null }, idColumn: string): string {
    const fromBody = reply.json?.[idColumn];
    const id = reply.entityId ?? (typeof fromBody === 'string' ? fromBody : null);
    if (id === null || !GUID.test(id)) throw new ApplyError(step, 'the created object returned no id');
    return id;
  }

  async run(): Promise<ApplySummary> {
    const { definition } = this.inputs;
    const who = await this.send('whoami', [200], 'GET', 'WhoAmI');
    const userId = who.json?.['UserId'];
    if (typeof userId !== 'string') throw new ApplyError('whoami', 'no user id');

    await this.ensurePublisher(definition);
    await this.ensureSolution(definition);
    const unitId = await this.ensureBusinessUnit(definition);
    await this.ensureTeam(definition, unitId, userId);

    for (const table of definition.tables) await this.ensureTable(table);
    for (const extension of definition.extensions) await this.ensureExtension(extension);
    await this.send('publish', [200, 204], 'POST', 'PublishAllXml', {});
    for (const table of definition.tables) await this.waitForKeys(table.logicalName, table.keys);
    for (const extension of definition.extensions) await this.waitForKeys(extension.table, extension.keys);

    if (this.inputs.deployClientId !== undefined) await this.ensureDeployUser(definition, unitId, this.inputs.deployClientId);
    const roleId = await this.ensureRole(definition.role, unitId);
    // Before the first deploy the Function's identity does not exist yet. The schema, role and e2e identity can still be applied;
    // the job is rerun after intake:deploy to register the Function.
    if (this.inputs.identityClientId === '') this.inputs.log('skipped application user for the intake identity: INTAKE_IDENTITY_CLIENT_ID is unset');
    else await this.ensureApplicationUser(this.inputs.identityClientId, definition.applicationUser, unitId, roleId, 'the intake identity');
    if (this.inputs.e2eClientId !== undefined) await this.ensureE2e(definition, unitId, this.inputs.e2eClientId);
    return { created: this.created, existing: this.existing };
  }

  /**
   * The first step of a new environment, run once by an operator who can already administer it (`--bootstrap`): the business
   * unit, and the pipeline identity as an application user in it. Every later run is the pipeline itself.
   */
  async bootstrap(): Promise<ApplySummary> {
    const { definition } = this.inputs;
    const clientId = this.inputs.deployClientId;
    if (clientId === undefined) throw new ApplyError('inputs', 'INTAKE_AZURE_CLIENT_ID is required to register the pipeline identity');
    await this.send('whoami', [200], 'GET', 'WhoAmI');
    const unitId = await this.ensureBusinessUnit(definition);
    await this.ensureDeployUser(definition, unitId, clientId);
    return { created: this.created, existing: this.existing };
  }

  /** The pipeline identity: an application user in the WE business unit holding the named platform role of that unit. */
  private async ensureDeployUser(definition: Definition, unitId: string, clientId: string): Promise<void> {
    const deploy = definition.deployUser;
    if (deploy === undefined) throw new ApplyError('deploy user', 'definition.json has no deployUser');
    let roleId: string | null = null;
    // A new business unit receives its copies of the platform roles a moment after it exists.
    for (let attempt = 1; attempt <= 6 && roleId === null; attempt += 1) {
      roleId = await this.findId('deploy user', 'roles', 'roleid', `name eq ${quote(deploy.role)} and _businessunitid_value eq ${unitId}`);
      if (roleId === null) await (this.inputs.sleep ?? realSleep)(this.inputs.keyPollMs ?? 5000);
    }
    if (roleId === null) throw new ApplyError('deploy user', `the role ${deploy.role} is not in the business unit yet; rerun in a minute`);
    await this.ensureApplicationUser(clientId, deploy, unitId, roleId, 'the pipeline identity');
  }

  /** The e2e read-back identity: its own role (Read and Delete only) and an application user holding it. */
  private async ensureE2e(definition: Definition, unitId: string, clientId: string): Promise<void> {
    const e2e = definition.e2e;
    if (e2e === undefined) throw new ApplyError('e2e', 'definition.json has no e2e section');
    const roleId = await this.ensureRole(e2e.role, unitId);
    await this.ensureApplicationUser(clientId, e2e.applicationUser, unitId, roleId, 'the e2e identity');
  }

  private async ensurePublisher(definition: Definition): Promise<void> {
    const { publisher } = definition;
    if (await this.findId('publisher', 'publishers', 'publisherid', `uniquename eq ${quote(publisher.uniqueName)}`) !== null) return this.note('existing', `publisher ${publisher.uniqueName}`);
    await this.send('publisher', [201, 204], 'POST', 'publishers', {
      uniquename: publisher.uniqueName, friendlyname: publisher.friendlyName, customizationprefix: publisher.customizationPrefix,
      customizationoptionvalueprefix: publisher.customizationOptionValuePrefix,
    });
    this.note('created', `publisher ${publisher.uniqueName}`);
  }

  private async ensureSolution(definition: Definition): Promise<void> {
    const { solution, publisher } = definition;
    if (await this.findId('solution', 'solutions', 'solutionid', `uniquename eq ${quote(solution.uniqueName)}`) !== null) return this.note('existing', `solution ${solution.uniqueName}`);
    const publisherId = await this.findId('solution', 'publishers', 'publisherid', `uniquename eq ${quote(publisher.uniqueName)}`);
    if (publisherId === null) throw new ApplyError('solution', 'the publisher was not found after creation');
    await this.send('solution', [201, 204], 'POST', 'solutions', {
      uniquename: solution.uniqueName, friendlyname: solution.friendlyName, version: solution.version, 'publisherid@odata.bind': `/publishers(${publisherId})`,
    });
    this.note('created', `solution ${solution.uniqueName}`);
  }

  private async ensureBusinessUnit(definition: Definition): Promise<string> {
    const name = definition.businessUnit.name;
    const found = await this.findId('business unit', 'businessunits', 'businessunitid', `name eq ${quote(name)}`);
    if (found !== null) {
      this.note('existing', `business unit ${name}`);
      return found;
    }
    const root = await this.findId('business unit', 'businessunits', 'businessunitid', '_parentbusinessunitid_value eq null');
    if (root === null) throw new ApplyError('business unit', 'the root business unit was not found');
    const reply = await this.send('business unit', [201, 204], 'POST', 'businessunits', { name, 'parentbusinessunitid@odata.bind': `/businessunits(${root})` });
    this.note('created', `business unit ${name}`);
    return this.idFrom('business unit', reply, 'businessunitid');
  }

  private async ensureTeam(definition: Definition, unitId: string, administratorId: string): Promise<void> {
    const name = definition.ownerTeam.name;
    if (await this.findId('owner team', 'teams', 'teamid', `name eq ${quote(name)} and _businessunitid_value eq ${unitId}`) !== null) return this.note('existing', `owner team ${name}`);
    await this.send('owner team', [201, 204], 'POST', 'teams', {
      name, teamtype: 0, description: 'Owns the records the World Enterprise intake service writes.',
      'businessunitid@odata.bind': `/businessunits(${unitId})`, 'administratorid@odata.bind': `/systemusers(${administratorId})`,
    });
    this.note('created', `owner team ${name}`);
  }

  private async ensureColumns(table: string, columns: readonly Column[]): Promise<void> {
    for (const column of columns) {
      const path = `EntityDefinitions(LogicalName=${quote(table)})/Attributes(LogicalName=${quote(logicalName(column.schemaName))})?$select=LogicalName`;
      if (await this.exists(`column ${column.schemaName}`, path)) {
        this.note('existing', `column ${table}.${column.schemaName}`);
        continue;
      }
      await this.send(`column ${column.schemaName}`, [201, 204], 'POST', `EntityDefinitions(LogicalName=${quote(table)})/Attributes`, attributeBody(column), this.solutionHeader);
      this.note('created', `column ${table}.${column.schemaName}`);
    }
  }

  private async ensureKeys(table: string, keys: readonly KeyDefinition[]): Promise<void> {
    if (keys.length === 0) return;
    const listed = await this.send(`keys of ${table}`, [200], 'GET', `EntityDefinitions(LogicalName=${quote(table)})/Keys?$select=SchemaName`);
    const present = new Set((Array.isArray(listed.json?.['value']) ? (listed.json['value'] as Json[]) : []).map((item) => item['SchemaName']));
    for (const key of keys) {
      if (present.has(key.schemaName)) {
        this.note('existing', `key ${table}.${key.schemaName}`);
        continue;
      }
      await this.send(`key ${key.schemaName}`, [201, 204], 'POST', `EntityDefinitions(LogicalName=${quote(table)})/Keys`, keyBody(key), this.solutionHeader);
      this.note('created', `key ${table}.${key.schemaName}`);
    }
  }

  private async ensureTable(table: Table): Promise<void> {
    if (await this.exists(`table ${table.schemaName}`, `EntityDefinitions(LogicalName=${quote(table.logicalName)})?$select=LogicalName`)) {
      this.note('existing', `table ${table.logicalName}`);
    } else {
      await this.send(`table ${table.schemaName}`, [201, 204], 'POST', 'EntityDefinitions', entityBody(table), this.solutionHeader);
      this.note('created', `table ${table.logicalName}`);
    }
    await this.ensureColumns(table.logicalName, table.columns);
    for (const lookup of table.lookups) {
      if (await this.exists(`lookup ${lookup.schemaName}`, `RelationshipDefinitions(SchemaName=${quote(lookup.relationship)})?$select=SchemaName`)) {
        this.note('existing', `lookup ${table.logicalName}.${lookup.schemaName}`);
        continue;
      }
      await this.send(`lookup ${lookup.schemaName}`, [201, 204], 'POST', 'RelationshipDefinitions', lookupBody(table, lookup), this.solutionHeader);
      this.note('created', `lookup ${table.logicalName}.${lookup.schemaName}`);
    }
    await this.ensureKeys(table.logicalName, table.keys);
  }

  private async ensureExtension(extension: Extension): Promise<void> {
    await this.ensureColumns(extension.table, extension.columns);
    await this.ensureKeys(extension.table, extension.keys);
  }

  /** An alternate key is built asynchronously. Idempotent writes depend on it, so the job waits until every key is active. */
  private async waitForKeys(table: string, keys: readonly KeyDefinition[]): Promise<void> {
    if (keys.length === 0) return;
    const attempts = this.inputs.keyPollAttempts ?? 24;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const reply = await this.send(`keys of ${table}`, [200], 'GET', `EntityDefinitions(LogicalName=${quote(table)})/Keys?$select=SchemaName,EntityKeyIndexStatus`);
      const items = (Array.isArray(reply.json?.['value']) ? (reply.json['value'] as Json[]) : []).filter((item) => keys.some((key) => key.schemaName === item['SchemaName']));
      if (items.some((item) => item['EntityKeyIndexStatus'] === 'Failed')) throw new ApplyError(`keys of ${table}`, 'an alternate key failed to build; see the key in the maker portal');
      if (items.length === keys.length && items.every((item) => item['EntityKeyIndexStatus'] === 'Active')) return this.inputs.log(`active  keys of ${table}`);
      await (this.inputs.sleep ?? realSleep)(this.inputs.keyPollMs ?? 5000);
    }
    throw new ApplyError(`keys of ${table}`, 'alternate keys are still building; rerun the job in a few minutes');
  }

  private async ensureRole(role: RoleSpec, unitId: string): Promise<string> {
    let roleId = await this.findId('role', 'roles', 'roleid', `name eq ${quote(role.name)} and _businessunitid_value eq ${unitId}`);
    if (roleId === null) {
      const reply = await this.send('role', [201, 204], 'POST', 'roles', { name: role.name, 'businessunitid@odata.bind': `/businessunits(${unitId})` });
      roleId = this.idFrom('role', reply, 'roleid');
      this.note('created', `role ${role.name}`);
    } else {
      this.note('existing', `role ${role.name}`);
    }

    const names = privilegeNamesFor(role);
    const listed = await this.send('privileges', [200], 'GET', `privileges?$select=privilegeid,name&$filter=${encodeURIComponent(names.map((name) => `name eq ${quote(name)}`).join(' or '))}`);
    const byName = new Map((Array.isArray(listed.json?.['value']) ? (listed.json['value'] as Json[]) : []).map((item) => [String(item['name']), String(item['privilegeid'])]));
    const missing = names.filter((name) => !byName.has(name));
    if (missing.length > 0) throw new ApplyError('privileges', `not found: ${missing.join(', ')}`);
    await this.send('role privileges', [200, 204], 'POST', `roles(${roleId})/Microsoft.Dynamics.CRM.AddPrivilegesRole`, {
      Privileges: names.map((name) => ({ PrivilegeId: byName.get(name), Depth: role.depth, BusinessUnitId: unitId })),
    });
    this.inputs.log(`granted ${names.length} privileges to role ${role.name} at ${role.depth} depth`);
    return roleId;
  }

  private async ensureApplicationUser(clientId: string, person: PersonName, unitId: string, roleId: string, what: string): Promise<void> {
    if (!GUID.test(clientId)) throw new ApplyError('application user', `the client id of ${what} is not a GUID`);
    const reply = await this.send('application user', [200], 'GET', `systemusers?$select=systemuserid,_businessunitid_value&$filter=${encodeURIComponent(`applicationid eq ${clientId}`)}&$top=1`);
    const first = Array.isArray(reply.json?.['value']) ? (reply.json['value'][0] as Json | undefined) : undefined;
    let userId: string;
    if (first === undefined) {
      const created = await this.send('application user', [201, 204], 'POST', 'systemusers', {
        applicationid: clientId, firstname: person.firstName, lastname: person.lastName, 'businessunitid@odata.bind': `/businessunits(${unitId})`,
      });
      userId = this.idFrom('application user', created, 'systemuserid');
      this.note('created', `application user for ${what}`);
    } else {
      userId = String(first['systemuserid']);
      if (first['_businessunitid_value'] !== unitId) throw new ApplyError('application user', 'the identity already exists in another business unit; move it to the WE business unit first');
      this.note('existing', `application user for ${what}`);
    }

    const assigned = await this.send('role assignment', [200], 'GET', `systemusers(${userId})/systemuserroles_association?$select=roleid&$filter=${encodeURIComponent(`roleid eq ${roleId}`)}`);
    if (Array.isArray(assigned.json?.['value']) && assigned.json['value'].length > 0) return this.note('existing', `role assignment for ${what}`);
    await this.send('role assignment', [200, 204], 'POST', `systemusers(${userId})/systemuserroles_association/$ref`, { '@odata.id': `${this.inputs.baseUrl}/api/data/v9.2/roles(${roleId})` });
    this.note('created', `role assignment for ${what}`);
  }
}

export async function applyDefinition(inputs: ApplyInputs): Promise<ApplySummary> {
  return new Applier(inputs).run();
}

export async function bootstrapEnvironment(inputs: ApplyInputs): Promise<ApplySummary> {
  return new Applier(inputs).bootstrap();
}

export function loadDefinition(path: URL = new URL('./definition.json', import.meta.url)): Definition {
  return parseDefinition(readFileSync(path, 'utf8'));
}

async function main(): Promise<void> {
  const definition = loadDefinition();
  if (process.argv.includes('--validate')) {
    console.log(`definition ok: ${definition.tables.length} table(s), ${definition.extensions.length} extension(s)`);
    return;
  }
  const baseUrl = (process.env['DATAVERSE_URL'] ?? '').replace(/\/+$/, '');
  const token = process.env['DATAVERSE_TOKEN'] ?? '';
  const identityClientId = process.env['INTAKE_IDENTITY_CLIENT_ID'] ?? '';
  const bootstrap = process.argv.includes('--bootstrap');
  const optional = (name: string): string | undefined => {
    const value = process.env[name] ?? '';
    return value === '' ? undefined : value;
  };
  const missing = [['DATAVERSE_URL', baseUrl], ['DATAVERSE_TOKEN', token]].filter(([, value]) => value === '').map(([name]) => name);
  if (missing.length > 0) throw new ApplyError('inputs', `missing ${missing.join(', ')}`);
  if (!baseUrl.startsWith('https://')) throw new ApplyError('inputs', 'DATAVERSE_URL must be an https URL');

  const client = new DataverseClient({ baseUrl, fetch, getToken: () => Promise.resolve(token), timeoutMs: 60_000 });
  const inputs: ApplyInputs = {
    definition, client, baseUrl, identityClientId, deployClientId: optional('INTAKE_AZURE_CLIENT_ID'), e2eClientId: optional('INTAKE_E2E_CLIENT_ID'), log: (line) => console.log(line),
  };
  const summary = bootstrap ? await bootstrapEnvironment(inputs) : await applyDefinition(inputs);
  console.log(`done: ${summary.created.length} created, ${summary.existing.length} already present`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof ApplyError ? `apply failed at ${error.message}` : error instanceof DataverseError ? `apply failed: ${error.code}` : `apply failed: ${error instanceof Error ? error.name : 'unknown error'}`);
    process.exit(1);
  });
}
