import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkOrigin, checkPublicHealth, verify } from '../iac/verify.mjs';
import { evaluateWhatIf, WhatIfFormatError } from '../iac/whatif-gate.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const IAC = join(ROOT, 'iac');
const bicepSource = (name: string): string => readFileSync(join(IAC, name), 'utf8');

type Json = Record<string, unknown>;

function findBicep(): string | null {
  const candidates = [process.env['BICEP_BIN'], join(homedir(), '.azure/bin/bicep')].filter((item): item is string => item !== undefined && item !== '');
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  const probe = spawnSync('bicep', ['--version'], { encoding: 'utf8' });
  return probe.status === 0 ? 'bicep' : null;
}

/** Every resource in an ARM template, including the ones inside nested module templates. */
function allResources(template: Json): Json[] {
  const found: Json[] = [];
  const visit = (resources: unknown): void => {
    for (const item of Array.isArray(resources) ? resources : Object.values((resources as Json | undefined) ?? {})) {
      const resource = item as Json;
      found.push(resource);
      const nested = (resource['properties'] as Json | undefined)?.['template'] as Json | undefined;
      if (nested !== undefined) visit(nested['resources']);
    }
  };
  visit(template['resources']);
  return found;
}

describe('bicep', () => {
  const bicep = findBicep();
  const required = process.env['REQUIRE_BICEP'] === '1';
  let template: Json | null = null;

  const compile = (): Json => {
    if (template !== null) return template;
    assert.ok(bicep !== null, 'no bicep binary: set BICEP_BIN or install it (REQUIRE_BICEP=1 makes this an error)');
    const work = mkdtempSync(join(tmpdir(), 'bicep-test-'));
    try {
      const out = join(work, 'main.json');
      const result = spawnSync(bicep, ['build', join(IAC, 'main.bicep'), '--outfile', out], { encoding: 'utf8' });
      assert.equal(result.status, 0, `bicep build failed:\n${result.stderr}`);
      assert.ok(!/warning/i.test(result.stderr), `bicep build warned:\n${result.stderr}`);
      template = JSON.parse(readFileSync(out, 'utf8')) as Json;
      return template;
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  };

  const skip = bicep === null && !required ? 'no bicep binary on this machine' : false;

  test('main.bicep compiles without errors or warnings', { skip }, () => {
    assert.ok(compile()['resources']);
  });

  test('the template creates a Flex Consumption Node 24 app that is https only and denies direct traffic', { skip }, () => {
    const sites = allResources(compile()).filter((resource) => resource['type'] === 'Microsoft.Web/sites');
    assert.equal(sites.length, 1);
    const properties = sites[0]?.['properties'] as Json;
    assert.equal(properties['httpsOnly'], true);
    assert.deepEqual((properties['functionAppConfig'] as Json)['runtime'], { name: 'node', version: '24' });
    const restrictions = (properties['siteConfig'] as Json)['ipSecurityRestrictions'] as Json[];
    const allow = restrictions.find((item) => item['action'] === 'Allow');
    const deny = restrictions.find((item) => item['action'] === 'Deny');
    assert.equal(allow?.['tag'], 'ServiceTag');
    assert.equal(allow?.['ipAddress'], 'AzureFrontDoor.Backend');
    assert.ok((allow?.['headers'] as Json)['x-azure-fdid']);
    assert.equal(deny?.['ipAddress'], '0.0.0.0/0');
    assert.equal(deny?.['priority'], 2147483647);
    const plan = allResources(compile()).find((resource) => resource['type'] === 'Microsoft.Web/serverfarms');
    assert.equal((plan?.['sku'] as Json)['name'], 'FC1');
  });

  test('storage has no account key, no public access, and private containers', { skip }, () => {
    const resources = allResources(compile());
    const account = resources.find((resource) => resource['type'] === 'Microsoft.Storage/storageAccounts');
    const properties = account?.['properties'] as Json;
    assert.equal(properties['allowSharedKeyAccess'], false);
    assert.equal(properties['allowBlobPublicAccess'], false);
    assert.equal(properties['minimumTlsVersion'], 'TLS1_2');
    const containers = resources.filter((resource) => resource['type'] === 'Microsoft.Storage/storageAccounts/blobServices/containers');
    assert.equal(containers.length, 3, 'state, briefs and deployments');
    for (const container of containers) assert.equal((container['properties'] as Json)['publicAccess'], 'None');
  });

  test('required inputs have no default, and the nurture sequence defaults off', { skip }, () => {
    const parameters = compile()['parameters'] as Record<string, Json>;
    for (const name of ['frontDoorId', 'dataverseUrl']) assert.ok(!('defaultValue' in (parameters[name] ?? { defaultValue: 1 })), `${name} must be supplied by the operator`);
    assert.equal(parameters['nurtureEnabled']?.['defaultValue'], false);
  });

  test('email engagement tracking is disabled and the Function has no secret value in its settings', { skip }, () => {
    const domain = allResources(compile()).find((resource) => resource['type'] === 'Microsoft.Communication/emailServices/domains');
    assert.equal((domain?.['properties'] as Json)['userEngagementTracking'], 'Disabled');
    const text = JSON.stringify(compile());
    assert.ok(text.includes('worldenterprise-intake-unsubscribe-key'));
    assert.ok(!text.includes('hmac') && !text.includes('WEBHOOK'), 'the webhook and its signing secret are gone');
    assert.ok(text.includes('@Microsoft.KeyVault(SecretUri='));
  });

  test('the notification Logic App is Consumption, enabled, and callable only by the Function identity', { skip }, () => {
    const workflows = allResources(compile()).filter((resource) => resource['type'] === 'Microsoft.Logic/workflows' && resource['existing'] !== true);
    assert.equal(workflows.length, 1);
    const properties = workflows[0]?.['properties'] as Json;
    assert.equal(properties['state'], 'Enabled');
    assert.deepEqual(workflows[0]?.['identity'], { type: 'SystemAssigned' });
    const access = properties['accessControl'] as { triggers: Json };
    assert.deepEqual(Object.keys(access.triggers), ['openAuthenticationPolicies'], 'no IP allow-list and no SAS-only access');
    const policies = ((access.triggers['openAuthenticationPolicies'] as Json)['policies'] as Record<string, { type: string; claims: { name: string; value: string }[] }>);
    const policy = Object.values(policies);
    assert.equal(policy.length, 1);
    assert.equal(policy[0]?.type, 'AAD');
    assert.deepEqual(policy[0]?.claims.map((claim) => claim.name), ['iss', 'aud', 'oid']);
    assert.match(policy[0]?.claims[0]?.value ?? '', /^\[format\('https:\/\/sts\.windows\.net\/\{0\}\/', tenant\(\)\.tenantId\)\]$/);
    assert.equal(policy[0]?.claims[1]?.value, 'https://management.core.windows.net/');
    assert.match(policy[0]?.claims[2]?.value ?? '', /callerPrincipalId/, 'the one allowed caller is the Function identity, passed in');
    assert.ok(properties['definition'], 'the definition comes from the JSON file in git');
  });

  test('the Function settings carry the trigger URL without its signature, and both identities may send mail', { skip }, () => {
    const text = JSON.stringify(compile());
    assert.ok(text.includes('"NOTIFY_LOGICAPP_URL"'));
    assert.ok(text.includes('listCallbackUrl') && text.includes('.basePath') && !text.includes('queries.sig') && !text.includes("queries['sig']"), 'the signature is never read');
    const emailOwners = allResources(compile()).filter((resource) => resource['type'] === 'Microsoft.Authorization/roleAssignments' && JSON.stringify(resource).includes('communicationEmailOwnerRoleId'));
    assert.equal(emailOwners.length, 2, 'the Function identity and the Logic App identity');
  });
});

describe('iac source', () => {
  const intake = bicepSource('intake.bicep');
  const settingNames = [...intake.matchAll(/\{ name: '([A-Z0-9_a-z]+)', value:/g)].map((match) => match[1] ?? '');

  test('every setting the service reads is set by the template', () => {
    const config = readFileSync(join(ROOT, 'src/azure/config.ts'), 'utf8');
    const read = new Set([...config.matchAll(/(?:need|origin)\('([A-Z_]+)'\)|env\['([A-Z_]+)'\]/g)].map((match) => match[1] ?? match[2] ?? ''));
    assert.ok(read.size >= 12, 'found the settings');
    assert.deepEqual([...read].filter((name) => !settingNames.includes(name)), []);
    assert.ok(settingNames.includes('AZURE_CLIENT_ID'), 'the identity is selected by AZURE_CLIENT_ID');
  });

  test('the one secret is a Key Vault reference, never an inline value, and no webhook setting remains', () => {
    const secretLines = intake.split('\n').filter((item) => /name: '(UNSUBSCRIBE_KEY|WEBHOOK_SECRET)'/.test(item));
    assert.equal(secretLines.length, 1);
    for (const line of secretLines) assert.match(line, /name: 'UNSUBSCRIBE_KEY'.*@Microsoft\.KeyVault\(SecretUri=/);
    assert.ok(!/webhook|hmac/i.test(intake + bicepSource('main.bicep') + bicepSource('parameters.example.json')));
  });

  test('the notification workflow definition is a file in git: one HTTP trigger, one Email API call with the Logic App identity, and no message body', () => {
    const definition = JSON.parse(readFileSync(join(ROOT, 'logicapps/we-intake-notify.definition.json'), 'utf8')) as {
      parameters: Record<string, unknown>;
      triggers: Record<string, { type: string; kind: string; inputs: { method: string; schema: { required: string[]; properties: Record<string, unknown> } } }>;
      actions: Record<string, { type: string; inputs: { method: string; uri: string; authentication: Record<string, string>; body: { content: { subject: string; plainText: string }; recipients: { to: { address: string }[] }; userEngagementTrackingDisabled: boolean } } }>;
    };
    assert.deepEqual(Object.keys(definition.parameters).sort(), ['acsEndpoint', 'notifyTo', 'senderAddress']);
    const [trigger] = Object.values(definition.triggers);
    assert.deepEqual([trigger?.type, trigger?.kind, trigger?.inputs.method], ['Request', 'Http', 'POST']);
    assert.deepEqual(trigger?.inputs.schema.required, ['requestId', 'kind', 'formLabel', 'name', 'recordUrl']);
    assert.ok(!('message' in (trigger?.inputs.schema.properties ?? {})) && !('email' in (trigger?.inputs.schema.properties ?? {})), 'the trigger schema has no message and no address');
    const [action] = Object.values(definition.actions);
    assert.equal(action?.type, 'Http');
    assert.match(action?.inputs.uri ?? '', /emails:send\?api-version=2023-03-31/);
    assert.deepEqual(action?.inputs.authentication, { type: 'ManagedServiceIdentity', audience: 'https://communication.azure.com/' });
    assert.equal(action?.inputs.body.userEngagementTrackingDisabled, true);
    assert.equal(action?.inputs.body.recipients.to[0]?.address, "@parameters('notifyTo')");
    for (const part of [action?.inputs.body.content.subject ?? '', action?.inputs.body.content.plainText ?? '']) assert.ok(!/triggerBody\(\)\?\['(message|email)'\]/.test(part));
    assert.match(action?.inputs.body.content.plainText ?? '', /recordUrl/);
  });

  test('notify.bicep loads that file, so the deployed workflow is the reviewed one', () => {
    assert.match(bicepSource('notify.bicep'), /definition: loadJsonContent\('\.\.\/logicapps\/we-intake-notify\.definition\.json'\)/);
  });

  test('the example parameter file names only parameters main.bicep declares, and supplies every one without a default', () => {
    const main = bicepSource('main.bicep');
    const declared = [...main.matchAll(/^param (\w+) \w+(?: = (.+))?$/gm)].map((match) => ({ name: match[1] ?? '', hasDefault: match[2] !== undefined }));
    const example = JSON.parse(bicepSource('parameters.example.json')) as { parameters: Record<string, unknown> };
    const supplied = Object.keys(example.parameters);
    assert.deepEqual(supplied.filter((name) => !declared.some((item) => item.name === name)), []);
    assert.deepEqual(declared.filter((item) => !item.hasDefault).map((item) => item.name).filter((name) => !supplied.includes(name)), []);
    assert.equal((example.parameters['nurtureEnabled'] as { value: boolean }).value, false);
  });
});

describe('what-if gate', () => {
  const change = (changeType: string, id = '/subscriptions/s/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/a', delta?: unknown[]) => ({ changeType, resourceId: id, ...(delta === undefined ? {} : { delta }) });

  test('creates, modifies and no-ops pass', () => {
    const verdict = evaluateWhatIf({ status: 'Succeeded', changes: [change('Create'), change('Modify'), change('NoChange'), change('Ignore')] });
    assert.equal(verdict.ok, true);
    assert.equal(verdict.summary, '1 Create, 1 Ignore, 1 Modify, 1 NoChange');
  });

  test('a deleting what-if is refused and names the resource, not its properties', () => {
    const verdict = evaluateWhatIf({ status: 'Succeeded', changes: [change('Create'), change('Delete', '/subscriptions/s/resourceGroups/rg/providers/Microsoft.Web/sites/fn-old')] });
    assert.equal(verdict.ok, false);
    assert.deepEqual(verdict.refusals, ['would delete Microsoft.Web/sites/fn-old']);
  });

  test('removing an access restriction in a modify is refused, even nested', () => {
    const delta = [{ path: 'properties', propertyChangeType: 'Modify', children: [{ path: 'siteConfig', propertyChangeType: 'Modify', children: [{ path: 'ipSecurityRestrictions', propertyChangeType: 'Delete' }] }] }];
    const verdict = evaluateWhatIf({ status: 'Succeeded', changes: [change('Modify', '/subscriptions/s/providers/Microsoft.Web/sites/fn', delta)] });
    assert.equal(verdict.ok, false);
    assert.match(verdict.refusals[0] ?? '', /would remove properties\.siteConfig\.ipSecurityRestrictions on Microsoft\.Web\/sites\/fn/);
  });

  test('a modify that only adds or changes properties passes', () => {
    const delta = [{ path: 'properties.siteConfig.appSettings', propertyChangeType: 'Modify' }, { path: 'tags.new', propertyChangeType: 'Create' }];
    assert.equal(evaluateWhatIf({ status: 'Succeeded', changes: [change('Modify', undefined, delta)] }).ok, true);
  });

  test('a what-if that did not succeed is refused', () => {
    assert.equal(evaluateWhatIf({ status: 'Failed', changes: [] }).ok, false);
  });

  test('something that is not a what-if report is an error, never a pass', () => {
    for (const bad of [null, 'text', {}, { changes: 'no' }, []]) assert.throws(() => evaluateWhatIf(bad), WhatIfFormatError);
  });

  test('the command line exits 1 on a deleting fixture, 0 on a clean one and 2 on garbage', () => {
    const work = mkdtempSync(join(tmpdir(), 'whatif-test-'));
    try {
      const run = (content: string): number | null => {
        const file = join(work, 'whatif.json');
        writeFileSync(file, content);
        return spawnSync(process.execPath, [join(IAC, 'whatif-gate.mjs'), file], { encoding: 'utf8' }).status;
      };
      assert.equal(run(JSON.stringify({ status: 'Succeeded', changes: [change('Delete')] })), 1);
      assert.equal(run(JSON.stringify({ status: 'Succeeded', changes: [change('Create')] })), 0);
      assert.equal(run('not json'), 2);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});

describe('post-deployment verification', () => {
  const headers = (extra: Record<string, string> = {}) => new Headers({ 'content-security-policy': "default-src 'none'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cache-control': 'no-store', ...extra });

  test('a 403 origin passes, anything else fails', () => {
    assert.deepEqual(checkOrigin({ status: 403 }), []);
    assert.equal(checkOrigin({ status: 200 }).length, 1);
  });

  test('public health must be 200, configured, and carry the headers without a cookie', () => {
    assert.deepEqual(checkPublicHealth({ status: 200, headers: headers() }, { configured: true }), []);
    assert.equal(checkPublicHealth({ status: 503, headers: headers() }, { configured: false }).length, 2);
    assert.ok(checkPublicHealth({ status: 200, headers: new Headers() }, { configured: true }).length >= 4);
    assert.ok(checkPublicHealth({ status: 200, headers: headers({ 'set-cookie': 'a=b' }) }, { configured: true }).some((item) => /cookie/.test(item)));
    assert.ok(checkPublicHealth({ status: 200, headers: headers({ 'cache-control': 'public' }) }, { configured: true }).some((item) => /no-store/.test(item)));
  });

  test('verify asks the origin and the public host, with a browser user agent, and sends nothing else', async () => {
    const seen: { url: string; agent: string | undefined; method: string | undefined; body: unknown }[] = [];
    const fetchImpl: typeof fetch = (input, init) => {
      const url = String(input);
      seen.push({ url, agent: (init?.headers as Record<string, string>)['User-Agent'], method: init?.method, body: init?.body });
      return Promise.resolve(url.includes('origin.example') ? new Response('Forbidden', { status: 403 }) : new Response(JSON.stringify({ configured: true }), { status: 200, headers: headers({ 'content-type': 'application/json' }) }));
    };
    const failures = await verify({ originHost: 'origin.example', apiHost: 'api.example', fetchImpl, log: () => undefined });
    assert.deepEqual(failures, []);
    assert.deepEqual(seen.map((item) => item.url), ['https://origin.example/api/health', 'https://api.example/api/health']);
    assert.ok(seen.every((item) => item.method === 'GET' && item.body === undefined && /Mozilla/.test(item.agent ?? '')));
  });
});

describe('repository secret scan', () => {
  const ALLOWED_NAMES = new Set([
    'worldenterprise-intake-unsubscribe-key', 'worldenterprise-intake-acs-endpoint', 'worldenterprise-intake-deploy-sp-secret', 'worldenterprise-intake-e2e-sp-secret',
  ]);
  const PATTERNS: [string, RegExp][] = [
    ['a private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ['a storage account key', /[A-Za-z0-9+/]{86}==/],
    ['a SAS signature', /[?&]sig=[A-Za-z0-9%+/=]{20,}/],
    ['a JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
    ['a connection string', /(AccountKey|SharedAccessKey|InstrumentationKey|accesskey)=[A-Za-z0-9+/=_-]{16,}/i],
    ['a secret setting with an inline value', /\b(UNSUBSCRIBE_KEY|DATAVERSE_TOKEN|INTAKE_DEPLOY_CLIENT_SECRET|INTAKE_E2E_CLIENT_SECRET)\s*[=:]\s*['"]?[A-Za-z0-9+/_-]{24,}/],
  ];

  function* files(dir: string): Generator<string> {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', 'dist', 'out', '.git'].includes(entry.name) || entry.name === 'package-lock.json') continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) yield* files(path);
      else if (/\.(ts|mjs|mts|json|md|bicep|yml|yaml|sh|txt)$/.test(entry.name)) yield path;
    }
  }

  test('no file under infra/intake holds a secret value, and only the known secret names appear', () => {
    const problems: string[] = [];
    const names = new Set<string>();
    const documents = ['docs/intake-runbook.md', 'docs/forms-privacy-facts.md', 'src/content/pages/legal/privacy.md'].map((path) => fileURLToPath(new URL(`../../../${path}`, import.meta.url)));
    for (const file of [...files(ROOT), ...documents]) {
      if (file.endsWith('iac.test.ts')) continue;
      const text = readFileSync(file, 'utf8');
      for (const [label, pattern] of PATTERNS) if (pattern.test(text)) problems.push(`${relative(ROOT, file)}: ${label}`);
      // Anything named like a secret (a key, secret, token, password or endpoint) must be one of the known names.
      for (const match of text.matchAll(/worldenterprise-intake-[a-z-]*(?:key|secret|token|password|endpoint)\b/g)) names.add(match[0]);
    }
    assert.deepEqual(problems, []);
    assert.deepEqual([...names].filter((name) => !ALLOWED_NAMES.has(name)), []);
  });

  test('the scan catches what it is meant to catch', () => {
    const planted = ['-----BEGIN RSA ' + 'PRIVATE KEY-----', `${'A'.repeat(86)}==`, '?sv=2024&sig=' + 'a'.repeat(30), `eyJ${'a'.repeat(12)}.${'b'.repeat(12)}.${'c'.repeat(12)}`, `AccountKey=${'x'.repeat(20)}`, `UNSUBSCRIBE_KEY=${'k'.repeat(30)}`];
    for (const text of planted) assert.ok(PATTERNS.some(([, pattern]) => pattern.test(text)), text.slice(0, 20));
  });
});
