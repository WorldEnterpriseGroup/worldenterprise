/**
 * Azure Communication Services Email adapter.
 *
 * ACS acknowledges a send before it is delivered. The adapter waits for the first status for a bounded time: a `Failed` or
 * `Canceled` status is an error (the row becomes `delivery-failed` and the sweep retries it), while running out of time
 * is not, because the message has been accepted and a retry could send it twice. User engagement tracking is switched off.
 */

import type { MailMessage } from '../logic/mail.ts';
import type { Mailer } from '../service/ports.ts';

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
