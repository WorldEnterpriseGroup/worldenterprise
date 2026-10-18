import { MAPS } from './maps.ts';
import { runJourney } from './walk.ts';

// WP-90: the partner customer journey (docs/wave8-contracts.md, section 11). The map is data in maps.ts; walk.ts clicks through it.
const map = MAPS.find((m) => m.audience === 'partner');
if (map === undefined) throw new Error('maps.ts has no partner map.');
runJourney(map);
