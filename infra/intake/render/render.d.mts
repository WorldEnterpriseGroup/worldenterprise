export interface BrowserRun {
  readonly error?: (Error & { code?: string }) | undefined;
  readonly status: number | null;
  readonly stderr?: string | null;
}

export function timeoutFromEnv(value: string | undefined, fallback: number): number;
export function runBrowser<T extends BrowserRun>(
  attempt: () => T,
  options?: { attempts?: number; timeoutMs?: number; log?: (line: string) => void },
): T;
export function renderAll(options: { briefsDir: string; outDir: string; pdf: boolean; log: (line: string) => void }): unknown[];
