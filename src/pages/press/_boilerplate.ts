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
    'World Enterprise Group Incorporated is a business incubation and consulting firm. ' +
    'WE steers dedicated, fully remote teams that build companies with their founders, paced to the years a company really takes. ' +
    'WE is a services firm, not an investor. WE makes no promise of funding. World Enterprise is operated by ' +
    `${pressEntity()}.`
  );
}
