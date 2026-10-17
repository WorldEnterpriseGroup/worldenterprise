/**
 * The contract between the runtime and a scene module. Type-only: the custom element imports these names without pulling three in.
 */
import type { PerspectiveCamera, Scene, Vector3, WebGPURenderer } from 'three/webgpu';

export const SCENE_NAMES = ['galaxy', 'launch', 'orbit', 'worldforge', 'starfield', 'accretion'] as const;
export type SceneName = (typeof SCENE_NAMES)[number];

export function isSceneName(value: string | undefined): value is SceneName {
  return value !== undefined && (SCENE_NAMES as readonly string[]).includes(value);
}

/** Options a page passes to a scene through `data-options` (JSON). Scenes validate what they read. */
export type SceneOptions = Readonly<Record<string, unknown>>;

export interface SceneContext {
  readonly renderer: WebGPURenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly options: SceneOptions;
  /** Frame width over height. */
  readonly aspect: number;
  /** 0.5 to 1: particle budgets scale with the frame's pixel area so a small frame does less work. */
  readonly quality: number;
}

export interface SceneInstance {
  /** The scene time, in seconds, that the poster shows. The runtime starts its clock here so the swap is seamless. */
  readonly posterTime: number;
  /** Advances to absolute time `t` (seconds). Must be a pure function of `t`, apart from pointer easing. */
  update(t: number, dt: number): void;
  /** World positions of the HTML labels, in label order (`data-anchor` index). */
  anchors?(): readonly Vector3[];
  /** Pointer position over the frame, -1..1 on both axes (y up). */
  pointer?(x: number, y: number): void;
  /** Highlights the body behind label `index`, or none. */
  highlight?(index: number | null): void;
  resize?(aspect: number): void;
  dispose(): void;
}

export interface SceneModule {
  create(ctx: SceneContext): SceneInstance;
}
