import { readFileSync } from 'node:fs';

import { parseContract, type Contract } from '../logic/contract.ts';

/**
 * Reads the forms contract the build copied next to the compiled code (iac/package-function.mjs copies
 * docs/forms-contract.schema.json into dist/). A missing or malformed file throws: the Function refuses to start rather than
 * run with a contract it cannot read.
 */
export function loadContract(path: URL | string = new URL('./forms-contract.schema.json', import.meta.url)): Contract {
  let json: string;
  try {
    json = readFileSync(path, 'utf8');
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : 'unknown';
    throw new Error(`forms contract file could not be read (${code}); the build must copy docs/forms-contract.schema.json next to the code`);
  }
  return parseContract(json);
}
