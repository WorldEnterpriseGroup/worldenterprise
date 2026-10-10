/**
 * Function entry point. Registers the routes and the two timers, and nothing else: every decision lives in `service/**`.
 *
 *   POST|OPTIONS /api/intake        all six forms
 *   POST|OPTIONS /api/newsletter    the newsletter form (the build's PUBLIC_WE_NEWSLETTER_API_URL points here)
 *   GET|POST     /api/unsubscribe   confirmation page and unsubscribe
 *   GET|HEAD     /api/health        configuration status, calls nothing downstream
 *   timers       retry sweep every 5 minutes; nurture sweep daily, a no-op unless NURTURE_ENABLED is true
 *
 * Not configured (no app settings yet) is a state, not a crash: the routes answer 503 and `health` says `unconfigured`, so
 * a deployed but unprovisioned Function is inert and says so.
 */

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext, type Timer } from '@azure/functions';

import { createLogger, errorCode, formatLine, type Logger } from './logic/log.ts';
import { emptyResult, jsonResult, type HttpResult } from './logic/http.ts';
import type { Deps } from './service/deps.ts';
import { handleIntake } from './service/intake.ts';
import { loadContract } from './service/load-contract.ts';
import { nurtureSweep, retrySweep } from './service/sweeps.ts';
import { handleHealth, handleUnsubscribe } from './service/unsubscribe.ts';
import { readConfig } from './azure/config.ts';
import { toRequestLike, toResponse } from './azure/http-adapter.ts';
import { buildDeps } from './azure/wiring.ts';

type Runtime =
  | { readonly configured: true; readonly deps: Deps }
  | { readonly configured: false; readonly contractVersion: number };

const bootLog: Logger = createLogger({ write: (level, line) => (level === 'error' ? console.error(line) : level === 'warn' ? console.warn(line) : console.info(line)) });

let runtime: Runtime | null = null;

function boot(): Runtime {
  if (runtime !== null) return runtime;
  const result = readConfig(process.env);
  if (!result.ok) {
    bootLog.warn('not_configured', { count: result.problems.length, reason: result.problems.join(',') });
    runtime = { configured: false, contractVersion: 0 };
    return runtime;
  }
  try {
    runtime = { configured: true, deps: buildDeps(result.config, loadContract()) };
  } catch (error) {
    // A missing or malformed contract file is a packaging fault, reported by code only.
    bootLog.error('boot_failed', { code: errorCode(error) });
    runtime = { configured: false, contractVersion: 0 };
  }
  return runtime;
}

const UNAVAILABLE: HttpResult = jsonResult(503, { ok: false, error: 'unavailable' }, { 'Retry-After': '60' });

/** Wraps a handler so an unexpected throw becomes a bare 500 and a log line that carries an error code and nothing else. */
function guard(route: string, run: (request: HttpRequest, current: Runtime) => Promise<HttpResult> | HttpResult) {
  return async (request: HttpRequest): Promise<HttpResponseInit> => {
    try {
      return toResponse(await run(request, boot()));
    } catch (error) {
      bootLog.error('unhandled', { route, code: errorCode(error) });
      return toResponse(emptyResult(500));
    }
  };
}

app.http('intake', {
  methods: ['POST', 'OPTIONS', 'GET'],
  authLevel: 'anonymous',
  route: 'intake',
  handler: guard('intake', (request, current) => (current.configured ? handleIntake(current.deps, toRequestLike(request)) : UNAVAILABLE)),
});

app.http('newsletter', {
  methods: ['POST', 'OPTIONS', 'GET'],
  authLevel: 'anonymous',
  route: 'newsletter',
  handler: guard('newsletter', (request, current) => (current.configured ? handleIntake(current.deps, toRequestLike(request), 'newsletter') : UNAVAILABLE)),
});

app.http('unsubscribe', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'unsubscribe',
  handler: guard('unsubscribe', (request, current) => (current.configured ? handleUnsubscribe(current.deps, toRequestLike(request)) : UNAVAILABLE)),
});

app.http('health', {
  methods: ['GET', 'HEAD'],
  authLevel: 'anonymous',
  route: 'health',
  handler: guard('health', (request, current) =>
    handleHealth(
      current.configured
        ? { configured: true, contractVersion: current.deps.contract.version, nurture: current.deps.settings.nurtureEnabled }
        : { configured: false, contractVersion: current.contractVersion, nurture: false },
      toRequestLike(request),
    )),
});

function timer(name: string, schedule: string, run: (deps: Deps) => Promise<unknown>): void {
  app.timer(name, {
    schedule,
    runOnStartup: false,
    handler: async (_timer: Timer, _context: InvocationContext): Promise<void> => {
      const current = boot();
      if (!current.configured) {
        console.info(formatLine('timer_skipped', { job: name, reason: 'not_configured' }));
        return;
      }
      try {
        await run(current.deps);
      } catch (error) {
        current.deps.log.error('timer_failed', { job: name, code: errorCode(error) });
      }
    },
  });
}

timer('retrySweep', '0 */5 * * * *', retrySweep);
timer('nurtureSweep', '0 0 14 * * *', nurtureSweep);
