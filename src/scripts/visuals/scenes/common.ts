/**
 * Building blocks shared by the scenes: the hex-faceted globe (every world is a Goldberg polyhedron, BRIEF 5.4), a soft additive point
 * material, a star shell, and glow sprites drawn on an in-memory canvas (a CanvasTexture is not an img-src fetch, so the CSP allows it).
 * No post-processing: glow comes from additive blending and shader falloff, which keeps the shared chunk small.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  NormalBlending,
  Points,
  ShaderMaterial,
  SphereGeometry,
  MeshBasicMaterial,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from 'three';
import { AMBER, RAMP, SKY, channels, ramp } from '../palette.ts';
import { goldbergCells, add, scale, sub } from '../geometry.ts';
import type { Vec3 } from '../geometry.ts';
import { gaussian, seeded } from '../rng.ts';
import type { Random } from '../rng.ts';

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
  readonly material: ShaderMaterial;
  /** 0 = scattered, 1 = assembled (each cell has its own delay inside that span). */
  setAssembly(progress: number): void;
  setTime(t: number): void;
  readonly cellCount: number;
}

const GLOBE_VERTEX = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec3 aScatter;
  attribute float aDelay;
  attribute vec3 color;
  uniform float uAssembly;
  uniform float uTime;
  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vArrive;
  float easeOut(float x) { return 1.0 - pow(1.0 - x, 3.0); }
  void main() {
    float local = clamp((uAssembly - aDelay * 0.7) / 0.3, 0.0, 1.0);
    float k = easeOut(local);
    vArrive = k;
    vec3 offset = aScatter * (1.0 - k);
    // A cell in flight spins about its own centre, so the tiles tumble in rather than slide.
    float spin = (1.0 - k) * 6.0 + aDelay * 10.0;
    vec3 rel = position - aCenter;
    float c = cos(spin * (1.0 - k));
    float s = sin(spin * (1.0 - k));
    rel = vec3(rel.x * c - rel.z * s, rel.y, rel.x * s + rel.z * c);
    vec3 p = aCenter + rel * mix(0.6, 1.0, k) + offset;
    vColor = color;
    vNormal = normalize(normalMatrix * normalize(aCenter));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const GLOBE_FRAGMENT = /* glsl */ `
  uniform vec3 uLight;
  uniform float uRim;
  uniform vec3 uRimColor;
  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vArrive;
  void main() {
    float diffuse = max(dot(normalize(vNormal), normalize(uLight)), 0.0);
    float rim = pow(1.0 - max(dot(normalize(vNormal), vView), 0.0), 2.4);
    vec3 base = vColor * (0.32 + 0.78 * diffuse);
    vec3 col = base + uRimColor * rim * uRim;
    // Tiles still in flight glow a little brighter, like hot material cooling into place.
    col += vColor * (1.0 - vArrive) * 0.6;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

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
    const centre = scale(c, opts.radius);
    const corners = cell.corners.map((corner) => add(centre, scale(sub(scale(corner, opts.radius), centre), inset)));
    const dir: Vec3 = [c[0] + gaussian(rand) * 0.6, c[1] + gaussian(rand) * 0.6, c[2] + gaussian(rand) * 0.6];
    const away = scale(dir, opts.radius * scatter * (0.6 + rand() * 0.9));
    const delay = rand();
    for (let k = 0; k < corners.length; k += 1) {
      const a = corners[k] as Vec3;
      const b = corners[(k + 1) % corners.length] as Vec3;
      for (const p of [centre, a, b]) {
        positions.push(p[0], p[1], p[2]);
        centers.push(centre[0], centre[1], centre[2]);
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
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  const material = new ShaderMaterial({
    vertexShader: GLOBE_VERTEX,
    fragmentShader: GLOBE_FRAGMENT,
    uniforms: {
      uAssembly: { value: scatter > 0 ? 0 : 1 },
      uTime: { value: 0 },
      uLight: { value: [0.55, 0.65, 0.75] },
      uRim: { value: opts.rim ?? 0.9 },
      uRimColor: { value: new Color(RAMP[4]) },
    },
  });
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
      const uniform = material.uniforms.uAssembly;
      if (uniform) uniform.value = Math.min(1, Math.max(0, progress));
      core.scale.setScalar(0.35 + 0.65 * Math.min(1, Math.max(0, progress * 1.4)));
    },
    setTime(t: number): void {
      const uniform = material.uniforms.uTime;
      if (uniform) uniform.value = t;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Soft additive points
// ---------------------------------------------------------------------------------------------------------------------------------

export const POINT_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;
    if (d > 1.0) discard;
    float core = exp(-d * d * 7.0);
    float halo = exp(-d * 3.2) * 0.35;
    gl_FragColor = vec4(vColor * (core + halo), (core + halo) * vAlpha);
    #include <colorspace_fragment>
  }
`;

/** A star shell around the origin: `count` points at radius `inner` to `outer`, twinkling gently. */
export function makeStarShell(count: number, inner: number, outer: number, rand: Random): Points {
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
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aPhase;
      attribute vec3 color;
      uniform float uTime;
      uniform float uScale;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = color;
        vAlpha = 0.55 + 0.45 * sin(uTime * (0.6 + fract(aPhase) * 1.4) + aPhase);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale * 3.0;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: POINT_FRAGMENT,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

/** Sets `uTime` on a shader material if it has one. */
export function setTime(material: ShaderMaterial, t: number): void {
  const uniform = material.uniforms.uTime;
  if (uniform) uniform.value = t;
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
