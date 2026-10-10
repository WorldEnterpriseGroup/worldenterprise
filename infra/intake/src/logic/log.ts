/**
 * The only way the service writes a log line. A line is an event name plus a fixed set of scalar fields: request id, kind,
 * status, a hashed client address, counts and an error code. Free-form text is not accepted, so a request body, an email
 * address, an unsubscribe token or a signed URL has no path into the logs. Error objects are reduced to a code; their
 * `message` is never read, because SDK and HTTP errors routinely echo the request URL (an OData $filter holding an email,
 * a SAS query string).
 */

export type LogLevel = 'info' | 'warn' | 'error';

export type LogValue = string | number | boolean;

export interface LogSink {
  write(level: LogLevel, line: string): void;
}

export interface Logger {
  info(event: string, fields?: Readonly<Record<string, LogValue>>): void;
  warn(event: string, fields?: Readonly<Record<string, LogValue>>): void;
  error(event: string, fields?: Readonly<Record<string, LogValue>>): void;
}

const ALLOWED_FIELDS: ReadonlySet<string> = new Set([
  'requestId', 'kind', 'status', 'code', 'client', 'attempt', 'stage', 'count', 'durationMs', 'briefId', 'route', 'reason', 'outcome', 'job',
]);

const EVENT_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/;

/** A value that looks like personal data or a credential is replaced rather than written. */
const SUSPICIOUS = /@|sig=|sv=|se=|sp=|https?:|[A-Za-z0-9_-]{40,}/;

function safeValue(value: LogValue): LogValue {
  if (typeof value !== 'string') return value;
  const single = value.replace(/[\r\n\t]+/g, ' ').slice(0, 80);
  return SUSPICIOUS.test(single) ? '[redacted]' : single;
}

export function formatLine(event: string, fields: Readonly<Record<string, LogValue>> = {}): string {
  const safe: Record<string, LogValue> = { event: EVENT_PATTERN.test(event) ? event : 'invalid_event' };
  for (const [key, value] of Object.entries(fields)) {
    if (ALLOWED_FIELDS.has(key)) safe[key] = safeValue(value);
  }
  return JSON.stringify(safe);
}

export function createLogger(sink: LogSink): Logger {
  return {
    info: (event, fields) => sink.write('info', formatLine(event, fields)),
    warn: (event, fields) => sink.write('warn', formatLine(event, fields)),
    error: (event, fields) => sink.write('error', formatLine(event, fields)),
  };
}

/** A short, stable code for an unknown thrown value. Never the message. */
export function errorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'unknown';
  const record = error as Record<string, unknown>;
  for (const key of ['code', 'errorCode']) {
    const value = record[key];
    if (typeof value === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(value)) return value;
  }
  for (const key of ['statusCode', 'status']) {
    const value = record[key];
    if (typeof value === 'number' && Number.isInteger(value)) return `http_${value}`;
  }
  const name = record['name'];
  return typeof name === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(name) ? name : 'error';
}
