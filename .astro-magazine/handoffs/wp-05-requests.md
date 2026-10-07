# WP-05 change requests

## CR-05-1 Insight article routes are never "live" (src/lib/route-state.ts, frozen)

`route-state.ts` collects `entry.id` into the id set, and `routeExists()` (`route-core.ts`) matches the dynamic parameter against that set. Insight entries live in desk folders (`dream/<slug>.mdx`), so their ids are `dream/<slug>` and the param `<slug>` never matches. Result: `/insights/<slug>/` is reported missing and would be excluded from sitemap, RSS, search and the HTML sitemap, although the page is built.

Proposed patch (route-state.ts, in `build()` where `ids.add(entry.id)` is called):

```ts
ids.add(entry.id);
if (name === 'insights') ids.add(entry.id.split('/').at(-1) ?? entry.id);
```

This is the same last-segment rule already used by `src/pages/insights/[slug].astro`. To be applied by WP-15. Until then `getRouteState().isLive('/insights/<slug>/')` is false for articles; WP-05 code does not depend on it.
