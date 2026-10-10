/**
 * Azure Communication Services Email adapter, and the optional webhook notifier.
 *
 * ACS acknowledges a send before it is delivered. The adapter waits for the first status for a bounded time: a `Failed` or
 * `Canceled` status is an error (the row becomes `delivery-failed` and the sweep retries it), while running out of time
 * is not, because the message has been accepted and a retry could send it twice. User engagement tracking is switched off.
 */

import { hmacHex } from '../logic/crypto.ts';
import type { MailMessage } from '../logic/mail.ts';
import type { Mailer, Notifier } from '../service/ports.ts';

export class MailError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'MailError';
    this.code = code;
  }
}

/** The part of the SDK's `EmailClient` the adapter uses, so tests can supply a scripted client. */
export interface EmailSender {
  beginSend(message: {
    readonly senderAddress: string;
    readonly content: { readonly subject: string; readonly plainText: string; readonly html: string };
    readonly recipients: { readonly to: { readonly address: string }[] };
    readonly headers: Record<string, string>;
    readonly disableUserEngagementTracking: boolean;
  }): Promise<{ pollUntilDone(options: { abortSignal: AbortSignal }): Promise<{ status?: string }> }>;
}

export interface AcsMailerOptions {
  readonly client: EmailSender;
  readonly senderAddress: string;
  readonly statusTimeoutMs?: number;
}

const DEFAULT_STATUS_TIMEOUT_MS = 10_000;

export class AcsMailer implements Mailer {
  private readonly options: AcsMailerOptions;

  constructor(options: AcsMailerOptions) {
    this.options = options;
  }

  async send(message: MailMessage): Promise<void> {
    let poller: Awaited<ReturnType<EmailSender['beginSend']>>;
    try {
      poller = await this.options.client.beginSend({
        senderAddress: this.options.senderAddress,
        content: { subject: message.subject, plainText: message.text, html: message.html },
        recipients: { to: [{ address: message.to }] },
        headers: { ...message.headers },
        disableUserEngagementTracking: true,
      });
    } catch (error) {
      throw new MailError(codeOf(error, 'mail_send_failed'));
    }
    let status: string | undefined;
    try {
      status = (await poller.pollUntilDone({ abortSignal: AbortSignal.timeout(this.options.statusTimeoutMs ?? DEFAULT_STATUS_TIMEOUT_MS) })).status;
    } catch (error) {
      if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) return;
      throw new MailError(codeOf(error, 'mail_status_failed'));
    }
    if (status === 'Failed' || status === 'Canceled') throw new MailError(`mail_${status.toLowerCase()}`);
  }
}

function codeOf(error: unknown, fallback: string): string {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  return typeof code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(code) ? code : fallback;
}

export interface WebhookOptions {
  readonly url: string;
  readonly secret: string;
  readonly fetch: typeof fetch;
  readonly timeoutMs?: number;
}

/**
 * Posts a small signed event (request id, kind, audience) so an operator can wire a flow or a chat message to it. The body
 * carries no name, email, company or message text. The signature is an HMAC-SHA-256 of the body in `X-WE-Signature`.
 */
export class WebhookNotifier implements Notifier {
  private readonly options: WebhookOptions;

  constructor(options: WebhookOptions) {
    this.options = options;
  }

  async notify(event: Readonly<Record<string, string | number>>): Promise<void> {
    const body = JSON.stringify(event);
    let response: Response;
    try {
      response = await this.options.fetch(this.options.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-WE-Signature': `sha256=${hmacHex(this.options.secret, body)}` },
        body,
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 5000),
      });
    } catch {
      throw new MailError('webhook_unreachable');
    }
    if (!response.ok) throw new MailError(`webhook_http_${response.status}`);
  }
}

/** Used when no webhook is configured. */
export const noopNotifier: Notifier = { notify: () => Promise.resolve() };
