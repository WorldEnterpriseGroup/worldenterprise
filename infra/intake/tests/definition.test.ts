import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { loadDefinition } from '../dataverse/apply.ts';
import { attributeBody, parseDefinition } from '../dataverse/metadata.ts';
import { ACCOUNT_KEY_COLUMN, ENGAGEMENT_SELECT, ENTITY_SET, LEAD_KEY_COLUMN, NAV_ACCOUNT, NAV_CONTACT, NAV_LEAD, REVIEW, STATUS } from '../src/logic/mapping.ts';

const definition = loadDefinition();
const table = definition.tables[0];
if (table === undefined) throw new Error('definition has no table');
const columns = new Map(table.columns.map((column) => [column.schemaName, column]));

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

/** Every `we_` identifier the code writes to or reads from the engagement table. */
function usedColumns(text: string): Set<string> {
  return new Set([...text.matchAll(/\bwe_[a-z_]+\b/g)].map((match) => match[0]).filter((name) => !name.startsWith('we_engagement')));
}

describe('dataverse definition', () => {
  test('parses, and every body it would send builds', () => {
    for (const column of [...table.columns, ...definition.extensions.flatMap((extension) => extension.columns)]) assert.ok(attributeBody(column));
  });

  test('the entity set and navigation properties are the ones the service writes', () => {
    assert.equal(table.entitySetName, ENTITY_SET);
    assert.deepEqual(table.lookups.map((lookup) => lookup.schemaName).sort(), [NAV_ACCOUNT, NAV_CONTACT, NAV_LEAD].sort());
    assert.equal(definition.extensions[0]?.columns[0]?.schemaName, ACCOUNT_KEY_COLUMN);
    assert.deepEqual(definition.extensions[0]?.keys[0]?.attributes, [ACCOUNT_KEY_COLUMN]);
  });

  test('the Lead carries the request id as an alternate key, which is what makes a replayed create a no-op', () => {
    const lead = definition.extensions.find((extension) => extension.table === 'lead');
    assert.ok(lead);
    assert.deepEqual(lead.columns.map((column) => column.schemaName), [LEAD_KEY_COLUMN]);
    assert.deepEqual(lead.keys.map((key) => key.attributes), [[LEAD_KEY_COLUMN]]);
  });

  test('the role can create, read and update Leads and Contacts and nothing it does not need', () => {
    const granted = new Map(definition.role.privileges.map((grant) => [grant.table, grant.actions]));
    for (const tableName of ['Lead', 'Contact']) {
      for (const action of ['Create', 'Read', 'Write']) assert.ok(granted.get(tableName)?.includes(action), `${tableName} ${action}`);
    }
    // AsyncOperation (System Jobs) is Read only: Dataverse checks it when an Account or Lead is created (#119).
    assert.deepEqual(granted.get('AsyncOperation'), ['Read']);
    assert.deepEqual([...granted.keys()].sort(), ['Account', 'AsyncOperation', 'Contact', 'Lead', 'we_Engagement']);
  });

  test('every column the adapters and mapping use exists in the definition', () => {
    const used = new Set([...usedColumns(source('../src/logic/mapping.ts')), ...usedColumns(source('../src/azure/dataverse.ts')), ...ENGAGEMENT_SELECT.filter((name) => name.startsWith('we_'))]);
    used.delete(ACCOUNT_KEY_COLUMN);
    used.delete('we_contact');
    used.delete('we_account');
    used.delete('we_lead');
    used.delete('we_engagementid');
    const known = new Set([...columns.keys(), table.primaryName.schemaName]);
    const unknown = [...used].filter((name) => !known.has(name));
    assert.deepEqual(unknown, []);
  });

  test('every column in the definition is used by the service, so none is dead weight', () => {
    const used = new Set([...usedColumns(source('../src/logic/mapping.ts')), ...usedColumns(source('../src/azure/dataverse.ts'))]);
    assert.deepEqual([...columns.keys()].filter((name) => !used.has(name)), []);
  });

  test('picklist options equal the status and review maps', () => {
    const options = (name: string) => Object.fromEntries((columns.get(name)?.options ?? []).map((option) => [option.name, option.value]));
    assert.deepEqual(options('we_status'), { ...STATUS });
    assert.deepEqual(options('we_review'), { ...REVIEW });
  });

  test('the alternate keys are the two the service looks rows up by', () => {
    assert.deepEqual(table.keys.map((key) => key.attributes), [['we_requestid'], ['we_tokenhash']]);
  });

  test('column lengths hold the contract limits', () => {
    const lengths: Record<string, number> = { we_requestid: 36, we_email: 254, we_message: 4000, we_focus: 1000, we_offer: 1500, we_submittername: 200, we_company: 200 };
    for (const [name, minimum] of Object.entries(lengths)) assert.ok((columns.get(name)?.maxLength ?? 0) >= minimum, name);
  });

  test('the role grants only what the service needs and never delete or assign', () => {
    const actions = definition.role.privileges.flatMap((grant) => grant.actions);
    assert.ok(!actions.includes('Delete') && !actions.includes('Assign') && !actions.includes('Share'));
    assert.equal(definition.role.depth, 'Local');
  });

  test('a malformed definition is refused', () => {
    assert.throws(() => parseDefinition('not json'), /not valid JSON/);
    const broken = JSON.parse(readFileSync(new URL('../dataverse/definition.json', import.meta.url), 'utf8')) as { tables: { columns: { type: string }[] }[] };
    const first = broken.tables[0]?.columns[0];
    assert.ok(first);
    first.type = 'string';
    delete (first as { maxLength?: number }).maxLength;
    assert.throws(() => parseDefinition(JSON.stringify(broken)), /needs a maxLength/);
  });
});
