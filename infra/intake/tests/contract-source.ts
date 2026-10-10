/**
 * The forms contract the tests run against: the committed `docs/forms-contract.schema.json` (WP-60), the same file the Function
 * packages and loads. There is no stand-in copy, so a change to the file that the server cannot read fails here.
 */

import { readFileSync } from 'node:fs';

import { parseContract, type Contract } from '../src/logic/contract.ts';

export const COMMITTED = new URL('../../../docs/forms-contract.schema.json', import.meta.url);

export interface ContractUnderTest {
  readonly contract: Contract;
  readonly source: 'committed';
}

export function loadContractUnderTest(): ContractUnderTest {
  return { contract: parseContract(readFileSync(COMMITTED, 'utf8')), source: 'committed' };
}
