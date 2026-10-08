// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
import { satteri } from '@astrojs/markdown-satteri';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';
import { buildCsp } from './src/lib/csp.ts';
import { createLastmodLookup } from './src/lib/lastmod.ts';
import { isSitemapUrl, withLastmod } from './src/lib/seo.ts';
import { tableWrapPlugin } from './src/lib/rehype-table-wrap.ts';

/** Production origin. Never changes for preview builds: canonicals always point here. */
const SITE = 'https://worldenterprise.org';

/**
 * Preview builds (GitLab Pages, path based) set PAGES_BASE_PATH, for example "/worldenterprise".
 * Production has no base. All internal links go through href() in src/lib/url.ts.
 */
const rawBase = (process.env.PAGES_BASE_PATH ?? '').trim();
const base = rawBase === '' ? undefined : `/${rawBase.replace(/^\/+|\/+$/g, '')}`;

/** Sitemap lastmod: frontmatter date, else the last git commit of the source file, else none (src/lib/lastmod.ts). */
const lastmod = createLastmodLookup({ root: fileURLToPath(new URL('.', import.meta.url)), base });

/**
 * Content Security Policy as a per-page meta tag (src/lib/csp.ts). The form endpoints are read from the build environment,
 * as src/data/forms.ts reads them, so the policy allows exactly the origins the forms post to.
 */
const security = {
  csp: buildCsp([process.env.PUBLIC_WE_INTAKE_API_URL, process.env.PUBLIC_WE_NEWSLETTER_API_URL]),
};

export default defineConfig({
  site: SITE,
  base,
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Titillium Web',
      cssVariable: '--font-display',
      fallbacks: ['WE Display Fallback', 'Arial', 'sans-serif'],
      options: {
        variants: [
          { weight: 600, style: 'normal', src: ['./src/assets/fonts/titillium-web-latin-600-normal.woff'] },
          { weight: 700, style: 'normal', src: ['./src/assets/fonts/titillium-web-latin-700-normal.woff'] },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Source Serif 4',
      cssVariable: '--font-serif',
      fallbacks: ['WE Serif Fallback', 'Georgia', 'serif'],
      options: {
        variants: [
          { weight: 400, style: 'normal', src: ['./src/assets/fonts/source-serif-4-latin-400-normal.woff'] },
          { weight: 400, style: 'italic', src: ['./src/assets/fonts/source-serif-4-latin-400-italic.woff'] },
          { weight: 600, style: 'normal', src: ['./src/assets/fonts/source-serif-4-latin-600-normal.woff'] },
          { weight: 700, style: 'normal', src: ['./src/assets/fonts/source-serif-4-latin-700-normal.woff'] },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Source Sans 3',
      cssVariable: '--font-sans',
      fallbacks: ['WE Sans Fallback', 'Arial', 'sans-serif'],
      options: {
        variants: [
          { weight: 400, style: 'normal', src: ['./src/assets/fonts/source-sans-3-latin-400-normal.woff'] },
          { weight: 400, style: 'italic', src: ['./src/assets/fonts/source-sans-3-latin-400-italic.woff'] },
          { weight: 600, style: 'normal', src: ['./src/assets/fonts/source-sans-3-latin-600-normal.woff'] },
          { weight: 700, style: 'normal', src: ['./src/assets/fonts/source-sans-3-latin-700-normal.woff'] },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Source Code Pro',
      cssVariable: '--font-mono',
      fallbacks: ['Consolas', 'monospace'],
      options: {
        variants: [
          { weight: 400, style: 'normal', src: ['./src/assets/fonts/source-code-pro-latin-400-normal.woff'] },
          { weight: 600, style: 'normal', src: ['./src/assets/fonts/source-code-pro-latin-600-normal.woff'] },
        ],
      },
    },
  ],
  // Markdown and MDX tables get the same scroll frame as the tables the templates write (src/lib/rehype-table-wrap.ts). Astro 7 renders
  // both formats with Sätteri, and @astrojs/mdx inherits this processor, so one plugin list covers .md and .mdx.
  markdown: { processor: satteri({ hastPlugins: [tableWrapPlugin] }) },
  security,
  devToolbar: { enabled: false },
  integrations: [mdx(), sitemap({ filter: isSitemapUrl, serialize: (item) => withLastmod(item, lastmod) })],
  vite: {
    build: {
      /**
       * Only stylesheets may be inlined. Astro's `inlineStylesheets: 'auto'` inlines a CSS chunk when it is under this limit
       * (4096 B when the function returns undefined), which turns the per-component chunks into one inline style block per
       * page. Everything else (images, scripts, fonts) must stay a file: a data: URI would need a CSP source we do not grant.
       */
      assetsInlineLimit: (/** @type {string} */ file) => (file.endsWith('.css') ? undefined : false),
    },
  },
});
