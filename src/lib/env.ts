/**
 * Build-time environment access that works both inside Astro (Vite) and under plain `node --test`.
 * Values come from the process environment first (CI variables), then from Vite's import.meta.env (.env files).
 */
interface MaybeViteMeta {
  readonly env?: Record<string, string | undefined>;
}

export function readEnv(name: string): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env[name] : undefined;
  if (fromProcess !== undefined && fromProcess !== '') return fromProcess;
  const viteEnv = (import.meta as MaybeViteMeta).env;
  const fromVite = viteEnv?.[name];
  return fromVite !== undefined && fromVite !== '' ? fromVite : undefined;
}

/** True when the variable is exactly "1". */
export function readFlag(name: string): boolean {
  return readEnv(name) === '1';
}
