import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';

/** A Pagefind fragment as the indexer writes it: a 12-byte prefix, then JSON, all gzipped. A filler byte count is not one and cannot be decoded. */
export function pagefindFragment(content: string): Buffer {
  return gzipSync(Buffer.from(`pagefind_dcd${JSON.stringify({ url: '/x/', content, meta: { title: 'x' } })}`));
}

/** Writes a throwaway dist tree for audit tests. Keys are dist-relative paths; values are text, bytes or a byte count of filler. */
export function makeDist(files: Readonly<Record<string, string | number | Buffer>>): string {
  const root = mkdtempSync(join(tmpdir(), 'we-dist-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, typeof content === 'number' ? Buffer.alloc(content, 1) : content);
  }
  return root;
}

interface PageOptions {
  readonly title?: string;
  readonly body?: string;
  readonly head?: string;
  readonly lang?: string | null;
  readonly skipLink?: boolean;
  readonly robots?: string;
}

/** A small page that satisfies every structural audit. Options introduce one defect at a time. */
export function page(options: PageOptions = {}): string {
  const { title = 'Page | World Enterprise', body = '<h1>Heading</h1><p>Text.</p>', head = '', lang = 'en', skipLink = true, robots } = options;
  const langAttr = lang === null ? '' : ` lang="${lang}"`;
  return `<!doctype html><html${langAttr}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>${robots !== undefined ? `<meta name="robots" content="${robots}">` : ''}${head}</head><body>${skipLink ? '<a class="skip-link" href="#main">Skip to content</a>' : ''}<header><nav aria-label="Primary"><a href="/">Home</a></nav></header><main id="main" tabindex="-1">${body}</main><footer><p>Footer</p></footer></body></html>`;
}

/** A clean two-route site plus the 404 page. */
export function cleanSite(): Record<string, string | number> {
  return {
    'index.html': page({ body: '<h1>Home</h1><a href="/program/">The program</a>' }),
    'program/index.html': page({ body: '<h1>Program</h1><a href="/">Back to home</a>' }),
    '404.html': page({ body: '<h1>Not here</h1><a href="/">Home</a>', robots: 'noindex, follow' }),
  };
}

export const LEDGER = {
  routes: [
    { path: '/', layout: 'HomeLayout', owner: 'WP-01', launch: true, indexable: true },
    { path: '/program/', layout: 'HubLayout', owner: 'WP-01', launch: true, indexable: true },
    { path: '/apply/', layout: 'FormLayout', owner: 'WP-03', launch: true, indexable: true },
    { path: '/404.html', layout: 'ReferenceLayout', owner: 'WP-09', launch: true, indexable: false },
    { path: '/legal/terms/', layout: 'LegalLayout', owner: 'WP-10', launch: false, indexable: true, reason: 'awaits counsel' },
  ],
  l2: [],
  machine: [{ path: '/robots.txt', launch: true, generated: 'page' }],
  styleguide: '/styleguide/',
};
