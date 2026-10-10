import { flags } from '../../data/flags.ts';
import { site } from '../../data/site.ts';

/**
 * The press boilerplate, shared by /press/ and the brand kit so the two pages can never state different facts about WE.
 * The legal entity is named with the wording that flags.pbcWording allows (C-18).
 */
export function pressEntity(): string {
  return flags.pbcWording ? site.legalLine : `${site.legalName}, registered in Delaware`;
}

export function pressBoilerplate(): string {
  return (
    'World Enterprise Incubator is a digital incubator for SaaS. Dedicated team seats, steered by WE, work with a founder from first idea toward a company that can show investors its evidence. WE is fully remote and makes no promise of funding. World Enterprise Incubator is operated by ' +
    `${pressEntity()}.`
  );
}
