/**
 * The shared scene runtime (ARCHITECTURE 3.2, steps 4 to 6). Loaded only by <we-scene>, only after the gate has passed, so `three` is
 * never fetched on a phone, with reduced motion or with JavaScript off.
 *
 * It owns the renderer, the loop and the life cycle: DPR capped at 1.75; paused offscreen, in a hidden tab and by the pause button;
 * torn down when reduced motion is switched on, on pagehide and when the element leaves the document; at most one scene animating per
 * page. It projects each label's anchor every frame and writes the position as CSS custom properties through the CSSOM (never a style
 * attribute, which the CSP blocks).
 */
import { Mesh, PerspectiveCamera, Points, Scene, Sprite, Vector3, WebGLRenderer, LineSegments, Line, InstancedMesh } from 'three';
import type { Material, Object3D } from 'three';
import type { SceneInstance, SceneModule, SceneOptions } from './types.ts';
import { WEBGL_CONTEXT_ATTRIBUTES } from './gate.ts';

export const MAX_DPR = 1.75;

export interface SceneController {
  readonly running: boolean;
  pause(): void;
  resume(): void;
  dispose(): void;
}

/** Every controller on the page. Only one animates at a time; starting one pauses the others. */
const live = new Set<Controller>();

function disposeMaterial(material: Material | Material[]): void {
  for (const m of Array.isArray(material) ? material : [material]) {
    for (const value of Object.values(m)) {
      if (value !== null && typeof value === 'object' && 'isTexture' in value && typeof (value as { dispose?: unknown }).dispose === 'function') {
        (value as { dispose: () => void }).dispose();
      }
    }
    m.dispose();
  }
}

function disposeTree(root: Object3D): void {
  root.traverse((node) => {
    if (node instanceof Mesh || node instanceof Points || node instanceof Line || node instanceof LineSegments || node instanceof InstancedMesh || node instanceof Sprite) {
      node.geometry.dispose();
      disposeMaterial(node.material);
    }
  });
}

class Controller implements SceneController {
  running = false;
  private disposed = false;
  private userPaused = false;
  private visible = false;
  private clock = 0;
  private last = 0;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(40, 16 / 9, 0.05, 200);
  private readonly instance: SceneInstance;
  private readonly canvas: HTMLCanvasElement;
  private readonly labels: HTMLElement[];
  private readonly lastLabel: [number, number][] = [];
  private readonly cleanups: (() => void)[] = [];
  private readonly projected = new Vector3();

  constructor(
    private readonly host: HTMLElement,
    private readonly frame: HTMLElement,
    mod: SceneModule,
    options: SceneOptions,
    private readonly onFallback: (reason: string, error?: unknown) => void,
  ) {
    this.canvas = host.ownerDocument.createElement('canvas');
    this.canvas.className = 'scene__canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, ...WEBGL_CONTEXT_ATTRIBUTES });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    const { width, height } = this.size();
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const area = (width * height) / (1600 * 900);
    const quality = Math.max(0.5, Math.min(1, area));
    this.instance = mod.create({ renderer: this.renderer, scene: this.scene, camera: this.camera, options, aspect: width / height, quality });
    this.clock = this.instance.posterTime;
    this.labels = Array.from(host.querySelectorAll<HTMLElement>('[data-anchor]'));
    frame.append(this.canvas);
    this.renderFrame(0);
    host.classList.add('is-live');
    this.wire();
  }

  private size(): { width: number; height: number } {
    const rect = this.frame.getBoundingClientRect();
    return { width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)) };
  }

  private listen(target: EventTarget, type: string, handler: (event: Event) => void, opts?: AddEventListenerOptions): void {
    target.addEventListener(type, handler, opts);
    this.cleanups.push(() => target.removeEventListener(type, handler, opts));
  }

  private wire(): void {
    const view = this.host.ownerDocument.defaultView ?? window;
    const observer = new IntersectionObserver(
      (entries) => {
        this.visible = entries.some((entry) => entry.isIntersecting);
        if (this.visible) this.resume();
        else this.pause();
      },
      { rootMargin: '0px', threshold: 0.01 },
    );
    observer.observe(this.frame);
    this.cleanups.push(() => observer.disconnect());

    const resize = new ResizeObserver(() => {
      const { width, height } = this.size();
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.instance.resize?.(width / height);
      if (!this.running) this.renderFrame(0);
    });
    resize.observe(this.frame);
    this.cleanups.push(() => resize.disconnect());

    this.listen(view.document, 'visibilitychange', () => {
      if (view.document.hidden) this.pause();
      else if (this.visible) this.resume();
    });
    const motion = view.matchMedia('(prefers-reduced-motion: reduce)');
    this.listen(motion, 'change', () => {
      if (motion.matches) this.fallBack('reduced motion was switched on');
    });
    this.listen(view, 'pagehide', () => this.dispose());
    this.listen(this.canvas, 'webglcontextlost', (event) => {
      event.preventDefault();
      this.fallBack('the WebGL context was lost');
    });

    this.listen(this.frame, 'pointermove', (event) => {
      const e = event as PointerEvent;
      const rect = this.frame.getBoundingClientRect();
      this.instance.pointer?.(((e.clientX - rect.left) / rect.width) * 2 - 1, -(((e.clientY - rect.top) / rect.height) * 2 - 1));
    });
    this.listen(this.frame, 'pointerleave', () => this.instance.pointer?.(0, 0));

    this.labels.forEach((label, index) => {
      const on = (): void => this.instance.highlight?.(index);
      const off = (): void => this.instance.highlight?.(null);
      this.listen(label, 'pointerenter', on);
      this.listen(label, 'focusin', on);
      this.listen(label, 'pointerleave', off);
      this.listen(label, 'focusout', off);
    });

    const toggle = this.host.querySelector<HTMLButtonElement>('.scene__toggle');
    if (toggle !== null) {
      toggle.hidden = false;
      this.listen(toggle, 'click', () => {
        this.userPaused = !this.userPaused;
        toggle.setAttribute('aria-pressed', String(this.userPaused));
        const text = toggle.querySelector('.scene__toggle-text');
        if (text !== null) text.textContent = this.userPaused ? (toggle.dataset.play ?? 'Play animation') : (toggle.dataset.pause ?? 'Pause animation');
        if (this.userPaused) this.pause();
        else this.resume();
      });
      this.cleanups.push(() => {
        toggle.hidden = true;
      });
    }
  }

  private renderFrame(dt: number): void {
    this.instance.update(this.clock, dt);
    this.renderer.render(this.scene, this.camera);
    this.placeLabels();
  }

  private placeLabels(): void {
    if (this.labels.length === 0 || this.instance.anchors === undefined) return;
    const anchors = this.instance.anchors();
    this.labels.forEach((label, i) => {
      const anchor = anchors[i];
      if (anchor === undefined) return;
      this.projected.copy(anchor).project(this.camera);
      const x = Math.round(((this.projected.x + 1) / 2) * 1000) / 10;
      const y = Math.round(((1 - this.projected.y) / 2) * 1000) / 10;
      const prev = this.lastLabel[i];
      if (prev !== undefined && prev[0] === x && prev[1] === y) return;
      this.lastLabel[i] = [x, y];
      label.style.setProperty('--x', `${x}%`);
      label.style.setProperty('--y', `${y}%`);
    });
  }

  private readonly tick = (now: number): void => {
    const dt = this.last === 0 ? 0 : Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.clock += dt;
    try {
      this.renderFrame(dt);
    } catch (error) {
      this.fallBack('a frame threw', error);
    }
  };

  pause(): void {
    if (!this.running) return;
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  resume(): void {
    if (this.disposed || this.userPaused || !this.visible || this.running || this.host.ownerDocument.hidden) return;
    for (const other of live) if (other !== this) other.pause();
    this.running = true;
    this.last = 0;
    this.renderer.setAnimationLoop(this.tick);
  }

  private fallBack(reason: string, error?: unknown): void {
    this.dispose();
    this.onFallback(reason, error);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.pause();
    live.delete(this);
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    try {
      this.instance.dispose();
      disposeTree(this.scene);
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    } catch (error) {
      console.warn('we-scene: disposing the scene threw', error);
    }
    this.canvas.remove();
    this.host.classList.remove('is-live');
    for (const label of this.labels) {
      label.style.removeProperty('--x');
      label.style.removeProperty('--y');
    }
  }

  register(): void {
    live.add(this);
  }
}

/**
 * Mounts a scene in `host` (a <we-scene>). The canvas joins `.scene__frame`, over the poster, and the poster fades only after the first
 * frame has rendered. Throws when the scene cannot be created; the element catches that and keeps the poster.
 */
export function startScene(host: HTMLElement, mod: SceneModule, options: SceneOptions, onFallback: (reason: string, error?: unknown) => void): SceneController {
  const frame = host.querySelector<HTMLElement>('.scene__frame');
  if (frame === null) throw new Error('we-scene: no .scene__frame inside the element');
  const controller = new Controller(host, frame, mod, options, onFallback);
  controller.register();
  return controller;
}
