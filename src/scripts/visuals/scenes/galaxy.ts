/**
 * GalaxyScene (BRIEF 5.4 scene 1, the hero): a spiral galaxy of particles turning with differential rotation, a procedural nebula
 * behind it, and at the core a hex-faceted world assembling from its tiles. One amber cell in that world is the only warm object. The
 * camera drifts with the pointer. Everything is a pure function of time, so the poster (rendered at `posterTime`) matches the first live
 * frame.
 *
 * Options: `align` 'center' | 'end' (where the core sits: center, or toward the right for a hero with text on the left).
 */
import { Group, Vector3 } from 'three/webgpu';
import { attribute, cos, float, mix, sin, smoothstep, vec3 } from 'three/tsl';
import { AMBER, RAMP, ramp } from '../palette.ts';
import { gaussian } from '../rng.ts';
import type { SceneContext, SceneInstance } from '../types.ts';
import {
  approach,
  attenuated,
  clearGlowCache,
  cloudGeometry,
  enumOption,
  makeClock,
  makeCloud,
  makeGlobe,
  makeGlow,
  makeNebula,
  makeStarShell,
  seeded,
} from './common.ts';
import type { Clock } from './common.ts';

const ARMS = 4;
const POSTER_TIME = 5.5;
const ASSEMBLE_SECONDS = 9;

function buildDisc(count: number, rand: () => number, dust: boolean, clock: Clock) {
  const radius = new Float32Array(count);
  const angle = new Float32Array(count);
  const height = new Float32Array(count);
  const size = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const arm = i % ARMS;
    // Exponential disc with a dense bulge.
    const r = dust ? 0.8 + rand() * 7.5 : Math.min(9.5, rand() < 0.3 ? Math.abs(gaussian(rand)) * 1.1 + 0.2 : 0.9 + rand() ** 0.8 * 8.4);
    const twist = r * 0.62;
    const spread = (dust ? 0.45 : 0.22) / (0.7 + r * 0.1);
    radius[i] = r;
    angle[i] = (arm / ARMS) * Math.PI * 2 + twist + gaussian(rand) * spread;
    height[i] = gaussian(rand) * (0.06 + 0.32 * Math.exp(-r * 0.7));
    size[i] = dust ? 7 + rand() * 9 : rand() < 0.03 ? 2.6 + rand() * 1.8 : 0.8 + rand() * 1.3;
    // Hot pale blue near the core, deeper blue in the arms, palest on the bright stars.
    const tone = dust ? 0.15 + rand() * 0.25 : Math.min(1, 0.12 + Math.exp(-r * 0.45) * 0.7 + rand() * 0.3);
    colors.set(ramp(tone), i * 3);
  }
  const geometry = cloudGeometry(count, {
    aRadius: { array: radius, size: 1 },
    aAngle: { array: angle, size: 1 },
    aHeight: { array: height, size: 1 },
    aSize: { array: size, size: 1 },
    aColor: { array: colors, size: 3 },
  });
  const r = attribute('aRadius', 'float');
  // Differential rotation: the inner disc turns faster, so the arms wind slowly.
  const omega = float(0.06).div(r.mul(0.22).add(0.35));
  const a = attribute('aAngle', 'float').add(clock.mul(omega));
  const position = vec3(r.mul(cos(a)), attribute('aHeight', 'float'), r.mul(sin(a))).toVar();
  const fade = smoothstep(0, 0.6, r).mul(float(1).sub(smoothstep(2, 9, r)).mul(0.3).add(0.7));
  return makeCloud({
    geometry,
    position,
    size: attenuated(position, attribute('aSize', 'float'), 36),
    rgb: attribute('aColor', 'vec3'),
    alpha: dust ? fade.mul(0.07) : fade,
  });
}

/**
 * The droid trail: small hex cells stream in from the lower left along a curve and dock into the world (the "companies joining" idea).
 * Each cell's position is a quadratic Bezier evaluated from its phase, so the trail costs one draw call.
 */
function buildTrail(count: number, rand: () => number, clock: Clock) {
  const phases = new Float32Array(count);
  const lanes = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    phases[i] = i / count + rand() * 0.012;
    lanes[i] = gaussian(rand) * 0.5;
  }
  const geometry = cloudGeometry(count, { aPhase: { array: phases, size: 1 }, aLane: { array: lanes, size: 1 } });
  const lane = attribute('aLane', 'float');
  const s = clock.mul(0.045).add(attribute('aPhase', 'float')).fract();
  const e = float(1).sub(float(1).sub(s).pow(1.6));
  const start = vec3(-9.5, -4.2, 3.5).add(vec3(0, lane.mul(0.5), lane.mul(0.3)));
  const bend = vec3(-4.5, -0.6, 2.8).add(vec3(lane.mul(0.35), lane.mul(-0.2), 0));
  const end = vec3(0, 0, 0);
  const position = mix(mix(start, bend, e), mix(bend, end, e), e).toVar();
  const rgb = mix(vec3(0.56, 0.74, 0.89), vec3(0.86, 0.92, 0.96), e);
  const alpha = smoothstep(0, 0.12, s).mul(float(1).sub(smoothstep(0.86, 1, s)));
  return makeCloud({
    geometry,
    position,
    size: attenuated(position, mix(float(26), float(7), e), 1),
    rgb,
    alpha,
    shape: 'hex',
  });
}

export function create(ctx: SceneContext): SceneInstance {
  const { scene, camera, options } = ctx;
  const align = enumOption(options, 'align', ['center', 'end'] as const, 'center');
  const clock = makeClock();

  const nebula = makeNebula({ radius: 90, intensity: 0.5, seed: 3, shadow: RAMP[0], light: RAMP[3] }, clock);
  scene.add(nebula);

  const root = new Group();
  // Tilt the disc so it reads as a spiral, not an edge-on line.
  root.rotation.x = 0.52;
  root.rotation.z = -0.18;
  scene.add(root);

  // Each layer has its own seed: a smaller frame draws fewer particles, and the ones it draws stay where the poster shows them.
  const stars = buildDisc(Math.round(18000 * ctx.quality), seeded(101), false, clock);
  const dust = buildDisc(Math.round(900 * ctx.quality), seeded(102), true, clock);
  root.add(dust, stars);

  const bulge = makeGlow(RAMP[5], 5.2, 0.55, 0.6);
  const halo = makeGlow(RAMP[2], 14, 0.22, 0.7);
  root.add(halo, bulge);

  const shell = makeStarShell(Math.round(1600 * ctx.quality), 30, 60, seeded(103), clock);
  scene.add(shell);

  // The world at the core: assembles over ASSEMBLE_SECONDS, then turns slowly. It does not tilt with the disc.
  // The amber cell faces the camera at the poster time: the world turns at 0.12 rad/s, so it starts 0.66 rad behind the front.
  const world = makeGlobe({ frequency: 5, radius: 0.8, seed: 7, scatter: 2.6, tones: [0.05, 0.62], rim: 1.1, amberToward: [-Math.sin(0.66) * 0.85, 0.5, Math.cos(0.66) * 0.85] });
  const worldGlow = makeGlow(AMBER, 0.6, 0.0);
  const worldHalo = makeGlow(RAMP[4], 3.2, 0.5);
  const core = new Group();
  core.add(worldHalo, world.group, worldGlow);
  scene.add(core);
  scene.add(buildTrail(26, seeded(104), clock));

  const offsetX = align === 'end' ? 2.6 : 0;
  const base = new Vector3(offsetX * -1, 0, 0);
  const look = new Vector3(-offsetX, 0.15, 0);
  let px = 0;
  let py = 0;
  let tx = 0;
  let ty = 0;

  const place = (aspect: number): void => {
    // Keep the core in frame on narrow ratios by pulling the camera back.
    const distance = aspect < 1.4 ? 12.5 : 10.2;
    camera.fov = 38;
    camera.near = 0.1;
    camera.far = 200;
    base.set(-offsetX, 3.2, distance);
    camera.updateProjectionMatrix();
  };
  place(ctx.aspect);

  return {
    posterTime: POSTER_TIME,
    update(t: number, dt: number): void {
      px = approach(px, tx, 1.6, dt);
      py = approach(py, ty, 1.6, dt);
      camera.position.set(base.x + px * 0.9, base.y + py * 0.5, base.z);
      camera.lookAt(look);
      clock.value = t;
      const assembly = Math.min(1, t / ASSEMBLE_SECONDS);
      world.setAssembly(assembly);
      world.group.rotation.y = t * 0.12;
      world.group.rotation.x = 0.25;
      // The amber spark brightens as the world completes.
      worldGlow.material.opacity = 0.25 + 0.55 * assembly ** 2;
      worldGlow.scale.setScalar(0.9 + 0.5 * assembly);
      worldHalo.material.opacity = 0.25 + 0.3 * assembly;
      shell.rotation.y = t * 0.004;
    },
    pointer(x: number, y: number): void {
      tx = x;
      ty = y;
    },
    resize(aspect: number): void {
      place(aspect);
    },
    dispose(): void {
      // The runtime disposes every geometry, material and texture in the scene graph after this.
      clearGlowCache();
    },
  };
}
