# WP-08 change requests (frozen files; apply in WP-15)

## R-1: `/newsletter/` is never "live" once the endpoint is set (src/lib/route-core.ts)

`src/pages/newsletter/[...slug].astro` emits `/newsletter/` only when `forms.newsletter.mode === 'endpoint'`. `fileToRoute` turns it into the dynamic pattern `/newsletter/[...slug]/`, and `matchDynamic` returns `null` for a rest segment with no remaining parts, so `routeExists('/newsletter/')` is false. Nothing breaks while the ledger row is `launch:false` (the default, and what CI builds). When `PUBLIC_WE_NEWSLETTER_API_URL` is set, the row becomes `launch:true`, `computeRouteState` reports it missing, and a `PUBLIC_RELEASE=1` build fails.

Patch proposal:

```ts
// matchDynamic: an optional rest segment matches zero remaining parts
if (rest?.[1] !== undefined) {
  const remaining = q.slice(i);
  params[rest[1]] = remaining.join('/');   // '' when empty
  return params;
}
// DYNAMIC_FIXED
'/newsletter/[...slug]/': [''],
```

Add a unit test in `tests/unit/foundation/route-core.test.ts`: `routeExists('/newsletter/', ctx)` is true with the page file present.

## R-2: insight entry ids vs route slug (src/lib/route-core.ts)

`routeExists` checks `ctx.entryIds.insights.has(slug)` using the full glob id. Articles stored in desk folders (`src/content/insights/dream/<slug>.md`) have ids `dream/<slug>`, so the 18 article rows would be reported missing even though `src/pages/insights/[slug].astro` builds them (it uses the last id segment). Compare against the last id segment, or store articles flat. WP-08 does not depend on it: the Resources hub renders insight cards from the collection, not from route state.

## R-3: CSP for Pagefind (WP-09, src/components/seo/**)

`<we-search>` loads `/pagefind/pagefind.js` with a dynamic `import()` and Pagefind compiles WebAssembly. A strict meta CSP needs `script-src 'self' 'wasm-unsafe-eval'` (the module itself is same-origin, so no hash is required). No inline script or style is added by WP-08 beyond Astro's bundled module scripts.

## R-4: newsletter form contract (WP-03)

`src/components/reference/NewsletterForm.astro` is a plain `<form method="post">` to `PUBLIC_WE_NEWSLETTER_API_URL` with fields `email`, `consent`, and a honeypot `website`. `docs/forms-contract.md` defines only the intake form. If WP-03 wants JSON posting, an `aria-live` status and the footer variant, it can supersede this component; the route needs no change.

## R-5: promote or reuse (WP-13)

Privately built, section-local: `components/reference/{FaqGroups,GlossaryList,NewsletterForm}.astro` and the two island hosts. `FaqGroups` renders `details.faq` with an id and a group-scoped `name`, because the shared `Faq`/`FaqList` take no id. Adding an optional `id` prop to `ui/Faq.astro` would let FaqGroups be replaced by `FaqList`.
