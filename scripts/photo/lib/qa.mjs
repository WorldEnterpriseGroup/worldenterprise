// QA result validation and candidate selection. The result shape is documented in scripts/photo/qa-result.schema.json; this module
// enforces it in code (no schema library: the repo has no build tooling beyond what ships) and applies the rubric's verdict rules.

export const CHECKS = Object.freeze(['copyMatch', 'palette', 'people', 'artifacts', 'cropSafety']);
export const VERDICTS = Object.freeze(['pass', 'fail']);

/** Problems in one QA result against the schema and the rubric rules. Empty means valid. */
export function validateQaResult(result, { slotId, candidate, srcsetWidths } = {}) {
  const problems = [];
  const fail = (message) => problems.push(message);
  if (typeof result !== 'object' || result === null) return ['result is not an object'];
  if (typeof result.slot !== 'string' || result.slot === '') fail('slot is missing');
  else if (slotId !== undefined && result.slot !== slotId) fail(`slot is ${result.slot}, expected ${slotId}`);
  if (!/^(object|figure)-\d+$/.test(result.candidate ?? '')) fail('candidate is not object-<offset> or figure-<offset>');
  else if (candidate !== undefined && result.candidate !== candidate) fail(`candidate is ${result.candidate}, expected ${candidate}`);
  if (!VERDICTS.includes(result.verdict)) fail(`verdict "${result.verdict}" is neither pass nor fail`);
  if (!Number.isInteger(result.score) || result.score < 0 || result.score > 10) fail('score is not an integer from 0 to 10');
  if (typeof result.reviewer !== 'string' || result.reviewer === '') fail('reviewer is missing');
  if (!Array.isArray(result.reasons)) fail('reasons is not an array');

  const checks = result.checks ?? {};
  for (const name of CHECKS) {
    const check = checks[name];
    if (typeof check !== 'object' || check === null) fail(`checks.${name} is missing`);
    else {
      if (typeof check.pass !== 'boolean') fail(`checks.${name}.pass is not a boolean`);
      if (typeof check.note !== 'string' || check.note.trim() === '') fail(`checks.${name}.note is empty; say what was seen`);
    }
  }
  if (checks.palette && !Number.isInteger(checks.palette.amberObjects)) fail('checks.palette.amberObjects is not an integer');
  if (checks.people) {
    if (typeof checks.people.facesVisible !== 'boolean') fail('checks.people.facesVisible is not a boolean');
    if (typeof checks.people.impliedIdentity !== 'boolean') fail('checks.people.impliedIdentity is not a boolean');
  }
  if (checks.artifacts) {
    for (const key of ['textOrGlyphs', 'handsOrFingers', 'malformedHexagons']) {
      if (typeof checks.artifacts[key] !== 'boolean') fail(`checks.artifacts.${key} is not a boolean`);
    }
  }
  if (checks.cropSafety) {
    const widths = checks.cropSafety.widths;
    if (!Array.isArray(widths) || widths.length === 0) fail('checks.cropSafety.widths lists no widths');
    else {
      for (const entry of widths) if (!Number.isInteger(entry.width) || typeof entry.pass !== 'boolean') fail('checks.cropSafety.widths has a malformed entry');
      if (srcsetWidths) {
        const have = new Set(widths.map((entry) => entry.width));
        for (const width of srcsetWidths) if (!have.has(width)) fail(`checks.cropSafety.widths misses the ${width}px srcset width`);
      }
      if (checks.cropSafety.pass === true && widths.some((entry) => entry.pass === false)) fail('cropSafety passes although a width fails');
    }
  }

  // Verdict rules from the rubric: pass needs every check to pass and the hard-fail booleans to be clear, and a written alt.
  if (result.verdict === 'pass') {
    for (const name of CHECKS) if (checks[name]?.pass !== true) fail(`verdict is pass but checks.${name} does not pass`);
    if (checks.palette?.amberObjects !== 1) fail('verdict is pass but the amber object count is not exactly one');
    if (checks.people?.facesVisible === true || checks.people?.impliedIdentity === true) fail('verdict is pass but the people check shows a face or an implied identity');
    if (checks.artifacts && (checks.artifacts.textOrGlyphs || checks.artifacts.handsOrFingers || checks.artifacts.malformedHexagons)) fail('verdict is pass but an artifact flag is set');
    if (typeof result.alt !== 'string' || result.alt.trim() === '') fail('verdict is pass but alt is empty; write alt from what the image shows');
  }
  return problems;
}

/**
 * Choose what to promote from validated QA results: per slot, the passing candidate with the highest score (ties: the lower seed offset).
 * Figure policy: `figures` is "none" (objects only) or "recommended" (figures only on recommended slots, and the stage trio all or none:
 * if all three stage slots have a passing figure candidate they take it, otherwise all three take their best object).
 * Returns `{ picks: { slot, candidate, alt }[], skipped: { slot, reason }[] }`.
 */
export function selectFromQa(results, extract, { figures = 'recommended' } = {}) {
  const peopleOf = new Map(extract.slots.map((slot) => [slot.id, slot.people]));
  const passing = results.filter((result) => result.verdict === 'pass');
  const best = (list) => [...list].sort((a, b) => b.score - a.score || Number(a.candidate.split('-')[1]) - Number(b.candidate.split('-')[1]))[0];
  const bySlot = new Map();
  for (const result of passing) bySlot.set(result.slot, [...(bySlot.get(result.slot) ?? []), result]);

  const figureAllowed = (slotId) => figures === 'recommended' && peopleOf.get(slotId) === 'recommended';
  const pickFor = (slotId, { allowFigure }) => {
    const options = (bySlot.get(slotId) ?? []).filter((result) => allowFigure || result.candidate.startsWith('object-'));
    return options.length === 0 ? null : best(options);
  };

  const stageIds = extract.slots.filter((slot) => slot.group === 'stage' && slot.kind === 'raster').map((slot) => slot.id);
  const stageFigures = stageIds.map((id) => pickFor(id, { allowFigure: figureAllowed(id) }));
  const stageAllFigures = figures === 'recommended' && stageFigures.every((pick) => pick?.candidate.startsWith('figure-'));

  const picks = [];
  const skipped = [];
  for (const slotId of new Set([...bySlot.keys(), ...extract.slots.filter((slot) => slot.kind === 'raster' && slot.generateNow).map((slot) => slot.id)])) {
    const isStage = stageIds.includes(slotId);
    const pick = isStage ? pickFor(slotId, { allowFigure: stageAllFigures }) : pickFor(slotId, { allowFigure: figureAllowed(slotId) });
    if (pick) picks.push({ slot: slotId, candidate: pick.candidate, alt: pick.alt });
    else skipped.push({ slot: slotId, reason: (bySlot.get(slotId) ?? []).length === 0 ? 'no passing candidate' : 'only figure candidates pass and the policy does not take them here' });
  }
  return { picks, skipped };
}
