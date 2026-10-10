/**
 * The forms contract as the server sees it. `docs/forms-contract.schema.json` (committed by WP-60, kept in sync with the
 * browser by tests/unit/wp-60/forms-schema.test.ts) is the single source: this module is the only place that knows its JSON
 * shape, and it turns that shape into a typed rule table. Everything else (validation, thanks paths, tests) reads the table.
 *
 * Shape consumed (version 2):
 *   forms                the kinds, exactly the six this service knows
 *   presence.matrix      per kind, per field: "R" required, "O" optional, "-" must be empty
 *   enums                allowed values for stage, topic, partnerCategory, investorKind and audience
 *   limits               maximum length per text field
 *   audience             per kind the allowed audiences, and `briefs` per brief the audiences it is offered to
 *   thanks               per kind the site-relative thanks path (a kind without one has no entry)
 *
 * The file does not carry a field type, so the type follows from the field name (see FIELD_TYPES). A file that does not fit is a
 * deployment error, not a request error: compileContract throws a ContractError naming the path, and the Function refuses to
 * start rather than guess.
 */

export const KINDS = ['apply', 'contact', 'newsletter', 'brief-request', 'investor-interest', 'partner-enquiry'] as const;
export type Kind = (typeof KINDS)[number];

export type Rule = 'R' | 'O' | '-';
export type FieldType = 'string' | 'boolean' | 'email' | 'url' | 'uuid' | 'enum' | 'slug' | 'iso';

export interface FieldRule {
  readonly rule: Rule;
  readonly type: FieldType;
  readonly max: number;
  readonly enum: readonly string[];
}

export interface KindRule {
  readonly thanks: string | null;
  /** Allowed audience values. `''` means the kind carries no audience. */
  readonly audience: readonly string[];
  readonly fields: Readonly<Record<string, FieldRule>>;
}

export interface Contract {
  readonly version: number;
  readonly kinds: Readonly<Record<Kind, KindRule>>;
  /** For each brief the contract names, the audiences it is offered to. A brief request must come from one of them. */
  readonly briefAudiences: Readonly<Record<string, readonly string[]>>;
}

/** The matrix columns the service understands. A column outside this list, or a missing one, is a deployment error. */
const MATRIX_FIELDS = [
  'name', 'email', 'company', 'stage', 'seats', 'topic', 'message', 'briefId', 'companyUrl', 'partnerCategory', 'offer', 'investorKind', 'focus',
  'audience', 'consent', 'requestId',
] as const;

/** The type of every field that is not plain text. A field with an entry in `enums` is an enum. */
const FIELD_TYPES: Readonly<Record<string, FieldType>> = {
  email: 'email', companyUrl: 'url', requestId: 'uuid', briefId: 'slug', consent: 'boolean',
};

/** Limits for the fields the contract's `limits` table leaves out (identifiers and flags, not free text). */
const DEFAULT_LIMITS: Readonly<Record<string, number>> = { requestId: 36, briefId: 64, consent: 5 };

const ENUM_LIMIT = 64;

export class ContractError extends Error {
  readonly path: string;
  constructor(path: string, problem: string) {
    super(`forms contract invalid at ${path}: ${problem}`);
    this.name = 'ContractError';
    this.path = path;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value)) throw new ContractError(path, 'expected an array of strings');
  return value.map((item, index) => {
    if (typeof item !== 'string') throw new ContractError(`${path}[${index}]`, 'expected a string');
    return item;
  });
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new ContractError(path, 'expected an object');
  return value;
}

function sitePath(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) throw new ContractError(path, 'expected a site-relative path');
  return value;
}

function compileEnums(raw: unknown): Readonly<Record<string, readonly string[]>> {
  const enums: Record<string, readonly string[]> = {};
  for (const [name, values] of Object.entries(record(raw, '$.enums'))) {
    const list = stringList(values, `$.enums.${name}`);
    if (list.length === 0) throw new ContractError(`$.enums.${name}`, 'an enum needs at least one value');
    enums[name] = list;
  }
  return enums;
}

function compileLimits(raw: unknown): Readonly<Record<string, number>> {
  const limits: Record<string, number> = {};
  for (const [name, value] of Object.entries(record(raw, '$.limits'))) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) throw new ContractError(`$.limits.${name}`, 'expected a positive integer');
    limits[name] = value;
  }
  return limits;
}

function compileFields(
  matrix: Record<string, unknown>, kind: Kind, enums: Readonly<Record<string, readonly string[]>>, limits: Readonly<Record<string, number>>,
): Record<string, FieldRule> {
  const path = `$.presence.matrix.${kind}`;
  const row = record(matrix[kind], path);
  for (const name of Object.keys(row)) {
    if (!(MATRIX_FIELDS as readonly string[]).includes(name)) throw new ContractError(`${path}.${name}`, 'unknown field');
  }
  const fields: Record<string, FieldRule> = {};
  for (const name of MATRIX_FIELDS) {
    const rule = row[name];
    if (rule !== 'R' && rule !== 'O' && rule !== '-') throw new ContractError(`${path}.${name}`, 'expected "R", "O" or "-"');
    // The audience column is checked against the kind's audience list, not as a text field.
    if (name === 'audience') continue;
    const values = enums[name] ?? [];
    const type: FieldType = FIELD_TYPES[name] ?? (values.length > 0 ? 'enum' : 'string');
    const max = limits[name] ?? DEFAULT_LIMITS[name] ?? (type === 'enum' ? ENUM_LIMIT : undefined);
    if (max === undefined) throw new ContractError(`$.limits.${name}`, 'missing a length limit for a text field');
    fields[name] = { rule, type, max, enum: values };
  }
  return fields;
}

function compileAudience(raw: Record<string, unknown>, matrix: Record<string, unknown>, kind: Kind): readonly string[] {
  const column = record(matrix[kind], `$.presence.matrix.${kind}`)['audience'];
  if (column === '-') return [''];
  // A brief request takes the audience of the brief asked for, so it accepts any audience a brief is offered to.
  if (kind === 'brief-request') {
    const offered = new Set<string>();
    for (const [brief, audiences] of Object.entries(record(raw['briefs'], '$.audience.briefs'))) {
      for (const audience of stringList(audiences, `$.audience.briefs.${brief}`)) offered.add(audience);
    }
    if (offered.size === 0) throw new ContractError('$.audience.briefs', 'expected at least one brief');
    return [...offered];
  }
  const list = stringList(raw[kind], `$.audience.${kind}`);
  if (list.length === 0) throw new ContractError(`$.audience.${kind}`, 'expected at least one audience');
  return list;
}

/** Turns the parsed JSON into the rule table, or throws a ContractError that names the first problem. */
export function compileContract(raw: unknown): Contract {
  const root = record(raw, '$');
  const version = root['version'];
  if (typeof version !== 'number' || !Number.isInteger(version)) throw new ContractError('$.version', 'expected an integer');

  const forms = stringList(root['forms'], '$.forms');
  for (const form of forms) {
    if (!(KINDS as readonly string[]).includes(form)) throw new ContractError('$.forms', `unknown form "${form}"`);
  }
  for (const kind of KINDS) {
    if (!forms.includes(kind)) throw new ContractError('$.forms', `missing form "${kind}"`);
  }

  const matrix = record(record(root['presence'], '$.presence')['matrix'], '$.presence.matrix');
  const enums = compileEnums(root['enums']);
  const limits = compileLimits(root['limits']);
  const audience = record(root['audience'], '$.audience');
  const thanks = record(root['thanks'], '$.thanks');
  for (const name of Object.keys(thanks)) {
    if (!(KINDS as readonly string[]).includes(name)) throw new ContractError(`$.thanks.${name}`, 'unknown form');
  }

  const kinds: Partial<Record<Kind, KindRule>> = {};
  for (const kind of KINDS) {
    kinds[kind] = {
      thanks: thanks[kind] === undefined ? null : sitePath(thanks[kind], `$.thanks.${kind}`),
      audience: compileAudience(audience, matrix, kind),
      fields: compileFields(matrix, kind, enums, limits),
    };
  }

  const briefAudiences: Record<string, readonly string[]> = {};
  for (const [brief, audiences] of Object.entries(record(audience['briefs'], '$.audience.briefs'))) {
    briefAudiences[brief] = stringList(audiences, `$.audience.briefs.${brief}`);
  }
  return { version, kinds: kinds as Record<Kind, KindRule>, briefAudiences };
}

export function parseContract(json: string): Contract {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ContractError('$', 'not valid JSON');
  }
  return compileContract(parsed);
}

/** Every thanks path the contract names. The only values a hidden `redirect` field may carry. */
export function thanksAllowlist(contract: Contract): readonly string[] {
  const paths = new Set<string>();
  for (const kind of KINDS) {
    const thanks = contract.kinds[kind].thanks;
    if (thanks !== null) paths.add(thanks);
  }
  return [...paths];
}

export function isKind(value: unknown): value is Kind {
  return typeof value === 'string' && (KINDS as readonly string[]).includes(value);
}
