import type { APIRoute } from 'astro';
import { site } from '../../data/site.ts';
import { securityTxt } from '../../lib/seo.ts';

/** security.txt expires one year after each build, so a stale file is never served indefinitely. */
const VALIDITY_DAYS = 365;

/**
 * Emits security.txt only once site.securityContact is a confirmed, monitored mailbox (claim C-22).
 * While it is null the response has no body, and Astro's static build writes no file for an empty response, so
 * /.well-known/security.txt does not exist (the ledger's machine route is launch:false in the same state).
 */
export const GET: APIRoute = () => {
  const expires = new Date(Date.now() + VALIDITY_DAYS * 24 * 60 * 60 * 1000);
  const body = securityTxt({ contact: site.securityContact, expires });
  if (body === null) return new Response(null);
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
