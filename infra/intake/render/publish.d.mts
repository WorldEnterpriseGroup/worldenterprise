export interface UploadItem {
  file: string;
  blob: string;
  contentType: string;
  sha256: string;
  immutable: boolean;
}

export interface AzResult {
  status: number;
  stdout: string;
  stderr: string;
}

export function uploadPlan(outDir: string): UploadItem[];
export function publish(options: {
  outDir: string;
  account: string;
  container?: string;
  run: (args: string[]) => AzResult;
  log: (line: string) => void;
}): { uploaded: string[]; skipped: string[] };
