/**
 * GalaxyScene (BRIEF 5.4 scene 1, the hero): a spiral galaxy of particles turning with differential rotation, a faint nebula, and at the
 * core a hex-faceted world assembling from its tiles. One amber cell in that world is the only warm object. The camera drifts with the
 * pointer. Everything is a pure function of time, so the poster (rendered at `posterTime`) matches the first live frame.
 *
 * Options: `align` 'center' | 'end' (where the core sits: centre, or toward the right for a hero with text on the left).
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, Points, ShaderMaterial, Vector3 } from 'three';
import { AMBER, RAMP, ramp } from '../palette.ts';
import { gaussian } from '../rng.ts';
import type { SceneContext, SceneInstance } from '../types.ts';
import { POINT_FRAGMENT, approach, clearGlowCache, enumOption, makeGlobe, makeGlow, makeStarShell, seeded, setTime } from './common.ts';

const ARMS = 4;
const POSTER_TIME = 5.5;
const ASSEMBLE_SECONDS = 9;

const GALAXY_VERTEX = /* glsl */ `
  attribute float aRadius;
  attribute float aAngle;
  attribute float aHeight;
  attribute float aSize;
  attribute vec3 color;
  uniform float uTime;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    // Differential rotation: the inner disc turns faster, so the arms wind slowly.
    float omega = 0.06 / (0.35 + aRadius * 0.22);
    float a = aAngle + uTime * omega;
    vec3 p = vec3(aRadius * cos(a), aHeight, aRadius * sin(a));
    vColor = color;
    vAlpha = smoothstep(0.0, 0.6, aRadius) * (0.55 + 0.45 * smoothstep(9.0, 2.0, aRadius));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * uScale * (18.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

function buildDisc(count: number, rand: () => number, dust: boolean): { points: Points; material: ShaderMaterial } {
  const radius = new Float32Array(count);
  const angle = new Float32Array(count);
  const height = new Float32Array(count);
  const size = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const arm = i % ARMS;
    // Exponential disc with a dense bulge.
    const r = dust ? 0.8 + rand() * 7.5 : Math.min(9.5, -Math.log(1 - rand() * 0.985) * 1.9 + 0.25);
    const twist = r * 0.62;
    const spread = (dust ? 0.5 : 0.28) / (0.6 + r * 0.12);
    radius[i] = r;
    angle[i] = (arm / ARMS) * Math.PI * 2 + twist + gaussian(rand) * spread;
    height[i] = gaussian(rand) * (0.06 + 0.32 * Math.exp(-r * 0.7));
    size[i] = dust ? 7 + rand() * 9 : rand() < 0.03 ? 2.6 + rand() * 1.8 : 0.8 + rand() * 1.3;
    // Hot pale blue near the core, deeper blue in the arms, palest on the bright stars.
    const tone = dust ? 0.1 + rand() * 0.25 : Math.min(1, 0.35 + Math.exp(-r * 0.45) * 0.6 + rand() * 0.25);
    colors.set(ramp(tone), i * 3);
  }
  const geometry = new BufferGeometry();
  // Positions are computed in the shader; `position` is still required for the draw call and bounding sphere.
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aRadius', new BufferAttribute(radius, 1));
  geometry.setAttribute('aAngle', new BufferAttribute(angle, 1));
  geometry.setAttribute('aHeight', new BufferAttribute(height, 1));
  geometry.setAttribute('aSize', new BufferAttribute(size, 1));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
    vertexShader: dust ? GALAXY_VERTEX.replace('vAlpha = smoothstep', 'vAlpha = 0.07 * smoothstep') : GALAXY_VERTEX,
    fragmentShader: POINT_FRAGMENT,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return { points, material };
}

/**
 * The droid trail: small hex cells stream in from the lower left along a curve and dock into the world (the "companies joining" idea).
 * Each cell's position is a quadratic Bezier evaluated in the shader from its phase, so the trail costs one draw call.
 */
const TRAIL_VERTEX = /* glsl */ `
  attribute float aPhase;
  attribute float aLane;
  uniform float uTime;
  uniform float uScale;
  uniform vec3 uStart;
  uniform vec3 uBend;
  uniform vec3 uEnd;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float s = fract(uTime * 0.045 + aPhase);
    float e = 1.0 - pow(1.0 - s, 1.6);
    vec3 start = uStart + vec3(0.0, aLane * 0.5, aLane * 0.3);
    vec3 bend = uBend + vec3(aLane * 0.35, -aLane * 0.2, 0.0);
    vec3 p = mix(mix(start, bend, e), mix(bend, uEnd, e), e);
    vColor = mix(vec3(0.56, 0.74, 0.89), vec3(0.86, 0.92, 0.96), e);
    vAlpha = smoothstep(0.0, 0.12, s) * (1.0 - smoothstep(0.86, 1.0, s));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uScale * mix(26.0, 7.0, e) * (10.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const HEX_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  float hexDist(vec2 p) {
    p = abs(p);
    return max(dot(p, vec2(0.8660254, 0.5)), p.y);
  }
  void main() {
    vec2 uv = (gl_PointCoord - 0.5) * 2.0;
    float d = hexDist(uv);
    float fill = 1.0 - smoothstep(0.66, 0.74, d);
    float edge = (1.0 - smoothstep(0.74, 0.8, d)) - fill;
    float glow = exp(-d * 3.0) * 0.4;
    float a = (fill * 0.75 + edge + glow) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * (fill * 0.8 + edge * 1.2 + glow), a);
    #include <colorspace_fragment>
  }
`;

function buildTrail(count: number, rand: () => number, pixelScale: number): { points: Points; material: ShaderMaterial } {
  const phases = new Float32Array(count);
  const lanes = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    phases[i] = i / count + rand() * 0.012;
    lanes[i] = gaussian(rand) * 0.5;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));
  geometry.setAttribute('aLane', new BufferAttribute(lanes, 1));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: pixelScale },
      uStart: { value: new Vector3(-9.5, -4.2, 3.5) },
      uBend: { value: new Vector3(-4.5, -0.6, 2.8) },
      uEnd: { value: new Vector3(0, 0, 0) },
    },
    vertexShader: TRAIL_VERTEX,
    fragmentShader: HEX_FRAGMENT,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return { points, material };
}

export function create(ctx: SceneContext): SceneInstance {
  const { scene, camera, renderer, options } = ctx;
  const rand = seeded(20261014);
  const align = enumOption(options, 'align', ['center', 'end'] as const, 'center');
  const pixelScale = renderer.getPixelRatio();

  const root = new Group();
  // Tilt the disc so it reads as a spiral, not an edge-on line.
  root.rotation.x = 0.52;
  root.rotation.z = -0.18;
  scene.add(root);

  const stars = buildDisc(Math.round(18000 * ctx.quality), rand, false);
  const dust = buildDisc(Math.round(900 * ctx.quality), rand, true);
  root.add(dust.points, stars.points);
  for (const m of [stars.material, dust.material]) {
    const u = m.uniforms.uScale;
    if (u) u.value = pixelScale;
  }

  const bulge = makeGlow(RAMP[5], 5.2, 0.55, 0.6);
  const halo = makeGlow(RAMP[2], 14, 0.22, 0.7);
  root.add(halo, bulge);

  const shell = makeStarShell(Math.round(1600 * ctx.quality), 30, 60, rand);
  scene.add(shell);
  const shellMaterial = shell.material as ShaderMaterial;
  const shellScale = shellMaterial.uniforms.uScale;
  if (shellScale) shellScale.value = pixelScale;

  // The world at the core: assembles over ASSEMBLE_SECONDS, then turns slowly. It does not tilt with the disc.
  const world = makeGlobe({ frequency: 5, radius: 0.62, seed: 7, scatter: 2.6, tones: [0.05, 0.75], rim: 1.1 });
  const worldGlow = makeGlow(AMBER, 0.6, 0.0);
  const worldHalo = makeGlow(RAMP[4], 3.2, 0.5);
  const core = new Group();
  core.add(worldHalo, world.group, worldGlow);
  scene.add(core);
  const trail = buildTrail(26, rand, pixelScale);
  scene.add(trail.points);

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
      setTime(stars.material, t);
      setTime(dust.material, t);
      setTime(shellMaterial, t);
      setTime(trail.material, t);
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
