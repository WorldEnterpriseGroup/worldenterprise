import type { APIRoute } from 'astro';
import { readFlag } from '../lib/env.ts';
import { robotsTxt } from '../lib/seo.ts';

/** Production allows all and names the sitemap index; preview builds (PUBLIC_PREVIEW=1) disallow everything. */
export const GET: APIRoute = () =>
  new Response(robotsTxt(readFlag('PUBLIC_PREVIEW')), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
