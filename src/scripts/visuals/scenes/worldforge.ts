/**
 * WorldForge, the incubation nursery (BRIEF 2.3 scene 4): a world assembles from tumbling hex tiles while seven faint O.R.B.I.T.A.L.
 * rings turn around it, and on each ring a moon condenses out of a cloud of dust: the side projects incubating alongside the main
 * company. One amber cell in the world is the scene's warm object. Pure function of time; the poster is frame `posterTime`.
 *
 * Options: `moons` (0 to 7, default 7). Label anchors are the moons in ring order, inner first.
 */
import { Group, LineBasicMaterial, Line, Vector3 } from 'three/webgpu';
import type { Mesh } from 'three/webgpu';
import { attribute, clamp, cos, float, mix, sin, smoothstep, uniform, vec3 } from 'three/tsl';
import { RAMP, channels } from '../palette.ts';
import { gaussian } from '../rng.ts';
import type { SceneContext, SceneInstance } from '../types.ts';
import { approach, attenuated, clearGlowCache, cloudGeometry, makeClock, makeCloud, makeGlobe, makeGlow, makeNebula, makeStarShell, numberOption, ringGeometry, seeded } from './common.ts';
import type { Clock, Globe } from './common.ts';

const POSTER_TIME = 8.5;
const WORLD_SECONDS = 10;
const MAX_MOONS = 7;

interface Moon {
  readonly pivot: Group;
  readonly globe: Globe;
  readonly dust: Mesh;
  readonly gather: { value: number };
  readonly radius: number;
  readonly speed: number;
  readonly phase: number;
  readonly start: number;
}

/** A dust cloud that falls in on a moon: each grain spirals from its offset to the moon's centre as `gather` goes 0 to 1. */
function buildDust(count: number, rand: () => number, clock: Clock): { mesh: Mesh; gather: Clock } {
  const offsets = new Float32Array(count * 3);
  const delays = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const r = 0.08 + Math.abs(gaussian(rand)) * 0.14;
    const v = [gaussian(rand), gaussian(rand) * 0.45, gaussian(rand)];
    const l = Math.hypot(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0) || 1;
    offsets.set([((v[0] ?? 0) / l) * r, ((v[1] ?? 0) / l) * r, ((v[2] ?? 0) / l) * r], i * 3);
    delays[i] = rand();
    const tone = RAMP[3 + Math.floor(rand() * 3)] ?? RAMP[4];
    colors.set(channels(tone), i * 3);
  }
  const geometry = cloudGeometry(count, {
    aOffset: { array: offsets, size: 3 },
    aDelay: { array: delays, size: 1 },
    aColor: { array: colors, size: 3 },
  });
  const gather = uniform(0);
  const k = clamp(gather.sub(attribute('aDelay', 'float').mul(0.4)).div(0.6), 0, 1);
  const e = smoothstep(0, 1, k);
  // Dust swirls as it falls in: the offset rotates about the moon's vertical axis.
  const inv = float(1).sub(e);
  const a = inv.mul(3).add(clock.mul(0.2).mul(inv));
  const o = attribute('aOffset', 'vec3').mul(inv);
  const position = vec3(o.x.mul(cos(a)).sub(o.z.mul(sin(a))), o.y, o.x.mul(sin(a)).add(o.z.mul(cos(a))));
  const mesh = makeCloud({
    geometry,
    position,
    size: attenuated(position, mix(float(4.2), float(1.6), e), 10),
    rgb: attribute('aColor', 'vec3'),
    alpha: inv.mul(0.9).add(0.05),
  });
  return { mesh, gather };
}

export function create(ctx: SceneContext): SceneInstance {
  const { scene, camera, options } = ctx;
  const clock = makeClock();
  const rand = seeded(9090);
  const moonCount = Math.round(numberOption(options, 'moons', MAX_MOONS, 0, MAX_MOONS));

  camera.fov = 36;
  camera.near = 0.1;
  camera.far = 200;
  camera.updateProjectionMatrix();
  const base = new Vector3(0, 3.4, 11.2);
  const look = new Vector3(0, -0.2, 0);

  const shell = makeStarShell(Math.round(2000 * ctx.quality), 25, 55, seeded(9001), clock);
  scene.add(makeNebula({ radius: 90, intensity: 0.4, seed: 5, shadow: RAMP[0], light: RAMP[3] }, clock), shell);

  // The amber cell faces the camera at the poster time (the world turns at 0.1 rad/s, so aim it 0.85 rad behind the front).
  const world = makeGlobe({ frequency: 6, radius: 1.15, seed: 21, scatter: 2.2, tones: [0.0, 0.6], rim: 1.1, amberToward: [-Math.sin(0.85) * 0.8, 0.45, Math.cos(0.85) * 0.8] });
  scene.add(world.group);
  const halo = makeGlow(RAMP[4], 4.2, 0.5);
  scene.add(halo);

  // Seven rings, each on its own tilt so they read as a nested system, not a flat target.
  const system = new Group();
  system.rotation.x = 0.12;
  scene.add(system);
  const moons: Moon[] = [];
  for (let i = 0; i < MAX_MOONS; i += 1) {
    // Ring tilt and moon phase come from the shared seed whether or not the ring has a moon, so moon i sits in the same place for any
    // `moons` count (the label anchors depend on it); each dust cloud has its own seed.
    const radius = 1.85 + i * 0.47;
    const tilt: [number, number, number] = [(rand() - 0.5) * 0.35, rand() * Math.PI, (rand() - 0.5) * 0.3];
    // Golden-angle phases keep neighboring moons apart, so their labels never stack.
    const phase = 0.4 + i * 2.39996 + rand() * 0.2;
    const pivot = new Group();
    pivot.rotation.set(...tilt);
    system.add(pivot);
    const ring = new Line(ringGeometry(radius, 192), new LineBasicMaterial({ color: RAMP[3], transparent: true, opacity: 0.3 + (i % 2) * 0.08 }));
    pivot.add(ring);
    if (i >= moonCount) continue;
    const globe = makeGlobe({ frequency: 2, radius: 0.16 + (i % 3) * 0.035, seed: 300 + i, tones: [0.25, 0.75], amberCell: -1, rim: 1.2 });
    globe.group.add(makeGlow(RAMP[4], 0.9, 0.4));
    const dust = buildDust(Math.round(260 * ctx.quality), seeded(9191 + i), clock);
    const moonGroup = new Group();
    moonGroup.add(globe.group, dust.mesh);
    pivot.add(moonGroup);
    moons.push({ pivot: moonGroup, globe, dust: dust.mesh, gather: dust.gather, radius, speed: 0.28 / Math.sqrt(radius), phase, start: 1.5 + i * 1.6 });
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
      clock.value = t;
      const assembly = Math.min(1, t / WORLD_SECONDS);
      world.setAssembly(assembly);
      world.group.rotation.y = t * 0.1;
      halo.material.opacity = 0.2 + 0.35 * assembly;
      moons.forEach((moon, i) => {
        const a = moon.phase + moon.speed * t;
        moon.pivot.position.set(moon.radius * Math.cos(a), 0, moon.radius * Math.sin(a));
        const gather = Math.min(1, Math.max(0, (t - moon.start) / 4.5));
        moon.gather.value = gather;
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
