import type { APIRoute } from 'astro';
import { loadLlms } from '../components/geo/llms-input.ts';
import { buildLlmsFullTxt } from '../lib/llms.ts';

/** /llms-full.txt: the full text of the key pages in one file, each block headed by its canonical URL, under a size cap. */
export const GET: APIRoute = async () => {
  const { input, fullPages } = await loadLlms();
  return new Response(buildLlmsFullTxt(input, fullPages), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
