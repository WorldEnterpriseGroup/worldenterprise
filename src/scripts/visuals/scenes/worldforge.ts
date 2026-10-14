/**
 * WorldForge, the incubation nursery (BRIEF 2.3 scene 4): a world assembles from tumbling hex tiles while seven faint O.R.B.I.T.A.L.
 * rings turn around it, and on each ring a moon condenses out of a cloud of dust: the side projects incubating alongside the main
 * company. One amber cell in the world is the scene's warm object. Pure function of time; the poster is frame `posterTime`.
 *
 * Options: `moons` (0 to 7, default 7). Label anchors are the moons in ring order, inner first.
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineLoop, Points, ShaderMaterial, Vector3 } from 'three';
import { RAMP } from '../palette.ts';
import { gaussian } from '../rng.ts';
import type { SceneContext, SceneInstance } from '../types.ts';
import { POINT_FRAGMENT, approach, clearGlowCache, makeGlobe, makeGlow, makeStarShell, numberOption, ringGeometry, seeded, setTime } from './common.ts';
import type { Globe } from './common.ts';

const POSTER_TIME = 8.5;
const WORLD_SECONDS = 10;
const MAX_MOONS = 7;

const DUST_VERTEX = /* glsl */ `
  attribute vec3 aOffset;
  attribute float aDelay;
  attribute vec3 color;
  uniform float uGather;
  uniform float uScale;
  uniform float uTime;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float k = clamp((uGather - aDelay * 0.4) / 0.6, 0.0, 1.0);
    float e = k * k * (3.0 - 2.0 * k);
    // Dust swirls as it falls in: the offset rotates about the moon's vertical axis.
    float a = (1.0 - e) * 3.0 + uTime * 0.2 * (1.0 - e);
    vec3 o = aOffset * (1.0 - e);
    o = vec3(o.x * cos(a) - o.z * sin(a), o.y, o.x * sin(a) + o.z * cos(a));
    vColor = color;
    vAlpha = (1.0 - e) * 0.9 + 0.05;
    vec4 mv = modelViewMatrix * vec4(position + o, 1.0);
    gl_PointSize = uScale * mix(3.4, 1.4, e) * (10.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

interface Moon {
  readonly pivot: Group;
  readonly globe: Globe;
  readonly dust: Points;
  readonly material: ShaderMaterial;
  readonly radius: number;
  readonly speed: number;
  readonly phase: number;
  readonly start: number;
}

function buildDust(count: number, rand: () => number, pixelScale: number): { points: Points; material: ShaderMaterial } {
  const offsets = new Float32Array(count * 3);
  const delays = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const r = 0.25 + Math.abs(gaussian(rand)) * 0.45;
    const v = [gaussian(rand), gaussian(rand) * 0.45, gaussian(rand)];
    const l = Math.hypot(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0) || 1;
    offsets.set([((v[0] ?? 0) / l) * r, ((v[1] ?? 0) / l) * r, ((v[2] ?? 0) / l) * r], i * 3);
    delays[i] = rand();
    const tone = RAMP[3 + Math.floor(rand() * 3)] ?? RAMP[4];
    colors.set([((tone >> 16) & 255) / 255, ((tone >> 8) & 255) / 255, (tone & 255) / 255], i * 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aOffset', new BufferAttribute(offsets, 3));
  geometry.setAttribute('aDelay', new BufferAttribute(delays, 1));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uGather: { value: 0 }, uScale: { value: pixelScale }, uTime: { value: 0 } },
    vertexShader: DUST_VERTEX,
    fragmentShader: POINT_FRAGMENT,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return { points, material };
}

export function create(ctx: SceneContext): SceneInstance {
  const { scene, camera, renderer, options } = ctx;
  const rand = seeded(9090);
  const pixelScale = renderer.getPixelRatio();
  const moonCount = Math.round(numberOption(options, 'moons', MAX_MOONS, 0, MAX_MOONS));

  camera.fov = 36;
  camera.near = 0.1;
  camera.far = 200;
  camera.updateProjectionMatrix();
  const base = new Vector3(0, 3.4, 11.2);
  const look = new Vector3(0, -0.2, 0);

  const shell = makeStarShell(Math.round(2000 * ctx.quality), 25, 55, rand);
  const shellMaterial = shell.material as ShaderMaterial;
  const shellScale = shellMaterial.uniforms.uScale;
  if (shellScale) shellScale.value = pixelScale;
  scene.add(shell);

  const world = makeGlobe({ frequency: 6, radius: 1.15, seed: 21, scatter: 2.2, tones: [0.0, 0.8], rim: 1.1 });
  scene.add(world.group);
  const halo = makeGlow(RAMP[4], 4.2, 0.5);
  scene.add(halo);

  // Seven rings, each on its own tilt so they read as a nested system, not a flat target.
  const system = new Group();
  system.rotation.x = 0.12;
  scene.add(system);
  const moons: Moon[] = [];
  for (let i = 0; i < MAX_MOONS; i += 1) {
    const radius = 1.85 + i * 0.47;
    const pivot = new Group();
    pivot.rotation.set((rand() - 0.5) * 0.35, rand() * Math.PI, (rand() - 0.5) * 0.3);
    system.add(pivot);
    const ring = new LineLoop(ringGeometry(radius, 192), new LineBasicMaterial({ color: RAMP[3], transparent: true, opacity: 0.16 + (i % 2) * 0.06 }));
    pivot.add(ring);
    if (i >= moonCount) continue;
    const globe = makeGlobe({ frequency: 1, radius: 0.15 + (i % 3) * 0.03, seed: 300 + i, tones: [0.3, 1.0], amberCell: -1, rim: 1.2 });
    const dust = buildDust(Math.round(260 * ctx.quality), rand, pixelScale);
    const moonGroup = new Group();
    moonGroup.add(globe.group, dust.points);
    pivot.add(moonGroup);
    moons.push({
      pivot: moonGroup,
      globe,
      dust: dust.points,
      material: dust.material,
      radius,
      speed: 0.28 / Math.sqrt(radius),
      phase: rand() * Math.PI * 2,
      start: 1.5 + i * 1.6,
    });
  }

  const anchorList = moons.map(() => new Vector3());
  let px = 0;
  let py = 0;
  let tx = 0;
  let ty = 0;

  return {
    posterTime: POSTER_TIME,
    update(t: number, dt: number): void {
      px = approach(px, tx, 1.4, dt);
      py = approach(py, ty, 1.4, dt);
      camera.position.set(base.x + px * 0.6, base.y + py * 0.4, base.z);
      camera.lookAt(look);
      setTime(shellMaterial, t);
      const assembly = Math.min(1, t / WORLD_SECONDS);
      world.setAssembly(assembly);
      world.group.rotation.y = t * 0.1;
      halo.material.opacity = 0.2 + 0.35 * assembly;
      moons.forEach((moon, i) => {
        const a = moon.phase + moon.speed * t;
        moon.pivot.position.set(moon.radius * Math.cos(a), 0, moon.radius * Math.sin(a));
        const gather = Math.min(1, Math.max(0, (t - moon.start) / 4.5));
        const u = moon.material.uniforms.uGather;
        if (u) u.value = gather;
        setTime(moon.material, t);
        moon.globe.group.scale.setScalar(Math.max(0.001, gather ** 1.5));
        moon.globe.group.rotation.y = t * 0.5;
        moon.dust.visible = gather < 1;
        moon.pivot.updateWorldMatrix(true, false);
        anchorList[i]?.set(0, 0.42, 0).applyMatrix4(moon.pivot.matrixWorld);
      });
    },
    anchors(): readonly Vector3[] {
      return anchorList;
    },
    pointer(x: number, y: number): void {
      tx = x;
      ty = y;
    },
    dispose(): void {
      clearGlowCache();
    },
  };
}
