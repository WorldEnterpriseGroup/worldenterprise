// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
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
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Titillium Web',
      cssVariable: '--font-display',
      fallbacks: ['Arial', 'sans-serif'],
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
      fallbacks: ['Georgia', 'serif'],
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
      fallbacks: ['Arial', 'sans-serif'],
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
  devToolbar: { enabled: false },
  integrations: [mdx(), sitemap()],
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
  },
});
