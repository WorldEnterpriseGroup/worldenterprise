/**
 * Pure geometry shared by the three.js scenes and the server-rendered posters and labels. Nothing here imports three, so it runs in
 * Astro frontmatter, in the browser and under `node --test`. The rule that makes poster and scene agree: both place things with these
 * functions, and both look through the same camera (`CameraSpec`, projected by `project()` here and by three's PerspectiveCamera there).
 */

export type Vec3 = readonly [number, number, number];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export function normalize(a: Vec3): Vec3 {
  const l = length(a);
  return l === 0 ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l];
}
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---------------------------------------------------------------------------------------------------------------------------------
// Hex-faceted globe: a Goldberg polyhedron, the dual of a geodesic icosphere. 12 pentagons, the rest hexagons (BRIEF 5.4).
// ---------------------------------------------------------------------------------------------------------------------------------

export interface GlobeCell {
  /** Unit vector to the cell's center. */
  readonly center: Vec3;
  /** The cell's corners on the unit sphere, in winding order around `center`. Five for a pentagon, six for a hexagon. */
  readonly corners: readonly Vec3[];
}

const PHI = (1 + Math.sqrt(5)) / 2;
const ICOSA_RAW: readonly Vec3[] = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
];
const ICOSA_VERTICES: readonly Vec3[] = ICOSA_RAW.map(normalize);
const ICOSA_FACES: readonly (readonly [number, number, number])[] = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

/** Number of cells of a Goldberg globe at `frequency`: 10 f^2 + 2. */
export const globeCellCount = (frequency: number): number => 10 * frequency * frequency + 2;

/**
 * Builds the cells of a Goldberg globe. `frequency` 1 is a dodecahedron (12 pentagons); 6 gives 362 cells, 8 gives 642. Each cell's
 * corners are the centroids of the geodesic triangles around one geodesic vertex, sorted by angle.
 */
export function goldbergCells(frequency: number): readonly GlobeCell[] {
  const f = Math.max(1, Math.min(24, Math.floor(frequency)));
  const vertices: Vec3[] = [];
  const index = new Map<string, number>();
  const key = (v: Vec3): string => `${v[0].toFixed(5)},${v[1].toFixed(5)},${v[2].toFixed(5)}`;
  const vertex = (v: Vec3): number => {
    const n = normalize(v);
    const k = key(n);
    const found = index.get(k);
    if (found !== undefined) return found;
    vertices.push(n);
    index.set(k, vertices.length - 1);
    return vertices.length - 1;
  };
  const triangles: (readonly [number, number, number])[] = [];
  for (const [ia, ib, ic] of ICOSA_FACES) {
    const a = ICOSA_VERTICES[ia] as Vec3;
    const b = ICOSA_VERTICES[ib] as Vec3;
    const c = ICOSA_VERTICES[ic] as Vec3;
    const point = (i: number, j: number): number => vertex(add(a, add(scale(sub(b, a), i / f), scale(sub(c, a), j / f))));
    for (let i = 0; i < f; i += 1) {
      for (let j = 0; j < f - i; j += 1) {
        triangles.push([point(i, j), point(i + 1, j), point(i, j + 1)]);
        if (i + j < f - 1) triangles.push([point(i + 1, j), point(i + 1, j + 1), point(i, j + 1)]);
      }
    }
  }
  const around: Vec3[][] = vertices.map(() => []);
  for (const [a, b, c] of triangles) {
    const centroid = normalize(scale(add(add(vertices[a] as Vec3, vertices[b] as Vec3), vertices[c] as Vec3), 1 / 3));
    around[a]?.push(centroid);
    around[b]?.push(centroid);
    around[c]?.push(centroid);
  }
  return vertices.map((center, i) => {
    const helper: Vec3 = Math.abs(center[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = normalize(cross(center, helper));
    const w = cross(center, u);
    const corners = [...(around[i] ?? [])].sort((p, q) => {
      const dp = sub(p, center);
      const dq = sub(q, center);
      return Math.atan2(dot(dp, w), dot(dp, u)) - Math.atan2(dot(dq, w), dot(dq, u));
    });
    return { center, corners };
  });
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Camera and projection. Mirrors three's PerspectiveCamera (vertical fov, lookAt with +y up).
// ---------------------------------------------------------------------------------------------------------------------------------

export interface CameraSpec {
  readonly position: Vec3;
  readonly target: Vec3;
  /** Vertical field of view in degrees. */
  readonly fov: number;
}

/** Projects a world point to frame coordinates in 0..1 (x from the left, y from the top). */
export function project(point: Vec3, camera: CameraSpec, aspect: number): { readonly x: number; readonly y: number; readonly depth: number } {
  const forward = normalize(sub(camera.target, camera.position));
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const rel = sub(point, camera.position);
  const z = dot(rel, forward);
  const tan = Math.tan((camera.fov * Math.PI) / 360);
  const ndcX = dot(rel, right) / (z * tan * aspect);
  const ndcY = dot(rel, up) / (z * tan);
  return { x: (ndcX + 1) / 2, y: (1 - ndcY) / 2, depth: z };
}

/** Parses an aspect ratio such as `16/9` into a number. */
export function aspectOf(ratio: string): number {
  const [w, h] = ratio.split('/').map((part) => Number(part.trim()));
  if (w === undefined || h === undefined || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    throw new Error(`visuals: "${ratio}" is not an aspect ratio of the form "16/9"`);
  }
  return w / h;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Static label placement. A label sits at a percentage of its frame, quantized to whole percent so it maps to a class
// (`vp-x-37 vp-y-62`, defined in src/components/visuals/positions.css): markup never carries a style attribute (CSP).
// ---------------------------------------------------------------------------------------------------------------------------------

export function positionClasses(x: number, y: number): string {
  const q = (v: number): number => Math.max(0, Math.min(100, Math.round(v * 100)));
  return `vp-x-${q(x)} vp-y-${q(y)}`;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Orbit system: N labeled bodies around a center.
// ---------------------------------------------------------------------------------------------------------------------------------

export const ORBIT_CAMERA: CameraSpec = { position: [0, 5.2, 8.6], target: [0, -0.35, 0], fov: 38 };
export const ORBIT_MIN_BODIES = 1;
export const ORBIT_MAX_BODIES = 12;

export interface OrbitBody {
  readonly radius: number;
  /** Angle at time 0, radians; the poster frame. */
  readonly angle: number;
  /** Angular speed, radians per second (inner rings run faster). */
  readonly speed: number;
  readonly ring: number;
}

export type OrbitRings = 'single' | 'nested';

/**
 * Lays N bodies out on rings. `single` puts all of them on one ring, evenly spaced (the seven service lines). `nested` gives each body
 * its own ring, spread in angle so neighbours never line up (the UBF components). Angles start from the front-left so the first label
 * reads first.
 */
export function orbitLayout(count: number, rings: OrbitRings): readonly OrbitBody[] {
  const n = Math.max(ORBIT_MIN_BODIES, Math.min(ORBIT_MAX_BODIES, Math.floor(count)));
  const start = Math.PI * 0.62;
  if (rings === 'single') {
    return Array.from({ length: n }, (_, i) => ({ radius: 4.1, angle: start + (2 * Math.PI * i) / n, speed: 0.045, ring: 0 }));
  }
  const inner = 1.9;
  const outer = 5.0;
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const radius = n === 1 ? (inner + outer) / 2 : inner + ((outer - inner) * i) / (n - 1);
    return { radius, angle: start + golden * i * 1.0, speed: 0.11 / Math.sqrt(radius), ring: i };
  });
}

/** Position of a body at time `t` seconds, on the y = 0 plane. */
export function orbitPosition(body: OrbitBody, t: number): Vec3 {
  const a = body.angle + body.speed * t;
  return [body.radius * Math.cos(a), 0, body.radius * Math.sin(a)];
}

/** An SVG path (frame units 0..width, 0..height) for a ring of `radius`, sampled through the camera. */
export function ringPath(radius: number, camera: CameraSpec, width: number, height: number, samples = 96): string {
  const parts: string[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const a = (2 * Math.PI * i) / samples;
    const p = project([radius * Math.cos(a), 0, radius * Math.sin(a)], camera, width / height);
    parts.push(`${i === 0 ? 'M' : 'L'}${(p.x * width).toFixed(1)} ${(p.y * height).toFixed(1)}`);
  }
  return `${parts.join(' ')}Z`;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Launch trajectory: Dream (Survey) on the pad, Build (Blueprint) mid-flight, Grow (Territory) in orbit.
// ---------------------------------------------------------------------------------------------------------------------------------

export const LAUNCH_CAMERA: CameraSpec = { position: [0, 0.6, 9.4], target: [0, 0.25, 0], fov: 42 };
export const LAUNCH_ASPECT = 16 / 9;
export const LAUNCH_STATIONS: readonly Vec3[] = [
  [-4.6, -1.75, 0.4],
  [-0.5, 0.15, -0.6],
  [3.9, 1.55, -0.8],
];
/** The Grow world and the radius of the orbit the capsule settles into. */
export const LAUNCH_WORLD: Vec3 = [3.9, 1.55, -0.8];
export const LAUNCH_ORBIT_RADIUS = 1.25;
/** Control points of the climb: pad, lift-off bend, the Build gate, the approach and the orbit entry. */
export const LAUNCH_PATH: readonly Vec3[] = [
  [-4.6, -1.75, 0.4],
  [-4.1, -0.65, 0.25],
  [-2.6, 0.05, -0.1],
  [-0.5, 0.15, -0.6],
  [1.4, 0.55, -0.9],
  [LAUNCH_WORLD[0] - LAUNCH_ORBIT_RADIUS, LAUNCH_WORLD[1] + 0.05, LAUNCH_WORLD[2]],
];

/** Uniform Catmull-Rom through `points`, `t` in 0..1 over the whole path. The ends are clamped by repeating the end points. */
export function catmullRom(points: readonly Vec3[], t: number): Vec3 {
  if (points.length === 0) throw new Error('visuals: catmullRom needs at least one point');
  if (points.length === 1) return points[0] as Vec3;
  const segments = points.length - 1;
  const u = Math.min(1, Math.max(0, t)) * segments;
  const i = Math.min(segments - 1, Math.floor(u));
  const s = u - i;
  const p0 = points[Math.max(0, i - 1)] as Vec3;
  const p1 = points[i] as Vec3;
  const p2 = points[i + 1] as Vec3;
  const p3 = points[Math.min(points.length - 1, i + 2)] as Vec3;
  const s2 = s * s;
  const s3 = s2 * s;
  const axis = (k: 0 | 1 | 2): number =>
    0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * s + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * s2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * s3);
  return [axis(0), axis(1), axis(2)];
}

/** Path parameter of each control point (the stations sit on control points 0, 3 and the orbit). */
export const LAUNCH_STATION_T: readonly number[] = [0, 3 / (LAUNCH_PATH.length - 1), 1];

/** Evenly spaced path parameters for `count` waypoints between the pad and the orbit, never on a station. */
export function waypointTs(count: number): readonly number[] {
  const n = Math.max(0, Math.min(8, Math.floor(count)));
  return Array.from({ length: n }, (_, i) => 0.08 + (0.86 * (i + 0.5)) / n);
}

/** Where the launch labels attach: the pad, the gate, above the Grow world, then each waypoint on the path. Shared by scene and poster. */
export function launchAnchors(waypointCount: number): readonly Vec3[] {
  const world: Vec3 = [LAUNCH_WORLD[0], LAUNCH_WORLD[1] + 0.95, LAUNCH_WORLD[2]];
  return [LAUNCH_STATIONS[0] as Vec3, LAUNCH_STATIONS[1] as Vec3, world, ...waypointTs(waypointCount).map((t) => catmullRom(LAUNCH_PATH, t))];
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Team constellation: seats as stars around the company, on honeycomb (axial hex) positions.
// ---------------------------------------------------------------------------------------------------------------------------------

export const MAX_SEATS = 10;

/** Axial hex coordinates in spiral order around the center: ring 1 (6 cells), then ring 2. */
const SPIRAL: readonly (readonly [number, number])[] = [
  [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1],
  [2, -1], [1, 1], [-1, 2], [-2, 1], [-1, -1], [1, -2],
];

/**
 * Positions in 0..1 of `count` seats (at most MAX_SEATS) around a center at (0.5, 0.5), on a flat-top honeycomb, with a small seeded
 * jitter so the team reads as a constellation rather than a grid. `spread` is the distance between neighbours as a fraction of the frame.
 */
export function constellationLayout(count: number, spread = 0.2, jitter = 0.015): readonly { readonly x: number; readonly y: number }[] {
  const n = Math.max(0, Math.min(MAX_SEATS, Math.floor(count)));
  return SPIRAL.slice(0, n).map(([q, r], i) => {
    const x = 0.5 + spread * (Math.sqrt(3) / 2) * (q + r / 2) * 1.15;
    const y = 0.5 + spread * 0.75 * r * 1.15;
    const wobble = Math.sin((i + 1) * 12.9898) * jitter;
    return { x: x + wobble, y: y - wobble * 0.6 };
  });
}

/** Neighbor pairs (indices into the layout, -1 for the center) that the constellation draws as lines. */
export function constellationLinks(count: number): readonly (readonly [number, number])[] {
  const n = Math.max(0, Math.min(MAX_SEATS, Math.floor(count)));
  const links: [number, number][] = [];
  for (let i = 0; i < Math.min(n, 6); i += 1) links.push([-1, i]);
  for (let i = 1; i < Math.min(n, 6); i += 1) links.push([i - 1, i]);
  if (n === 6) links.push([5, 0]);
  const outerParent = [0, 1, 2, 3, 4, 5];
  for (let i = 6; i < n; i += 1) links.push([outerParent[i - 6] ?? 0, i]);
  return links;
}
