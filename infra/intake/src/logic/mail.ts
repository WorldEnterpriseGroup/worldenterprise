/**
 * Email content. Plain, specific and short. Nothing here promises a delivery time, an outcome, funding or a price: the
 * truth policy for the site applies to every sentence WE sends. The brief link is a short-lived signed URL; the
 * unsubscribe link opens a confirmation page and unsubscribes only when that page is submitted.
 */

import { escapeHtml, singleLine } from './text.ts';

export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  readonly headers: Readonly<Record<string, string>>;
}

export interface MailContext {
  readonly name: string;
  readonly briefTitle: string;
  readonly briefId: string;
  readonly siteOrigin: string;
  /** The signed read link. Present for the brief email, absent for follow-ups. */
  readonly briefUrl: string | null;
  readonly unsubscribeUrl: string;
  /** Postal address line for the footer, set by the operator (OP-MAIL). Empty means the footer carries only the company name. */
  readonly footerAddress: string;
}

const COMPANY = 'World Enterprise Group Incorporated';

function greeting(name: string): string {
  const first = singleLine(name).split(' ')[0] ?? '';
  return first === '' ? 'Hello,' : `Hello ${first},`;
}

function footerText(ctx: MailContext): string {
  const address = ctx.footerAddress === '' ? '' : `\n${singleLine(ctx.footerAddress)}`;
  return `\n--\nWE, ${COMPANY}${address}\nStop these emails: ${ctx.unsubscribeUrl}\n`;
}

function footerHtml(ctx: MailContext): string {
  const address = ctx.footerAddress === '' ? '' : `<br>${escapeHtml(singleLine(ctx.footerAddress))}`;
  return `<hr style="border:none;border-top:1px solid #d6d6d6;margin:24px 0"><p style="font-size:13px;color:#555">WE, ${COMPANY}${address}<br><a href="${escapeHtml(ctx.unsubscribeUrl)}">Stop these emails</a></p>`;
}

function wrapHtml(body: string, ctx: MailContext): string {
  return `<!doctype html><html lang="en"><body style="font:16px/1.5 system-ui,Arial,sans-serif;color:#1a1a1a;max-width:36rem;margin:0 auto;padding:16px">${body}${footerHtml(ctx)}</body></html>`;
}

/** RFC 8058 one-click headers, so a mail client can offer its own unsubscribe button. The POST goes to the same endpoint as the page. */
function listHeaders(ctx: MailContext): Record<string, string> {
  return { 'List-Unsubscribe': `<${ctx.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
}

export function renderBriefEmail(to: string, ctx: MailContext): MailMessage {
  if (ctx.briefUrl === null) throw new Error('brief_url_missing');
  const title = singleLine(ctx.briefTitle);
  const subject = `Your WE brief: ${title}`;
  const text = [
    greeting(ctx.name),
    '',
    `You asked WE to send the brief "${title}". You can read it here:`,
    ctx.briefUrl,
    '',
    'The link is private to you and stops working after 48 hours. If it has expired, request the brief again at:',
    `${ctx.siteOrigin}/briefs/${ctx.briefId}/`,
    '',
    'If you did not request this brief, you can ignore this email.',
  ].join('\n') + footerText(ctx);
  const html = wrapHtml(
    `<p>${escapeHtml(greeting(ctx.name))}</p>` +
      `<p>You asked WE to send the brief <strong>${escapeHtml(title)}</strong>.</p>` +
      `<p><a href="${escapeHtml(ctx.briefUrl)}">Read the brief</a></p>` +
      `<p>The link is private to you and stops working after 48 hours. If it has expired, <a href="${escapeHtml(`${ctx.siteOrigin}/briefs/${ctx.briefId}/`)}">request the brief again</a>.</p>` +
      '<p>If you did not request this brief, you can ignore this email.</p>',
    ctx,
  );
  return { to, subject, text, html, headers: listHeaders(ctx) };
}

interface NurtureCopy {
  readonly subject: (title: string) => string;
  readonly lines: (title: string, siteOrigin: string) => readonly string[];
  readonly link: (siteOrigin: string, briefId: string) => { readonly label: string; readonly url: string };
}

const NURTURE: readonly NurtureCopy[] = [
  {
    subject: (title) => `A question to take back to "${title}"`,
    lines: (title) => [
      `A few days ago you asked WE for the brief "${title}".`,
      'If you have read it, its section on what it cannot tell you is a good place to check the limits against your own situation: your jurisdiction, your date and the size of your company.',
    ],
    link: (siteOrigin, briefId) => ({ label: 'The brief page', url: `${siteOrigin}/briefs/${briefId}/` }),
  },
  {
    subject: () => 'More reading from WE',
    lines: () => [
      'WE publishes articles on the same desks as its briefs: what a document or instrument is, what the sources say, and what they do not cover.',
      'You are receiving this because you chose to hear about related briefs and articles.',
    ],
    link: (siteOrigin) => ({ label: 'WE insights', url: `${siteOrigin}/insights/` }),
  },
  {
    subject: () => 'Where to go next with WE',
    lines: () => [
      'If the brief was useful and you would like to talk about your company, you can tell WE about it. WE decides whether to talk further and makes no promise of funding.',
      'If not, there is nothing to do. This is the last of these emails.',
    ],
    link: (siteOrigin) => ({ label: 'Tell WE about your company', url: `${siteOrigin}/apply/` }),
  },
];

export const NURTURE_STAGES = NURTURE.length;

/** Follow-up number `stage`, 1-based. */
export function renderNurtureEmail(to: string, stage: number, ctx: MailContext): MailMessage {
  const copy = NURTURE[stage - 1];
  if (copy === undefined) throw new Error('nurture_stage_unknown');
  const title = singleLine(ctx.briefTitle);
  const lines = copy.lines(title, ctx.siteOrigin);
  const link = copy.link(ctx.siteOrigin, ctx.briefId);
  const text = [greeting(ctx.name), '', ...lines.flatMap((line) => [line, '']), `${link.label}: ${link.url}`].join('\n') + footerText(ctx);
  const html = wrapHtml(
    `<p>${escapeHtml(greeting(ctx.name))}</p>${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}<p><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></p>`,
    ctx,
  );
  return { to, subject: copy.subject(title), text, html, headers: listHeaders(ctx) };
}
