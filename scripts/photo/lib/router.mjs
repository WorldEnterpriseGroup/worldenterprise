// GPU Router client: one image per call, async polling, dual auth headers, classified errors and backoff.
// Port of .plan/photo/gen.py. `fetch` and `sleep` are injectable so the retry logic is unit-tested without a network.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * @param {string} cmd
 * @param {string[]} args
 * @returns {Promise<{ stdout: string }>}
 */
async function runCommand(cmd, args) {
  const { stdout } = await execFileAsync(cmd, args, { timeout: 60_000 });
  return { stdout };
}

export const DEFAULT_ROUTER_URL = 'http://localhost:18200';
export const KEY_VAULT = 'omlab-secrets';
export const KEY_SECRET_NAME = 'hardmagic-internal-api-key';

/** A "success" frame smaller than this is the blank 3 KB image the router returned while wedged (art direction 5.1). */
export const MIN_IMAGE_BYTES = 30 * 1024;

const PENDING_STATUSES = new Set(['processing', 'queued', 'pending', 'deploying']);
const DONE_STATUSES = new Set([undefined, null, 'completed', 'succeeded']);

/** Failure classes. `retry` says whether the same request is worth sending again; `capacity` means wait minutes, not seconds. */
export class RouterError extends Error {
  constructor(message, { kind, status = null, retry = false, capacity = false, cause } = {}) {
    super(message, { cause });
    this.name = 'RouterError';
    this.kind = kind;
    this.status = status;
    this.retry = retry;
    this.capacity = capacity;
  }
}

/** HTTP status to failure class. 503 is "no GPU capacity" (minutes); 429 and the other 5xx are transient. */
export function classifyStatus(status) {
  if (status === 503 || status === 429) return { kind: 'capacity', retry: true, capacity: true };
  if (status >= 500) return { kind: 'server', retry: true, capacity: false };
  if (status === 401 || status === 403) return { kind: 'auth', retry: false, capacity: false };
  return { kind: 'client', retry: false, capacity: false };
}

/**
 * The router key. `HARDMAGIC_INTERNAL_KEY` wins; otherwise it is read from Azure Key Vault by secret NAME. The value is returned to
 * the caller and never logged; errors name the vault and secret only.
 * @param {{ env?: Record<string, string | undefined>, run?: (cmd: string, args: string[]) => Promise<{ stdout: string }> }} [options] `run` is injectable for tests
 * @returns {Promise<string>}
 */
export async function loadKey({ env = process.env, run = runCommand } = {}) {
  if (env.HARDMAGIC_INTERNAL_KEY) return env.HARDMAGIC_INTERNAL_KEY;
  try {
    const { stdout } = await run('az', ['keyvault', 'secret', 'show', '--vault-name', KEY_VAULT, '-n', KEY_SECRET_NAME, '--query', 'value', '-o', 'tsv']);
    const key = stdout.trim();
    if (key === '') throw new Error('empty value');
    return key;
  } catch (error) {
    throw new RouterError(
      `Cannot load the router key: set HARDMAGIC_INTERNAL_KEY or sign in with \`az login\` (secret ${KEY_SECRET_NAME} in vault ${KEY_VAULT}). ${error instanceof Error ? error.message.split('\n')[0] : ''}`.trim(),
      { kind: 'auth', cause: error },
    );
  }
}

/** Both header forms: the router accepts either, and a proxy in front of it may strip one. */
export function authHeaders(key) {
  return { 'X-Internal-Key': key, Authorization: `Bearer ${key}` };
}

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class RouterClient {
  /**
   * @param {object} options
   * @param {string} options.key router key
   * @param {string} [options.baseUrl]
   * @param {(url: string, init: RequestInit) => Promise<Response>} [options.fetchImpl]
   * @param {(ms: number) => Promise<void>} [options.sleep]
   * @param {number} [options.pollMs] delay between polls of an async job
   * @param {number} [options.jobTimeoutMs] give up on one job after this long
   */
  constructor({ key, baseUrl = process.env.GPU_ROUTER_URL ?? DEFAULT_ROUTER_URL, fetchImpl = fetch, sleep = realSleep, pollMs = 4000, jobTimeoutMs = 600_000 }) {
    if (!key) throw new RouterError('RouterClient needs a key.', { kind: 'auth' });
    this.key = key;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
    this.sleep = sleep;
    this.pollMs = pollMs;
    this.jobTimeoutMs = jobTimeoutMs;
  }

  async #request(path, { method = 'GET', body, timeoutMs = 120_000 } = {}) {
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: { ...authHeaders(this.key), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new RouterError(`Router unreachable at ${this.baseUrl} (is the port-forward up?): ${error instanceof Error ? error.message : String(error)}`, { kind: 'network', retry: true, cause: error });
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      throw new RouterError(`Router answered HTTP ${response.status} for ${method} ${path}: ${detail}`, { status: response.status, ...classifyStatus(response.status) });
    }
    try {
      return await response.json();
    } catch (error) {
      throw new RouterError(`Router sent invalid JSON for ${method} ${path}`, { kind: 'server', status: response.status, retry: true, cause: error });
    }
  }

  async #download(url) {
    let response;
    try {
      response = await this.fetchImpl(url, { signal: AbortSignal.timeout(120_000) });
    } catch (error) {
      throw new RouterError(`Fetching the image URL failed: ${error instanceof Error ? error.message : String(error)}`, { kind: 'network', retry: true, cause: error });
    }
    if (!response.ok) throw new RouterError(`Image URL answered HTTP ${response.status}`, { status: response.status, ...classifyStatus(response.status) });
    return Buffer.from(await response.arrayBuffer());
  }

  /** One image, no retries: submit, poll while the job is pending, decode. Returns `{ bytes, model }`. */
  async generateOnce({ model, prompt, size, seed }, { minBytes = MIN_IMAGE_BYTES } = {}) {
    let payload = await this.#request('/v1/images/generations', { method: 'POST', body: { model, prompt, size, n: 1, seed } });
    const deadline = Date.now() + this.jobTimeoutMs;
    let items = payload.data ?? [];
    while (items.length === 0 && PENDING_STATUSES.has(payload.status) && payload.id) {
      if (Date.now() > deadline) throw new RouterError(`Job ${payload.id} timed out after ${Math.round(this.jobTimeoutMs / 1000)} s`, { kind: 'timeout', retry: true });
      await this.sleep(this.pollMs);
      payload = await this.#request(`/v1/images/generations/${encodeURIComponent(payload.id)}`, { timeoutMs: 60_000 });
      items = payload.data ?? [];
    }
    if (items.length === 0) {
      if (!DONE_STATUSES.has(payload.status)) {
        throw new RouterError(`Job ended with status "${payload.status}": ${JSON.stringify(payload).slice(0, 300)}`, { kind: 'server', retry: true });
      }
      throw new RouterError(`No image in the response (keys: ${Object.keys(payload).join(', ')})`, { kind: 'server', retry: true });
    }
    const [item] = items;
    let bytes;
    if (item.b64_json) bytes = Buffer.from(item.b64_json, 'base64');
    else if (item.url) bytes = await this.#download(item.url);
    else throw new RouterError(`Image item has neither b64_json nor url (keys: ${Object.keys(item).join(', ')})`, { kind: 'server', retry: true });
    if (bytes.length < minBytes) {
      throw new RouterError(`Image is only ${bytes.length} bytes, which is the blank frame a wedged router returns`, { kind: 'blank', retry: true, capacity: true });
    }
    return { bytes, model: payload.model ?? model };
  }

  /**
   * One image with retry. Transient failures (5xx, network, blank frame) back off 5, 15, 45 s; capacity failures (503, 429) wait
   * minutes (60, 180, 300 s). Client and auth errors fail at once. `onRetry({ attempt, error, waitMs })` is called before each wait.
   * @param {{ model: string, prompt: string, size: string, seed: number }} request
   * @param {{ retries?: number, backoffMs?: number[], capacityBackoffMs?: number[], onRetry?: (info: { attempt: number, error: RouterError, waitMs: number }) => unknown }} [options]
   */
  async generate(request, { retries = 4, backoffMs = [5_000, 15_000, 45_000, 90_000], capacityBackoffMs = [60_000, 180_000, 300_000, 300_000], onRetry = () => {} } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await this.generateOnce(request);
      } catch (error) {
        if (!(error instanceof RouterError) || !error.retry) throw error;
        lastError = error;
        if (attempt === retries) break;
        const table = error.capacity ? capacityBackoffMs : backoffMs;
        const waitMs = table[Math.min(attempt, table.length - 1)];
        onRetry({ attempt: attempt + 1, error, waitMs });
        await this.sleep(waitMs);
      }
    }
    throw new RouterError(`Gave up after ${retries + 1} attempts: ${lastError.message}`, { kind: lastError.kind, status: lastError.status, retry: false, capacity: lastError.capacity, cause: lastError });
  }

  /**
   * Is the model serving? There is no documented readiness endpoint, so ask for the smallest image the router will draw. `ready`
   * is false with a reason (capacity, unknown model, unreachable) rather than throwing, so a caller can print and stop.
   */
  async probe(model) {
    try {
      await this.generateOnce({ model, prompt: 'A single matte blue six-sided hexagon tile on a plain pale surface, soft light.', size: '512x512', seed: 1 }, { minBytes: 1024 });
      return { ready: true, reason: 'drew a 512x512 test frame' };
    } catch (error) {
      if (error instanceof RouterError && error.kind === 'blank') return { ready: false, reason: error.message };
      if (error instanceof RouterError) return { ready: false, reason: `${error.kind}${error.status ? ` ${error.status}` : ''}: ${error.message}` };
      throw error;
    }
  }
}
