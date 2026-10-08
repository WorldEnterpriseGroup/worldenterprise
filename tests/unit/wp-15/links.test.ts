import assert from 'node:assert/strict';
import test from 'node:test';
import * as linksAudit from '../../../scripts/audit-links.mjs';
import * as html from '../../../scripts/lib/html.mjs';
import { cleanSite, makeDist, page } from '../shared/fixture-dist.ts';

interface Page {
  readonly route: string;
  readonly file: string;
  readonly html: string;
}
interface Finding {
  readonly level: 'error' | 'warn';
  readonly where: string;
  readonly message: string;
}
const htmlApi = html as unknown as { readPages(root: string): Page[] };
const linksApi = linksAudit as unknown as {
  auditLinks(o: { distDir: string; pages: Page[]; ledger?: unknown; strict?: boolean }): { findings: Finding[]; orphans: string[] };
};

const row = (path: string) => ({ path, layout: 'ReferenceLayout', owner: 'WP-03', launch: true, indexable: path !== '/apply/thanks/' });
const ledger = { routes: [row('/'), row('/program/'), row('/apply/thanks/'), row('/orphan/')], l2: [], machine: [], styleguide: '/styleguide/' };

test('the form success page is a flow target, not an orphan, but a truly unlinked route still is', () => {
  const root = makeDist({
    ...cleanSite(),
    'apply/thanks/index.html': page({ body: '<h1>Thanks</h1>' }),
    'orphan/index.html': page({ body: '<h1>Orphan</h1>' }),
  });
  const result = linksApi.auditLinks({ distDir: root, pages: htmlApi.readPages(root), ledger });
  assert.deepEqual(result.orphans, ['/orphan/']);
});
