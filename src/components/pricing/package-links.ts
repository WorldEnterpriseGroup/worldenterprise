import { PACKAGE_PARAM } from '../../data/packages.ts';
import type { PackageId } from '../../data/packages.ts';

/**
 * Link to a page that reads `?package=<id>` (docs/wave7-contracts.md, section 1). `path` is an already resolved site path, for
 * example `href('/apply/')`, so the preview base is kept. The id is one of the four package ids and needs no encoding.
 */
export function withPackage(path: string, id: PackageId): string {
  return `${path}?${PACKAGE_PARAM}=${id}`;
}
