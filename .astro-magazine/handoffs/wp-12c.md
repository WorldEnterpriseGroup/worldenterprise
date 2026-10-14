# WP-12c handoff: responsive LCP heroes and declared dependencies

Branch `wp/12c`, issue #28. Merged to `demo` as a869edb (pipeline 64725 green on the branch, demo pipeline 64767). Locally `astro check` (0 errors), `node --test` (648 pass) and `check:ownership` ran; the build, audits and Playwright run in CI.

## What changed

| Area | Change |
|---|---|
| Heroes | `HeroEditorial`, `HeroAtlas` and `HomeHero` render `photoImage()` output: AVIF `srcset`, the slot `sizes`, display size as `width` and `height`, `fetchpriority="high"`, `decoding="async"`, no `loading`. The home band in `src/pages/index.astro` does the same, lazy. |
| Preload | The home page builds `band-1` once, passes it to `HomeHero` (new `image` prop) and derives the head preload from the same object with `preloadOfPhoto()` (`src/lib/image-type.ts`). `SeoHead` writes `imagesrcset` and `imagesizes` next to `href` and `type`, so the browser makes one request. `PreloadImage` is the shared type (`BaseLayout`, `layouts/types.ts`, `SeoHead`). |
| `photoImage()` | Additive field `format` (`avif` or `svg`) so a preload names the right media type. |
| Audit | `scripts/audit-images.mjs`: a preload with `imagesrcset` must match the `srcset` and `sizes` of an `<img>` on the page (negative proof in `tests/unit/wp-15/image-type.test.ts`). |
| Variants | Nothing committed: `getImage()` builds 640 and 1024 (hero-home) and 512, 768 and 1024 (card-4x3) from the masters at build time (decision P-4). `slots.ts` is untouched. |
| Dependencies | `satteri` 0.10.5 and `@astrojs/markdown-satteri` 0.4.3 declared in `package.json` (both were imported but only transitive); the lockfile gained the two root entries and nothing else (decision P-5). |
| Tests | `tests/unit/wp-12c/hero-srcset.test.ts` pins the contract; the wp-12b, wp-15 and wp-17 tests that pinned the old markup assert the new one. |
| Ownership | WP-12c assignment and exception rows added. |

## Notes for the next work package

- An editorial hero on a 4:3 slot now reports 512x384 as `width` and `height` (the slot display size) instead of the 1024x768 master; the frame is absolutely positioned, so nothing moves.
- The 640 variant stands in for the 480 and 768 widths in the brief; adding them means editing the frozen `slots.ts`.
- WP-12b phase B: replacing a master needs no extra step for variants. If it also adds a decision P-4, renumber one of the two (both rows are kept on conflict).
- Not verified here: the real file sizes of the 640 variants against `audit:images` (CI did, and was green).
