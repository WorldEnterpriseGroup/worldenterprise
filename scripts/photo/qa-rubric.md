# Vision QA rubric for generated photos

Phase B of the photography pass (issue #22). Every candidate in staging is judged against this rubric by looking at it. One reviewer
(a person or a QA agent that can open images with the Read tool) works through `qa-queue.json` and writes one result file per
candidate. `promote.mjs --from-qa` then picks the best passing candidate per slot.

The prompts are positive-only: they never name what must not appear, because naming a thing summons it. This rubric is where the ban
list lives.

## What you get

`node scripts/photo/qa-sheet.mjs` writes, per candidate, a PNG sheet and one entry in
`<staging>/<model>/qa-queue.json`:

| Queue field | Use |
| --- | --- |
| `sheet` | Open this with Read. Top: the master with the page crop (solid) and the safe zone (dashed) drawn on it. Middle: what the page shows (hexagon clip, 1.9:1 / 3.2:1 / 5:1 band crops, or the card detail crop). Bottom: every srcset width below the master at its own pixel size. |
| `image` | The raw candidate, for a closer look. |
| `copy.anchor` | The page copy this image sits beside. The image must support it, not contradict it. |
| `copy.convey`, `copy.avoid` | What the image should say, and what it must not suggest. |
| `prompt`, `figures` | What was asked for. A figure candidate has `figures` of 1 to 3. |
| `amberPrefilter` | A colour count of amber blobs. A pre-filter only: it cannot see text, hands or a flag. Always look. |
| `people`, `group`, `srcsetWidths`, `master` | The slot's people class, group, widths to check and master size. |
| `resultPath` | Where to write the result JSON. |

## The five checks

A candidate passes only if all five pass. Write a one-sentence `note` for every check, pass or fail, saying what you saw.

### 1. Copy match (`copyMatch`)

Read `copy.anchor`, then look at the image. Pass when the picture supports the sentence beside it and conveys `copy.convey`.
Fail when:

- it suggests something the copy does not claim: an outcome, a result, a launch, a win, growth, funding, security, a certification;
- it matches a different slot better (two slots drawing the same picture is a fail for the later one);
- the object count or arrangement contradicts the copy (the copy says seven, the image shows a ring of nine: the alt must not state a count, and the image must still read as "many around one");
- it hits anything in `copy.avoid`.

### 2. Brand palette (`palette`)

The brand is blue, charcoal and mist, with exactly one amber accent. Pass when:

- the scene reads as deep blue, slate, white and mist-blue surfaces with soft grey;
- there is **exactly one** amber object (`amberObjects: 1`), and it is small (under about 6 percent of the frame), on the intended object, and made of a material (glass, enamel, paper, foil), not a tool or a lamp;
- no other saturated hue competes: no green, red, purple or pink object, and no warm orange or brown cast over the whole frame.

Fail on zero or two or more amber objects, amber light washing the scene, an amber figure garment, a warm golden-hour cast, or a dominant off-palette colour. Brown wood is allowed as a material but counts as a second amber if it reads as amber.

### 3. People policy (`people`)

The policy is in `.plan/photo/people-policy.json` and manifest rule `Q-photo-alt`. Pass when:

- an **object** candidate (`figures: 0`) shows **no person, no part of a person, no skin, no reflection of one**. Not a hand, not a shadow of one;
- a **figure** candidate (`figures` 1 to 3) shows exactly that many people, framed **chest-down with no head in the frame** and **no face**, forearms on a table, in plain knitwear (navy, grey or white), working at the tabletop model;
- nothing implies who anyone is: no name tag, lanyard, badge, laptop, screen, handshake, pointing, whiteboard presentation, crowd, suit or jacket, no setting that reads as an office, boardroom or pitch;
- nothing reads as a **founder, staff member, client, mentor, investor or testimonial**. The people are anonymous and the scene is a working session, never a portrait.

Set `facesVisible: true` for any face or any head, even turned away or blurred. Set `impliedIdentity: true` if the scene casts anyone in a role. Either one fails the candidate outright.

### 4. Artifacts (`artifacts`)

Look at the master at full size and at the 512 px width. Fail on any of these, and set the matching flag:

- `textOrGlyphs`: any letter, numeral, glyph-like scribble, logo, watermark, or readable or unreadable writing, on paper, spines, tiles, tokens or the surface;
- `handsOrFingers`: any hand with extra, fused or missing fingers, melted hands, or a hand that reads as anything other than a plain forearm and hand resting or placing a tile;
- `malformedHexagons`: tiles that are not clean six-sided hexagons (five, seven or eight sides, warped, merged, a honeycomb that turns irregular), or a count that is visibly broken (a row with a missing or doubled tile when the subject needs a clean row).

Also fail on: melted or duplicated objects, floating objects with no support, impossible shadows, a screen or device, a flag, pole, pin, spire, padlock, shield, seal, badge, chart, trophy, handshake or lightbulb, a visible room, window view or building, and heavy blur or banding that survives at 512 px.

### 5. Crop safety (`cropSafety`)

Check **every** srcset width listed for the slot (`srcsetWidths`), narrowest first, and record each in `widths`. The images are pure scales of the master, so a width fails when its content is lost or unreadable at that size or in that crop:

- **band** images: every key element must sit inside the dashed zone of **all three** crops (1.9:1, 3.2:1, 5:1), with nothing important in the outer 12 percent left and right or outside the middle height of the narrowest crop. The amber accent must remain visible in all three;
- **stage** images: every key element, including the amber accent, must sit inside the hexagon clip (the four corners and 5 percent top and bottom are lost);
- **card, inset, svc, pb and research** images: every key element must sit inside the middle 70 percent, because the card and the detail view share the crop;
- at the narrowest width the subject is still recognisable and the amber accent is still a distinct object, not a speck.

`cropSafety.pass` is true only if every entry in `widths` passes.

## Verdict

- `pass` needs: all five checks pass, `amberObjects` is 1, `facesVisible` and `impliedIdentity` are false, all three artifact flags are false, and an `alt` is written.
- Otherwise `fail`, with `reasons` listing each failure in a short phrase ("second amber object on the left", "five-sided tile in the row").
- `score` is 0 to 10 and ranks passing candidates against each other: composition, calm, how well it matches the slot's tone, how clean the hexagons are. Do not give a failing candidate more than 4.

## Alt text (written from what shipped, for every passing candidate)

Look at the image and describe what is shown, as one plain sentence of at least 30 characters and six words. The manifest check
enforces:

- it does not start with "image of", "photo of" or "picture of";
- it is unique across the site;
- it never names an identity or role: no founder, client, customer, investor, partner, mentor, operator, member, staff, team of;
- on an object candidate it never mentions a person, hands, a figure or a face;
- on a figure candidate it describes the activity ("Forearms resting on a long table beside a layered paper contour model"), never who the people are.

Do not state a count unless the image shows exactly that count. Name the amber object.

## Retry and fallback

- If both object candidates of a slot fail, regenerate with `--force --slots <id>` after editing the slot's `scripts/photo/prompts/<id>.json` parts (never the template text), then `node scripts/photo/build-prompts.mjs`.
- A slot that has no passing candidate after one retry stays as its vector composition. Say so in the report. Slots with a `risk` note in their prompt file (pb-4, pb-5, research-2, band-1) are the likeliest to stay vector; that is expected (art direction 5.1).
- The stage trio takes a figure only if all three pass with one. `promote.mjs --from-qa` applies that rule.

## Writing the result

Write one JSON file per candidate to its `resultPath`, matching `scripts/photo/qa-result.schema.json`:

```json
{
  "slot": "svc-c",
  "candidate": "object-0",
  "reviewer": "qa-agent",
  "verdict": "pass",
  "score": 8,
  "alt": "Two large hexagonal blocks, one deep blue and one white, facing each other across a table with one small amber tile between them.",
  "reasons": [],
  "checks": {
    "copyMatch": { "pass": true, "note": "Two facing blocks read as a company and its buyers." },
    "palette": { "pass": true, "note": "Blue and white blocks, one small amber glass tile.", "amberObjects": 1 },
    "people": { "pass": true, "note": "No person or hand anywhere.", "facesVisible": false, "impliedIdentity": false },
    "artifacts": { "pass": true, "note": "Clean hexagons, no marks on the blocks.", "textOrGlyphs": false, "handsOrFingers": false, "malformedHexagons": false },
    "cropSafety": { "pass": true, "note": "Blocks and tile sit inside the middle 70 percent.", "widths": [{ "width": 512, "pass": true }, { "width": 768, "pass": true }, { "width": 1024, "pass": true }] }
  }
}
```

`promote.mjs` validates every result (`lib/qa.mjs`) and refuses an inconsistent one: a `pass` with a failing check, a missing width, an
empty note or an empty alt.
