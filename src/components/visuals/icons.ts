import type { ImageMetadata } from 'astro';
import { primaryNav } from '../../data/nav.ts';
import type { NavLink, ServiceLine } from '../../data/nav.ts';

/**
 * The visuals icon set: the seven service-line hex icons (shared with HexIcon, src/assets/icons/) and the generic program icons
 * (src/assets/visuals/icons/), all hexagon-tile SVGs from the brand kit. They render as <img> files: no inline SVG, no style attributes,
 * cached once for the whole site.
 */
const PROGRAM = import.meta.glob<{ default: ImageMetadata }>('../../assets/visuals/icons/icon-*.svg', { eager: true });
const SERVICE = import.meta.glob<{ default: ImageMetadata }>('../../assets/icons/[A-G]-*.svg', { eager: true });

export const PROGRAM_ICONS = ['calendar', 'checklist', 'clock', 'contact', 'data', 'document', 'gate', 'globe', 'handover', 'report', 'steering', 'team'] as const;
export type ProgramIcon = (typeof PROGRAM_ICONS)[number];
export type IconKey = ProgramIcon | ServiceLine;

export const isIconKey = (key: string): key is IconKey => /^[A-G]$/.test(key) || (PROGRAM_ICONS as readonly string[]).includes(key);

export function iconAsset(key: IconKey): ImageMetadata {
  const entry = /^[A-G]$/.test(key)
    ? Object.entries(SERVICE).find(([path]) => path.includes(`/icons/${key}-`))
    : Object.entries(PROGRAM).find(([path]) => path.endsWith(`/icon-${key}.svg`));
  if (entry === undefined) throw new Error(`visuals: icon "${key}" is missing from the icon set`);
  return entry[1].default;
}

export interface ServiceLineEntry {
  readonly line: ServiceLine;
  readonly label: string;
  readonly href: string;
  readonly description: string | undefined;
}

/** The seven service lines, A to G, as the primary navigation names and links them (one source of truth for names and routes). */
export function serviceLines(): readonly ServiceLineEntry[] {
  const found = new Map<ServiceLine, NavLink>();
  for (const item of primaryNav) {
    if (item.kind !== 'mega') continue;
    for (const column of item.columns) {
      for (const link of column.links) {
        if (link.line !== undefined && !found.has(link.line)) found.set(link.line, link);
      }
    }
  }
  const lines = (['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const).map((line) => {
    const link = found.get(line);
    if (link === undefined) throw new Error(`visuals: service line ${line} is missing from the primary navigation`);
    return { line, label: link.label, href: link.href, description: link.description };
  });
  return lines;
}
