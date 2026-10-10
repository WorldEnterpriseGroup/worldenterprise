/**
 * The forms contract as the server sees it. `docs/forms-contract.schema.json` (committed by WP-60, kept in sync with the
 * browser by tests/unit/wp-60/forms-schema.test.ts) is the single source: this module is the only place that knows its JSON
 * shape, and it turns that shape into a typed rule table. Everything else (validation, thanks paths, tests) reads the table.
 *
 * Shape consumed:
 *   { "version": 2,
 *     "kinds": { "<kind>": { "thanks": "/apply/thanks/" | null,
 *                            "audience": ["startup", ...] | [""],
 *                            "fields": { "<field>": { "rule": "R" | "O" | "-", "type": "string" | "boolean" | "email" | "url" |
 *                                                     "uuid" | "enum" | "slug" | "iso", "max": 120, "enum": ["..."] } } } } }
 *
 * A file that does not fit is a deployment error, not a request error: compileContract throws a ContractError naming the
 * path, and the Function refuses to start rather than guess.
 */

export const KINDS = ['apply', 'contact', 'newsletter', 'brief-request', 'investor-interest', 'partner-enquiry'] as const;
export type Kind = (typeof KINDS)[number];

export const AUDIENCES = ['startup', 'investor', 'partner'] as const;
export type Audience = (typeof AUDIENCES)[number];

export type Rule = 'R' | 'O' | '-';
export type FieldType = 'string' | 'boolean' | 'email' | 'url' | 'uuid' | 'enum' | 'slug' | 'iso';

const RULES: readonly string[] = ['R', 'O', '-'];
const FIELD_TYPES: readonly string[] = ['string', 'boolean', 'email', 'url', 'uuid', 'enum', 'slug', 'iso'];

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
}

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

function compileField(raw: unknown, path: string): FieldRule {
  if (!isRecord(raw)) throw new ContractError(path, 'expected an object');
  const rule = raw['rule'];
  if (typeof rule !== 'string' || !RULES.includes(rule)) throw new ContractError(`${path}.rule`, 'expected "R", "O" or "-"');
  const type = raw['type'];
  if (typeof type !== 'string' || !FIELD_TYPES.includes(type)) throw new ContractError(`${path}.type`, `expected one of ${FIELD_TYPES.join(', ')}`);
  const max = raw['max'];
  if (max !== undefined && (typeof max !== 'number' || !Number.isInteger(max) || max < 1)) throw new ContractError(`${path}.max`, 'expected a positive integer');
  const values = raw['enum'] === undefined ? [] : stringList(raw['enum'], `${path}.enum`);
  if (type === 'enum' && values.length === 0) throw new ContractError(`${path}.enum`, 'an enum field needs at least one value');
  return { rule: rule as Rule, type: type as FieldType, max: typeof max === 'number' ? max : 4000, enum: values };
}

function compileKind(raw: unknown, path: string): KindRule {
  if (!isRecord(raw)) throw new ContractError(path, 'expected an object');
  const thanks = raw['thanks'];
  if (thanks !== null && (typeof thanks !== 'string' || !thanks.startsWith('/') || thanks.startsWith('//'))) {
    throw new ContractError(`${path}.thanks`, 'expected a site-relative path or null');
  }
  const audience = stringList(raw['audience'], `${path}.audience`);
  if (audience.length === 0) throw new ContractError(`${path}.audience`, 'expected at least one value (use [""] for none)');
  const rawFields = raw['fields'];
  if (!isRecord(rawFields)) throw new ContractError(`${path}.fields`, 'expected an object');
  const fields: Record<string, FieldRule> = {};
  for (const [name, field] of Object.entries(rawFields)) fields[name] = compileField(field, `${path}.fields.${name}`);
  return { thanks, audience, fields };
}

/** Turns the parsed JSON into the rule table, or throws a ContractError that names the first problem. */
export function compileContract(raw: unknown): Contract {
  if (!isRecord(raw)) throw new ContractError('$', 'expected an object');
  const version = raw['version'];
  if (typeof version !== 'number' || !Number.isInteger(version)) throw new ContractError('$.version', 'expected an integer');
  const kinds = raw['kinds'];
  if (!isRecord(kinds)) throw new ContractError('$.kinds', 'expected an object');
  const compiled: Partial<Record<Kind, KindRule>> = {};
  for (const kind of KINDS) {
    if (!(kind in kinds)) throw new ContractError(`$.kinds.${kind}`, 'missing kind');
    compiled[kind] = compileKind(kinds[kind], `$.kinds.${kind}`);
  }
  for (const name of Object.keys(kinds)) {
    if (!(KINDS as readonly string[]).includes(name)) throw new ContractError(`$.kinds.${name}`, 'unknown kind');
  }
  return { version, kinds: compiled as Record<Kind, KindRule> };
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
