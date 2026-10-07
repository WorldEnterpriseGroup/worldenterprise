#!/usr/bin/env node
// Writes the route ledger (src/data/routes.ts) as JSON so audits and Playwright, which may run on a Node without
// TypeScript support, share one source of truth. Node 24 strips types natively. Usage: node scripts/lib/export-ledger.mjs [out]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const out = resolve(process.argv[2] ?? 'reports/ledger.json');

try {
  const { routes, L2_RESERVED, MACHINE_ROUTES, STYLEGUIDE_PATH } = await import('../../src/data/routes.ts');
  const payload = {
    generatedAt: new Date().toISOString(),
    styleguide: STYLEGUIDE_PATH,
    routes: routes.map((r) => ({
      path: r.path,
      layout: r.layout,
      owner: r.owner,
      launch: r.launch,
      indexable: r.indexable,
      ...(r.source !== undefined ? { source: r.source } : {}),
      ...(r.reason !== undefined ? { reason: r.reason } : {}),
    })),
    l2: L2_RESERVED.map((r) => ({ path: r.path, launch: r.launch })),
    machine: MACHINE_ROUTES.map((m) => ({ path: m.path, launch: m.launch, generated: m.generated })),
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`export-ledger: ${payload.routes.length} routes (${payload.routes.filter((r) => r.launch).length} launched) written to ${out}`);
} catch (error) {
  console.error(`export-ledger: cannot read the route ledger: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
