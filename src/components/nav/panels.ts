import type { NavColumn, NavFeatured, NavLink, NavSection } from '../../data/nav.ts';

/**
 * What one mega-menu panel and one mobile drawer section render, derived from the navigation data without changing it (DP-3).
 * Pure, so node --test can run it.
 */
export interface PanelColumn extends NavColumn {
  /**
   * Whether the column shows its descriptions. A column is either described or compact: it shows descriptions only when every one of
   * its links has one, so no column mixes tall rows with short ones and a panel reads as one system.
   */
  readonly described: boolean;
}

export interface PanelModel {
  /** The columns with every link that another, more prominent part of the panel already carries removed. */
  readonly columns: readonly PanelColumn[];
  /** The strip links that are not already in the lead, the tile or a column. */
  readonly strip: readonly NavLink[];
  readonly featured: NavFeatured;
  /** Links the panel shows, which is the rows a visitor has to read. */
  readonly linkCount: number;
}

/** The newest research brief, when the build could read one. It fills the tile that carries `newestResearch` in nav.ts. */
export interface NewestResearch {
  readonly title: string;
  readonly href: string;
}

/**
 * The tile of a panel. A tile flagged `newestResearch` names the newest published research brief and links to it; when no brief is
 * readable the tile keeps the text of the navigation data, so the panel never shows an empty tile. No date and no count is shown.
 */
export function featuredTile(featured: NavFeatured, newest: NewestResearch | null): NavFeatured {
  if (featured.newestResearch !== true || newest === null) return featured;
  return { ...featured, title: newest.title, cta: { label: featured.cta.label, href: newest.href } };
}

/**
 * Each page is listed once per panel. The order of prominence is the hub in the lead, the tile, the columns, then the strip, so a
 * page that two of them name stays where it is most prominent and the repeat is dropped. A column left empty by this is dropped.
 * Pages are never removed across panels: a visitor looking in another panel still finds the page there.
 */
export function panelModel(section: NavSection, newest: NewestResearch | null = null): PanelModel {
  const featured = featuredTile(section.featured, newest);
  const taken = new Set<string>([section.href, featured.cta.href]);
  const columns: PanelColumn[] = [];
  for (const column of section.columns) {
    const links = column.links.filter((link) => {
      if (taken.has(link.href)) return false;
      taken.add(link.href);
      return true;
    });
    if (links.length > 0) columns.push({ heading: column.heading, links, described: links.every((link) => link.description !== undefined && link.description !== '') });
  }
  const strip = section.strip.filter((link) => {
    if (taken.has(link.href)) return false;
    taken.add(link.href);
    return true;
  });
  const linkCount = columns.reduce((sum, column) => sum + column.links.length, 0) + strip.length;
  return { columns, strip, featured, linkCount };
}
