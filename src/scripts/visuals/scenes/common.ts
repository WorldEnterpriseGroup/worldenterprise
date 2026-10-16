/**
 * Building blocks shared by the scenes, written as TSL node materials so one code path runs on three's WebGPURenderer and on its WebGL2
 * backend (the renderer picks; see ../runtime.ts). GLSL ShaderMaterial is not supported by WebGPURenderer, so every custom material here is
 * a node graph: the hex-faceted globe (every world is a Goldberg polyhedron, BRIEF 5.4), soft and hexagonal point clouds, a star shell and
 * a noise nebula, plus glow sprites drawn on an in-memory canvas (a CanvasTexture is not an img-src fetch, so the CSP allows it).
 * No post-processing: glow comes from additive blending and shader falloff, which keeps the shared chunk small.
 *
 * Point clouds are instanced quads (WebGPU draws points one pixel wide, so a sized point is a sprite): one draw call per cloud, the
 * position, size, colour and alpha of each instance a pure function of its attributes and the scene time, so the poster frame and the
 * first live frame agree.
 */
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshBasicNodeMaterial,
  NormalBlending,
  PlaneGeometry,
  PointsNodeMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from 'three/webgpu';
import type { Node } from 'three/webgpu';
import {
  Fn,
  abs,
  attribute,
  clamp,
  cos,
  dot,
  exp,
  float,
  fract,
  length,
  max,
  mix,
  modelViewMatrix,
  normalize,
  positionLocal,
  positionViewDirection,
  pow,
  sin,
  smoothstep,
  step,
  transformNormalToView,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { AMBER, RAMP, SKY, channels, ramp } from '../palette.ts';
import { goldbergCells, add, scale, sub } from '../geometry.ts';
import type { Vec3 } from '../geometry.ts';
import { gaussian, seeded } from '../rng.ts';
import type { Random } from '../rng.ts';

/** The scene clock: every material of a scene reads the same uniform, and the scene writes `.value` once per frame. */
export function makeClock() {
  return uniform(0);
}
export type Clock = ReturnType<typeof makeClock>;

// ---------------------------------------------------------------------------------------------------------------------------------
// Instanced point clouds
// ---------------------------------------------------------------------------------------------------------------------------------

/** One per-instance attribute: a flat float array and how many floats make one item (1 to 3). */
export interface CloudAttribute {
  readonly array: Float32Array;
  readonly size: 1 | 2 | 3;
}

/** A quad geometry drawn `count` times, with one instanced attribute per entry of `attributes`. */
export function cloudGeometry(count: number, attributes: Readonly<Record<string, CloudAttribute>>): InstancedBufferGeometry {
  const quad = new PlaneGeometry(1, 1);
  const geometry = new InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.getAttribute('position'));
  geometry.setAttribute('uv', quad.getAttribute('uv'));
  geometry.instanceCount = count;
  for (const [name, a] of Object.entries(attributes)) geometry.setAttribute(name, new InstancedBufferAttribute(a.array, a.size));
  quad.dispose();
  return geometry;
}

export type CloudShape = 'soft' | 'hex';

export interface CloudSpec {
  readonly geometry: InstancedBufferGeometry;
  /** Instance centre in the object's space (vec3). */
  readonly position: Node<'vec3'>;
  /** Diameter in CSS pixels at the instance's depth (float). The renderer multiplies by the pixel ratio. */
  readonly size: Node<'float'>;
  /** Linear colour (vec3). */
  readonly rgb: Node<'vec3'>;
  /** Opacity (float). */
  readonly alpha: Node<'float'>;
  readonly shape?: CloudShape;
}

/** Distance from the centre of a quad pixel in -1..1 units (1 at the edge of the inscribed circle). */
const radial = (): Node<'float'> => length(uv().sub(0.5)).mul(2);

/** Pixel size of a perspective-attenuated sprite: `base` CSS pixels at a view distance of `reference` world units. */
export function attenuated(position: Node<'vec3'>, base: Node<'float'> | number, reference: number): Node<'float'> {
  const viewZ = modelViewMatrix.mul(vec4(position, 1)).z.negate();
  return (typeof base === 'number' ? float(base) : base).mul(float(reference).div(max(viewZ, 0.001)));
}

const hexDistance = (p: Node<'vec2'>): Node<'float'> => {
  const a = abs(p);
  return max(dot(a, vec2(0.8660254, 0.5)), a.y);
};

/** A soft additive glow (`soft`) or a hexagonal cell with a hairline edge and a halo (`hex`). */
export function makeCloud(spec: CloudSpec): Mesh {
  const material = new PointsNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;
  material.sizeAttenuation = false;
  material.positionNode = spec.position;
  material.sizeNode = spec.size;
  if (spec.shape === 'hex') {
    const d = hexDistance(uv().sub(0.5).mul(2));
    const fill = float(1).sub(smoothstep(0.66, 0.74, d));
    const edge = float(1).sub(smoothstep(0.74, 0.8, d)).sub(fill);
    const glow = exp(d.mul(-3)).mul(0.4);
    const a = fill.mul(0.75).add(edge).add(glow).mul(spec.alpha);
    material.colorNode = vec4(spec.rgb.mul(fill.mul(0.8).add(edge.mul(1.2)).add(glow)), a);
  } else {
    const d = radial();
    const core = exp(d.mul(d).mul(-7));
    const halo = exp(d.mul(-3.2)).mul(0.35);
    const energy = core.add(halo);
    material.colorNode = vec4(spec.rgb.mul(energy), energy.mul(spec.alpha).mul(step(d, 1)));
  }
  const mesh = new Mesh(spec.geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Hex globe
// ---------------------------------------------------------------------------------------------------------------------------------

export interface GlobeOptions {
  readonly frequency: number;
  readonly radius: number;
  readonly seed: number;
  /** Fraction of each cell kept; the rest is the dark seam between cells. */
  readonly inset?: number;
  /** How far from the surface a cell starts when it assembles (in radii). 0 builds the globe already assembled. */
  readonly scatter?: number;
  /** Index of the one amber cell, or -1 for none. Defaults to a seeded choice (or to `amberToward`). */
  readonly amberCell?: number;
  /** Puts the amber cell on the cell nearest this direction (object space), so it faces the camera in the poster. */
  readonly amberToward?: Vec3;
  /** Ramp range used for cell colors, 0..1 on the blue ramp. */
  readonly tones?: readonly [number, number];
  /** Brightness of the rim light. */
  readonly rim?: number;
}

export interface Globe {
  readonly group: Group;
  readonly material: MeshBasicNodeMaterial;
  /** 0 = scattered, 1 = assembled (each cell has its own delay inside that span). */
  setAssembly(progress: number): void;
  readonly cellCount: number;
}

export function makeGlobe(opts: GlobeOptions): Globe {
  const rand = seeded(opts.seed);
  const cells = goldbergCells(opts.frequency);
  const inset = opts.inset ?? 0.86;
  const scatter = opts.scatter ?? 0;
  const [toneLow, toneHigh] = opts.tones ?? [0.0, 0.62];
  const toward = opts.amberToward;
  const nearest = (dir: Vec3): number => {
    let best = 0;
    let bestDot = -Infinity;
    cells.forEach((cell, i) => {
      const d = cell.center[0] * dir[0] + cell.center[1] * dir[1] + cell.center[2] * dir[2];
      if (d > bestDot) {
        bestDot = d;
        best = i;
      }
    });
    return best;
  };
  const amber = opts.amberCell ?? (toward !== undefined ? nearest(toward) : Math.floor(rand() * cells.length));
  const positions: number[] = [];
  const centers: number[] = [];
  const scatters: number[] = [];
  const delays: number[] = [];
  const colors: number[] = [];
  // Land and sea: a smooth field over the sphere picks the tone, so cells clump into regions instead of salt-and-pepper noise.
  const lobes: Vec3[] = Array.from({ length: 5 }, () => {
    const v: Vec3 = [gaussian(rand), gaussian(rand), gaussian(rand)];
    const l = Math.hypot(...v) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  });
  cells.forEach((cell, index) => {
    const c = cell.center;
    const field = lobes.reduce((sum, lobe, i) => sum + Math.max(0, c[0] * lobe[0] + c[1] * lobe[1] + c[2] * lobe[2]) ** 3 * (i % 2 === 0 ? 1 : 0.7), 0);
    const tone = toneLow + (toneHigh - toneLow) * Math.min(1, field * 0.9 + rand() * 0.18);
    const rgb = index === amber ? channels(AMBER) : ramp(tone);
    const middle = scale(c, opts.radius);
    const corners = cell.corners.map((corner) => add(middle, scale(sub(scale(corner, opts.radius), middle), inset)));
    const dir: Vec3 = [c[0] + gaussian(rand) * 0.6, c[1] + gaussian(rand) * 0.6, c[2] + gaussian(rand) * 0.6];
    const away = scale(dir, opts.radius * scatter * (0.6 + rand() * 0.9));
    const delay = rand();
    for (let k = 0; k < corners.length; k += 1) {
      const a = corners[k] as Vec3;
      const b = corners[(k + 1) % corners.length] as Vec3;
      for (const p of [middle, a, b]) {
        positions.push(p[0], p[1], p[2]);
        centers.push(middle[0], middle[1], middle[2]);
        scatters.push(away[0], away[1], away[2]);
        delays.push(delay);
        colors.push(rgb[0], rgb[1], rgb[2]);
      }
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('aCenter', new BufferAttribute(new Float32Array(centers), 3));
  geometry.setAttribute('aScatter', new BufferAttribute(new Float32Array(scatters), 3));
  geometry.setAttribute('aDelay', new BufferAttribute(new Float32Array(delays), 1));
  geometry.setAttribute('aColor', new BufferAttribute(new Float32Array(colors), 3));

  const uAssembly = uniform(scatter > 0 ? 0 : 1);
  const aCenter = attribute('aCenter', 'vec3');
  const aScatter = attribute('aScatter', 'vec3');
  const aDelay = attribute('aDelay', 'float');
  const aColor = attribute('aColor', 'vec3');
  // Each tile has its own delay inside the assembly span, eased out; a tile in flight tumbles about its own centre.
  const local = clamp(uAssembly.sub(aDelay.mul(0.7)).div(0.3), 0, 1);
  const k = float(1).sub(pow(float(1).sub(local), 3)).toVar();
  const spin = float(1).sub(k).mul(6).add(aDelay.mul(10)).mul(float(1).sub(k));
  const rel = positionLocal.sub(aCenter);
  const c = cos(spin);
  const s = sin(spin);
  const tumbled = vec3(rel.x.mul(c).sub(rel.z.mul(s)), rel.y, rel.x.mul(s).add(rel.z.mul(c)));
  const material = new MeshBasicNodeMaterial();
  material.positionNode = aCenter.add(tumbled.mul(mix(0.6, 1, k))).add(aScatter.mul(float(1).sub(k)));
  const normal = normalize(transformNormalToView(normalize(aCenter)));
  const diffuse = max(dot(normal, normalize(vec3(0.55, 0.65, 0.75))), 0);
  const rimTerm = pow(float(1).sub(max(dot(normal, positionViewDirection), 0)), 2.4);
  const base = aColor.mul(diffuse.mul(0.78).add(0.32));
  const rimColor = uniform(new Color(RAMP[4]));
  const glowIn = aColor.mul(float(1).sub(k).mul(0.6));
  material.colorNode = vec4(base.add(rimColor.mul(rimTerm).mul(opts.rim ?? 0.9)).add(glowIn), 1);
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  // The dark core shows through the seams between cells, so the hex grid reads at any distance.
  const core = new Mesh(new SphereGeometry(opts.radius * 0.97, 48, 32), new MeshBasicMaterial({ color: new Color(SKY).multiplyScalar(0.55) }));
  const group = new Group();
  group.add(core, mesh);
  return {
    group,
    material,
    cellCount: cells.length,
    setAssembly(progress: number): void {
      uAssembly.value = Math.min(1, Math.max(0, progress));
      core.scale.setScalar(0.35 + 0.65 * Math.min(1, Math.max(0, progress * 1.4)));
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Star shell
// ---------------------------------------------------------------------------------------------------------------------------------

/** A star shell around the origin: `count` stars at radius `inner` to `outer`, twinkling gently. */
export function makeStarShell(count: number, inner: number, outer: number, rand: Random, clock: Clock): Mesh {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const u = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const r = inner + (outer - inner) * Math.sqrt(rand());
    const s = Math.sqrt(1 - u * u);
    positions.set([r * s * Math.cos(a), r * u, r * s * Math.sin(a)], i * 3);
    const rgb = ramp(0.55 + rand() * 0.45);
    colors.set(rgb, i * 3);
    sizes[i] = rand() < 0.04 ? 2.6 + rand() * 1.6 : 0.7 + rand() * 1.1;
    phases[i] = rand() * Math.PI * 2;
  }
  const geometry = cloudGeometry(count, {
    aPos: { array: positions, size: 3 },
    aColor: { array: colors, size: 3 },
    aSize: { array: sizes, size: 1 },
    aPhase: { array: phases, size: 1 },
  });
  const phase = attribute('aPhase', 'float');
  return makeCloud({
    geometry,
    position: attribute('aPos', 'vec3'),
    size: attribute('aSize', 'float').mul(3),
    rgb: attribute('aColor', 'vec3'),
    alpha: sin(clock.mul(fract(phase).mul(1.4).add(0.6)).add(phase)).mul(0.45).add(0.55),
  });
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Nebula
// ---------------------------------------------------------------------------------------------------------------------------------

/** Hash-based 3D value noise and a three-octave sum of it: cheap enough for a full-frame backdrop, and identical on both backends. */
const hash3 = Fn(([p]: [Node<'vec3'>]) => {
  const q = fract(p.mul(vec3(0.1031, 0.103, 0.0973)));
  const r = q.add(dot(q, q.yzx.add(33.33)));
  return fract(r.x.add(r.y).mul(r.z));
});

const valueNoise = Fn(([p]: [Node<'vec3'>]) => {
  const i = p.floor();
  const f = fract(p);
  const u = f.mul(f).mul(float(3).sub(f.mul(2)));
  const lerpX = (dy: number, dz: number): Node<'float'> => mix(hash3(i.add(vec3(0, dy, dz))), hash3(i.add(vec3(1, dy, dz))), u.x);
  const front = mix(lerpX(0, 0), lerpX(1, 0), u.y);
  const back = mix(lerpX(0, 1), lerpX(1, 1), u.y);
  return mix(front, back, u.z);
});

const cloudNoise = Fn(([p]: [Node<'vec3'>]) => {
  const a = valueNoise(p).mul(0.5);
  const b = valueNoise(p.mul(2.03).add(7.1)).mul(0.28);
  const c = valueNoise(p.mul(4.11).add(3.7)).mul(0.22);
  return a.add(b).add(c);
});

export interface NebulaOptions {
  /** Radius of the dome the nebula is painted on. Keep it far outside the scene, so the camera's own movement barely shifts the clouds. */
  readonly radius: number;
  /** Overall brightness, 0 to 1. Keep it low behind text. */
  readonly intensity: number;
  readonly seed: number;
  /** Colours of the dark and bright parts of the clouds, 0xRRGGBB. */
  readonly shadow: number;
  readonly light: number;
}

/**
 * A procedural nebula: soft, banded clouds of the blue ramp painted on the inside of a far dome. The pattern is a pure
 * function of direction and the scene clock, so it drifts slowly and the poster frame matches the first live frame.
 */
export function makeNebula(opts: NebulaOptions, clock: Clock): Mesh {
  const dir = normalize(positionLocal);
  const seedShift = vec3(opts.seed * 1.7, opts.seed * 0.9, opts.seed * 2.3);
  const drift = vec3(clock.mul(0.004), clock.mul(-0.002), clock.mul(0.003));
  const p = dir.mul(2.6).add(seedShift).add(drift);
  const warp = cloudNoise(p.mul(0.7).add(11.3));
  const n = cloudNoise(p.add(warp.mul(1.3)));
  // Clouds only where the noise passes a threshold, so most of the sky stays dark and the clouds have edges.
  const density = smoothstep(0.42, 0.82, n);
  const tint = mix(vec3(...channels(opts.shadow)), vec3(...channels(opts.light)), smoothstep(0.5, 0.9, n));
  const material = new MeshBasicNodeMaterial();
  material.side = BackSide;
  material.transparent = true;
  material.depthWrite = false;
  material.depthTest = false;
  material.blending = AdditiveBlending;
  material.colorNode = vec4(tint.mul(density), density.mul(opts.intensity));
  const dome = new Mesh(new SphereGeometry(opts.radius, 32, 16), material);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  return dome;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Glow sprites
// ---------------------------------------------------------------------------------------------------------------------------------

const glowCache = new Map<string, CanvasTexture>();

/** A radial glow texture, drawn once per color on an offscreen canvas. */
export function glowTexture(hex: number, falloff = 0.55): CanvasTexture {
  const key = `${hex}:${falloff}`;
  const cached = glowCache.get(key);
  if (cached !== undefined && cached.image !== undefined) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('visuals: a 2D canvas context is unavailable for the glow texture');
  const [r, g, b] = channels(hex).map((v) => Math.round(v * 255));
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, `rgba(${r},${g},${b},1)`);
  gradient.addColorStop(falloff * 0.35, `rgba(${r},${g},${b},0.45)`);
  gradient.addColorStop(falloff, `rgba(${r},${g},${b},0.12)`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  glowCache.set(key, texture);
  return texture;
}

/** An additive glow sprite. Sprites own a fresh material, so disposing the scene never frees a texture another sprite still uses. */
export function makeGlow(hex: number, size: number, opacity = 1, falloff = 0.55): Sprite {
  const material = new SpriteMaterial({ map: glowTexture(hex, falloff), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity });
  const sprite = new Sprite(material);
  sprite.scale.setScalar(size);
  return sprite;
}

/** Forget cached glow textures (the runtime disposes them with the materials that use them). */
export function clearGlowCache(): void {
  glowCache.clear();
}

/** A ring of `segments` points as a closed line geometry on the y = 0 plane. */
export function ringGeometry(radius: number, segments = 160): BufferGeometry {
  const positions = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    positions.set([radius * Math.cos(a), 0, radius * Math.sin(a)], i * 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  return geometry;
}

export { NormalBlending };

/** Eases a value toward a target at `rate` per second. */
export function approach(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

/** Reads a number option, clamped, with a default. */
export function numberOption(options: Readonly<Record<string, unknown>>, key: string, fallback: number, min: number, max: number): number {
  const value = options[key];
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/** Reads a string option from a fixed list, with a default. */
export function enumOption<T extends string>(options: Readonly<Record<string, unknown>>, key: string, allowed: readonly T[], fallback: T): T {
  const value = options[key];
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export { seeded };
