import type { SlotId } from '../assets/photo/slots.ts';
import type { HeroArtProps, HeroCta, HeroMeasure } from '../components/hero/types.ts';
import type { CtaVariant } from '../data/cta/types.ts';
import type { Crumb } from '../lib/breadcrumbs.ts';
import type { PreloadImage } from '../lib/image-type.ts';
import type { JsonLdNode, PageSchemaType } from '../lib/schema.ts';

/** Props every layout accepts and forwards to BaseLayout. */
export interface PageMeta {
  /** Page title without the site suffix. Omit only on the home page. */
  title?: string;
  /** Short form of the title for the document title and social cards when the heading is too long. Defaults to title. */
  seoTitle?: string | undefined;
  /** Meta description, 160 characters or fewer. */
  description: string;
  /** Route path as listed in the ledger, for example /program/how-it-works/. */
  path: string;
  /** Social card slot; sections without their own card use og-default. */
  ogSlot?: SlotId;
  /** Draft content is never indexed and is excluded from search. */
  draft?: boolean;
  /** Last substantive update. Feeds dateModified. */
  updated?: Date;
  schemaType?: PageSchemaType;
  /** Overrides the breadcrumbs derived from the path. */
  crumbs?: readonly Crumb[];
  /** Extra JSON-LD nodes for this page. */
  jsonLd?: readonly JsonLdNode[];
  /** LCP image to preload. */
  preloadImage?: PreloadImage;
  /** The frontmatter `cta` override of the document: which call to action closes the page (src/data/cta, contracts section 6.1). */
  cta?: { readonly variant: CtaVariant; readonly briefId?: string | undefined } | undefined;
}

/** Hero options for the layouts that open with a hero. Each layout supplies the defaults that suit its template. */
export interface HeroProps {
  /** The main action above the fold. A fragment href ("#form") links inside the page. */
  primary?: HeroCta | undefined;
  secondary?: HeroCta | undefined;
  /** Photo slot for the hero media frame. It replaces the vector art. */
  photo?: SlotId | undefined;
  /** Vector art for the hero media frame when no photo is given. */
  art?: HeroArtProps | undefined;
  /** How wide the hero copy runs. Layouts match it to the body below so both share one left edge. */
  measure?: HeroMeasure | undefined;
}

/** Header block shared by layouts that open with a hero. */
export interface HeaderProps extends HeroProps {
  eyebrow?: string | undefined;
  lead?: string | undefined;
}

export interface Heading {
  readonly depth: number;
  readonly slug: string;
  readonly text: string;
}
