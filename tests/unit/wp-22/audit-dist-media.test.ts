import assert from 'node:assert/strict';
import test from 'node:test';
import * as distAudit from '../../../scripts/lib/audit-dist.mjs';
import { makeDist } from '../shared/fixture-dist.ts';

// WP-22 (#88): the publish allowlist admits the self-hosted video the media components emit to _astro/ (AV1 WebM, H.264 MP4, WebVTT
// captions) and nothing more: other media types stay refused, and a top-level video folder is still not a publishable path.

interface Finding {
  readonly level: 'error' | 'warn';
  readonly where: string;
  readonly message: string;
}
const api = distAudit as unknown as {
  auditDist(options: { distDir: string; cnameFile: string }): Finding[];
  ALLOWED_EXTENSIONS: ReadonlySet<string>;
};

const BASE: Record<string, string | number> = {
  CNAME: 'worldenterprise.org\n',
  'dist/index.html': '<html><body><h1>Home</h1></body></html>',
  'dist/404.html': '<html><body><h1>Not found</h1></body></html>',
};

function audit(extra: Record<string, string | number>): Finding[] {
  const root = makeDist({ ...BASE, ...extra });
  return api.auditDist({ distDir: `${root}/dist`, cnameFile: `${root}/CNAME` }).filter((f) => f.level === 'error');
}

test('.mp4, .webm and .vtt are on the allowlist', () => {
  for (const ext of ['.mp4', '.webm', '.vtt']) assert.ok(api.ALLOWED_EXTENSIONS.has(ext), ext);
});

test('video and captions under _astro/ publish cleanly', () => {
  const errors = audit({
    'dist/_astro/decade.Ab12Cd.mp4': 2048,
    'dist/_astro/decade.Ab12Cd.webm': 2048,
    'dist/_astro/decade.en.Ab12Cd.vtt': 'WEBVTT\n\ntitle-a\n00:00.000 --> 00:02.000\nA caption\n',
  });
  assert.deepEqual(
    errors.filter((f) => /\.(mp4|webm|vtt)/.test(f.where)),
    [],
  );
});

test('other media types are still refused', () => {
  for (const name of ['clip.mov', 'clip.mkv', 'track.mp3', 'subs.srt']) {
    const errors = audit({ [`dist/_astro/${name}`]: 10 });
    assert.ok(
      errors.some((f) => f.where.endsWith(name) && /not on the publish allowlist/.test(f.message)),
      `${name} is refused`,
    );
  }
});
