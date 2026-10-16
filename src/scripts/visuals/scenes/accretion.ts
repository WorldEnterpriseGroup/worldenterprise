/**
 * AccretionScene (the "worlds take years" scene): a protoplanetary disc seen at a shallow tilt. Dust and grains spiral in from the dark
 * rim, a few hex-faceted planetesimals ride the rings, and at the centre a hex-faceted world grows from them, one tile glowing amber.
 * It is incubation as world-building: slow, continuous, and never finished. Wide and short by design, so it works as a band behind text.
 *
 * Every grain follows a looping life (born faint on the rim, falls inward, dims as the world takes it), a pure function of the scene
 * clock, so there is no pop at the loop and the poster is simply frame `posterTime`. The disc is one instanced draw call.
 *
 * Options: `align` 'center' | 'end' (where the world sits: center, or toward the right for a band with text on the left).
 */
import { Group, Vector3 } from 'three/webgpu';
import type { Node } from 'three/webgpu';
import { attribute, cos, float, fract, mix, pow, sin, smoothstep, vec3 } from 'three/tsl';
import { AMBER, RAMP, ramp } from '../palette.ts';
import { gaussian } from '../rng.ts';
import type { SceneContext, SceneInstance } from '../types.ts';
import { approach, attenuated, clearGlowCache, cloudGeometry, enumOption, makeClock, makeCloud, makeGlobe, makeGlow, makeNebula, makeStarShell, seeded } from './common.ts';
import type { Clock } from './common.ts';

const POSTER_TIME = 9;
const GROW_SECONDS = 14;
/** Seconds for one grain to fall from the rim to the world. */
const LIFE = 46;
const R_IN = 0.9;
const R_OUT = 8.2;

/** Radius of a grain at life fraction `u` (0 at the rim, 1 at the world): fast at first, then a slow inspiral. */
function fall(u: Node<'float'>): Node<'float'> {
  return float(R_IN).add(float(R_OUT - R_IN).mul(pow(float(1).sub(u), 1.55)));
}

function buildGrains(count: number, rand: () => number, clock: Clock, dust: boolean) {
  const phase = new Float32Array(count);
  const angle = new Float32Array(count);
  const height = new Float32Array(count);
  const size = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    phase[i] = rand();
    // Grains clump into a few faint lanes (the gaps are where planetesimals have swept the disc clean).
    angle[i] = rand() * Math.PI * 2;
    height[i] = gaussian(rand) * (dust ? 0.12 : 0.05);
    size[i] = dust ? 8 + rand() * 9 : rand() < 0.04 ? 2.4 + rand() * 1.4 : 0.8 + rand() * 1.2;
    colors.set(ramp(dust ? 0.12 + rand() * 0.25 : 0.2 + rand() * 0.8), i * 3);
  }
  const geometry = cloudGeometry(count, {
    aPhase: { array: phase, size: 1 },
    aAngle: { array: angle, size: 1 },
    aHeight: { array: height, size: 1 },
    aSize: { array: size, size: 1 },
    aColor: { array: colors, size: 3 },
  });
  const u = fract(clock.div(LIFE).add(attribute('aPhase', 'float')));
  const r = fall(u);
  // Keplerian-ish: inner grains turn faster. Lanes: a slow sine in the angle pulls grains toward four spiral arms.
  const omega = float(1.1).div(r.mul(r.sqrt()).add(1.2));
  const a0 = attribute('aAngle', 'float');
  const arms = sin(a0.mul(2).add(r.mul(0.9))).mul(0.35);
  const a = a0.add(arms).add(clock.mul(omega));
  const position = vec3(r.mul(cos(a)), attribute('aHeight', 'float').mul(r.mul(0.35).add(0.4)), r.mul(sin(a))).toVar();
  // Born faint on the rim, dim as the world takes it: no pop at the loop.
  const life = smoothstep(0, 0.1, u).mul(float(1).sub(smoothstep(0.86, 1, u)));
  const heat = float(1).sub(smoothstep(R_IN, 5, r)).mul(0.5).add(0.5);
  return makeCloud({
    geometry,
    position,
    size: attenuated(position, attribute('aSize', 'float'), 30),
    rgb: attribute('aColor', 'vec3').mul(heat),
    alpha: life.mul(dust ? 0.06 : 0.95),
  });
}

/** Planetesimals: small hex cells on a few rings, turning at their own pace; the visible beginnings of worlds. */
function buildBodies(rand: () => number, clock: Clock) {
  const rings = [2.2, 3.4, 4.9, 6.6];
  const per = [3, 4, 5, 6];
  const radius: number[] = [];
  const angle: number[] = [];
  const size: number[] = [];
  const speed: number[] = [];
  rings.forEach((r, k) => {
    for (let i = 0; i < (per[k] ?? 0); i += 1) {
      radius.push(r + gaussian(rand) * 0.08);
      angle.push((i / (per[k] ?? 1)) * Math.PI * 2 + rand() * 0.6);
      size.push(11 + rand() * 9 - k * 1.2);
      speed.push(1.1 / (r * Math.sqrt(r) + 1.2));
    }
  });
  const count = radius.length;
  const geometry = cloudGeometry(count, {
    aRadius: { array: Float32Array.from(radius), size: 1 },
    aAngle: { array: Float32Array.from(angle), size: 1 },
    aSize: { array: Float32Array.from(size), size: 1 },
    aSpeed: { array: Float32Array.from(speed), size: 1 },
  });
  const r = attribute('aRadius', 'float');
  const a = attribute('aAngle', 'float').add(clock.mul(attribute('aSpeed', 'float')));
  const position = vec3(r.mul(cos(a)), float(0), r.mul(sin(a))).toVar();
  return makeCloud({
    geometry,
    position,
    size: attenuated(position, attribute('aSize', 'float'), 10),
    rgb: mix(vec3(0.56, 0.74, 0.89), vec3(0.86, 0.92, 0.96), smoothstep(2, 6.6, r)),
    alpha: float(0.8),
    shape: 'hex',
  });
}

export function create(ctx: SceneContext): SceneInstance {
  const { scene, camera, options } = ctx;
  const align = enumOption(options, 'align', ['center', 'end'] as const, 'center');
  const clock = makeClock();
  const offsetX = align === 'end' ? 3.4 : 0;

  scene.add(makeNebula({ radius: 90, intensity: 0.42, seed: 11, shadow: RAMP[0], light: RAMP[2] }, clock));
  scene.add(makeStarShell(Math.round(1800 * ctx.quality), 30, 60, seeded(7001), clock));

  // The disc lies in the xz plane of this group, tilted toward the camera so it reads as a wide ellipse.
  const disc = new Group();
  disc.rotation.x = 0.3;
  disc.rotation.z = -0.07;
  disc.position.x = offsetX;
  scene.add(disc);
  const grains = buildGrains(Math.round(14000 * ctx.quality), seeded(7002), clock, false);
  const dust = buildGrains(Math.round(700 * ctx.quality), seeded(7003), clock, true);
  disc.add(dust, grains, buildBodies(seeded(7004), clock));
  disc.add(makeGlow(RAMP[2], 16, 0.16, 0.7));

  // The world: grows over GROW_SECONDS, then turns. Its amber cell faces the camera at the poster time.
  const world = makeGlobe({ frequency: 5, radius: 0.9, seed: 31, scatter: 2.4, tones: [0.05, 0.62], rim: 1.1, amberToward: [0, 0.3, 0.9] });
  const worldGlow = makeGlow(AMBER, 0.6, 0.0);
  const worldHalo = makeGlow(RAMP[4], 4.4, 0.5);
  const core = new Group();
  core.add(worldHalo, world.group, worldGlow);
  disc.add(core);

  const base = new Vector3();
  const look = new Vector3();
  let px = 0;
  let py = 0;
  let tx = 0;
  let ty = 0;
  const place = (aspect: number): void => {
    // The disc spans the frame on wide ratios; narrower frames pull the camera back so the world stays in view.
    const distance = aspect < 1.4 ? 15 : aspect < 2 ? 12 : 10.4;
    camera.fov = 36;
    camera.near = 0.1;
    camera.far = 200;
    base.set(0, 2.4, distance);
    look.set(0, 0, 0);
    camera.updateProjectionMatrix();
  };
  place(ctx.aspect);

  return {
    posterTime: POSTER_TIME,
    update(t: number, dt: number): void {
      px = approach(px, tx, 1.6, dt);
      py = approach(py, ty, 1.6, dt);
      camera.position.set(base.x + px * 0.8, base.y + py * 0.4, base.z);
      camera.lookAt(look);
      clock.value = t;
      const growth = Math.min(1, t / GROW_SECONDS);
      world.setAssembly(growth);
      world.group.rotation.y = t * 0.1;
      world.group.rotation.x = 0.2;
      worldGlow.material.opacity = 0.2 + 0.6 * growth ** 2;
      worldGlow.scale.setScalar(0.9 + 0.5 * growth);
      worldHalo.material.opacity = 0.2 + 0.35 * growth;
    },
    pointer(x: number, y: number): void {
      tx = x;
      ty = y;
    },
    resize(aspect: number): void {
      place(aspect);
    },
    dispose(): void {
      clearGlowCache();
    },
  };
}
