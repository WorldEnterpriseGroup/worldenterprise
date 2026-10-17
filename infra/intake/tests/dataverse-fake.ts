/**
 * An in-memory stand-in for the slice of the Dataverse Web API that `dataverse/apply.ts` uses. It keeps real state, so a
 * second run against it proves idempotency, and it records every request so tests can check methods, headers and order.
 */

import { randomUUID } from 'node:crypto';

type Row = Record<string, unknown>;

export interface Recorded {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Row | null;
}

export interface FakeOptions {
  /** Privilege names the environment knows. Defaults to every one the intake role needs. */
  readonly privileges?: readonly string[];
  /** Polls of an alternate key that report Pending before it turns Active. Infinity means it never does. */
  readonly keyPendingPolls?: number;
  readonly failedKey?: string;
  /** An application user for this client id that already exists in a different business unit. */
  readonly foreignApplicationUser?: string;
  /** Answer this method and path prefix with a status and an error message. */
  readonly failOn?: { readonly method: string; readonly prefix: string; readonly status: number; readonly message: string };
}

const BASE = 'https://org.crm.example/api/data/v9.2/';
const ROOT_UNIT = randomUUID();
const ADMIN = randomUUID();

export const ALL_PRIVILEGES: readonly string[] = ['Create', 'Read', 'Write', 'Append', 'AppendTo'].flatMap((action) => [`prv${action}we_Engagement`, `prv${action}Contact`, `prv${action}Account`]);

interface Entity {
  readonly body: Row;
  readonly attributes: Map<string, Row>;
  readonly keys: Map<string, { readonly body: Row; polls: number }>;
}

function matchesClause(row: Row, clause: string): boolean {
  const parsed = /^([\w]+) eq (.+)$/.exec(clause.trim());
  if (parsed === null) throw new Error(`fake: unsupported filter clause ${clause}`);
  const column = parsed[1] ?? '';
  const raw = parsed[2] ?? '';
  const wanted: unknown = raw === 'null' ? null : raw.startsWith("'") ? raw.slice(1, -1).replaceAll("''", "'") : raw;
  const actual = row[column] ?? null;
  return String(actual).toLowerCase() === String(wanted).toLowerCase();
}

function matchesFilter(row: Row, filter: string): boolean {
  return filter.split(' or ').some((group) => group.split(' and ').every((clause) => matchesClause(row, clause)));
}

export class FakeDataverse {
  readonly requests: Recorded[] = [];
  readonly publishers: Row[] = [];
  readonly solutions: Row[] = [];
  readonly units: Row[] = [{ businessunitid: ROOT_UNIT, name: 'Contoso', _parentbusinessunitid_value: null }];
  readonly teams: Row[] = [];
  readonly roles: Row[] = [];
  readonly users: Row[] = [];
  readonly entities = new Map<string, Entity>([['account', { body: {}, attributes: new Map(), keys: new Map() }]]);
  readonly relationships = new Map<string, Row>();
  readonly grants: { roleId: string; privileges: Row[] }[] = [];
  readonly associations: { userId: string; roleId: string }[] = [];
  readonly privilegeRows: Row[];
  private readonly options: FakeOptions;

  constructor(options: FakeOptions = {}) {
    this.options = options;
    this.privilegeRows = (options.privileges ?? ALL_PRIVILEGES).map((name) => ({ privilegeid: randomUUID(), name }));
  }

  readonly fetch: typeof fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>));
    const method = init?.method ?? 'GET';
    const path = decodeURIComponent(url.slice(BASE.length));
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Row) : null;
    this.requests.push({ method, path, headers, body });
    return Promise.resolve(this.route(method, path, body));
  };

  get baseUrl(): string {
    return BASE.slice(0, BASE.indexOf('/api/'));
  }

  private json(status: number, value: unknown): Response {
    return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
  }

  private created(collection: string, id: string): Response {
    return new Response(null, { status: 204, headers: { 'odata-entityid': `${BASE}${collection}(${id})` } });
  }

  private list(rows: readonly Row[], query: URLSearchParams): Response {
    const filter = query.get('$filter');
    const top = Number(query.get('$top') ?? '1000');
    return this.json(200, { value: rows.filter((row) => filter === null || matchesFilter(row, filter)).slice(0, top) });
  }

  private route(method: string, path: string, body: Row | null): Response {
    const failure = this.options.failOn;
    if (failure !== undefined && failure.method === method && path.startsWith(failure.prefix)) return this.json(failure.status, { error: { message: failure.message } });

    const [pathname = '', queryText = ''] = path.split(/\?(.*)/s);
    const query = new URLSearchParams(queryText);

    if (method === 'GET' && pathname === 'WhoAmI') return this.json(200, { UserId: ADMIN });
    if (method === 'POST' && pathname === 'PublishAllXml') return new Response(null, { status: 204 });

    const simple: Record<string, Row[]> = { publishers: this.publishers, solutions: this.solutions, businessunits: this.units, teams: this.teams, roles: this.roles };
    const idColumn: Record<string, string> = { publishers: 'publisherid', solutions: 'solutionid', businessunits: 'businessunitid', teams: 'teamid', roles: 'roleid' };
    const rows = simple[pathname];
    if (rows !== undefined) {
      if (method === 'GET') return this.list(rows, query);
      const id = randomUUID();
      rows.push({ ...this.flatten(body ?? {}), [idColumn[pathname] ?? '']: id });
      return this.created(pathname, id);
    }

    if (pathname === 'privileges' && method === 'GET') return this.list(this.privilegeRows, query);

    if (pathname === 'systemusers') {
      if (method === 'GET') return this.list(this.users, query);
      const id = randomUUID();
      this.users.push({ ...this.flatten(body ?? {}), systemuserid: id });
      return this.created('systemusers', id);
    }
    const userRoles = /^systemusers\(([^)]+)\)\/systemuserroles_association(\/\$ref)?$/.exec(pathname);
    if (userRoles !== null) {
      const userId = userRoles[1] ?? '';
      if (method === 'GET') return this.list(this.associations.filter((item) => item.userId === userId).map((item) => ({ roleid: item.roleId })), query);
      const roleId = /roles\(([^)]+)\)/.exec(String(body?.['@odata.id']))?.[1] ?? '';
      this.associations.push({ userId, roleId });
      return new Response(null, { status: 204 });
    }

    const addPrivileges = /^roles\(([^)]+)\)\/Microsoft\.Dynamics\.CRM\.AddPrivilegesRole$/.exec(pathname);
    if (addPrivileges !== null && method === 'POST') {
      this.grants.push({ roleId: addPrivileges[1] ?? '', privileges: (body?.['Privileges'] as Row[] | undefined) ?? [] });
      return new Response(null, { status: 204 });
    }

    if (pathname === 'EntityDefinitions' && method === 'POST') {
      const name = String(body?.['SchemaName']).toLowerCase();
      this.entities.set(name, { body: body ?? {}, attributes: new Map(), keys: new Map() });
      return new Response(null, { status: 204 });
    }
    const entity = /^EntityDefinitions\(LogicalName='([^']+)'\)(?:\/(Attributes|Keys)(?:\(LogicalName='([^']+)'\))?)?$/.exec(pathname);
    if (entity !== null) {
      const found = this.entities.get(entity[1] ?? '');
      if (found === undefined) return this.json(404, { error: { message: 'not found' } });
      const part = entity[2];
      if (part === undefined) return this.json(200, { LogicalName: entity[1] });
      if (part === 'Attributes') {
        if (method === 'POST') {
          found.attributes.set(String(body?.['SchemaName']).toLowerCase(), body ?? {});
          return new Response(null, { status: 204 });
        }
        return found.attributes.has(entity[3] ?? '') ? this.json(200, { LogicalName: entity[3] }) : this.json(404, { error: { message: 'not found' } });
      }
      if (method === 'POST') {
        found.keys.set(String(body?.['SchemaName']), { body: body ?? {}, polls: 0 });
        return new Response(null, { status: 204 });
      }
      return this.json(200, { value: [...found.keys.entries()].map(([name, key]) => ({ SchemaName: name, EntityKeyIndexStatus: this.keyStatus(name, key) })) });
    }

    if (pathname === 'RelationshipDefinitions' && method === 'POST') {
      this.relationships.set(String(body?.['SchemaName']), body ?? {});
      return new Response(null, { status: 204 });
    }
    const relationship = /^RelationshipDefinitions\(SchemaName='([^']+)'\)$/.exec(pathname);
    if (relationship !== null) return this.relationships.has(relationship[1] ?? '') ? this.json(200, { SchemaName: relationship[1] }) : this.json(404, { error: { message: 'not found' } });

    return this.json(404, { error: { message: `fake: no route for ${method} ${pathname}` } });
  }

  private keyStatus(name: string, key: { polls: number }): string {
    if (name === this.options.failedKey) return 'Failed';
    key.polls += 1;
    return key.polls > (this.options.keyPendingPolls ?? 0) ? 'Active' : 'Pending';
  }

  /** Turns `x@odata.bind` bindings into the `_x_value` column a query would show. */
  private flatten(body: Row): Row {
    const row: Row = {};
    for (const [name, value] of Object.entries(body)) {
      const bind = /^(\w+)@odata\.bind$/.exec(name);
      row[bind === null ? name : `_${bind[1]}_value`] = bind === null ? value : /\(([^)]+)\)/.exec(String(value))?.[1];
    }
    if (this.options.foreignApplicationUser !== undefined && row['applicationid'] === this.options.foreignApplicationUser) row['_businessunitid_value'] = randomUUID();
    return row;
  }
}
