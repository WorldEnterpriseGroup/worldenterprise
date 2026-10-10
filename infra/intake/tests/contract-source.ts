/**
 * Which forms contract the tests run against. The committed `docs/forms-contract.schema.json` (WP-60) is the source of
 * truth. Until that file exists in the tree, the tests fall back to the fixture next to this file, so work can proceed, and
 * say so. A pipeline sets REQUIRE_REAL_CONTRACT=1 (infra/intake/ci.yml does), which turns a missing file into a failure
 * instead of a silent pass against a copy.
 */

import { existsSync, readFileSync } from 'node:fs';

import { parseContract, type Contract } from '../src/logic/contract.ts';

export const COMMITTED = new URL('../../../docs/forms-contract.schema.json', import.meta.url);
export const FIXTURE = new URL('./fixtures/forms-contract.schema.json', import.meta.url);

export interface ContractUnderTest {
  readonly contract: Contract;
  readonly source: 'committed' | 'fixture';
}

export function loadContractUnderTest(): ContractUnderTest {
  if (existsSync(COMMITTED)) return { contract: parseContract(readFileSync(COMMITTED, 'utf8')), source: 'committed' };
  if (process.env['REQUIRE_REAL_CONTRACT'] === '1') {
    throw new Error('docs/forms-contract.schema.json is missing and REQUIRE_REAL_CONTRACT=1: the server tests must run against the committed contract');
  }
  return { contract: parseContract(readFileSync(FIXTURE, 'utf8')), source: 'fixture' };
}
