import type { APIRoute } from 'astro';
import { loadLlms } from '../components/geo/llms-input.ts';
import { buildLlmsTxt } from '../lib/llms.ts';

/** /llms.txt: the index of the site for language-model readers, generated from site.ts, the route state and the twins. */
export const GET: APIRoute = async () => {
  const { input } = await loadLlms();
  return new Response(buildLlmsTxt(input), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
