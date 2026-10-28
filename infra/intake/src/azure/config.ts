/**
 * Reads the Function's app settings. Pure: it takes the environment as a map and returns either a complete configuration or
 * the NAMES of what is missing or malformed. Values never appear in the result of a failure, so a misconfiguration report
 * (the health endpoint, a log line) cannot leak one.
 *
 * Required settings are injected by the Bicep template: the Dataverse URL and storage account come from deployment inputs,
 * the ACS endpoint and sender from the ACS resources the template creates, the notification Logic App's trigger URL from the
 * Logic App the template creates, the unsubscribe key as a Key Vault reference.
 */

import { parseOrigins } from '../logic/http.ts';

export interface IntakeConfig {
  readonly dataverseUrl: string;
  readonly storageAccount: string;
  readonly stateContainer: string;
  readonly briefsContainer: string;
  readonly acsEndpoint: string;
  readonly senderAddress: string;
  readonly allowedOrigins: readonly string[];
  readonly siteOrigin: string;
  readonly apiOrigin: string;
  readonly unsubscribeKey: string;
  /** Trigger URL of the notification Logic App, without a `sig`: the Function authenticates with its managed identity. */
  readonly notifyUrl: string;
  readonly nurtureEnabled: boolean;
  readonly footerAddress: string;
}

export type ConfigResult =
  | { readonly ok: true; readonly config: IntakeConfig }
  | { readonly ok: false; readonly problems: readonly string[] };

type Env = Readonly<Record<string, string | undefined>>;

function httpsOrigin(value: string | undefined): string | null {
  if (value === undefined || value.trim() === '') return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

/** The settings that are secrets. Their names are recorded in docs; their values are never read into a message. */
export const SECRET_SETTINGS = ['UNSUBSCRIBE_KEY'] as const;

export function readConfig(env: Env): ConfigResult {
  const problems: string[] = [];
  const need = (name: string): string => {
    const value = env[name]?.trim() ?? '';
    if (value === '') problems.push(name);
    return value;
  };
  const origin = (name: string): string => {
    const value = httpsOrigin(env[name]);
    if (value === null) {
      problems.push(name);
      return '';
    }
    return value;
  };

  const dataverseUrl = origin('DATAVERSE_URL');
  const acsEndpoint = origin('ACS_ENDPOINT');
  const siteOrigin = origin('SITE_ORIGIN');
  const apiOrigin = origin('API_ORIGIN');
  const storageAccount = need('STORAGE_ACCOUNT');
  if (storageAccount !== '' && !/^[a-z0-9]{3,24}$/.test(storageAccount)) problems.push('STORAGE_ACCOUNT');
  const senderAddress = need('ACS_SENDER_ADDRESS');
  if (senderAddress !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderAddress)) problems.push('ACS_SENDER_ADDRESS');
  const unsubscribeKey = need('UNSUBSCRIBE_KEY');
  if (unsubscribeKey !== '' && unsubscribeKey.length < 32) problems.push('UNSUBSCRIBE_KEY');
  const allowedOrigins = parseOrigins(env['ALLOWED_ORIGINS']);
  if (allowedOrigins.length === 0) problems.push('ALLOWED_ORIGINS');

  // The trigger URL is not a credential (it has no `sig`), but a URL that does carry one is refused rather than used.
  const notifyUrl = env['NOTIFY_LOGICAPP_URL']?.trim() ?? '';
  if (httpsOrigin(notifyUrl) === null || /[?&]sig=/i.test(notifyUrl)) problems.push('NOTIFY_LOGICAPP_URL');

  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    config: {
      dataverseUrl,
      storageAccount,
      stateContainer: env['STATE_CONTAINER']?.trim() || 'intake-state',
      briefsContainer: env['BRIEFS_CONTAINER']?.trim() || 'briefs',
      acsEndpoint,
      senderAddress,
      allowedOrigins,
      siteOrigin,
      apiOrigin,
      unsubscribeKey,
      notifyUrl,
      // Anything other than the exact string 'true' leaves the nurture sequence off.
      nurtureEnabled: env['NURTURE_ENABLED']?.trim().toLowerCase() === 'true',
      footerAddress: env['MAIL_FOOTER_ADDRESS']?.trim() ?? '',
    },
  };
}
