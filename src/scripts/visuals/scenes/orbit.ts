/**
 * OrbitSystem (BRIEF 2.1 Solar System / Sun, 2.3 scene 2): a hex-faceted sun with hairline orbit rings and one small hex world per
 * label. The layout comes from `orbitLayout` in geometry.ts, the same function the server uses to draw the SVG poster, so the poster
 * and the first live frame (t = 0) agree. Hovering or focusing a label brightens its body and its ring.
 *
 * Options: `count` (0 to 12 bodies; 0 draws the sun alone, the base of the generic poster), `rings` 'single' | 'nested', `accent` (index of the amber body, or -1 for an amber cell on the sun).
 */
import { Color, LineBasicMaterial, LineLoop, Vector3 } from 'three';
import type { ShaderMaterial, Sprite } from 'three';
import { AMBER, RAMP } from '../palette.ts';
import { ORBIT_CAMERA, ORBIT_MAX_BODIES, orbitLayout, orbitPosition } from '../geometry.ts';
import type { SceneContext, SceneInstance } from '../types.ts';
import { approach, clearGlowCache, enumOption, makeGlobe, makeGlow, makeStarShell, numberOption, ringGeometry, seeded, setTime } from './common.ts';
import type { Globe } from './common.ts';

export function create(ctx: SceneContext): SceneInstance {
  const { scene, camera, renderer, options } = ctx;
  const rand = seeded(777);
  const pixelScale = renderer.getPixelRatio();
  const count = Math.round(numberOption(options, 'count', 7, 0, ORBIT_MAX_BODIES));
  const rings = enumOption(options, 'rings', ['single', 'nested'] as const, 'single');
  const accent = Math.round(numberOption(options, 'accent', -1, -1, ORBIT_MAX_BODIES - 1));
  const layout = count === 0 ? [] : orbitLayout(count, rings);

  camera.fov = ORBIT_CAMERA.fov;
  camera.near = 0.1;
  camera.far = 200;
  camera.updateProjectionMatrix();
  const base = new Vector3(...ORBIT_CAMERA.position);
  const look = new Vector3(...ORBIT_CAMERA.target);

  const shell = makeStarShell(Math.round(1800 * ctx.quality), 25, 55, rand);
  const shellMaterial = shell.material as ShaderMaterial;
  const shellScale = shellMaterial.uniforms.uScale;
  if (shellScale) shellScale.value = pixelScale;
  scene.add(shell);

  // With no accent body, the amber object is one cell on the sun, turned toward the camera at t = 0 (the poster frame).
  const sun = makeGlobe({ frequency: 5, radius: 0.95, seed: 3, tones: [0.1, 0.62], ...(accent < 0 ? { amberToward: [0.15, 0.75, 0.65] as const } : { amberCell: -1 }), rim: 1.2 });
  scene.add(sun.group);
  const corona = makeGlow(RAMP[4], 4.6, 0.6);
  const outer = makeGlow(RAMP[2], 9, 0.25, 0.7);
  scene.add(outer, corona);

  const ringLines: LineLoop[] = [];
  const ringRadii = Array.from(new Set(layout.map((b) => b.radius)));
  for (const radius of ringRadii) {
    const line = new LineLoop(ringGeometry(radius, 192), new LineBasicMaterial({ color: RAMP[3], transparent: true, opacity: 0.32 }));
    ringLines.push(line);
    scene.add(line);
  }

  interface Body {
    readonly globe: Globe;
    readonly glow: Sprite;
    readonly ring: LineLoop | undefined;
    readonly baseGlow: number;
  }
  const bodies: Body[] = layout.map((b, i) => {
    const isAccent = i === accent;
    const globe = makeGlobe({ frequency: 2, radius: 0.26, seed: 100 + i, tones: [0.2, 0.7], amberCell: -1, rim: 1.1 });
    if (isAccent) {
      // The accent body is the scene's one amber object: an amber glow around a blue world.
      const glow = makeGlow(AMBER, 1.5, 0.75);
      globe.group.add(glow);
      scene.add(globe.group);
      return { globe, glow, ring: ringLines[ringRadii.indexOf(b.radius)], baseGlow: 0.75 };
    }
    const glow = makeGlow(RAMP[4], 1.3, 0.4);
    globe.group.add(glow);
    scene.add(globe.group);
    return { globe, glow, ring: ringLines[ringRadii.indexOf(b.radius)], baseGlow: 0.4 };
  });

  const anchorList = layout.map(() => new Vector3());
  let highlighted: number | null = null;
  const emphasis = layout.map(() => 0);
  let px = 0;
  let py = 0;
  let tx = 0;
  let ty = 0;
  const ringColor = new Color(RAMP[3]);
  const ringHot = new Color(RAMP[5]);

  return {
    posterTime: 0,
    update(t: number, dt: number): void {
      px = approach(px, tx, 1.4, dt);
      py = approach(py, ty, 1.4, dt);
      camera.position.set(base.x + px * 0.6, base.y + py * 0.4, base.z);
      camera.lookAt(look);
      setTime(shellMaterial, t);
      sun.group.rotation.y = t * 0.08;
      corona.material.opacity = 0.55 + 0.05 * Math.sin(t * 0.7);
      layout.forEach((b, i) => {
        const body = bodies[i];
        if (body === undefined) return;
        const [x, y, z] = orbitPosition(b, t);
        body.globe.group.position.set(x, y, z);
        body.globe.group.rotation.y = t * 0.4 + i;
        // Ease emphasis even when paused frames are rendered with dt = 0 (it then snaps, which is fine for a static frame).
        const target = highlighted === i ? 1 : 0;
        emphasis[i] = dt === 0 ? target : approach(emphasis[i] ?? 0, target, 8, dt);
        const e = emphasis[i] ?? 0;
        body.globe.group.scale.setScalar(1 + e * 0.35);
        body.glow.material.opacity = body.baseGlow + e * 0.5;
        anchorList[i]?.set(x, y + 0.42 + e * 0.1, z);
      });
      ringLines.forEach((line, r) => {
        const radius = ringRadii[r];
        const hot = highlighted !== null && layout[highlighted]?.radius === radius && rings === 'nested';
        const material = line.material as LineBasicMaterial;
        material.color.copy(hot ? ringHot : ringColor);
        material.opacity = hot ? 0.7 : 0.32;
      });
    },
    anchors(): readonly Vector3[] {
      return anchorList;
    },
    pointer(x: number, y: number): void {
      tx = x;
      ty = y;
    },
    highlight(index: number | null): void {
      highlighted = index;
    },
    dispose(): void {
      clearGlowCache();
    },
  };
}
