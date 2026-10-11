/**
 * What the seats of WE can and cannot build, shown on every industry page and on the hub. Each sentence restates one claim or one existing
 * services page, as .astro-magazine/sources/wp-74.json records (document src/components/industries/scope-copy.ts). The sentences say what a
 * seat does, and never claim that WE holds a certification or meets an industry rule (claim C-15).
 */

export interface ScopeItem {
  readonly text: string;
}

export const SCOPE_HEADING = "What WE's seats can and cannot build";

export const SCOPE_ITEMS: readonly ScopeItem[] = [
  { text: "WE is a digital incubator for SaaS companies, with dedicated offshore team seats steered by WE." },
  { text: "A seat builds SaaS software: architecture, an agile build in short cycles and a pilot environment where early customers can use the product." },
  { text: "A seat does not run a live service, because WE builds to pilot scale." },
  { text: "A seat does not store or process restricted or regulated data in WE systems." },
  { text: "WE gives no assurance that a product will pass a particular audit or hold a particular certification." },
  { text: "WE does not give legal, tax, accounting, insurance or compliance advice." },
  { text: "WE coordinates a founder’s own counsel and other specialists, and the founder engages them directly." },
];
