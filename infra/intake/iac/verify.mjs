/**
 * Post-deployment checks, run by the manual `intake:verify` job once the operator has provisioned the Front Door route.
 *
 *   ORIGIN_HOST=<function default host> API_HOST=intake.worldenterprise.org node iac/verify.mjs
 *
 * 1. The direct Function host refuses traffic that did not come through Front Door: GET https://ORIGIN_HOST/api/health is 403.
 * 2. The public host answers GET /api/health with 200, `configured: true`, and the security headers every response carries.
 *
 * The WAF's bad-bot rule blocks the default curl and node user agents, so the public check sends a browser-like one. Nothing
 * here sends a request body, a credential or a cookie, and only status codes and header names are printed.
 */

import { pathToFileURL } from 'node:url';

const REQUIRED_HEADERS = ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'cache-control'];
const BROWSER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

/** Pure checks over a fetched response, so tests need no network. Returns the list of failures. */
export function checkOrigin(response) {
  return response.status === 403 ? [] : [`the direct origin answered ${response.status}, expected 403`];
}

export function checkPublicHealth(response, body) {
  const failures = [];
  if (response.status !== 200) failures.push(`public health answered ${response.status}, expected 200`);
  if (body?.configured !== true) failures.push('public health does not report configured: true');
  for (const name of REQUIRED_HEADERS) if (!response.headers.has(name)) failures.push(`public health lacks the ${name} header`);
  if (response.headers.get('x-content-type-options') !== 'nosniff') failures.push('x-content-type-options is not nosniff');
  if (response.headers.get('cache-control')?.includes('no-store') !== true) failures.push('cache-control is not no-store');
  if (response.headers.has('set-cookie')) failures.push('public health sets a cookie');
  return failures;
}

async function get(url, fetchImpl) {
  return fetchImpl(url, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': BROWSER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
}

export async function verify({ originHost, apiHost, fetchImpl = fetch, log = console.log }) {
  const failures = [];
  const origin = await get(`https://${originHost}/api/health`, fetchImpl);
  failures.push(...checkOrigin(origin));
  log(`origin health: ${origin.status}`);

  const pub = await get(`https://${apiHost}/api/health`, fetchImpl);
  let body = null;
  try {
    body = await pub.json();
  } catch {
    failures.push('public health did not return JSON');
  }
  failures.push(...checkPublicHealth(pub, body));
  log(`public health: ${pub.status}`);
  return failures;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const originHost = process.env.ORIGIN_HOST ?? '';
  const apiHost = process.env.API_HOST ?? '';
  if (!/^[a-z0-9.-]+$/i.test(originHost) || !/^[a-z0-9.-]+$/i.test(apiHost)) {
    console.error('verify: ORIGIN_HOST and API_HOST must be set to host names');
    process.exit(2);
  }
  try {
    const failures = await verify({ originHost, apiHost });
    for (const failure of failures) console.error(`verify failed: ${failure}`);
    if (failures.length > 0) process.exit(1);
    console.log('verify: the origin refuses direct traffic and public health is configured with the security headers');
  } catch (error) {
    console.error(`verify: request failed (${error.name})`);
    process.exit(1);
  }
}
