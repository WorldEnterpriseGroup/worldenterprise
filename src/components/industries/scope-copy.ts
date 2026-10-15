/**
 * What the teams WE steers can and cannot build, shown on every industry page and on the hub. Each sentence restates one claim or one existing
 * services page, as .astro-magazine/sources/wp-74.json records (document src/components/industries/scope-copy.ts). The sentences say what a
 * team does, and never claim that WE holds a certification or meets an industry rule (claim C-15).
 */

export interface ScopeItem {
  readonly text: string;
}

export const SCOPE_HEADING = "What WE's seats can and cannot build";

export const SCOPE_ITEMS: readonly ScopeItem[] = [
  { text: "WE is a long-horizon business incubation and consulting firm that steers a dedicated, fully remote team building the company with its founder." },
  { text: "The team builds software: architecture, an agile build in short cycles and a pilot environment where early customers can use the product." },
  { text: "The team does not run a live service, because WE builds to pilot scale." },
  { text: "The team does not store or process restricted or regulated data in WE systems." },
  { text: "WE gives no assurance that a product will pass a particular audit or hold a particular certification." },
  { text: "WE does not give legal, tax, accounting, insurance or compliance advice." },
  { text: "WE coordinates a founder’s own counsel and other specialists, and the founder engages them directly." },
];
