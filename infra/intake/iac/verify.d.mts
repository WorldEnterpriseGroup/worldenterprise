export function checkOrigin(response: { status: number }): string[];
export function checkPublicHealth(response: { status: number; headers: Headers }, body: { configured?: unknown } | null): string[];
export function verify(options: { originHost: string; apiHost: string; fetchImpl?: typeof fetch; log?: (line: string) => void }): Promise<string[]>;
