/**
 * The capability gate for <we-scene> (ARCHITECTURE 3.2, step 2). A scene runs only on a wide screen with a fine pointer, with motion
 * allowed, outside forced colors, on a device with at least four cores and (where reported) four gigabytes, without Save-Data, and only
 * when WebGL2 works without a major performance caveat. Lighthouse's mobile run (412 px) therefore never passes, and never fetches three.
 * Software GL (SwiftShader on a CI runner, or a blocklisted GPU) reports a major performance caveat: three would render on the CPU and
 * starve the main thread (menus stop responding), so such a browser keeps the poster.
 *
 * `evaluateGate` is a pure function over a capabilities object, so it is unit-tested; `readCapabilities` reads them from a window.
 */

/** The media query every scene needs. 64rem is 1024 px at the default font size. */
export const SCENE_MEDIA = '(min-width: 64rem) and (pointer: fine) and (prefers-reduced-motion: no-preference)';
export const MIN_CORES = 4;
export const MIN_MEMORY_GB = 4;

export interface SceneCapabilities {
  /** `SCENE_MEDIA` matches. */
  readonly media: boolean;
  readonly forcedColors: boolean;
  /** navigator.hardwareConcurrency; undefined when the browser does not say. */
  readonly cores: number | undefined;
  /** navigator.deviceMemory in GB; undefined when the browser does not say (Firefox, Safari). */
  readonly memory: number | undefined;
  readonly saveData: boolean;
  /** Whether a hardware-accelerated WebGL2 context can be created. Probed last, because the probe costs a context. */
  readonly webgl2: () => boolean;
}

export type GateResult = { readonly ok: true } | { readonly ok: false; readonly reason: 'media' | 'forced-colors' | 'cores' | 'memory' | 'save-data' | 'webgl2' };

export function evaluateGate(caps: SceneCapabilities): GateResult {
  if (!caps.media) return { ok: false, reason: 'media' };
  if (caps.forcedColors) return { ok: false, reason: 'forced-colors' };
  if (caps.cores !== undefined && caps.cores < MIN_CORES) return { ok: false, reason: 'cores' };
  if (caps.memory !== undefined && caps.memory < MIN_MEMORY_GB) return { ok: false, reason: 'memory' };
  if (caps.saveData) return { ok: false, reason: 'save-data' };
  if (!caps.webgl2()) return { ok: false, reason: 'webgl2' };
  return { ok: true };
}

interface NavigatorHints {
  readonly hardwareConcurrency?: number;
  readonly deviceMemory?: number;
  readonly connection?: { readonly saveData?: boolean };
}

/**
 * The context attributes both the probe and the renderer use. `failIfMajorPerformanceCaveat` makes the browser refuse a context it would
 * render in software, so the gate and the renderer agree on what counts as WebGL2.
 */
export const WEBGL_CONTEXT_ATTRIBUTES = { failIfMajorPerformanceCaveat: true, powerPreference: 'high-performance' } as const satisfies WebGLContextAttributes;

/** The part of a document the probe needs (a structural type, so the probe is unit-tested without a DOM). */
export interface CanvasFactory {
  createElement(tag: 'canvas'): { getContext(id: 'webgl2', attributes: WebGLContextAttributes): WebGL2RenderingContext | null };
}

/** Creates a throwaway hardware WebGL2 context and releases it at once. Any failure, or software GL only, means no WebGL2. */
export function probeWebgl2(doc: CanvasFactory): boolean {
  try {
    const canvas = doc.createElement('canvas');
    const gl = canvas.getContext('webgl2', WEBGL_CONTEXT_ATTRIBUTES);
    if (gl === null) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch (error) {
    console.warn('we-scene: the WebGL2 probe threw, showing the poster', error);
    return false;
  }
}

export function readCapabilities(win: Window): SceneCapabilities {
  const nav = win.navigator as Navigator & NavigatorHints;
  return {
    media: win.matchMedia(SCENE_MEDIA).matches,
    forcedColors: win.matchMedia('(forced-colors: active)').matches,
    cores: typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 ? nav.hardwareConcurrency : undefined,
    memory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined,
    saveData: nav.connection?.saveData === true,
    webgl2: () => probeWebgl2(win.document),
  };
}
