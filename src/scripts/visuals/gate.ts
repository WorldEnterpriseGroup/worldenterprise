/**
 * The capability gate for <we-scene> (ARCHITECTURE 3.2, step 2). A scene runs only on a wide screen with a fine pointer, with motion
 * allowed, outside forced colors, on a device with at least four cores and (where reported) four gigabytes, without Save-Data, and only
 * when WebGL2 works without a major performance caveat. Lighthouse's mobile run (412 px) therefore never passes, and never fetches three.
 * Software GL (SwiftShader on a CI runner, llvmpipe, a blocklisted GPU) would make three render on the CPU and starve the main thread
 * (menus stop responding), so such a browser keeps the poster: the probe asks with `failIfMajorPerformanceCaveat` and also refuses a
 * context whose renderer string names a software rasteriser.
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

export type GateResult =
  { readonly ok: true } | { readonly ok: false; readonly reason: 'media' | 'forced-colors' | 'cores' | 'memory' | 'save-data' | 'webgl2' };

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
export const WEBGL_CONTEXT_ATTRIBUTES = {
  failIfMajorPerformanceCaveat: true,
  powerPreference: 'high-performance',
} as const satisfies WebGLContextAttributes;

/**
 * Renderer strings of software rasterisers: SwiftShader (Chrome's fallback, and headless Chrome on a CI runner), Mesa llvmpipe and
 * softpipe, Mesa's offscreen driver and Windows' Microsoft Basic Render Driver. Headless Chrome hands out a SwiftShader context without
 * a major performance caveat, so the caveat flag alone does not keep the poster there.
 */
export const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render driver|mesa offscreen/i;

export function isSoftwareRenderer(renderer: string): boolean {
  return SOFTWARE_RENDERER.test(renderer);
}

/** WEBGL_debug_renderer_info.UNMASKED_RENDERER_WEBGL, and the core RENDERER enum. */
const UNMASKED_RENDERER_WEBGL = 0x9246;
const RENDERER = 0x1f01;

/** The parts of a WebGL2 context the probe uses. */
export interface ProbeContext {
  getExtension(name: string): unknown;
  getParameter(pname: number): unknown;
}

/** The part of a document the probe needs (a structural type, so the probe is unit-tested without a DOM). */
export interface CanvasFactory {
  createElement(tag: 'canvas'): { getContext(id: 'webgl2', attributes: WebGLContextAttributes): ProbeContext | null };
}

/** The unmasked renderer name when the browser exposes it, else the (possibly masked) RENDERER string; '' when neither is a string. */
export function rendererName(gl: ProbeContext): string {
  const unmasked = gl.getExtension('WEBGL_debug_renderer_info') === null ? undefined : gl.getParameter(UNMASKED_RENDERER_WEBGL);
  if (typeof unmasked === 'string' && unmasked !== '') return unmasked;
  const renderer = gl.getParameter(RENDERER);
  return typeof renderer === 'string' ? renderer : '';
}

function release(gl: ProbeContext): void {
  const ext = gl.getExtension('WEBGL_lose_context') as { loseContext?: () => void } | null;
  ext?.loseContext?.();
}

/**
 * Creates a throwaway WebGL2 context and releases it at once. No context, a software renderer, or any failure means no WebGL2, so the
 * poster stays: three on a CPU rasteriser starves the main thread.
 */
export function probeWebgl2(doc: CanvasFactory): boolean {
  try {
    const canvas = doc.createElement('canvas');
    const gl = canvas.getContext('webgl2', WEBGL_CONTEXT_ATTRIBUTES);
    if (gl === null) return false;
    try {
      return !isSoftwareRenderer(rendererName(gl));
    } finally {
      release(gl);
    }
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
