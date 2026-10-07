import type { APIRoute, GetStaticPaths } from 'astro';
import { buildMarkdownDownload, entrySlug } from '../../components/library/markdown.ts';
import { getRenderable } from '../../lib/content.ts';

/** Static Markdown download for each library template, generated from the same source file as the HTML page. */
export const getStaticPaths = (async () => {
  const entries = await getRenderable('library');
  return entries.map((entry) => ({ params: { slug: entrySlug(entry.id) } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) => {
  const slug = params['slug'];
  const entries = await getRenderable('library');
  const entry = entries.find((candidate) => entrySlug(candidate.id) === slug);
  if (entry === undefined || entry.body === undefined) {
    return new Response(`No library template named ${String(slug)}.`, { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  const markdown = buildMarkdownDownload({
    title: entry.data.title,
    description: entry.data.description,
    instructions: entry.data.instructions,
    body: entry.body,
    updated: entry.data.updated,
  });
  return new Response(markdown, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
