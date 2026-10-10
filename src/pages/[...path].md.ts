import type { APIRoute, GetStaticPaths } from 'astro';
import { getTwins } from '../components/geo/twin-sources.ts';
import { renderTwin, twinParam } from '../lib/markdown-twins.ts';

/**
 * Markdown twins: /insights/<slug>.md is the plain Markdown text of /insights/<slug>/ (docs/wave7-contracts.md, section 2).
 * Which pages have one, and why the rest do not, is decided in src/components/geo/assemble.ts. The library downloads keep their own
 * endpoint (src/pages/library/[slug].md.ts), which is more specific than this one and is never in the twin set.
 */
export const getStaticPaths = (async () => {
  const { twins } = await getTwins();
  return twins.map((twin) => ({ params: { path: twinParam(twin.route) } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) => {
  const { twins } = await getTwins();
  const twin = twins.find((candidate) => twinParam(candidate.route) === params['path']);
  if (twin === undefined) {
    return new Response(`No Markdown version of ${String(params['path'])}.`, { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  return new Response(renderTwin(twin), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
