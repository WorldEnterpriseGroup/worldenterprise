import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { DataverseClient } from '../src/azure/dataverse.ts';
import { applyDefinition, ApplyError, bootstrapEnvironment, loadDefinition } from '../dataverse/apply.ts';
import { parseDefinition, privilegeNames, privilegeNamesFor } from '../dataverse/metadata.ts';
import { FakeDataverse, type FakeOptions } from './dataverse-fake.ts';

const IDENTITY = '11111111-2222-4333-8444-555555555555';
const TOKEN = 'eyJ.fake-bearer-token-value.sig';

const DEPLOY = '22222222-3333-4444-8555-666666666666';
const E2E = '33333333-4444-4555-8666-777777777777';

function setup(options: FakeOptions = {}, overrides: { identity?: string; keyPollAttempts?: number; deploy?: string; e2e?: string } = {}) {
  const fake = new FakeDataverse(options);
  const log: string[] = [];
  const client = new DataverseClient({ baseUrl: fake.baseUrl, getToken: () => Promise.resolve(TOKEN), fetch: fake.fetch, sleep: () => Promise.resolve() });
  const run = () => applyDefinition({
    definition: loadDefinition(), client, baseUrl: fake.baseUrl, identityClientId: overrides.identity ?? IDENTITY, log: (line) => log.push(line),
    sleep: () => Promise.resolve(), keyPollAttempts: overrides.keyPollAttempts ?? 5, keyPollMs: 1,
    ...(overrides.deploy === undefined ? {} : { deployClientId: overrides.deploy }), ...(overrides.e2e === undefined ? {} : { e2eClientId: overrides.e2e }),
  });
  const bootstrap = () => bootstrapEnvironment({
    definition: loadDefinition(), client, baseUrl: fake.baseUrl, identityClientId: '', log: (line) => log.push(line), sleep: () => Promise.resolve(), keyPollMs: 1,
    ...(overrides.deploy === undefined ? {} : { deployClientId: overrides.deploy }),
  });
  return { fake, log, run, bootstrap };
}

describe('dataverse apply', () => {
  test('a fresh environment gets the publisher, solution, business unit, team, table, keys, role and application user', async () => {
    const { fake, run } = setup();
    const summary = await run();
    const definition = loadDefinition();
    const table = definition.tables[0];
    assert.ok(table);

    assert.equal(fake.publishers.length, 1);
    assert.equal(fake.solutions.length, 1);
    const unit = fake.units.find((row) => row['name'] === 'World Enterprise');
    assert.ok(unit, 'the WE business unit exists');
    assert.equal(unit['_parentbusinessunitid_value'], fake.units[0]?.['businessunitid'], 'it sits under the root unit');
    assert.equal(fake.teams.length, 1);
    assert.equal(fake.teams[0]?.['_businessunitid_value'], unit['businessunitid']);

    const entity = fake.entities.get(table.logicalName);
    assert.ok(entity);
    assert.deepEqual([...entity.attributes.keys()].sort(), table.columns.map((column) => column.schemaName).sort());
    assert.deepEqual([...entity.keys.keys()].sort(), table.keys.map((key) => key.schemaName).sort());
    assert.deepEqual([...fake.relationships.keys()].sort(), table.lookups.map((lookup) => lookup.relationship).sort());
    assert.ok(fake.entities.get('account')?.attributes.has('we_accountkey'));
    assert.ok(fake.entities.get('account')?.keys.has('account_we_accountkey'));
    assert.ok(fake.entities.get('lead')?.attributes.has('we_requestid'), 'the Lead gets its request id column');
    assert.ok(fake.entities.get('lead')?.keys.has('lead_we_requestid'), 'and the alternate key that makes a replayed create a no-op');

    const role = fake.roles.find((row) => row['name'] === definition.role.name);
    assert.equal(role?.['_businessunitid_value'], unit['businessunitid']);
    assert.equal(fake.grants.length, 1);
    assert.equal(fake.grants[0]?.privileges.length, privilegeNames(definition).length);
    assert.ok(fake.grants[0]?.privileges.every((grant) => grant['Depth'] === 'Local' && grant['BusinessUnitId'] === unit['businessunitid']));

    const user = fake.users.find((row) => row['applicationid'] === IDENTITY);
    assert.ok(user);
    assert.equal(user['_businessunitid_value'], unit['businessunitid']);
    assert.deepEqual(fake.associations, [{ userId: user['systemuserid'], roleId: role?.['roleid'] }]);
    assert.ok(summary.created.length > 30);
    assert.ok(privilegeNames(definition).includes('prvCreateLead') && privilegeNames(definition).includes('prvWriteContact'));
  });

  test('a second run creates nothing', async () => {
    const { fake, run } = setup();
    await run();
    const counts = [fake.publishers.length, fake.solutions.length, fake.units.length, fake.teams.length, fake.roles.length, fake.users.length, fake.associations.length, fake.relationships.size];
    const second = await run();
    assert.deepEqual(second.created, []);
    assert.deepEqual([fake.publishers.length, fake.solutions.length, fake.units.length, fake.teams.length, fake.roles.length, fake.users.length, fake.associations.length, fake.relationships.size], counts);
  });

  test('metadata is created inside the solution, and nothing is ever deleted', async () => {
    const { fake, run } = setup();
    await run();
    for (const request of fake.requests) {
      assert.notEqual(request.method, 'DELETE');
      assert.notEqual(request.method, 'PUT');
      if (request.method === 'POST' && /^(EntityDefinitions|RelationshipDefinitions)/.test(request.path)) {
        assert.equal(request.headers['MSCRM.SolutionUniqueName'], 'worldenterprise_intake', request.path);
      }
    }
  });

  test('the privileges are granted after the table exists and the keys are active before the role is touched', async () => {
    const { fake, run } = setup({ keyPendingPolls: 2 });
    await run();
    const index = (predicate: (path: string, method: string) => boolean) => fake.requests.findIndex((request) => predicate(request.path, request.method));
    const table = index((path, method) => method === 'POST' && path === 'EntityDefinitions');
    const publish = index((path) => path === 'PublishAllXml');
    const role = index((path, method) => method === 'POST' && path === 'roles');
    assert.ok(table >= 0 && table < publish && publish < role);
    const polls = fake.requests.filter((request) => request.method === 'GET' && request.path.includes('EntityKeyIndexStatus')).length;
    assert.ok(polls >= 3, 'waited through the pending polls');
  });

  test('a key that never becomes active is an error that says to rerun', async () => {
    const { run } = setup({ keyPendingPolls: Infinity }, { keyPollAttempts: 3 });
    await assert.rejects(run(), (error: unknown) => error instanceof ApplyError && /still building/.test(error.message));
  });

  test('a key that fails to build is an error', async () => {
    const { run } = setup({ failedKey: 'we_engagement_requestid' });
    await assert.rejects(run(), (error: unknown) => error instanceof ApplyError && /failed to build/.test(error.message));
  });

  test('a privilege the environment does not know is named in the error', async () => {
    const { run } = setup({ privileges: ['prvReadContact'] });
    await assert.rejects(run(), (error: unknown) => error instanceof ApplyError && error.step === 'privileges' && /prvCreatewe_Engagement/.test(error.message));
  });

  test('an identity that already lives in another business unit is not moved', async () => {
    const { run } = setup({ foreignApplicationUser: IDENTITY });
    // The fake only flags a user that is created through it; seed one by running once, then check the guard on the rerun.
    await assert.rejects(async () => {
      await run();
      await run();
    }, (error: unknown) => error instanceof ApplyError && /another business unit/.test(error.message));
  });

  test('an http error is reported with its step and message, never the token', async () => {
    const { fake, log, run } = setup({ failOn: { method: 'POST', prefix: 'roles', status: 403, message: 'principal lacks privilege' } });
    await assert.rejects(run(), (error: unknown) => error instanceof ApplyError && error.step === 'role' && /403 principal lacks privilege/.test(error.message));
    const everything = JSON.stringify([log, fake.requests.map((request) => request.path), fake.requests.map((request) => request.body)]);
    assert.ok(!everything.includes(TOKEN), 'the bearer token appears in no log line, path or body');
  });

  test('the log names objects and counts, and carries no token', async () => {
    const { log, run } = setup();
    await run();
    assert.ok(log.length > 0);
    assert.ok(log.every((line) => !line.includes(TOKEN) && !/bearer/i.test(line)));
  });

  test('a client id that is not a GUID is refused before anything is created for the user', async () => {
    const { run } = setup({}, { identity: 'not-a-guid' });
    await assert.rejects(run(), (error: unknown) => error instanceof ApplyError && error.step === 'application user');
  });

  test('the bootstrap creates the business unit and the pipeline identity with the platform role, and nothing else', async () => {
    const { fake, run, bootstrap } = setup({}, { deploy: DEPLOY });
    await bootstrap();
    const unit = fake.units.find((row) => row['name'] === 'World Enterprise');
    assert.ok(unit);
    const user = fake.users.find((row) => row['applicationid'] === DEPLOY);
    assert.equal(user?.['_businessunitid_value'], unit['businessunitid']);
    const admin = fake.roles.find((row) => row['name'] === 'System Administrator' && row['_businessunitid_value'] === unit['businessunitid']);
    assert.deepEqual(fake.associations, [{ userId: user?.['systemuserid'], roleId: admin?.['roleid'] }]);
    assert.deepEqual([fake.publishers.length, fake.teams.length, fake.grants.length, fake.entities.size], [0, 0, 0, 1], 'only the unit, the user and its role');

    // The pipeline's own run then finds both and adds the rest, without a second user or a second unit.
    await run();
    assert.equal(fake.units.filter((row) => row['name'] === 'World Enterprise').length, 1);
    assert.equal(fake.users.filter((row) => row['applicationid'] === DEPLOY).length, 1, 'the bootstrap user is kept, not duplicated');
  });

  test('a bootstrap without the pipeline client id is refused', async () => {
    const { bootstrap } = setup();
    await assert.rejects(bootstrap(), (error: unknown) => error instanceof ApplyError && error.step === 'inputs');
  });

  test('the pipeline run ensures the deploy user and the e2e identity, and a rerun changes nothing', async () => {
    const { fake, run } = setup({}, { deploy: DEPLOY, e2e: E2E });
    await run();
    const definition = loadDefinition();
    assert.ok(definition.e2e);
    const e2eRole = fake.roles.find((row) => row['name'] === definition.e2e?.role.name);
    assert.ok(e2eRole);
    const grant = fake.grants.find((item) => item.roleId === e2eRole['roleid']);
    assert.equal(grant?.privileges.length, privilegeNamesFor(definition.e2e.role).length);
    assert.ok(grant?.privileges.every((item) => item['Depth'] === 'Local'));
    const e2eUser = fake.users.find((row) => row['applicationid'] === E2E);
    assert.ok(e2eUser);
    assert.deepEqual(fake.associations.filter((item) => item.userId === e2eUser['systemuserid']), [{ userId: e2eUser['systemuserid'], roleId: e2eRole['roleid'] }]);
    assert.ok(fake.users.some((row) => row['applicationid'] === DEPLOY));
    const counts = [fake.roles.length, fake.users.length, fake.associations.length];
    const second = await run();
    assert.deepEqual(second.created, []);
    assert.deepEqual([fake.roles.length, fake.users.length, fake.associations.length], counts);
  });

  test('the e2e privileges are read and delete only, and it never creates, writes or assigns', () => {
    const definition = loadDefinition();
    const names = privilegeNamesFor(definition.e2e?.role ?? { name: '', depth: 'Local', privileges: [] });
    assert.deepEqual(names.slice().sort(), ['prvDeleteContact', 'prvDeleteLead', 'prvDeletewe_Engagement', 'prvReadContact', 'prvReadLead', 'prvReadwe_Engagement']);
    const widened = JSON.parse(JSON.stringify(definition)) as { e2e: { role: { privileges: { actions: string[] }[] } } };
    widened.e2e.role.privileges[0]?.actions.push('Write');
    assert.throws(() => parseDefinition(JSON.stringify(widened)), /only Read and Delete/);
  });

  test('before the first deploy the Function identity is skipped, and the rest is applied', async () => {
    const { fake, log, run } = setup({}, { identity: '', e2e: E2E });
    await run();
    assert.equal(fake.users.length, 1, 'only the e2e application user');
    assert.ok(log.some((line) => /skipped application user for the intake identity/.test(line)));
  });
});
