export interface BriefSource {
  id?: string;
  title?: string;
  publisher?: string;
  url?: string;
  accessed?: string;
}

export interface Brief {
  id: string;
  title: string;
  version: string;
  updated: string;
  sentinel: string;
  sources: BriefSource[];
  body: string;
}

export interface RegistryEntry {
  id: string;
  title: string;
  version: string;
  pdfPath: string;
  htmlPath: string;
}

export class BriefError extends Error {
  constructor(file: string, problem: string);
}

export function parseFrontMatter(block: string, file: string): { data: Record<string, string>; sources: BriefSource[] };
export function parseBrief(fileName: string, text: string): Brief;
export function renderHtml(brief: Brief): string;
export function blobPaths(brief: Pick<Brief, 'id' | 'version'>): { html: string; pdf: string };
export function buildRegistry(briefs: readonly Brief[]): { version: 1; briefs: RegistryEntry[] };
