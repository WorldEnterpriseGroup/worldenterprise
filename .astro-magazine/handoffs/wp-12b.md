# WP-12b handoff: photography pass, phase A (plumbing)

Branch `wp/12b`, issue #22 (left open: phase B closes it). No image was generated in this phase; all 47 slots are still the WP-12 vector compositions (`source: "vector"`). Locally only `astro check`, `node --test` and `check:ownership` ran; the build, audits and Playwright run in CI.

## What changed

| Area | Change |
|---|---|
| Slot table | `src/assets/photo/slots.ts`: every slot has `aspect`, `widths`, `sizes` and `people` (forbidden, optional, recommended) besides its exact size. `PROFILE_SIZE` is unchanged. New `MODEL_MAX_EDGE = 1024` (the 1K waiver, decision P-1), `RECOMMENDED_FIGURE_IDS`, `OPTIONAL_FIGURE_IDS`, `peopleClass()`, `sizesFor()`. |
| Responsive output | `src/assets/photo/responsive.ts` (pure: `srcsetWidths`, `displayAttributes`) and `src/components/media/photo-image.ts` (`photoImage(slot, { sizes? })` returns `src srcset sizes width height alt` through `getImage`). `AvifPicture` is now one `<img>` with an AVIF srcset, `loading="lazy"` and `decoding="async"` unless `priority`, where it is `eager` and `fetchpriority="high"`. Astro's own `priority` is never forwarded (it sets `decoding="sync"`, which `audit:images` rejects). |
| Consumers | `Card` takes optional `srcset` and `sizes`; the five card components, `LineAside`, `/pricing/` (band-3) and `/program/who-its-for/` (stage cards) go through `photoImage()`. |
| Manifest | Schema 2 (see decision P-3): per slot `kind aspect width height widths people figures source model seed prompt promptSha256 generatedAt alt bytes quality file path`. `source` is `vector` or `generated`. `assemble-manifest.mjs` rebuilds the vector rows and carries generated rows over unchanged. |
| CI extract | `.astro-magazine/media/shotlist-extract.json`: CI has no `.plan/`, so the tests read this extract of `.plan/photo/shotlist.json` and `people-policy.json` (it records both sha256 values). |
| Decisions | `.astro-magazine/decisions.md`: P-1 (1K masters, waiver of the 2048 row), P-2 (one responsive `<img>`), P-3 (manifest 2), F-6 (SAGE-PLAN 4.6 amendment: chest-down figures on the 13 allowed slots). |
| Ownership | WP-12b row existed; four exceptions added: `ownership.json`, `decisions.md`, `LineAside.astro`, `who-its-for.astro`, `pricing/index.astro`. |
| Tests | `tests/unit/wp-12b/` (25 tests): manifest against the shotlist (every slot present, size equals the shotlist size scaled to a long edge of at most 1024, people class and the 13/6/one-per-page/trio rules, alt present and not generic, provenance fields, real AVIF dimensions and bytes through sharp), responsive widths, markup rules (img attributes, `fetchpriority="high"` confined to the hero files, the preload only on the home page, consumers use `photoImage`), footer disclosure (renders only when a slot has `source: "generated"`). |

Footer disclosure: `src/lib/photo-disclosure.ts` and `Footer.astro` already gated the line on `source === "generated"`; no change was needed, only the test that proves it and flips a slot to `generated` in memory.

## Deliberately left alone

- `HeroEditorial`, `HeroAtlas`, `HomeHero`: the `<img>` lines already carry `fetchpriority="high" decoding="async"` with no `loading`, and the HeroEditorial line is pinned by the WP-17 heroes test. They serve a plain 1024 master, so the LCP image has no srcset; the home preload carries href and type only.
- `src/pages/index.astro` (blocked for WP-12b by the WP-15 ownership test): the home band is still `<img src={band.src.src}>` at 1024x576 with no srcset, inside the 120 KB band budget; the home preload is unchanged.
- A stacked layout with no `max-inline-size` can show a 1024 master up to about 925 CSS px. Fine at 1x; noted for the visual QA in phase B.
- Vector alt text stays until a slot is replaced; phase B writes the new alt from the image.
- The manifest lost its old `comfyui` object (nothing read it).

## Phase B checklist

Prerequisite: Boogu-Image-0.1-Turbo is served by GPU Router (the onboarding is a separate job, `HardMagic/gpu-router`, GitOps only). Confirm with one probe before the batch. If it is not served, stop and report; do not fall back to another model without a decision row.

1. **Generate serially**, one request at a time (a parallel batch wedged the stand-in model, art-direction section 10). Retry an intermittent 500. Output at the exact master size, no upscaling, then `magick in.png -strip -resize WxH -quality 65 out.avif` (ImageMagick; Pillow is not installed). Overwrite `src/assets/photo/<file>` named in the manifest row.
2. **Slots**: 38 raster slots, of which 30 are `generateNow`. The other 8 (inset-resources, inset-about, topic-dream, topic-build, topic-grow, topic-fundable, band-2, band-3) stay vector until the owner asks. The 9 OG cards stay SVG-composed.

   | Group | Slots | Master |
   |---|---|---|
   | Section insets (4:3) | inset-program, inset-services, inset-playbooks, inset-fundability, inset-trust, inset-network, inset-pricing, inset-apply, inset-contact | 1024x768 |
   | Services (4:3) | svc-a to svc-g | 1024x768 |
   | Stages (4:3) | stage-dream, stage-build, stage-grow | 1024x768 |
   | Playbooks (4:3) | pb-1 to pb-5 | 1024x768 |
   | Research (4:3) | research-1 to research-4 | 1024x768 |
   | Bands (16:9) | band-1, band-4 now; band-2, band-3 later | 1024x576 (waiver P-1) |
   | Topic covers (16:9) | topic-dream, topic-build, topic-grow, topic-fundable (not generateNow) | 1024x576 |

   The authoritative list, with `proposedAlt` and `subjectBrief` per slot, is `.astro-magazine/media/shotlist-extract.json`.
3. **People classes** (decision F-6): figures only on the 13 allowed slots. Recommended (5): inset-playbooks, svc-b, stage-dream, stage-build, stage-grow. Optional (8, default to an object): inset-program, svc-a, svc-d, pb-1, pb-2, pb-3, pb-5, research-4. All other slots: no person. Cap six figure images at launch; one per page except the stage trio (all or none). Set `figures` in the manifest row.
4. **Seeds**: raster `7000 + slot index`, OG `7100 + card index`. Candidates add 0 and +500 for objects; +1000, +1500, +2000, +2500 for the four figure candidates. Two object candidates per slot; record the seed that was kept, and the rejected seeds with reasons in the commit message.
5. **Prompt** = PREFIX + SUBJECT + SUFFIX (art-direction section 7), model-agnostic, no negations.
   - Object PREFIX: "Editorial still life photograph of a hand-built tabletop model made of paper, card, matte ceramic and brushed steel, photographed as a physical object on a plain pale surface, soft north-window light with long gentle shadows, 50mm lens, shallow depth of field, matte film grade with lifted whites."
   - SUBJECT: one or two plain sentences (view, model, materials), at most seven counted objects, "six-sided hexagon", "blank tiles with completely plain faces", ending "Subject centred with a quiet margin around it." Start from the slot's `subjectBrief`.
   - SUFFIX: "Color palette: crisp white and pale mist-blue surfaces, deep blue and slate, soft grey. There is exactly one amber object in the frame: {ACCENT}. All other objects are white, grey, blue or slate. No text, no logos, no writing." `{ACCENT}` is one concrete object with its material ("the small amber disc at one contour edge", "in amber glass"). On figure slots the amber goes on the model, never on a tool.
   - Figure PREFIX: "Editorial documentary photograph of a calm working session around a hand-built tabletop model ...", SUBJECT "Framed from the chest down so that no head is in the frame: {N} person(s), in {named knitwear}, {seated or standing} at {table}, forearms on the table, {working at the model}, in front of {the model}." N is one to three; name the garments; never "a team".
   - Never write an unwanted noun ("no flag" summons flags). Keep the model's own quirks (negative prompt, steps, size limit) out of the template; Boogu-specific notes go in a new section 8.x of the art direction, not in the prompts.
6. **QA rubric** (view every candidate at full size and at 100% on edges, hands and small parts). Reject on: legible or garbled text, numerals, logos, watermarks; screens with legible content; more or fewer than one amber object, or amber over about 6% of the frame; summoned objects (flags, poles, pins, spires, locks, shields, charts, trophies, any banned symbol); wrong geometry (irregular hexagons, octagons, uneven spacing); counts that contradict the alt; the same model or accent twice on a page; copy mismatch (customers, traction, premises, a security control, a result or promise, an identity); key elements outside the central 70% (cards) or the stage ellipse; and for figures any head, face or eye contact, more than three figures, a suit, a hand close-up, a screen, a figure on a forbidden slot, two figure images on one page (stage trio excepted), anatomy faults. `amber_qa.py` (scratch, may be gone) ranks candidates only; a person approves.
7. **File budgets**: card at most 60 KB at 512 and 1024 wide variants of the same encode, band at most 120 KB, 1024 cap. The srcset is built by Astro from the master, so only the master needs to meet the 1024 budget; `npm run audit:images` in CI checks the built files.
8. **Manifest row** per replaced slot: `source: "generated"`, `model: "Boogu/Boogu-Image-0.1-Turbo"`, `seed`, `prompt` (text) and `promptSha256`, `generatedAt`, `figures`, new `alt` written from the image (describes the activity or object, never an identity, role or employer; at least 20 characters; not generic), `bytes`, `quality`. Run `node .astro-magazine/media/assemble-manifest.mjs` only if the vector rows need rebuilding; it keeps generated rows. Set `generation.status` to `done` when finished.
9. **Disclosure**: the first generated slot makes the footer show "Illustrative images, some AI-generated. Figures shown are not real people, founders, clients or WE staff." Check it on one built page. `tests/unit/wp-12b` must stay green; it fails on a figure outside the 13 slots, a second figure per page, a partial stage trio, more than six figures, a generic alt, a wrong master size and a wrong source spelling.
10. **Then** commit in small groups (by section), push, watch the pipeline to green, ff-merge to `demo`, watch the demo pipeline, and close issue #22. Consider migrating `src/pages/index.astro` (home band, home preload) in the same change with a WP-15 exception row; the hero images can then also take a srcset.
