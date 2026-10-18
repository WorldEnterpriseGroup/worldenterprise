import { MAPS } from './maps.ts';
import { runJourney } from './walk.ts';

// WP-90: the corporate customer journey (docs/wave8-contracts.md, section 11). The map is data in maps.ts; walk.ts clicks through it.
const map = MAPS.find((m) => m.audience === 'corporate');
if (map === undefined) throw new Error('maps.ts has no corporate map.');
runJourney(map);
