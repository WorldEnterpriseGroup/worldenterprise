/**
 * Which graphics backend a scene renders on. three's WebGPURenderer runs the same node materials on WebGPU and on its WebGL2 backend, so
 * the choice is only about speed and safety: WebGPU when the browser exposes a real GPU adapter, WebGL2 otherwise. A software adapter
 * (SwiftShader, llvmpipe, a "fallback adapter") would render on the CPU and starve the main thread, so it never counts as WebGPU, which
 * is the same rule `gate.ts` applies to WebGL2. Pure functions over structural types, so they are unit-tested without a browser.
 */
import { isSoftwareRenderer } from './gate.ts';

export type Backend = 'webgpu' | 'webgl2';

/** The fields of GPUAdapterInfo the check reads (all optional: browsers expose different subsets). */
export interface AdapterInfoLike {
  readonly vendor?: string;
  readonly architecture?: string;
  readonly device?: string;
  readonly description?: string;
}

export interface AdapterLike {
  /** Old Chrome name; true when the adapter is the browser's software fallback. */
  readonly isFallbackAdapter?: boolean;
  readonly info?: AdapterInfoLike;
}

export interface GpuLike {
  requestAdapter(options?: { readonly powerPreference?: 'high-performance' | 'low-power' }): Promise<AdapterLike | null>;
}

/** True for an adapter that renders on the CPU. */
export function isSoftwareAdapter(adapter: AdapterLike): boolean {
  if (adapter.isFallbackAdapter === true) return true;
  const info = adapter.info;
  if (info === undefined) return false;
  return [info.vendor, info.architecture, info.device, info.description].some((field) => typeof field === 'string' && isSoftwareRenderer(field));
}

/** 'webgpu' when `gpu` hands out a hardware adapter, else 'webgl2'. A rejected or missing request is not an error: WebGL2 is the fallback. */
export async function chooseBackend(gpu: GpuLike | undefined): Promise<Backend> {
  if (gpu === undefined) return 'webgl2';
  try {
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (adapter === null || isSoftwareAdapter(adapter)) return 'webgl2';
    return 'webgpu';
  } catch (error) {
    console.warn('we-scene: requesting a WebGPU adapter failed, using WebGL2', error);
    return 'webgl2';
  }
}
