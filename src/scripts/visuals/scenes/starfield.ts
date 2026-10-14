/**
 * Starfield (the background of a dark full-bleed band): a deep star shell drifting slowly, a few soft nebula clouds in the blue ramp and
 * a single amber star. Built for wide, short frames (21/9 and wider) behind text, so it stays dim: text on top must keep its contrast.
 *
 * Options: `density` 0.3 to 1.5 (default 1).
 */
import { Group, Vector3 } from 'three';
import type { ShaderMaterial } from 'three';
import { AMBER, RAMP } from '../palette.ts';
import type { SceneContext, SceneInstance } from '../types.ts';
import { approach, clearGlowCache, makeGlow, makeStarShell, numberOption, seeded, setTime } from './common.ts';

export function create(ctx: SceneContext): SceneInstance {
  const { scene, camera, renderer, options } = ctx;
  const rand = seeded(5150);
  const pixelScale = renderer.getPixelRatio();
  const density = numberOption(options, 'density', 1, 0.3, 1.5);

  camera.fov = 50;
  camera.near = 0.1;
  camera.far = 200;
  camera.position.set(0, 0, 0.01);
  camera.lookAt(0, 0, -1);
  camera.updateProjectionMatrix();

  const near = makeStarShell(Math.round(1400 * density * ctx.quality), 12, 22, seeded(5151));
  const far = makeStarShell(Math.round(3200 * density * ctx.quality), 30, 60, seeded(5152));
  const materials = [near.material as ShaderMaterial, far.material as ShaderMaterial];
  for (const m of materials) {
    const u = m.uniforms.uScale;
    if (u) u.value = pixelScale;
  }
  scene.add(far, near);

  // Nebula: large, very faint glows spread across the band.
  const nebula = new Group();
  const tones = [RAMP[1], RAMP[2], RAMP[0], RAMP[3], RAMP[1]];
  tones.forEach((tone, i) => {
    const glow = makeGlow(tone, 16 + rand() * 12, 0.16 + rand() * 0.08, 0.8);
    glow.position.set(-16 + i * 8 + (rand() - 0.5) * 4, (rand() - 0.5) * 5, -20 - rand() * 6);
    nebula.add(glow);
  });
  scene.add(nebula);

  const amber = makeGlow(AMBER, 0.9, 0.9, 0.4);
  amber.position.set(9.5, 2.2, -18);
  scene.add(amber);

  let px = 0;
  let py = 0;
  let tx = 0;
  let ty = 0;
  const look = new Vector3();

  return {
    posterTime: 0,
    update(t: number, dt: number): void {
      px = approach(px, tx, 1.0, dt);
      py = approach(py, ty, 1.0, dt);
      for (const m of materials) setTime(m, t);
      near.rotation.y = t * 0.006;
      far.rotation.y = t * 0.0025;
      look.set(px * 0.04, py * 0.025, -1);
      camera.lookAt(look);
      amber.material.opacity = 0.75 + 0.2 * Math.sin(t * 0.9);
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
