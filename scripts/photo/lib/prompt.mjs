// Prompt builder: PREFIX + SUBJECT + SUFFIX (art direction section 7). Pure; no I/O.
// Prompts are model-agnostic and positive-only: an unwanted noun is never written, because naming it summons it ("no flag" drew
// flags). The ban list lives in the QA rubric and in `lintParts`, not in the prompt text.
import { FIGURE_OFFSETS, OBJECT_OFFSETS, sha256 } from './common.mjs';

export const OBJECT_PREFIX =
  'Editorial still life photograph of a hand-built tabletop model made of paper, card, matte ceramic and brushed steel, photographed as a physical object on a plain pale surface, soft north-window light with long gentle shadows, 50mm lens, shallow depth of field, matte film grade with lifted whites.';

export const FIGURE_PREFIX =
  'Editorial documentary photograph of a calm working session around a hand-built tabletop model made of paper, card, matte ceramic and brushed steel, soft north-window daylight, 50mm lens, shallow depth of field, matte film grade with lifted whites.';

/** How the frame is composed, by slot group. Cards and covers keep the middle 70 percent; stage images are clipped to a hexagon; bands are cropped wide. */
export const ENDINGS = Object.freeze({
  card: 'Subject centred with a quiet margin around it.',
  stage: 'Subject centred with a generous quiet margin around it, every key element near the middle of the frame.',
  band: 'Subject spread along the horizontal centre line with wide quiet margins left and right.',
});

export function endingFor(group) {
  if (group === 'stage') return 'stage';
  if (group === 'band' || group === 'topic') return 'band';
  return 'card';
}

export function suffixFor(accent) {
  return `Color palette: crisp white and pale mist-blue surfaces, deep blue and slate, soft grey. There is exactly one amber object in the frame: ${accent}. All other objects are white, grey, blue or slate. No text, no logos, no writing.`;
}

const COUNT_WORDS = { 1: 'one person only', 2: 'two people', 3: 'three people' };

/** SUBJECT of a figure scene: chest-down framing, a stated headcount, named knitwear (art direction 4.4). */
export function figureSubject({ count, garments, posture, table, activity, model }) {
  const people = COUNT_WORDS[count];
  if (people === undefined) throw new Error(`A figure scene has one to three people, got ${count}.`);
  return `Framed from the chest down so that no head is in the frame: ${people}, in ${garments}, ${posture} at ${table}, forearms on the table, ${activity}, in front of ${model}.`;
}

/** Assemble the object prompt of a prompt file. */
export function buildObjectPrompt(file) {
  const { subject, accent } = file.object;
  return [OBJECT_PREFIX, subject, ENDINGS[endingFor(file.group)], suffixFor(accent)].join(' ');
}

/** Assemble the figure prompt of a prompt file, or null when the slot carries no figure variant. */
export function buildFigurePrompt(file) {
  if (!file.figure) return null;
  return [FIGURE_PREFIX, figureSubject(file.figure), ENDINGS[endingFor(file.group)], suffixFor(file.figure.accent)].join(' ');
}

export function buildPrompts(file) {
  return { object: buildObjectPrompt(file), figure: buildFigurePrompt(file) };
}

export function hashPrompts(prompts) {
  return { object: sha256(prompts.object), figure: prompts.figure === null ? null : sha256(prompts.figure) };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Negative prompt. The two turbo models run at CFG 1.0 and take none; a model that does (models.json `negativePrompt`) gets this
// list as a separate field, and the positive prompt stays positive either way (art direction 7.3).
export const NEGATIVE_PROMPT =
  'text, letters, numerals, logos, watermark, writing, flag, pole, pin, spire, padlock, shield, seal, badge, chart, trophy, handshake, lightbulb, screen, face, eyes, head, suit, extra fingers, distorted hexagon, second amber object';

// ---------------------------------------------------------------------------------------------------------------------------------
// Lint of the hand-authored parts (subject, accent, figure fields). The template wording is exempt: it is the proven text.
const NEGATION = /\b(?:no|not|never|without|none|nothing|avoid|don't|do not|neither|nor)\b/i;
const NUMBER_WORDS_ABOVE_SEVEN = /\b(?:eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|twenty|dozen|hundred)\b/i;
const BANNED_NOUNS = new RegExp(
  `\\b(?:${[
    'flags?', 'poles?', 'pins?', 'spires?', 'padlocks?', 'locks?', 'shields?', 'seals?', 'badges?', 'checkmarks?', 'certificates?',
    'charts?', 'graphs?', 'trophy', 'trophies', 'rockets?', 'podiums?', 'coins?', 'money', 'currency', 'price tags?', 'globes?',
    'handshakes?', 'light ?bulbs?', 'puzzle', 'brains?', 'screens?', 'monitors?', 'laptops?', 'phones?', 'logos?', 'text', 'words?',
    'letters?', 'numerals?', 'numbers?', 'digits?', 'clocks?', 'calendars?', 'dials?', 'rulers?', 'scales?', 'gavels?', 'arrows?',
    'offices?', 'boardrooms?', 'buildings?', 'streets?', 'cityscapes?', 'suits?', 'jackets?', 'blazers?', 'ties?', 'faces?',
    'eyes?', 'heads?', 'sticky notes?', 'hologram', 'rooms?', 'chairs?', 'sun', 'sunrise', 'sunset',
  ].join('|')})\\b`,
  'i',
);
const AMBER_MATERIAL = /\b(?:glass|ceramic|enamel|paper|foil|silk|cloth|stock|wood|steel|resin|lacquer|glaze)\b/i;
const KNITWEAR = /\b(?:knit|knitwear|cardigan|cardigans|sweater|sweaters|jumper|jumpers|pullover|pullovers)\b/i;
const FIGURE_FORBIDDEN = /\b(?:suit|suits|jacket|blazer|screen|laptop|monitor|phone|pointing|points|handshake|shaking|crowd|team|founders?|mentors?|staff|investors?|customers?|clients?)\b/i;

/**
 * Problems in the hand-authored parts of a prompt file. `people` is the slot's people class. Returns one message per problem.
 */
export function lintParts(file) {
  const problems = [];
  const fail = (message) => problems.push(`${file.id}: ${message}`);
  const parts = { subject: file.object?.subject, 'object accent': file.object?.accent };
  if (file.figure) {
    for (const key of ['garments', 'posture', 'table', 'activity', 'model']) parts[`figure ${key}`] = file.figure[key];
    parts['figure accent'] = file.figure.accent;
  }
  for (const [name, text] of Object.entries(parts)) {
    if (typeof text !== 'string' || text.trim() === '') {
      fail(`${name} is missing`);
      continue;
    }
    if (NEGATION.test(text)) fail(`${name} contains a negation ("${NEGATION.exec(text)[0]}"); say what is there instead`);
    if (/[0-9#%()]/.test(text)) fail(`${name} contains a digit, hash, percent sign or parenthesis; use words and plain clauses`);
    if (NUMBER_WORDS_ABOVE_SEVEN.test(text)) fail(`${name} asks for a count above seven ("${NUMBER_WORDS_ABOVE_SEVEN.exec(text)[0]}")`);
    if (name !== 'figure garments' && BANNED_NOUNS.test(text)) fail(`${name} names a banned or summoning noun ("${BANNED_NOUNS.exec(text)[0]}")`);
    if (/\bamber\b/i.test(text) && !name.endsWith('accent')) fail(`${name} mentions amber; the accent clause names the one amber object`);
  }
  for (const key of ['object accent', 'figure accent']) {
    const accent = parts[key];
    if (typeof accent !== 'string') continue;
    if (!/\bamber\b/i.test(accent)) fail(`${key} does not say amber`);
    else if (!AMBER_MATERIAL.test(accent)) fail(`${key} names no material (glass, ceramic, enamel, paper, foil, silk, cloth)`);
    if ((accent.match(/\bamber\b/gi) ?? []).length > 1) fail(`${key} says amber more than once; name the one amber object a single time`);
  }
  const subject = file.object?.subject ?? '';
  if (/\bhexagon/i.test(subject) && !/\bsix-sided\b/i.test(subject)) fail('subject mentions a hexagon without "six-sided" (plain "hexagon" drew octagons)');
  if (file.figure) {
    if (file.people === 'forbidden') fail('a figure variant on a slot the people policy forbids');
    if (!KNITWEAR.test(file.figure.garments ?? '')) fail('figure garments name no knitwear (unnamed wardrobe at distance becomes dark suits)');
    for (const key of ['garments', 'posture', 'table', 'activity', 'model']) {
      if (FIGURE_FORBIDDEN.test(file.figure[key] ?? '')) fail(`figure ${key} contains a banned word ("${FIGURE_FORBIDDEN.exec(file.figure[key])[0]}")`);
    }
    if (!Number.isInteger(file.figure.count) || file.figure.count < 1 || file.figure.count > 3) fail('figure count is not one to three');
    if (file.figure.count > 2 && file.group !== 'stage') fail('three figures only in a wide scene; cards and stage images take at most two');
  }
  return problems;
}

/** Problems in the assembled prompts: length, drift from the stored text, and template integrity. */
export function lintAssembled(file) {
  const problems = [];
  const built = buildPrompts(file);
  const hashes = hashPrompts(built);
  for (const kind of ['object', 'figure']) {
    const stored = file.prompts?.[kind] ?? null;
    if (stored !== built[kind]) problems.push(`${file.id}: stored ${kind} prompt differs from the builder output; run node scripts/photo/build-prompts.mjs`);
    const storedHash = file.promptSha256?.[kind] ?? null;
    if (storedHash !== hashes[kind]) problems.push(`${file.id}: stored ${kind} hash is stale; run node scripts/photo/build-prompts.mjs`);
    if (built[kind] !== null && built[kind].length > 1400) problems.push(`${file.id}: ${kind} prompt is ${built[kind].length} characters, keep it under 1400`);
  }
  if (!built.object.startsWith(OBJECT_PREFIX)) problems.push(`${file.id}: object prompt does not start with the template prefix`);
  return problems;
}

// ---------------------------------------------------------------------------------------------------------------------------------
/**
 * Which candidates to generate for a slot: `{ kind, offset, seed, prompt }[]`.
 * Objects take offsets 0 and +500; figures take +1000, +1500, +2000, +2500 and only on a slot the people policy allows.
 * `figures`: "none" (objects only), "recommended" (default: figure candidates on the five recommended slots) or "all" (also the eight optional).
 * `candidates` caps the number of candidates per kind.
 */
export function candidatePlan(file, base, { figures = 'recommended', candidates = Infinity } = {}) {
  if (!['none', 'recommended', 'all'].includes(figures)) throw new Error(`--figures is none, recommended or all, got "${figures}".`);
  const plan = OBJECT_OFFSETS.slice(0, candidates).map((offset) => ({ kind: 'object', offset, seed: base + offset, prompt: file.prompts.object }));
  const wantsFigure = file.figure && file.people !== 'forbidden' && (figures === 'all' || (figures === 'recommended' && file.people === 'recommended'));
  if (wantsFigure) {
    for (const offset of FIGURE_OFFSETS.slice(0, candidates)) plan.push({ kind: 'figure', offset, seed: base + offset, prompt: file.prompts.figure });
  }
  return plan;
}
