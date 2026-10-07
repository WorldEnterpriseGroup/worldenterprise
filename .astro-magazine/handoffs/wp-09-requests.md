# WP-09 change requests

## To WP-14 (CI wiring)

1. In `verify:static`, after the site build step, run both audits against `dist`:
   ```
   - node scripts/audit-seo.mjs --dist dist --sitemap=warn
   - node scripts/validate-jsonld.mjs --dist dist
   ```
   Use `--sitemap=warn` until WP-15 applies request W15-1; then drop the flag (the sitemap rule becomes an error). Optional `package.json` script names (via WP-15): `audit:seo`, `audit:jsonld`.
2. `lastmod` from git needs history: set `GIT_DEPTH: "0"` on `verify:static` and on the `pages` job (GitLab clones shallow by default). The lastmod helper omits the date when git returns nothing, so a shallow clone degrades safely.
3. Preview builds: run `audit-seo.mjs` with `PUBLIC_PREVIEW=1` in the environment (it then expects noindex everywhere).
4. `audit-seo` reports a missing og:image as a warning only (FLAG-OG). Once WP-12 fills the `og-*` slots, consider making it an error for indexable pages.

## To WP-15 (frozen files and wiring)

W15-1. `astro.config.mjs` sitemap integration (frozen). Replace the filter with the tested helper and add lastmod:
```js
import { isSitemapUrl, withLastmod } from './src/lib/seo.ts';
// lookup(pathname): Date | undefined. Reference algorithm: map the pathname to its source
// (src/content/<collection>/**/<slug>.md|mdx, src/pages/**, or src/content/pages/**), prefer the frontmatter
// updatedDate / updated, else `git log -1 --format=%cI -- <file>`; return undefined when nothing is found.
sitemap({ filter: isSitemapUrl, serialize: (item) => withLastmod(item, lookup) })
```
Tests: `tests/unit/wp-09/seo.test.ts` covers `isSitemapUrl` and `withLastmod`. `/sitemap/`, `/search/` and `/apply/thanks/` are noindex ledger rows and are removed by `isSitemapUrl`. If the config loader does not accept a `.ts` import, inline the two functions.

W15-2. `security.csp` (decision, frozen config and `decisions.md`). Verified against the installed astro 7.3.6 types (`config.d.ts`, `context.d.ts`): `security.csp` is supported and emits one `<meta http-equiv="content-security-policy">` per page with hashes for Astro-processed scripts and styles. WP-09 already registers the inline speculation-rules script with `Astro.csp?.insertScriptHash` (a no-op until enabled). Recommended config:
```js
security: {
  csp: {
    algorithm: 'SHA-256',
    directives: [
      "default-src 'self'",
      "img-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      `connect-src 'self' ${intakeOrigin}`,
      `form-action 'self' ${intakeOrigin}`,
    ],
    // only if inline style attributes remain (see risks):
    // styleDirective: { resources: [{ resource: "'unsafe-inline'", kind: 'attribute' }] }
  },
},
```
`intakeOrigin` is the origin of `PUBLIC_WE_INTAKE_API_URL` (omit when unset). Enable it on a branch first and let `e2e:smoke` and the axe run prove there is no violation.

Risks to clear before enabling (owned by WP-13 and WP-03): about 10 inline `style=` attributes in `.astro` files are blocked by `style-src` unless moved to classes or allowed with `style-src-attr 'unsafe-inline'`; the Astro `<Font>` output and any `is:inline` script other than JSON-LD (a data block, exempt) and the speculation rules (hashed) need checking in the built meta; the speculation-rules hash is computed over the exact serialised string and must match the built markup (verify in CI).

Accepted exceptions to record in `.astro-magazine/decisions.md`: a meta CSP cannot set `frame-ancestors`, `report-uri` or `sandbox`; GitHub Pages cannot set `Permissions-Policy` or add HSTS beyond its own defaults; Cloudflare edge rules remain a post-launch option.

W15-3. Optional: add `audit:seo` and `audit:jsonld` scripts to `package.json`.

## To WP-13 (BaseLayout and chrome)

W13-1. `BaseLayout` always builds `pageNode` with a `breadcrumb` reference but only adds the BreadcrumbList when crumbs exist (the home page and 404). WP-09 now drops the dangling reference inside `graph()`, so no change is required; if BaseLayout is touched, pass breadcrumb presence explicitly.

W13-2. The mega-menu panels render about 15 `<h2 class="mega-panel__heading">` elements before the page `<h1>` in document order. `audit-seo` judges headings inside `<main>` only, so this does not fail it; consider a non-heading element for panel headings so assistive-technology heading navigation starts at the page title.

## To the orchestrator

- `security.txt`: `src/pages/.well-known/security.txt.ts` returns an empty body while `site.securityContact` is null. Verified in `node_modules/astro/dist/core/build/generate.js` that an empty response writes no file. No file ships until the operator confirms a monitored `security@` mailbox and WP-15 sets `site.securityContact` and flips the `MACHINE_ROUTES` row.
- The `SearchAction` on the WebSite node is added by `JsonLd.astro` only when `/search/` is live in the route state. It points at `/search/?q=`, which WP-08 must support.
