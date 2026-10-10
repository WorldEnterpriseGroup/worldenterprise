import assert from 'node:assert/strict';
import test from 'node:test';
import { AMBER, analyseRgb, blobAreas, hsv, isAmber } from '../../../scripts/photo/lib/amber.mjs';
import { MIN_IMAGE_BYTES, RouterClient, RouterError, authHeaders, classifyStatus, loadKey } from '../../../scripts/photo/lib/router.mjs';

const KEY = 'test-key-value-not-a-secret';
const GOOD_IMAGE = Buffer.alloc(MIN_IMAGE_BYTES + 1000, 7).toString('base64');

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function client(handlers: Handler[], options: { pollMs?: number; jobTimeoutMs?: number } = {}): { router: InstanceType<typeof RouterClient>; calls: { url: string; init: RequestInit }[]; waits: number[] } {
  const calls: { url: string; init: RequestInit }[] = [];
  const waits: number[] = [];
  let next = 0;
  const fetchImpl = async (url: string, init: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    const handler = handlers[Math.min(next, handlers.length - 1)];
    next += 1;
    return handler(url, init);
  };
  const router = new RouterClient({ key: KEY, baseUrl: 'http://router.test/', fetchImpl, sleep: async (ms: number) => void waits.push(ms), ...options });
  return { router, calls, waits };
}

const request = { model: 'mage_flow_turbo', prompt: 'p', size: '1024x768', seed: 7001 };

test('status classes: 503 and 429 are capacity, other 5xx transient, 4xx final', () => {
  assert.deepEqual(classifyStatus(503), { kind: 'capacity', retry: true, capacity: true });
  assert.deepEqual(classifyStatus(429), { kind: 'capacity', retry: true, capacity: true });
  assert.deepEqual(classifyStatus(500), { kind: 'server', retry: true, capacity: false });
  assert.deepEqual(classifyStatus(502), { kind: 'server', retry: true, capacity: false });
  assert.deepEqual(classifyStatus(401), { kind: 'auth', retry: false, capacity: false });
  assert.deepEqual(classifyStatus(400), { kind: 'client', retry: false, capacity: false });
});

test('both auth headers are sent, on the submit and on every poll', async () => {
  assert.deepEqual(authHeaders(KEY), { 'X-Internal-Key': KEY, Authorization: `Bearer ${KEY}` });
  const { router, calls } = client([() => json({ id: 'job1', status: 'processing' }), () => json({ status: 'completed', data: [{ b64_json: GOOD_IMAGE }] })]);
  await router.generateOnce(request);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    const headers = call.init.headers as Record<string, string>;
    assert.equal(headers['X-Internal-Key'], KEY);
    assert.equal(headers.Authorization, `Bearer ${KEY}`);
  }
  assert.equal(calls[0].url, 'http://router.test/v1/images/generations');
  assert.equal(calls[1].url, 'http://router.test/v1/images/generations/job1');
  assert.deepEqual(JSON.parse(calls[0].init.body as string), { model: 'mage_flow_turbo', prompt: 'p', size: '1024x768', n: 1, seed: 7001 });
});

test('an async job is polled while processing, queued, pending or deploying', async () => {
  const { router, waits, calls } = client(
    [() => json({ id: 'j', status: 'queued' }), () => json({ id: 'j', status: 'deploying' }), () => json({ id: 'j', status: 'processing' }), () => json({ id: 'j', status: 'completed', model: 'm', data: [{ b64_json: GOOD_IMAGE }] })],
    { pollMs: 1234 },
  );
  const out = await router.generateOnce(request);
  assert.equal(calls.length, 4);
  assert.deepEqual(waits, [1234, 1234, 1234]);
  assert.equal(out.model, 'm');
  assert.equal(out.bytes.length, MIN_IMAGE_BYTES + 1000);
});

test('a synchronous response and a url response both decode', async () => {
  const sync = client([() => json({ data: [{ b64_json: GOOD_IMAGE }] })]);
  assert.equal((await sync.router.generateOnce(request)).bytes.length, MIN_IMAGE_BYTES + 1000);
  const viaUrl = client([() => json({ data: [{ url: 'http://img.test/a.png' }] }), () => new Response(Buffer.alloc(MIN_IMAGE_BYTES + 5, 1))]);
  assert.equal((await viaUrl.router.generateOnce(request)).bytes.length, MIN_IMAGE_BYTES + 5);
});

test('a job that never finishes times out, and a failed job status is an error', async () => {
  const stuck = client([() => json({ id: 'j', status: 'processing' })], { jobTimeoutMs: -1 });
  await assert.rejects(stuck.router.generateOnce(request), (error: InstanceType<typeof RouterError>) => error.kind === 'timeout' && error.retry);
  const failed = client([() => json({ id: 'j', status: 'failed' })]);
  await assert.rejects(failed.router.generateOnce(request), /status "failed"/);
});

test('a 500 backs off 5 s then succeeds; the wait is the transient table, not the capacity one', async () => {
  const { router, waits } = client([() => json({ error: 'boom' }, 500), () => json({ data: [{ b64_json: GOOD_IMAGE }] })]);
  const retries: number[] = [];
  const out = await router.generate(request, { onRetry: ({ attempt }: { attempt: number }) => retries.push(attempt) });
  assert.ok(out.bytes.length > MIN_IMAGE_BYTES);
  assert.deepEqual(waits, [5000]);
  assert.deepEqual(retries, [1]);
});

test('a 503 waits minutes (60 s, then 180 s) because there is no GPU capacity', async () => {
  const { router, waits } = client([() => json({ error: 'no capacity' }, 503), () => json({ error: 'no capacity' }, 503), () => json({ data: [{ b64_json: GOOD_IMAGE }] })]);
  await router.generate(request);
  assert.deepEqual(waits, [60_000, 180_000]);
});

test('a blank frame (under 30 KB) is treated as a wedged router: retried on the capacity schedule', async () => {
  const blank = Buffer.alloc(3000, 1).toString('base64');
  const { router, waits } = client([() => json({ data: [{ b64_json: blank }] }), () => json({ data: [{ b64_json: GOOD_IMAGE }] })]);
  await router.generate(request);
  assert.deepEqual(waits, [60_000]);
});

test('a 400 or a 401 fails at once with no retry, and the message never contains the key', async () => {
  for (const status of [400, 401]) {
    const { router, waits, calls } = client([() => json({ error: 'bad request' }, status)]);
    await assert.rejects(router.generate(request), (error: InstanceType<typeof RouterError>) => {
      assert.equal(error.status, status);
      assert.equal(error.retry, false);
      assert.ok(!error.message.includes(KEY));
      return true;
    });
    assert.equal(calls.length, 1);
    assert.deepEqual(waits, []);
  }
});

test('retries are bounded: after the last attempt the error says how many were made', async () => {
  const { router, calls, waits } = client([() => json({ error: 'boom' }, 500)]);
  await assert.rejects(router.generate(request, { retries: 2 }), /Gave up after 3 attempts/);
  assert.equal(calls.length, 3);
  assert.deepEqual(waits, [5000, 15_000]);
});

test('an unreachable router is a retryable network error that names the port-forward', async () => {
  const router = new RouterClient({
    key: KEY,
    fetchImpl: async () => {
      throw new TypeError('fetch failed');
    },
    sleep: async () => undefined,
  });
  await assert.rejects(router.generateOnce(request), (error: InstanceType<typeof RouterError>) => error.kind === 'network' && error.retry && /port-forward/.test(error.message));
});

test('probe reports ready or the reason, and does not throw on a router error', async () => {
  const ready = client([() => json({ data: [{ b64_json: Buffer.alloc(2000, 3).toString('base64') }] })]);
  assert.deepEqual(await ready.router.probe('boogu_image_turbo'), { ready: true, reason: 'drew a 512x512 test frame' });
  const down = client([() => json({ error: 'model not ready' }, 503)]);
  const result = await down.router.probe('boogu_image_turbo');
  assert.equal(result.ready, false);
  assert.match(result.reason, /capacity 503/);
});

test('the key comes from the environment first, then Azure Key Vault by secret name; failures never print a value', async () => {
  assert.equal(await loadKey({ env: { HARDMAGIC_INTERNAL_KEY: KEY }, run: async () => assert.fail('az must not run') }), KEY);
  let seen: string[] = [];
  const fromVault = await loadKey({
    env: {},
    run: async (cmd: string, args: string[]) => {
      assert.equal(cmd, 'az');
      seen = args;
      return { stdout: `${KEY}\n` };
    },
  });
  assert.equal(fromVault, KEY);
  assert.deepEqual(seen, ['keyvault', 'secret', 'show', '--vault-name', 'omlab-secrets', '-n', 'hardmagic-internal-api-key', '--query', 'value', '-o', 'tsv']);
  await assert.rejects(
    loadKey({
      env: {},
      run: async () => {
        throw new Error('Please run az login');
      },
    }),
    (error: InstanceType<typeof RouterError>) => error.kind === 'auth' && /hardmagic-internal-api-key/.test(error.message) && /az login/.test(error.message),
  );
  await assert.rejects(loadKey({ env: {}, run: async () => ({ stdout: '\n' }) }), /Cannot load the router key/);
});

test('RouterClient refuses to start without a key', () => {
  assert.throws(() => new RouterClient({ key: '' }), /needs a key/);
});

// ---------------------------------------------------------------------------------------------------------------------------------
function frame(width: number, height: number, paint: (x: number, y: number) => [number, number, number]): Uint8Array {
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data.set(paint(x, y), (y * width + x) * 3);
  }
  return data;
}

const BLUE: [number, number, number] = [40, 80, 150];
const AMBER_RGB: [number, number, number] = [232, 163, 61];

test('amber pre-filter: amber is the 25 to 48 degree hue with strong saturation, blue is not', () => {
  assert.equal(isAmber(...AMBER_RGB), true);
  assert.equal(isAmber(...BLUE), false);
  assert.equal(isAmber(200, 190, 180), false, 'a pale beige is not saturated enough');
  assert.ok(Math.abs(hsv(...AMBER_RGB).h - 36) < 2);
  assert.equal(AMBER.hueLo, 25);
});

test('amber pre-filter: one small blob is ok; none, two, or a large area is flagged for review', () => {
  const square = (x0: number, y0: number, size: number) => (x: number, y: number): [number, number, number] => (x >= x0 && x < x0 + size && y >= y0 && y < y0 + size ? AMBER_RGB : BLUE);
  const one = analyseRgb(frame(100, 100, square(40, 40, 10)), 100, 100);
  assert.equal(one.blobs, 1);
  assert.deepEqual(one.flags, []);
  assert.deepEqual(analyseRgb(frame(100, 100, () => BLUE), 100, 100).flags, ['amber-blobs=0']);
  const two = analyseRgb(frame(100, 100, (x, y) => (x < 10 && y < 10) || (x > 80 && y > 80) ? AMBER_RGB : BLUE), 100, 100);
  assert.deepEqual(two.flags, ['amber-blobs=2']);
  const big = analyseRgb(frame(100, 100, square(10, 10, 40)), 100, 100);
  assert.match(big.flags.join(), /amber-area=16\.0%/);
  const speck = analyseRgb(frame(100, 100, (x, y) => (x === 5 && y === 5 ? AMBER_RGB : BLUE)), 100, 100);
  assert.equal(speck.blobs, 0, 'a one-pixel speck is below the blob threshold');
});

test('blobAreas counts 4-connected components', () => {
  const mask = new Uint8Array([1, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1]);
  assert.deepEqual(blobAreas(mask, 4).sort(), [1, 2, 3]);
});
