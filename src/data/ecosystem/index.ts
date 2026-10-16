import { ACCELERATORS } from './accelerators.ts';
import { ANGELS } from './angels.ts';
import { COMMUNITIES } from './communities.ts';
import { COWORKING } from './coworking.ts';
import { GOVERNMENT } from './government.ts';
import { INCUBATORS } from './incubators.ts';
import { SBA } from './sba.ts';
import { UNIVERSITY } from './university.ts';
import { CATEGORIES } from './categories.ts';
import type { AudienceId, CategoryId, EcosystemEntry, StageId } from './types.ts';

export { CATEGORIES, CATEGORY_BY_ID } from './categories.ts';
export * from './types.ts';

export const ALL_ENTRIES: readonly EcosystemEntry[] = [
  ...ACCELERATORS,
  ...INCUBATORS,
  ...UNIVERSITY,
  ...COWORKING,
  ...ANGELS,
  ...SBA,
  ...GOVERNMENT,
  ...COMMUNITIES,
];

export function entriesIn(category: CategoryId): readonly EcosystemEntry[] {
  return ALL_ENTRIES.filter((e) => e.category === category);
}

export function countByCategory(): Readonly<Record<CategoryId, number>> {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0])) as Record<CategoryId, number>;
  for (const e of ALL_ENTRIES) out[e.category] += 1;
  return out;
}

export function countByStage(stage: StageId): number {
  return ALL_ENTRIES.filter((e) => e.stages.includes(stage)).length;
}

export function countByAudience(audience: AudienceId): number {
  return ALL_ENTRIES.filter((e) => e.audiences.includes(audience)).length;
}

export function countRemoteFriendly(): number {
  return ALL_ENTRIES.filter((e) => e.delivery === 'online' || e.delivery === 'hybrid').length;
}
