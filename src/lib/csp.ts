import type { AstroUserConfig } from 'astro';

/**
 * Content Security Policy for the static site (WP-09 request W15-2, decision recorded in .astro-magazine/decisions.md).
 * GitHub Pages cannot send response headers, so the policy ships as the <meta http-equiv> tag Astro emits per page, with
 * hashes for every script and style Astro processes. The pure builder lives here so it can be unit tested; astro.config.mjs
 * calls it with the endpoint URLs from the build environment.
 *
 * Accepted exceptions (a meta policy cannot do these, and the host cannot add headers):
 * - frame-ancestors, report-uri and sandbox are ignored in a meta tag, so they are not listed.
 * - style attributes are allowed (style-src-attr 'unsafe-inline'). The site sets CSS custom properties in markup, for
 *   example style="--grid-min:16rem". Scripts stay locked to 'self' plus hashes, so an attribute cannot run code.
 * - Pagefind needs 'wasm-unsafe-eval' to compile its WebAssembly index reader. That is not 'unsafe-eval'.
 */

type SecurityConfig = NonNullable<AstroUserConfig['security']>;
export type CspConfig = Extract<NonNullable<SecurityConfig['csp']>, object>;

/**
 * The origin of each form endpoint URL, sorted and without duplicates. Blank and missing values are skipped. Only absolute
 * https URLs are allowed, the same rule src/data/forms.ts applies (src/lib/endpoints.ts), so a cleartext origin can never
 * reach connect-src or form-action.
 */
export function endpointOrigins(urls: readonly (string | undefined)[]): string[] {
  const origins = new Set<string>();
  for (const raw of urls) {
    const value = raw?.trim() ?? '';
    if (value === '') continue;
    let url: URL;
    try {
      url = new URL(value);
    } catch (error) {
      throw new Error(`Content Security Policy: "${value}" is not an absolute URL (${error instanceof Error ? error.message : String(error)}).`);
    }
    if (url.protocol !== 'https:') {
      throw new Error(`Content Security Policy: endpoint "${value}" must use https.`);
    }
    origins.add(url.origin);
  }
  return [...origins].sort();
}

/** The policy. `endpoints` are the intake and newsletter URLs; their origins are the only allowed form targets. */
export function buildCsp(endpoints: readonly (string | undefined)[]): CspConfig {
  const origins = endpointOrigins(endpoints).join(' ');
  const withOrigins = (source: string): string => (origins === '' ? source : `${source} ${origins}`);
  return {
    algorithm: 'SHA-256',
    directives: [
      "default-src 'self'",
      "img-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      `connect-src ${withOrigins("'self'")}`,
      `form-action ${withOrigins("'self'")}`,
    ],
    scriptDirective: {
      resources: ["'self'", "'wasm-unsafe-eval'"],
    },
    styleDirective: {
      resources: [
        { resource: "'self'", kind: 'element' },
        { resource: "'unsafe-inline'", kind: 'attribute' },
      ],
    },
  };
}
