import type { Page, Request } from '@playwright/test';

/**
 * What the tools promise: what is entered stays in the browser. After the page has loaded, nothing may leave it.
 *
 * One kind of request is not the tool and is let through, so it neither counts nor fails the console check: a same-origin GET of a
 * static resource. The site's own footer wordmark is a lazy image, and at a narrow viewport ticking or typing scrolls it into range
 * after the page has settled. Every other request, and any request to another origin, is counted and aborted.
 */
const STATIC_TYPES: readonly string[] = ['image', 'font', 'stylesheet', 'script', 'media'];

/** True for a same-origin GET of an image, font, stylesheet, script or media file: the page's own assets, not the tool talking. */
export function isSameOriginStaticGet(request: Pick<Request, 'method' | 'resourceType' | 'url'>, origin: string): boolean {
  return request.method() === 'GET' && STATIC_TYPES.includes(request.resourceType()) && new URL(request.url()).origin === origin;
}

/**
 * Starts watching for requests that leave the page and returns the list they are written to, which must stay empty. Call it once
 * the page has loaded. The same predicate decides what is counted and what is aborted, so an allowed asset loads normally and logs
 * no console error, while anything else is both recorded and refused.
 */
export async function trackEgress(page: Page, baseURL: string | undefined): Promise<string[]> {
  if (baseURL === undefined) throw new Error('the project sets no baseURL');
  const origin = new URL(baseURL).origin;
  const sent: string[] = [];
  page.on('request', (request) => {
    if (!isSameOriginStaticGet(request, origin)) sent.push(`${request.method()} ${request.url()}`);
  });
  page.on('websocket', (socket) => sent.push(`websocket ${socket.url()}`));
  await page.route('**/*', (route) => (isSameOriginStaticGet(route.request(), origin) ? route.continue() : route.abort()));
  return sent;
}
