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

  connectedCallback(): void {
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
      this.controller = runtime.startScene(this, mod, parseOptions(this.dataset.options), (reason, error) => this.fallback(reason, error));
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
