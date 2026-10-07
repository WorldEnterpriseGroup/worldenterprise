import type { SlotId } from '../assets/photo/slots.ts';
import type { Crumb } from '../lib/breadcrumbs.ts';
import type { JsonLdNode, PageSchemaType } from '../lib/schema.ts';

/** Props every layout accepts and forwards to BaseLayout. */
export interface PageMeta {
  /** Page title without the site suffix. Omit only on the home page. */
  title?: string;
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
  preloadImage?: { readonly href: string; readonly type: string };
}

/** Header block shared by layouts that render a PageHeader. */
export interface HeaderProps {
  eyebrow?: string;
  lead?: string;
}

export interface Heading {
  readonly depth: number;
  readonly slug: string;
  readonly text: string;
}
