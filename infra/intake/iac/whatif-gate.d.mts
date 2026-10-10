export interface Verdict {
  ok: boolean;
  refusals: string[];
  summary: string;
}

export class WhatIfFormatError extends Error {
  constructor(problem: string);
}

export function evaluateWhatIf(result: unknown): Verdict;
export function evaluateFile(path: string): Verdict;
