/**
 * Finds the Chromium the Playwright image already carries, so the render job needs no install. Playwright keeps its browsers
 * under PLAYWRIGHT_BROWSERS_PATH (default /ms-playwright) in revision-numbered folders; the layout differs between releases,
 * so every known relative path is tried. `CHROME_BIN` overrides the search.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FOLDERS = ['chromium_headless_shell-', 'chromium-'];
const RELATIVE = [
  'chrome-headless-shell-linux64/chrome-headless-shell',
  'chrome-linux/headless_shell',
  'chrome-linux64/chrome',
  'chrome-linux/chrome',
];

export function findChromium(env = process.env, fs = { existsSync, readdirSync }) {
  const override = env.CHROME_BIN;
  if (override !== undefined && override !== '') return fs.existsSync(override) ? override : null;
  const base = env.PLAYWRIGHT_BROWSERS_PATH && env.PLAYWRIGHT_BROWSERS_PATH !== '0' ? env.PLAYWRIGHT_BROWSERS_PATH : '/ms-playwright';
  let names;
  try {
    names = fs.readdirSync(base);
  } catch {
    // No browsers folder means no browser here; the caller reports it with the path that was searched.
    return null;
  }
  for (const prefix of FOLDERS) {
    for (const name of names.filter((item) => item.startsWith(prefix)).sort().reverse()) {
      for (const relative of RELATIVE) {
        const candidate = join(base, name, relative);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  return null;
}

/** The argument list that prints one HTML file to PDF. A fresh profile folder keeps the run away from HOME. */
export function printArgs({ htmlPath, pdfPath, profileDir }) {
  return [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--no-first-run',
    '--no-pdf-header-footer',
    `--user-data-dir=${profileDir}`,
    `--print-to-pdf=${pdfPath}`,
    `file://${htmlPath}`,
  ];
}
