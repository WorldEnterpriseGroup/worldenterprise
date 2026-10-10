import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';

import { parseRegistry } from '../src/azure/blob.ts';
import { blobPaths, BriefError, buildRegistry, parseBrief, renderHtml } from '../render/brief.mjs';
import { findChromium, printArgs } from '../render/chromium.mjs';
import { escapeHtml, renderInline, renderMarkdown } from '../render/markdown.mjs';
import { publish, uploadPlan, type AzResult } from '../render/publish.mjs';

const FIXTURE = readFileSync(new URL('../render/fixtures/self-test-brief.md', import.meta.url), 'utf8');
const SENTINEL = 'A renderer that cannot reproduce this exact sentence in both the HTML and the PDF has changed the text of the brief.';

function brief(overrides: Record<string, string> = {}, body = `Opening paragraph.\n\n${SENTINEL}\n`): string {
  const fields: Record<string, string> = { id: 'funding-paths', title: 'Funding paths', version: '"1.0"', updated: '2026-10-20', sentinel: `"${SENTINEL}"`, ...overrides };
  return `---\n${Object.entries(fields).map(([key, value]) => `${key}: ${value}`).join('\n')}\n---\n${body}`;
}

describe('markdown', () => {
  test('raw html is escaped and never passed through', () => {
    assert.equal(renderMarkdown('<img src=x onerror=alert(1)>'), '<p>&lt;img src=x onerror=alert(1)&gt;</p>');
    assert.equal(renderInline('a & b < c'), 'a &amp; b &lt; c');
    assert.equal(escapeHtml(`"'`), '&quot;&#39;');
  });

  test('a link with a scheme other than http, https or mailto is rendered as text', () => {
    assert.equal(renderInline('[x](javascript:alert(1))'), 'x');
    assert.equal(renderInline('[x](data:text/html,hi)'), 'x');
    assert.equal(renderInline('[x](https://example.org/a?b=1&c=2)'), '<a href="https://example.org/a?b=1&amp;c=2">x</a>');
    assert.equal(renderInline('[w](https://en.example.org/wiki/Name_(disambiguation))'), '<a href="https://en.example.org/wiki/Name_(disambiguation)">w</a>');
    assert.equal(renderInline('[mail](mailto:a@example.org)'), '<a href="mailto:a@example.org">mail</a>');
  });

  test('emphasis, code and underscores inside words', () => {
    assert.equal(renderInline('**b** and *i* and `c*d*`'), '<strong>b</strong> and <em>i</em> and <code>c*d*</code>');
    assert.equal(renderInline('snake_case_name stays'), 'snake_case_name stays');
  });

  test('the body never renders above h2, and headings get unique ids', () => {
    const headings: { id: string; text: string }[] = [];
    const html = renderMarkdown('# One\n\n## Same\n\n## Same\n\n### Deeper', { headings });
    assert.ok(html.includes('<h2 id="one">One</h2>'));
    assert.ok(html.includes('<h2 id="same">Same</h2>') && html.includes('<h2 id="same-2">Same</h2>'));
    assert.ok(html.includes('<h3 id="deeper">'));
    assert.deepEqual(headings.map((heading) => heading.id), ['one', 'same', 'same-2']);
  });

  test('lists nest, and an ordered list stays ordered', () => {
    assert.equal(renderMarkdown('- a\n  - b\n- c'), '<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>');
    assert.equal(renderMarkdown('1. a\n2. b'), '<ol><li>a</li><li>b</li></ol>');
  });

  test('tables, quotes, rules and fences', () => {
    assert.ok(renderMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |').includes('<th>a</th><th>b</th>'));
    assert.equal(renderMarkdown('> quoted'), '<blockquote><p>quoted</p></blockquote>');
    assert.equal(renderMarkdown('---'), '<hr>');
    assert.equal(renderMarkdown('```\n<b>\n```'), '<pre><code>&lt;b&gt;</code></pre>');
  });
});

describe('brief parsing', () => {
  test('the fixture parses with both source styles', () => {
    const parsed = parseBrief('self-test-brief.md', FIXTURE);
    assert.equal(parsed.version, '1.0');
    assert.deepEqual(parsed.sources.map((source) => source.id), ['s1', 's2']);
    assert.equal(parsed.sources[0]?.title, 'Example source, with a comma in the title');
    assert.equal(parsed.sources[1]?.url, 'https://example.org/other');
  });

  test('a trailing comment after a quoted value is not part of it', () => {
    const parsed = parseBrief('funding-paths.md', brief({ id: 'funding-paths   # equals the file name', title: '"Funding paths"   # shown' }));
    assert.equal(parsed.id, 'funding-paths');
    assert.equal(parsed.title, 'Funding paths');
  });

  test('every rule that guards the registry and the gate is enforced', () => {
    const cases: [string, string, RegExp][] = [
      ['funding-paths.md', brief({ id: 'other' }), /must equal the file name/],
      ['funding-paths.md', brief({ title: '""' }), /title is required/],
      ['funding-paths.md', brief({ version: 'two' }), /version must be numeric/],
      ['funding-paths.md', brief({ updated: '20 Oct' }), /updated must be/],
      ['funding-paths.md', brief({ sentinel: '"too short"' }), /at least 12 words/],
      ['funding-paths.md', brief({}, 'A body with no sentinel at all.'), /does not appear verbatim/],
      ['funding-paths.md', 'no front matter', /missing front matter/],
      ['Funding.md', brief({ id: 'Funding' }), /lower-case slug/],
    ];
    for (const [file, text, pattern] of cases) assert.throws(() => parseBrief(file, text), (error: unknown) => error instanceof BriefError && pattern.test(error.message), pattern.source);
  });

  test('a source without an https url is refused', () => {
    const text = brief().replace('---\n', '---\nsources:\n  - { id: s1, title: "T", url: "http://example.org" }\n').replace(/^---\n---/, '---');
    assert.throws(() => parseBrief('funding-paths.md', text), /needs an https url/);
  });

  test('the sentinel is matched after folding curly quotes and whitespace', () => {
    const sentence = "It's a sentence with more than twelve words, so the parser accepts it as the sentinel.";
    const folded = sentence.replace("'", '\u2019').replace(/ /g, '  ');
    assert.ok(parseBrief('funding-paths.md', brief({ sentinel: `"${sentence}"` }, `Intro.\n\n${folded}\n`)));
  });
});

describe('brief html', () => {
  const parsed = parseBrief('self-test-brief.md', FIXTURE);
  const html = renderHtml(parsed);

  test('one self-contained, noindex document with a single h1 and no script or external asset', () => {
    assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1);
    assert.ok(html.includes('<meta name="robots" content="noindex, nofollow">'));
    assert.ok(!/<script|<link|@import|<img|<iframe/i.test(html));
    assert.ok(html.startsWith('<!doctype html>') && html.includes('<html lang="en">'));
  });

  test('the title is escaped everywhere it appears', () => {
    const risky = { ...parsed, title: 'A <b>"risky"</b> title' };
    const output = renderHtml(risky);
    assert.ok(!output.includes('<b>'));
    assert.equal((output.match(/&lt;b&gt;/g) ?? []).length, 2);
  });

  test('rendering is deterministic', () => {
    assert.equal(renderHtml(parsed), html);
  });
});

describe('registry', () => {
  test('is sorted, versioned, and read back by the Function parser', () => {
    const second = parseBrief('funding-paths.md', brief());
    const first = parseBrief('self-test-brief.md', FIXTURE);
    const registry = buildRegistry([first, second]);
    assert.deepEqual(registry.briefs.map((entry) => entry.id), ['funding-paths', 'self-test-brief']);
    const entries = parseRegistry(JSON.stringify(registry));
    assert.equal(entries.length, 2);
    assert.equal(entries[0]?.pdfPath, 'briefs/funding-paths/v1.0/funding-paths.pdf');
    assert.equal(entries[0]?.htmlPath, blobPaths(second).html);
  });

  test('a duplicate id is refused', () => {
    const one = parseBrief('funding-paths.md', brief());
    assert.throws(() => buildRegistry([one, one]), /duplicate brief id/);
  });
});

describe('chromium', () => {
  const tree = (paths: readonly string[]) => ({
    existsSync: (path: string) => paths.includes(path),
    readdirSync: (path: string) => {
      if (path !== '/ms-playwright') throw new Error('ENOENT');
      return ['chromium-1200', 'chromium_headless_shell-1200', 'ffmpeg-1011'];
    },
  });

  test('the headless shell is preferred, then the full browser; none is null', () => {
    assert.equal(findChromium({}, tree(['/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell', '/ms-playwright/chromium-1200/chrome-linux64/chrome'])), '/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell');
    assert.equal(findChromium({}, tree(['/ms-playwright/chromium-1200/chrome-linux64/chrome'])), '/ms-playwright/chromium-1200/chrome-linux64/chrome');
    assert.equal(findChromium({}, tree([])), null);
  });

  test('CHROME_BIN wins when it exists and is not silently replaced when it does not', () => {
    assert.equal(findChromium({ CHROME_BIN: '/opt/chrome' }, tree(['/opt/chrome'])), '/opt/chrome');
    assert.equal(findChromium({ CHROME_BIN: '/opt/missing' }, tree(['/ms-playwright/chromium-1200/chrome-linux64/chrome'])), null);
  });

  test('the print arguments run headless with a private profile and no header or footer', () => {
    const args = printArgs({ htmlPath: '/w/a.html', pdfPath: '/w/a.pdf', profileDir: '/p' });
    for (const expected of ['--headless', '--no-pdf-header-footer', '--user-data-dir=/p', '--print-to-pdf=/w/a.pdf', 'file:///w/a.html']) assert.ok(args.includes(expected), expected);
  });
});

describe('publish', () => {
  function outFolder(): string {
    const dir = mkdtempSync(join(tmpdir(), 'publish-test-'));
    const parsed = parseBrief('funding-paths.md', brief());
    const paths = blobPaths(parsed);
    mkdirSync(join(dir, 'briefs/funding-paths/v1.0'), { recursive: true });
    writeFileSync(join(dir, paths.html), renderHtml(parsed));
    writeFileSync(join(dir, paths.pdf), '%PDF-1.7 fake');
    writeFileSync(join(dir, 'briefs.json'), JSON.stringify(buildRegistry([parsed])));
    return dir;
  }

  function fakeAz(existing: Record<string, string> = {}, failUpload = false) {
    const calls: string[][] = [];
    const run = (args: string[]): AzResult => {
      calls.push(args);
      const name = args[args.indexOf('--name') + 1] ?? '';
      if (args[2] === 'show') return name in existing ? { status: 0, stdout: `${existing[name]}\n`, stderr: '' } : { status: 1, stdout: '', stderr: 'ERROR: BlobNotFound' };
      return failUpload ? { status: 1, stdout: '', stderr: 'ERROR: AuthorizationFailure' } : { status: 0, stdout: '', stderr: '' };
    };
    return { calls, run };
  }

  test('the plan lists versioned files before the registry, with content types and hashes', () => {
    const dir = outFolder();
    try {
      const plan = uploadPlan(dir);
      assert.deepEqual(plan.map((item) => item.blob), ['briefs/funding-paths/v1.0/funding-paths.html', 'briefs/funding-paths/v1.0/funding-paths.pdf', 'briefs.json']);
      assert.deepEqual(plan.map((item) => item.immutable), [true, true, false]);
      assert.ok(plan.every((item) => /^[0-9a-f]{64}$/.test(item.sha256)));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a fresh container gets every file, the registry last, with no overwrite of a version', () => {
    const dir = outFolder();
    try {
      const az = fakeAz();
      const result = publish({ outDir: dir, account: 'acct', run: az.run, log: () => undefined });
      assert.deepEqual(result.uploaded, ['briefs/funding-paths/v1.0/funding-paths.html', 'briefs/funding-paths/v1.0/funding-paths.pdf', 'briefs.json']);
      const uploads = az.calls.filter((args) => args[2] === 'upload');
      assert.deepEqual(uploads.map((args) => args[args.indexOf('--overwrite') + 1]), ['false', 'false', 'true']);
      for (const args of uploads) {
        assert.deepEqual(args.slice(args.indexOf('--auth-mode'), args.indexOf('--auth-mode') + 2), ['--auth-mode', 'login']);
        assert.ok(args.includes('private, no-store'));
        assert.ok(!args.some((arg) => /sas|key|token/i.test(arg) && arg !== '--content-cache-control'));
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a version already published with the same content is kept, and the registry is still refreshed', () => {
    const dir = outFolder();
    try {
      const plan = uploadPlan(dir);
      const existing = Object.fromEntries(plan.filter((item) => item.immutable).map((item) => [item.blob, item.sha256]));
      const result = publish({ outDir: dir, account: 'acct', run: fakeAz(existing).run, log: () => undefined });
      assert.deepEqual(result.uploaded, ['briefs.json']);
      assert.equal(result.skipped.length, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('the same version with different content fails and says to bump the version', () => {
    const dir = outFolder();
    try {
      const existing = { 'briefs/funding-paths/v1.0/funding-paths.html': 'deadbeef' };
      assert.throws(() => publish({ outDir: dir, account: 'acct', run: fakeAz(existing).run, log: () => undefined }), /bump the version/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a failed upload stops before the registry', () => {
    const dir = outFolder();
    try {
      const az = fakeAz({}, true);
      assert.throws(() => publish({ outDir: dir, account: 'acct', run: az.run, log: () => undefined }), /upload of briefs\/funding-paths\/v1\.0\/funding-paths\.html failed: ERROR: AuthorizationFailure/);
      assert.ok(!az.calls.some((args) => args.includes('briefs.json')));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('an error that is not "not found" while checking a blob is not treated as absent', () => {
    const dir = outFolder();
    try {
      const run = (): AzResult => ({ status: 1, stdout: '', stderr: 'ERROR: AuthorizationFailure' });
      assert.throws(() => publish({ outDir: dir, account: 'acct', run, log: () => undefined }), /could not check/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('render cli', () => {
  test('the self-test passes without a browser', () => {
    const result = spawnSync(process.execPath, [new URL('../render/render.mjs', import.meta.url).pathname, '--self-test', '--no-pdf'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /self-test ok/);
  });

  test('a missing briefs folder is not an error and writes no registry', () => {
    const out = mkdtempSync(join(tmpdir(), 'render-empty-'));
    try {
      const result = spawnSync(process.execPath, [new URL('../render/render.mjs', import.meta.url).pathname, '--briefs', join(out, 'none'), '--out', out, '--no-pdf'], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /no briefs to render/);
      assert.throws(() => readFileSync(join(out, 'briefs.json')));
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  test('an invalid brief fails the job and names the file and the problem, not the text', () => {
    const dir = mkdtempSync(join(tmpdir(), 'render-bad-'));
    try {
      writeFileSync(join(dir, 'funding-paths.md'), brief({ id: 'other' }));
      const result = spawnSync(process.execPath, [new URL('../render/render.mjs', import.meta.url).pathname, '--briefs', dir, '--out', join(dir, 'out'), '--no-pdf'], { encoding: 'utf8' });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /invalid brief: funding-paths\.md: id "other" must equal the file name/);
      assert.ok(!result.stdout.includes('Opening paragraph') && !result.stderr.includes('Opening paragraph'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
