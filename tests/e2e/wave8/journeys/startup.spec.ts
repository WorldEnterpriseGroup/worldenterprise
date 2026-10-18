import { MAPS } from './maps.ts';
import { runJourney } from './walk.ts';

// WP-90: the startup customer journey (docs/wave8-contracts.md, section 11). The map is data in maps.ts; walk.ts clicks through it.
const map = MAPS.find((m) => m.audience === 'startup');
if (map === undefined) throw new Error('maps.ts has no startup map.');
runJourney(map);
