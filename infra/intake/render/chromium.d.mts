export interface FsView {
  existsSync(path: string): boolean;
  readdirSync(path: string): string[];
}

export function findChromium(env?: Record<string, string | undefined>, fs?: FsView): string | null;
export function printArgs(options: { htmlPath: string; pdfPath: string; profileDir: string }): string[];
