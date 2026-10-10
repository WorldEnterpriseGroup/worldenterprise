# WP-12d handoff: photo-generation rig for phase B

Branch `wp/12d`, issue #27 (this rig), issue #22 stays open until phase B has promoted images and the demo pipeline is green. The rig is dev tooling in `scripts/photo/`; nothing there is imported by `src/` or shipped to `dist/`. No dry-run image was committed and no manifest row was flipped.

## Phase B: the command sequence

Prerequisites: `kubectl` access to namespace `gpu-suite`, `az login` (the router key is read from Azure Key Vault `omlab-secrets`, secret `hardmagic-internal-api-key`, or from `HARDMAGIC_INTERNAL_KEY`; it is never printed), and `boogu_image_turbo` Ready on the GPU router.

```
scripts/photo/phase-b.sh --probe --model boogu_image_turbo
scripts/photo/phase-b.sh --model boogu_image_turbo
```

1. The first line only says whether the model is serving (exit 3 and a message if not; nothing is generated). The second starts the port-forward on `localhost:18200` if needed, probes, generates every candidate serially (resumable: rerun the same command after an interruption), and builds the QA sheets and `qa-queue.json`.
2. **QA pass.** Open `<staging>/boogu_image_turbo/qa-queue.json` (staging defaults to `~/.cache/we-photo-staging`, or `PHOTO_STAGING`). For each item, view `sheet` with the Read tool and write the result JSON to `resultPath` following `scripts/photo/qa-rubric.md` and `scripts/photo/qa-result.schema.json`. A separate QA agent can do this from the queue alone; each item carries the copy, the prompt, the srcset widths and the amber pre-filter.
3. **Promote.** `node scripts/photo/promote.mjs --from-qa --model boogu_image_turbo --dry`, read the plan, then the same without `--dry`. It picks the best passing candidate per slot, encodes the AVIF masters into `src/assets/photo/`, rewrites the manifest rows, validates the whole manifest and runs `tests/unit/wp-12b/`; on failure it restores everything.
4. Commit `src/assets/photo` in small groups, push, watch the pipeline green, merge to `demo`, watch demo green, flip `generation.status` to `done` in `manifest.json`, close #22.

Generate flags (also accepted by `phase-b.sh`): `--slots id,id`, `--candidates N` (cap per slot; default is the whole plan, 2 objects plus 4 figures where allowed), `--figures none|recommended|all` (default `recommended`), `--include-hold`, `--staging DIR`, `--plan` (print the work list, call nothing), `--force`. A first, cheap trial: `scripts/photo/phase-b.sh --model boogu_image_turbo --slots svc-b,band-1 --candidates 1`.

Ownership: promotion writes under `src/assets/photo/**`, which is WP-12b's write set. Whoever runs phase B needs that ownership (or an exception row).

## Scope

- 38 raster slots; 30 are `generateNow`. Hold (not generated unless `--include-hold`): inset-resources, inset-about, topic-dream, topic-build, topic-grow, topic-fundable, band-2, band-3. The 9 OG cards stay SVG-composed.
- Figures only on the 13 people-allowed slots, four candidates each at seeds +1000 to +2500. `recommended` generates figures for inset-playbooks, svc-b and the stage trio; the 8 optional slots stay objects unless you pass `--figures all`. The stage trio takes figures all or none; at most six figure images.
- Prompts: 38 files in `scripts/photo/prompts/` generated from the shotlist and art direction by `build-prompts.mjs` (`--check` verifies them and the lint: positive wording only, no digits, one named amber object). Each prompt was written against the copy that sits beside the slot. Re-run `node scripts/photo/build-prompts.mjs` after editing `lib/prompt.mjs`.
- Risk slots to look at first: pb-4, pb-5, research-2, band-1.

## Dry-run findings (mage_flow_turbo, svc-b, stage-dream, band-1, inset-apply, inset-playbooks)

- The rig works end to end: probe, serial generation at exact 1024x768 and 1024x576, resume by prompt hash, amber pre-filter, QA sheets, queue.
- Heads are the main risk. "Framed from the chest down" was ignored (faces appeared). The close-up wording now in the figure template (only forearms and hands, top edge through the middle of the torso) removes faces but a chin can still show at the top edge in some seeds. The `facesVisible` QA gate decides; do not skip the four candidates. Boogu may behave differently: try one figure slot first.
- Amber: an accent described as a part of the structure turns whole parts amber or doubles. A small separate tile resting on a named surface lands once. inset-apply and svc-b use that form. Other slots whose accent is a structural part (svc-f first block, svc-d hanging tile, pb-3 last block) carry the same risk; if Boogu repeats it, change the accent clause in `lib/prompt.mjs`, not the QA.
- The model draws octagons and heptagons for hexagonal plates (svc-b plates are octagonal in several seeds). `malformedHexagons` is a QA check.
- The amber pre-filter flags skin tones, so every figure candidate reads `REVIEW`; it ranks objects only.
- QA sheets are JPEG capped at 1600 px; a PNG sheet reached 2.4 MB and the Read tool refuses files over 2 MB.

## Files

`scripts/photo/`: `phase-b.sh`, `generate.mjs`, `promote.mjs`, `qa-sheet.mjs`, `build-prompts.mjs`, `models.json`, `qa-rubric.md`, `qa-result.schema.json`, `prompts/*.json`, `lib/{common,prompt,router,staging,encode,amber,promote-core,qa,qa-views}.mjs`. Tests: `tests/unit/wp-12d/` (`node --test "tests/unit/wp-12d/*.test.ts"`). Decisions: P-6 to P-10 (WP-12d section) in `.astro-magazine/decisions.md`.
