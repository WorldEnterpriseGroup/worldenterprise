// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

/** Production origin. Never changes for preview builds: canonicals always point here. */
const SITE = 'https://worldenterprise.org';

/**
 * Preview builds (GitLab Pages, path based) set PAGES_BASE_PATH, for example "/worldenterprise".
 * Production has no base. All internal links go through href() in src/lib/url.ts.
 */
const rawBase = (process.env.PAGES_BASE_PATH ?? '').trim();
const base = rawBase === '' ? undefined : `/${rawBase.replace(/^\/+|\/+$/g, '')}`;

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
  devToolbar: { enabled: false },
  integrations: [mdx(), sitemap()],
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
  },
});
