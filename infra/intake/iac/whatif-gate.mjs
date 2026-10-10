/**
 * The deploy gate. Reads the JSON that `az deployment sub what-if --no-pretty-print -o json` printed and refuses to go on
 * when the deployment would delete anything or when the what-if itself did not succeed.
 *
 *   node iac/whatif-gate.mjs whatif.json
 *
 * Exit 0: safe to deploy. Exit 1: refused, with the reason and the resource ids (never property values). Exit 2: the file
 * is not a what-if result at all, which also stops the deployment: an unreadable report is not a clean one.
 *
 * What it refuses:
 *   - a resource whose changeType is Delete;
 *   - a Modify that removes (propertyChangeType Delete) an access restriction, a role assignment property or a network rule,
 *     because that is how a deny-by-default posture is quietly lifted;
 *   - a status other than Succeeded.
 * Creates, modifies and no-ops pass.
 */

import { readFileSync } from 'node:fs';

const GUARDED_PATH = /ipSecurityRestrictions|networkAcls|roleDefinitionId|principalId|allowSharedKeyAccess/i;

export class WhatIfFormatError extends Error {
  constructor(problem) {
    super(problem);
    this.name = 'WhatIfFormatError';
  }
}

function shortId(resourceId) {
  const text = String(resourceId ?? 'unknown resource');
  const at = text.indexOf('/providers/');
  return at >= 0 ? text.slice(at + '/providers/'.length) : text;
}

/** Returns `{ ok, refusals, summary }` for a parsed what-if result. Throws WhatIfFormatError for anything that is not one. */
export function evaluateWhatIf(result) {
  if (typeof result !== 'object' || result === null || !Array.isArray(result.changes)) throw new WhatIfFormatError('the report has no changes list');
  const refusals = [];
  const counts = {};
  if (typeof result.status === 'string' && result.status !== 'Succeeded') refusals.push(`the what-if status is ${result.status}`);

  for (const change of result.changes) {
    const type = String(change?.changeType ?? 'Unknown');
    counts[type] = (counts[type] ?? 0) + 1;
    if (type === 'Delete') {
      refusals.push(`would delete ${shortId(change.resourceId)}`);
      continue;
    }
    if (type === 'Modify' && Array.isArray(change.delta)) {
      const removed = flattenDelta(change.delta).filter((item) => item.change === 'Delete' && GUARDED_PATH.test(item.path));
      for (const item of removed) refusals.push(`would remove ${item.path} on ${shortId(change.resourceId)}`);
    }
  }
  const summary = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([type, count]) => `${count} ${type}`).join(', ') || 'no changes';
  return { ok: refusals.length === 0, refusals, summary };
}

function flattenDelta(delta, prefix = '') {
  const found = [];
  for (const item of delta) {
    const path = prefix === '' ? String(item?.path ?? '') : `${prefix}.${item?.path ?? ''}`;
    found.push({ path, change: item?.propertyChangeType });
    if (Array.isArray(item?.children)) found.push(...flattenDelta(item.children, path));
  }
  return found;
}

export function evaluateFile(path) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new WhatIfFormatError(`cannot read the what-if report: ${error.code ?? error.name}`);
  }
  return evaluateWhatIf(parsed);
}

if (import.meta.main) {
  const path = process.argv[2];
  if (path === undefined) {
    console.error('usage: node iac/whatif-gate.mjs <what-if.json>');
    process.exit(2);
  }
  try {
    const verdict = evaluateFile(path);
    console.log(`what-if: ${verdict.summary}`);
    if (!verdict.ok) {
      for (const refusal of verdict.refusals) console.error(`refused: ${refusal}`);
      console.error('The deployment would remove something. Deleting resources is an operator decision outside this pipeline.');
      process.exit(1);
    }
    console.log('what-if gate: no deletions');
  } catch (error) {
    if (error instanceof WhatIfFormatError) {
      console.error(`what-if gate: ${error.message}`);
      process.exit(2);
    }
    throw error;
  }
}
