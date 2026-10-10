import { isLiveOnDisk } from './live.ts';
import type { Audience } from '../families.ts';
import { FALLBACK_SURFACE, SURFACES } from './map.ts';
import { keyForVariant, targetFor } from './targets.ts';
import type { Target } from './targets.ts';
import type { CtaAction, CtaModel, IsLive, ResolveInput, SurfaceMatch, SurfaceRule, TargetKey } from './types.ts';

export type { CtaAction, CtaCollection, CtaModel, CtaPlacement, CtaVariant, IsLive, ResolveInput, SurfaceRule, TargetKey } from './types.ts';
export type { Audience };
export { FALLBACK_SURFACE, SURFACES } from './map.ts';
export { allKeys, keyForVariant, NO_FUNDING_NOTE, targetFor } from './targets.ts';

/**
 * CTA resolution (docs/wave8-contracts.md, section 6.1). Pure: no Astro imports, no side effects. The only outside fact is whether a
 * ledger path is live, which the caller may pass (the unit tests do) and which otherwise is read from disk (`src/data/cta/live.ts`).
 *
 * Order: the frontmatter `cta`, then the surface rows of `map.ts` (path, then section, then collection and desk), then the layout
 * default, then nothing. A candidate whose target is not live is skipped, so a brief that was cut falls back to the next candidate and
 * no band ever links a dead page. A band with no live primary is `null`.
 */

function matches(match: SurfaceMatch, input: ResolveInput): boolean {
  if (match.path !== undefined && match.path !== input.path) return false;
  if (match.prefix !== undefined && !input.path.startsWith(match.prefix)) return false;
  if (match.collection !== undefined && match.collection !== input.collection) return false;
  if (match.desks !== undefined && match.desks.length > 0 && !(input.topic !== undefined && (match.desks as readonly string[]).includes(input.topic))) return false;
  return true;
}

export interface SurfaceMatchResult {
  readonly rule: SurfaceRule;
  /** True when no row named the document and the layout default decided. */
  readonly fallback: boolean;
}

/** The row of the default map that decides a document. */
export function findSurface(input: ResolveInput): SurfaceMatchResult {
  const rule = SURFACES.find((candidate) => matches(candidate.match, input));
  return rule === undefined ? { rule: FALLBACK_SURFACE, fallback: true } : { rule, fallback: false };
}

interface Picked {
  readonly key: TargetKey;
  readonly target: Target;
}

/** The first candidate with a target that can carry a band (when `band` is set) and whose path is live and is not `except`. */
function pick(keys: readonly TargetKey[], isLive: IsLive, options: { readonly band: boolean; readonly except?: string }): Picked | undefined {
  for (const key of keys) {
    const target = targetFor(key);
    if (target === undefined) continue;
    if (options.band && target.band === undefined) continue;
    if (target.href === options.except) continue;
    if (!isLive(target.href)) continue;
    return { key, target };
  }
  return undefined;
}

const action = (target: Target): CtaAction => ({ label: target.label, href: target.href });

function modelFrom(id: string, audience: Audience, primary: Picked, secondary: Picked | undefined): CtaModel | null {
  const band = primary.target.band;
  if (band === undefined) return null;
  return {
    id,
    audience,
    variant: primary.target.variant,
    heading: band.heading,
    body: band.body,
    primary: action(primary.target),
    ...(secondary !== undefined ? { secondary: action(secondary.target) } : {}),
    ...(band.note !== undefined ? { note: band.note } : {}),
  };
}

/** The end-of-page band for a document, or null when the surface has none or no primary target is live. */
export function resolveCta(input: ResolveInput, isLive: IsLive = isLiveOnDisk): CtaModel | null {
  const { rule } = findSurface(input);
  if (rule.primary.length === 0) return null;
  const override = input.frontmatterCta === undefined ? undefined : keyForVariant(input.frontmatterCta.variant, input.frontmatterCta.briefId);
  const overridePrimary = override !== undefined && (rule.frontmatter ?? 'primary') === 'primary';
  const overrideSecondary = override !== undefined && rule.frontmatter === 'secondary';
  const primary = pick(overridePrimary ? [override, ...rule.primary] : rule.primary, isLive, { band: true });
  if (primary === undefined) return null;
  const secondary = pick(overrideSecondary ? [override, ...rule.secondary] : rule.secondary, isLive, { band: false, except: primary.target.href });
  return modelFrom(primary.key, rule.audience, primary, secondary);
}

/**
 * The mid-body band for a long document: one primary and nothing else, because the inline band is a single sentence and a link. Null
 * when the surface has no mid band or its target is not live. The hast plugin (`src/lib/rehype-mid-cta.ts`) places it.
 */
export function resolveMidCta(input: ResolveInput, isLive: IsLive = isLiveOnDisk): CtaModel | null {
  const { rule } = findSurface(input);
  if (rule.mid === undefined) return null;
  const primary = pick([rule.mid], isLive, { band: true });
  return primary === undefined ? null : modelFrom(`mid:${primary.key}`, rule.audience, primary, undefined);
}

/**
 * A band for one named target, for a component that is given a variant (and a brief id) instead of a document: the `variant` and
 * `briefId` props of `CtaBand`. Null when the target is not live.
 */
export function ctaForTarget(
  variant: CtaModel['variant'],
  options: { readonly briefId?: string; readonly audience?: Audience } = {},
  isLive: IsLive = isLiveOnDisk,
): CtaModel | null {
  const primary = pick([keyForVariant(variant, options.briefId)], isLive, { band: true });
  return primary === undefined ? null : modelFrom(primary.key, options.audience ?? 'startup', primary, undefined);
}
