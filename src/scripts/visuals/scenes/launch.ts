/**
 * LaunchTrajectory (BRIEF 2.3 scene 3): a droid, a small amber hex capsule (the scene's one warm object), lifts off the Dream pad, arcs
 * through the Build gate and settles into orbit around the Grow world. The trajectory is a dotted line that lights up behind the capsule.
 * Labels (the three stations, then any waypoints such as the L.A.U.N.C.H. letters) are HTML; the scene reports their anchors.
 *
 * Options: `waypoints` (0 to 8) — how many waypoint anchors to report after the stations.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  Points,
  ShaderMaterial,
  TorusGeometry,
  Vector3,
} from 'three';
import { AMBER, RAMP } from '../palette.ts';
import {
  LAUNCH_CAMERA,
  LAUNCH_ORBIT_RADIUS,
  LAUNCH_PATH,
  LAUNCH_STATIONS,
  LAUNCH_STATION_T,
  LAUNCH_WORLD,
  catmullRom,
  waypointTs,
} from '../geometry.ts';
import type { Vec3 } from '../geometry.ts';
import type { SceneContext, SceneInstance } from '../types.ts';
import { POINT_FRAGMENT, approach, clearGlowCache, makeGlobe, makeGlow, makeStarShell, numberOption, ringGeometry, seeded, setTime } from './common.ts';

/** One flight: the climb, then a settled orbit, then a short fade before the next launch. */
const CLIMB = 8.5;
const ORBIT = 5.5;
const CYCLE = CLIMB + ORBIT;
const POSTER_TIME = 5.2;
const ORBIT_TILT = 0.42;

const ex = new Vector3(1, 0, 0);
const ez = new Vector3(0, Math.sin(ORBIT_TILT), Math.cos(ORBIT_TILT));
const world = new Vector3(...LAUNCH_WORLD);

function orbitPoint(angle: number, out: Vector3): Vector3 {
  return out.copy(world).addScaledVector(ex, LAUNCH_ORBIT_RADIUS * Math.cos(angle)).addScaledVector(ez, LAUNCH_ORBIT_RADIUS * Math.sin(angle));
}

/** Path parameter of the capsule at cycle time `c` (0..CLIMB): a slow lift-off, a fast middle, a gentle orbit entry. */
function climbParam(c: number): number {
  const x = Math.min(1, Math.max(0, c / CLIMB));
  return x < 0.5 ? 2 * x * x * (1.1 - 0.2 * x) : 1 - ((-2 * x + 2) ** 2) / 2;
}

/** Capsule position at absolute time `t`. */
function capsuleAt(t: number, out: Vector3): { progress: number; orbiting: boolean } {
  const c = ((t % CYCLE) + CYCLE) % CYCLE;
  if (c < CLIMB) {
    const u = climbParam(c);
    const p = catmullRom(LAUNCH_PATH, u);
    out.set(p[0], p[1], p[2]);
    return { progress: u, orbiting: false };
  }
  const angle = Math.PI + ((c - CLIMB) / ORBIT) * Math.PI * 1.6;
  orbitPoint(angle, out);
  return { progress: 1, orbiting: true };
}

const TRAJECTORY_VERTEX = /* glsl */ `
  attribute float aT;
  attribute float aSize;
  uniform float uProgress;
  uniform float uTime;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float lit = step(aT, uProgress);
    float head = exp(-abs(uProgress - aT) * 30.0);
    vColor = mix(vec3(0.31, 0.63, 0.84), vec3(0.86, 0.92, 0.96), lit * 0.6 + head * 0.4);
    vAlpha = 0.28 + lit * 0.5 + head * 0.6;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uScale * aSize * (1.0 + head * 0.8) * (10.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

function buildTrajectory(pixelScale: number): { points: Points; material: ShaderMaterial } {
  const samples: { p: Vec3; t: number }[] = [];
  // Even spacing by arc length so the dots read as a dotted line, not clumps.
  const dense = Array.from({ length: 600 }, (_, i) => catmullRom(LAUNCH_PATH, i / 599));
  const lengths = [0];
  for (let i = 1; i < dense.length; i += 1) {
    const a = dense[i - 1] as Vec3;
    const b = dense[i] as Vec3;
    lengths.push((lengths[i - 1] ?? 0) + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const total = lengths[lengths.length - 1] ?? 1;
  const step = 0.11;
  let j = 0;
  for (let d = 0; d <= total; d += step) {
    while (j < lengths.length - 1 && (lengths[j + 1] ?? total) < d) j += 1;
    samples.push({ p: dense[j] as Vec3, t: j / (dense.length - 1) });
  }
  const positions = new Float32Array(samples.length * 3);
  const ts = new Float32Array(samples.length);
  const sizes = new Float32Array(samples.length);
  samples.forEach((s, i) => {
    positions.set(s.p, i * 3);
    ts[i] = s.t;
    sizes[i] = 5.5;
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aT', new BufferAttribute(ts, 1));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uProgress: { value: 0 }, uTime: { value: 0 }, uScale: { value: pixelScale } },
    vertexShader: TRAJECTORY_VERTEX,
    fragmentShader: POINT_FRAGMENT,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return { points, material };
}

/** Exhaust: a short fading wake of points behind the capsule, rewritten each frame from the capsule's recent positions. */
const WAKE = 48;

function buildWake(pixelScale: number): { points: Points; positions: Float32Array; geometry: BufferGeometry } {
  const positions = new Float32Array(WAKE * 3);
  const age = new Float32Array(WAKE);
  for (let i = 0; i < WAKE; i += 1) age[i] = i / (WAKE - 1);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aAge', new BufferAttribute(age, 1));
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uScale: { value: pixelScale } },
    vertexShader: /* glsl */ `
      attribute float aAge;
      uniform float uScale;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = mix(vec3(0.86, 0.92, 0.96), vec3(0.14, 0.52, 0.78), aAge);
        vAlpha = (1.0 - aAge) * 0.8;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uScale * mix(16.0, 4.0, aAge) * (10.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: POINT_FRAGMENT,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return { points, positions, geometry };
}

export function create(ctx: SceneContext): SceneInstance {
  const { scene, camera, renderer, options } = ctx;
  const rand = seeded(4242);
  const pixelScale = renderer.getPixelRatio();
  const waypointCount = Math.round(numberOption(options, 'waypoints', 0, 0, 8));

  camera.fov = LAUNCH_CAMERA.fov;
  camera.near = 0.1;
  camera.far = 200;
  camera.updateProjectionMatrix();
  const look = new Vector3(...LAUNCH_CAMERA.target);
  const base = new Vector3(...LAUNCH_CAMERA.position);

  const shell = makeStarShell(Math.round(2400 * ctx.quality), 25, 55, rand);
  const shellMaterial = shell.material as ShaderMaterial;
  const shellScale = shellMaterial.uniforms.uScale;
  if (shellScale) shellScale.value = pixelScale;
  scene.add(shell);

  // Dream: the pad, a flat hex platform with concentric hex rings and a soft glow.
  const pad = new Group();
  pad.position.set(...(LAUNCH_STATIONS[0] as Vec3));
  const deck = new Mesh(new CylinderGeometry(0.62, 0.7, 0.08, 6), new MeshBasicMaterial({ color: new Color(RAMP[0]) }));
  deck.position.y = -0.12;
  pad.add(deck);
  for (const r of [0.85, 1.15]) {
    const ring = new LineLoop(ringGeometry(r, 6), new LineBasicMaterial({ color: RAMP[3], transparent: true, opacity: r < 1 ? 0.7 : 0.35 }));
    ring.position.y = -0.1;
    pad.add(ring);
  }
  pad.add(makeGlow(RAMP[3], 2.4, 0.45));
  scene.add(pad);

  // Build: a hexagonal gate the path threads, facing along the path.
  const gate = new Group();
  gate.position.set(...(LAUNCH_STATIONS[1] as Vec3));
  const gateRing = new Mesh(new TorusGeometry(0.7, 0.035, 8, 6), new MeshBasicMaterial({ color: new Color(RAMP[4]) }));
  const gateOuter = new Mesh(new TorusGeometry(0.88, 0.012, 6, 6), new MeshBasicMaterial({ color: new Color(RAMP[2]), transparent: true, opacity: 0.6 }));
  const ahead = catmullRom(LAUNCH_PATH, LAUNCH_STATION_T[1] ?? 0.6);
  const next = catmullRom(LAUNCH_PATH, (LAUNCH_STATION_T[1] ?? 0.6) + 0.02);
  gate.lookAt(gate.position.x + (next[0] - ahead[0]), gate.position.y + (next[1] - ahead[1]), gate.position.z + (next[2] - ahead[2]));
  gate.add(gateRing, gateOuter, makeGlow(RAMP[3], 2.2, 0.35));
  scene.add(gate);

  // Grow: the hex world with its orbit ring.
  const planet = makeGlobe({ frequency: 4, radius: 0.78, seed: 11, tones: [0.0, 0.8], amberCell: -1, rim: 1.0 });
  planet.group.position.copy(world);
  scene.add(planet.group);
  const halo = makeGlow(RAMP[4], 3.4, 0.45);
  halo.position.copy(world);
  scene.add(halo);
  const orbitRing = new LineLoop(ringGeometry(LAUNCH_ORBIT_RADIUS, 160), new LineBasicMaterial({ color: RAMP[4], transparent: true, opacity: 0.45 }));
  orbitRing.position.copy(world);
  // ringGeometry lies in the xz plane; tilting it by -ORBIT_TILT about x matches the capsule's orbit basis (ex, ez).
  orbitRing.rotation.x = -ORBIT_TILT;
  scene.add(orbitRing);

  const trajectory = buildTrajectory(pixelScale);
  scene.add(trajectory.points);

  // The capsule: an amber hex prism with its own glow, the one warm object in the scene.
  const capsule = new Group();
  const body = new Mesh(new CylinderGeometry(0.11, 0.11, 0.2, 6), new MeshBasicMaterial({ color: new Color(AMBER) }));
  capsule.add(body, makeGlow(AMBER, 0.9, 0.85));
  scene.add(capsule);
  const wake = buildWake(pixelScale);
  scene.add(wake.points);
  const wakeAttr = wake.geometry.getAttribute('position') as BufferAttribute;

  const anchorList: Vector3[] = [
    ...LAUNCH_STATIONS.map((s, i) => (i === 2 ? world.clone().add(new Vector3(0, 0.95, 0)) : new Vector3(...s))),
    ...waypointTs(waypointCount).map((t) => new Vector3(...catmullRom(LAUNCH_PATH, t))),
  ];

  const here = new Vector3();
  const prev = new Vector3();
  let px = 0;
  let py = 0;
  let tx = 0;
  let ty = 0;

  return {
    posterTime: POSTER_TIME,
    update(t: number, dt: number): void {
      px = approach(px, tx, 1.4, dt);
      py = approach(py, ty, 1.4, dt);
      camera.position.set(base.x + px * 0.35, base.y + py * 0.2, base.z);
      camera.lookAt(look);
      setTime(shellMaterial, t);

      const state = capsuleAt(t, here);
      capsule.position.copy(here);
      capsuleAt(t - 0.05, prev);
      capsule.up.set(0, 1, 0);
      capsule.lookAt(here.x * 2 - prev.x, here.y * 2 - prev.y, here.z * 2 - prev.z);
      capsule.rotateX(Math.PI / 2);
      const c = ((t % CYCLE) + CYCLE) % CYCLE;
      // Fade out at the end of the orbit and back in on the pad, so the loop never pops.
      const fade = Math.min(1, c / 0.6, (CYCLE - c) / 0.8);
      capsule.scale.setScalar(Math.max(0.001, fade));
      const progressUniform = trajectory.material.uniforms.uProgress;
      if (progressUniform) progressUniform.value = state.orbiting ? 1.0 : state.progress;
      for (let i = 0; i < WAKE; i += 1) {
        capsuleAt(Math.max(t - c, t - i * 0.03), prev);
        wakeAttr.setXYZ(i, prev.x, prev.y, prev.z);
      }
      wakeAttr.needsUpdate = true;
      wake.points.visible = fade > 0.05;

      planet.group.rotation.y = t * 0.15;
      gate.rotation.z = t * 0.12;
      pad.rotation.y = t * 0.05;
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
