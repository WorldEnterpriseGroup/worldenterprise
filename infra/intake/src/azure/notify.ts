/**
 * The notifier: one authenticated POST to the World Enterprise notification Logic App, which emails the info@ inbox
 * through Azure Communication Services. The Function proves who it is with an Entra token of its own managed identity; the
 * Logic App's trigger accepts only that identity (see iac/notify.bicep), so the URL carries no shared secret.
 *
 * The event is a form label, a name and a record link: no email address and no message body. The request id travels in
 * the `x-ms-client-tracking-id` header, which Logic Apps records on the run, so a run can be found from a request id.
 * Errors carry a stable code and nothing else.
 */

import type { NotifyEvent } from '../logic/mapping.ts';
import type { Notifier } from '../service/ports.ts';

/** The audience a Consumption Logic App request trigger validates an Entra token against. */
export const LOGIC_APP_AUDIENCE = 'https://management.core.windows.net/';

/**
 * The token scope for that audience. Entra drops a single trailing slash before `.default`, so `<audience>.default` yields a
 * token whose `aud` lacks the slash and the trigger refuses it with 403 MisMatchingOAuthClaims (#119). The doubled slash keeps it.
 */
export const LOGIC_APP_SCOPE = `${LOGIC_APP_AUDIENCE}/.default`;

export class NotifyError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'NotifyError';
    this.code = code;
  }
}

export interface LogicAppNotifierOptions {
  /** The trigger URL without its `sig` query parameter. */
  readonly url: string;
  readonly getToken: () => Promise<string>;
  readonly fetch: typeof fetch;
  readonly timeoutMs?: number;
}

export class LogicAppNotifier implements Notifier {
  private readonly options: LogicAppNotifierOptions;

  constructor(options: LogicAppNotifierOptions) {
    this.options = options;
  }

  async notify(event: NotifyEvent): Promise<void> {
    let token: string;
    try {
      token = await this.options.getToken();
    } catch {
      // The credential error can carry tenant and client details; only the stable code leaves this adapter.
      throw new NotifyError('notify_token');
    }
    let response: Response;
    try {
      response = await this.options.fetch(this.options.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-ms-client-tracking-id': event.requestId },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 8000),
      });
    } catch (error) {
      throw new NotifyError(error instanceof Error && error.name === 'TimeoutError' ? 'notify_timeout' : 'notify_unreachable');
    }
    if (!response.ok) throw new NotifyError(`notify_http_${response.status}`);
  }
}
