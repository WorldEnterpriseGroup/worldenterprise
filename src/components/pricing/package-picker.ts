/**
 * Package picker. The first half is pure (which package a stage maps to, and what to say about it) and runs under `node --test`.
 * The second half defines `<we-package-picker>`, which only enhances server-rendered markup: without JavaScript the page shows a plain
 * list of the four stages, each linking to its package card. No storage, no network, no cookies.
 *
 * The stage-to-package mapping is the one src/data/packages.ts publishes (claim C-10): a package is "sized for" one company stage.
 * Nothing here invents a recommendation, a score or a seat count.
 */

import { getPackage, packageForStage } from '../../data/packages.ts';
import type { PackageId } from '../../data/packages.ts';
import { withPackage } from './package-links.ts';

export interface PickerBases {
  /** The resolved site path of the application, for example `/apply/`. */
  readonly apply: string;
  /** The resolved site path of the Team Composer. */
  readonly composer: string;
}

export interface PickerResult {
  readonly id: PackageId;
  readonly name: string;
  /** The sentence announced when the visitor picks a stage. */
  readonly status: string;
  readonly applyHref: string;
  readonly composerHref: string;
  /** The package card on the same page. */
  readonly cardHref: string;
}

/** The package sized for a stage, or null for anything that is not one of the four published stage keys. */
export function pickerResult(stageKey: string, bases: PickerBases): PickerResult | null {
  const found = packageForStage(stageKey);
  if (found === null) return null;
  const pkg = getPackage(found.id);
  return {
    id: pkg.id,
    name: pkg.name,
    status: `${pkg.name} is sized for this stage: ${pkg.stageFit} Its depth in every service line is ${pkg.depth}.`,
    applyHref: withPackage(bases.apply, pkg.id),
    composerHref: withPackage(bases.composer, pkg.id),
    cardHref: `#package-${pkg.id}`,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Custom element. Nothing below runs at import time except the guarded registration in definePackagePicker().
// ---------------------------------------------------------------------------------------------------------------

function makeLink(className: string, href: string, label: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = className;
  link.href = href;
  link.textContent = label;
  return link;
}

export function definePackagePicker(): void {
  if (typeof customElements === 'undefined' || customElements.get('we-package-picker') !== undefined) return;

  class PackagePickerElement extends HTMLElement {
    private readonly onChange = (event: Event): void => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === 'radio') this.show(target.value);
    };

    connectedCallback(): void {
      if (this.querySelector('input[type="radio"]') === null) return;
      this.setAttribute('data-enhanced', '');
      this.addEventListener('change', this.onChange);
    }

    disconnectedCallback(): void {
      this.removeEventListener('change', this.onChange);
    }

    private bases(): PickerBases {
      return { apply: this.dataset.apply ?? '/apply/', composer: this.dataset.composer ?? '/tools/team-composer/' };
    }

    private show(stageKey: string): void {
      const result = pickerResult(stageKey, this.bases());
      const status = this.querySelector<HTMLElement>('[data-status]');
      const actions = this.querySelector<HTMLElement>('[data-actions]');
      if (result === null || status === null || actions === null) return;

      status.textContent = result.status;
      actions.replaceChildren(
        makeLink('btn btn--primary', result.applyHref, `Start with ${result.name}`),
        makeLink('btn btn--secondary', result.composerHref, 'Sketch the team'),
        makeLink('picker__card-link', result.cardHref, `See the ${result.name} card`),
      );

      document.querySelectorAll<HTMLElement>('[data-package]').forEach((card) => {
        if (card.dataset.package === result.id) card.setAttribute('data-suggested', '');
        else card.removeAttribute('data-suggested');
      });
    }
  }

  customElements.define('we-package-picker', PackagePickerElement);
}
