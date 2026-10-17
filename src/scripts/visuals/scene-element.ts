/**
 * <we-scene>: the loader stub for every three.js scene (ARCHITECTURE 3.2). Under 2 KB gzipped, and it imports nothing from `three`
 * statically (unit-tested): the runtime and the scene arrive through dynamic `import()` only after the gate passes and the frame is
 * about to scroll into view, so phones, reduced motion, forced colors, Save-Data and no-JS visitors keep the poster and never fetch three.
 *
 * States, on `data-state`: `poster` (gate refused or a static figure), `waiting` (observing), `loading`, `live`, `fallback` (something
 * failed: a console warning says what, and the poster stays).
 */
import { evaluateGate, readCapabilities } from './gate.ts';
import { isSceneName } from './types.ts';
import type { SceneModule, SceneName, SceneOptions } from './types.ts';
import type { SceneController } from './runtime.ts';

const LOADERS: Readonly<Record<SceneName, () => Promise<SceneModule>>> = {
  galaxy: () => import('./scenes/galaxy.ts'),
  launch: () => import('./scenes/launch.ts'),
  orbit: () => import('./scenes/orbit.ts'),
  worldforge: () => import('./scenes/worldforge.ts'),
  starfield: () => import('./scenes/starfield.ts'),
  accretion: () => import('./scenes/accretion.ts'),
};

const idle = (fn: () => void): void => {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(fn, { timeout: 1500 });
  else window.setTimeout(fn, 200);
};

function parseOptions(raw: string | undefined): SceneOptions {
  if (raw === undefined || raw === '') return {};
  try {
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as SceneOptions) : {};
  } catch (error) {
    console.warn('we-scene: data-options is not valid JSON; using the defaults', error);
    return {};
  }
}

export class WeScene extends HTMLElement {
  private observer: IntersectionObserver | undefined;
  private controller: SceneController | undefined;

  /** Arrow keys, Home and End step focus through the label links, in poster and live state alike. */
  private readonly onKey = (event: KeyboardEvent): void => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key) || !(event.target instanceof HTMLElement)) return;
    const items = Array.from(this.querySelectorAll<HTMLElement>('.scene__label a[href], .scene__label button'));
    const index = items.indexOf(event.target);
    if (index === -1 || items.length < 2) return;
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + step + items.length) % items.length;
    event.preventDefault();
    items[next]?.focus();
  };

  /**
   * The "About this scene" button opens a <dialog> by invoker command (`commandfor`, no script) where the browser supports it; elsewhere
   * the button is revealed and opens the dialog itself. It stays hidden without a dialog, so a no-JS visitor never sees a dead button.
   */
  private wireDetail(): void {
    const button = this.querySelector<HTMLButtonElement>('button[data-detail-for]');
    const dialog = button === null ? null : document.getElementById(button.dataset.detailFor ?? '');
    if (button === null || !(dialog instanceof HTMLDialogElement)) return;
    if (!('commandForElement' in HTMLButtonElement.prototype)) button.addEventListener('click', () => dialog.showModal());
    button.hidden = false;
  }

  connectedCallback(): void {
    this.addEventListener('keydown', this.onKey);
    this.wireDetail();
    const name = this.dataset.scene;
    if (this.hasAttribute('data-static') || !isSceneName(name)) {
      if (!isSceneName(name)) console.warn(`we-scene: unknown scene "${String(name)}"; showing the poster`);
      this.dataset.state = 'poster';
      return;
    }
    const gate = evaluateGate(readCapabilities(window));
    if (!gate.ok) {
      this.dataset.state = 'poster';
      this.dataset.gate = gate.reason;
      return;
    }
    this.dataset.state = 'waiting';
    this.observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        this.observer?.disconnect();
        this.observer = undefined;
        idle(() => void this.load(name));
      },
      { rootMargin: '200px' },
    );
    this.observer.observe(this);
  }

  disconnectedCallback(): void {
    this.removeEventListener('keydown', this.onKey);
    this.observer?.disconnect();
    this.observer = undefined;
    this.controller?.dispose();
    this.controller = undefined;
  }

  private async load(name: SceneName): Promise<void> {
    if (!this.isConnected) return;
    this.dataset.state = 'loading';
    try {
      const [runtime, mod] = await Promise.all([import('./runtime.ts'), LOADERS[name]()]);
      if (!this.isConnected) return;
      const controller = await runtime.startScene(this, mod, parseOptions(this.dataset.options), (reason, error) => this.fallback(reason, error));
      if (!this.isConnected) {
        controller.dispose();
        return;
      }
      this.controller = controller;
      this.dataset.state = 'live';
    } catch (error) {
      this.fallback(`the ${name} scene could not start`, error);
    }
  }

  private fallback(reason: string, error?: unknown): void {
    this.controller = undefined;
    this.dataset.state = 'fallback';
    console.warn(`we-scene: ${reason}; showing the poster`, error ?? '');
  }
}

export function defineWeScene(): void {
  if (!customElements.get('we-scene')) customElements.define('we-scene', WeScene);
}
