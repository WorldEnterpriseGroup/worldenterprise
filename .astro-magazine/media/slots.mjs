/**
 * Slot brief table for WP-12: motif (vector fallback), intended ComfyUI prompt, style, filter and alt text.
 * Order defines the seed: seed = 7000 + index (SAGE-PLAN 6.7). OG slots are composed by scripts/build-og.mjs.
 * `alt` is written from the subject of each composition and is what consumers render.
 */
const PAL = 'deep blue, white, soft grey, one small warm amber accent, no people, no text';

const s = (id, group, profile, style, filter, motif, alt, subject, extra = {}) => ({
  id, group, profile, style, filter, motif, alt, prompt: `${subject}, ${PAL}`, ...extra,
});

export const SLOTS = [
  s('inset-program', 'inset', 'card-4x3', 'architectural', 'cool', 'atlas', 'A paper atlas of hexagonal cells in blue and white with one amber cell, drawn as a flat illustration.', 'overhead view of a paper atlas of hexagonal cells on a drafting table'),
  s('inset-services', 'inset', 'card-4x3', 'minimalist', 'cool', 'ring', 'Seven hexagonal tiles arranged in a ring around a deep blue centre tile, one tile edged in amber.', 'seven hexagonal wooden tiles in a ring, one with an amber edge'),
  s('inset-playbooks', 'inset', 'card-4x3', 'minimalist', 'cool', 'notebook', 'An open grid-paper notebook with two hexagon sketches and a blue pencil resting below it.', 'open grid notebook and a blue pencil, overhead'),
  s('inset-fundability', 'inset', 'card-4x3', 'minimalist', 'cool', 'folders', 'Four blank folders in different blues fanned across a pale ground, one folder in amber.', 'stack of blank folders and a brass clip'),
  s('inset-trust', 'inset', 'card-4x3', 'architectural', 'cool', 'shadow', 'Diagonal lattice shadows falling across a pale blue wall with one amber hexagon of light.', 'shadow of an architectural lattice on a pale wall'),
  s('inset-resources', 'inset', 'card-4x3', 'minimalist', 'cool', 'shelf', 'Three shelves of blank blue and white book spines with one amber hexagon marker.', 'bookshelf with blank blue and white spines'),
  s('inset-network', 'inset', 'card-4x3', 'aerial', 'cool', 'bridge', 'Four hexagonal nodes joined by blue arcs over water at dawn, with a small amber sun.', 'aerial of connected bridges over a bay at dawn'),
  s('inset-about', 'inset', 'card-4x3', 'minimalist', 'cool', 'plant', 'A quiet desk with a lamp-free surface and a potted plant whose leaves are hexagons, one in amber.', 'quiet daylight desk with a plant, no people'),
  s('inset-pricing', 'inset', 'card-4x3', 'minimalist', 'cool', 'scale', 'A balanced scale with two blue pans on a pale ground and an amber hexagon at its pivot.', 'balanced brass scale on a pale desk'),
  s('inset-apply', 'inset', 'card-4x3', 'minimalist', 'cool', 'pen', 'A blank sheet of paper marked with a single hexagon and a blue pen with an amber tip beside it.', 'pen on blank paper beside a closed laptop'),
  s('inset-contact', 'inset', 'card-4x3', 'minimalist', 'cool', 'desk', 'A desk beside a window at dawn, with warm amber light and a pale blue sky.', 'window at dawn over a desk'),
  s('svc-a', 'service', 'card-4x3', 'minimalist', 'cool', 'planning', 'A grid of blank swatch cards in white and pale blue, each marked with a small hexagon, one swatch in amber.', 'fabric and paper swatches in blues'),
  s('svc-b', 'service', 'card-4x3', 'minimalist', 'cool', 'lattice', 'A dark blue hexagonal lattice with circuit-like traces and one amber cell.', 'macro of a hexagonal lattice, circuit-like'),
  s('svc-c', 'service', 'card-4x3', 'minimalist', 'cool', 'facing', 'Two large hexagons facing each other across a table line with a small amber cell between them.', 'two empty chairs facing across a table'),
  s('svc-d', 'service', 'card-4x3', 'minimalist', 'cool', 'wall', 'A glass wall covered with blank blue and white notes in loose rows, one note in amber.', 'blank blue sticky notes on a glass wall', { seedShift: 3 }),
  s('svc-e', 'service', 'card-4x3', 'minimalist', 'cool', 'globe', 'A faceted blue globe rising over a horizon with a small amber sun.', 'sunrise over a faceted globe sculpture'),
  s('svc-f', 'service', 'card-4x3', 'minimalist', 'cool', 'stairs', 'Six hexagons rising step by step from lower left to upper right, the last one amber.', 'stairway ascending in a bright atrium'),
  s('svc-g', 'service', 'card-4x3', 'minimalist', 'cool', 'folders', 'Four blank folders in different shades of blue standing side by side.', 'four blank folders in different blues', { seedShift: 5 }),
  s('stage-dream', 'stage', 'card-4x3', 'aerial', 'cool', 'coast', 'Layered coastline contours in blue at dawn with an amber sun on the horizon.', 'coastline survey at dawn'),
  s('stage-build', 'stage', 'card-4x3', 'architectural', 'cool', 'frame', 'A blueprint-style steel frame drawn in pale lines on deep blue with an amber dimension line.', 'blueprint rolls beside a steel frame'),
  s('stage-grow', 'stage', 'card-4x3', 'aerial', 'cool', 'terrace', 'Terraced hillside bands in blue with a hexagon field pattern and a small amber sun.', 'terraced hillside with a hex field pattern'),
  s('pb-1', 'playbook', 'card-4x3', 'minimalist', 'cool', 'atlas', 'A hexagonal field with a central cluster of seven cells and one amber cell, suggesting a problem mapped out.', 'abstract hexagonal composition: a mapped problem space', { seedShift: 7 }),
  s('pb-2', 'playbook', 'card-4x3', 'minimalist', 'cool', 'frame', 'A blueprint-style frame drawn in pale lines on deep blue with an amber cell at its centre, suggesting a product designed to a plan.', 'abstract hexagonal composition: parts around a core', { seedShift: 11 }),
  s('pb-3', 'playbook', 'card-4x3', 'minimalist', 'cool', 'trail', 'A trail of linked hexagons growing larger and ending in an amber cell, suggesting a first release shipped.', 'abstract hexagonal composition: a rising trail', { seedShift: 13 }),
  s('pb-4', 'playbook', 'card-4x3', 'minimalist', 'cool', 'bridge', 'Four hexagonal nodes joined by blue arcs over a water line with a small amber sun, suggesting customers connected to a product.', 'abstract hexagonal composition: a linked trail', { seedShift: 17 }),
  s('pb-5', 'playbook', 'card-4x3', 'minimalist', 'cool', 'honeycomb', 'A dense dark blue honeycomb with several lit cells and one amber cell.', 'abstract hexagonal composition: a repeating honeycomb', { seedShift: 19 }),
  s('topic-dream', 'topic', 'card-landscape', 'abstract', 'cool', 'gradient', 'A pale blue gradient field of large hexagons with one amber cell.', 'hex-gradient field in pale blue', { variant: 0 }),
  s('topic-build', 'topic', 'card-landscape', 'abstract', 'cool', 'gradient', 'A mid blue gradient field of large hexagons with one amber cell.', 'hex-gradient field in mid blue', { variant: 1 }),
  s('topic-grow', 'topic', 'card-landscape', 'abstract', 'cool', 'gradient', 'A light gradient field of large hexagons fading from white to sky blue with one amber cell.', 'hex-gradient field in white and sky blue', { variant: 2 }),
  s('topic-fundable', 'topic', 'card-landscape', 'abstract', 'cool', 'gradient', 'A deep night blue gradient field of large hexagons with one amber cell.', 'hex-gradient field in deep blue', { variant: 3 }),
  s('research-1', 'research', 'card-4x3', 'minimalist', 'cool', 'lattice', 'A dark blue lattice of hexagons with linked nodes, suggesting layered protection, with one amber cell.', 'calm abstract of a protective lattice', { seedShift: 23 }),
  s('research-2', 'research', 'card-4x3', 'minimalist', 'cool', 'shadow', 'Soft diagonal shadow lines over a pale blue wall with one amber hexagon, suggesting light let in.', 'calm abstract of light through a lattice', { seedShift: 29 }),
  s('research-3', 'research', 'card-4x3', 'minimalist', 'cool', 'facing', 'Two hexagons of different tones facing each other with an amber cell between, suggesting a comparison.', 'calm abstract of two options compared', { seedShift: 31 }),
  s('research-4', 'research', 'card-4x3', 'minimalist', 'cool', 'planning', 'A grid of blank cards each marked with a small hexagon, one card in amber.', 'calm abstract of a grid of definitions', { seedShift: 37 }),
  s('band-1', 'band', 'hero-home', 'photo', 'cool', 'desk', 'A remote workspace at golden hour: an empty chair at a desk beside a window with warm amber light.', 'remote desk at golden hour with an empty chair', { seedShift: 41 }),
  s('band-2', 'band', 'hero-home', 'photo', 'cool', 'honeycomb', 'A macro honeycomb of dark blue hexagons with a single glowing amber cell.', 'macro of a hexagonal honeycomb with an amber cell'),
  s('band-3', 'band', 'hero-home', 'photo', 'cool', 'planning', 'A planning table seen from above, covered with blank cards and one amber card.', 'overhead of a planning table with blank cards'),
  s('band-4', 'band', 'hero-home', 'photo', 'cool', 'globe', 'A faceted globe rising at sunrise over a deep blue horizon with a small amber sun.', 'sunrise over a faceted globe', { seedShift: 43 }),
];

export const BUDGET = { 'card-4x3': 60 * 1024, 'card-landscape': 60 * 1024, 'hero-home': 120 * 1024 };
export const SIZE = { 'card-4x3': [1024, 768], 'card-landscape': [1024, 576], 'hero-home': [1024, 576] };
