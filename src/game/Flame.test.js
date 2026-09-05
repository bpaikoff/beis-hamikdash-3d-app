import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  Flame,
  Embers,
  Smoke,
  noise1,
  flicker,
  flameRamp,
  FLAME_FRAG,
  NOISE_GLSL,
} from './Flame.js';
import { ParticleSystem } from './ParticleSystem.js';

/** The flame only reads the camera's world position. */
const stubCamera = (x, y, z) => ({ position: new THREE.Vector3(x, y, z) });

/** Local +z axis of an object in world space (the direction its quads face). */
function facing(obj) {
  obj.updateMatrixWorld(true);
  return new THREE.Vector3(0, 0, 1).transformDirection(obj.matrixWorld);
}

describe('Flame', () => {
  it('builds one quad per billboard, all standing in the x-y plane', () => {
    const f = new Flame({ quads: 7, size: 2, height: 3 });
    expect(f.quads).toBe(7);
    expect(f.geometry.attributes.position.count).toBe(28);
    expect(f.geometry.index.count).toBe(42);
    expect(f.geometry.attributes.phase.count).toBe(28);
    const pos = f.geometry.attributes.position;
    let maxY = 0;
    let maxX = 0;
    for (let i = 0; i < pos.count; i++) {
      maxY = Math.max(maxY, pos.getY(i));
      maxX = Math.max(maxX, Math.abs(pos.getX(i)));
      expect(Math.abs(pos.getZ(i))).toBeLessThan(2 * 0.15 + 1e-6); // small depth spread only
    }
    expect(maxY).toBeGreaterThan(2.1); // quad heights are 0.7..1.1 x height
    expect(maxY).toBeLessThanOrEqual(3.3);
    expect(maxX).toBeLessThan(2); // within the base width
    expect(f.material.depthWrite).toBe(false);
    expect(f.material.transparent).toBe(true);
    expect(f.material.blending).toBe(THREE.AdditiveBlending);
    expect(f.material.toneMapped).toBe(true);
    f.dispose();
  });

  it('is deterministic for a seed', () => {
    const a = new Flame({ seed: 5 });
    const b = new Flame({ seed: 5 });
    const c = new Flame({ seed: 6 });
    expect(Array.from(a.geometry.attributes.position.array)).toEqual(
      Array.from(b.geometry.attributes.position.array)
    );
    expect(Array.from(a.geometry.attributes.position.array)).not.toEqual(
      Array.from(c.geometry.attributes.position.array)
    );
    [a, b, c].forEach((f) => f.dispose());
  });

  it('faces the camera by rotating about y only, from any side', () => {
    const f = new Flame();
    f.position.set(10, 5, -20);
    for (const [cx, cy, cz] of [
      [40, 5, -20],
      [10, 30, 30],
      [-15, 0, -20],
      [10, 5, -60],
      [25, 2, -5],
    ]) {
      f.update(0.016, stubCamera(cx, cy, cz));
      const dir = facing(f);
      const toCam = new THREE.Vector3(cx - 10, 0, cz + 20).normalize();
      expect(dir.y).toBeCloseTo(0, 6); // never tilts
      expect(dir.dot(toCam)).toBeCloseTo(1, 5); // +z points straight at the camera (horizontally)
      expect(f.rotation.x).toBe(0);
      expect(f.rotation.z).toBe(0);
    }
    f.dispose();
  });

  it('faces the camera when hung on a translated parent', () => {
    const parent = new THREE.Group();
    parent.position.set(-30, 11, -54);
    const f = new Flame();
    parent.add(f);
    f.update(0.016, stubCamera(-30, 12, 0));
    expect(facing(f).z).toBeCloseTo(1, 6);
    f.update(0.016, stubCamera(0, 12, -54));
    expect(facing(f).x).toBeCloseTo(1, 6);
    f.dispose();
    expect(parent.children).toHaveLength(0);
  });

  it('advances the time uniform without allocating new uniforms', () => {
    const f = new Flame();
    const u = f.material.uniforms;
    const t0 = u.uTime.value;
    const before = { uTime: u.uTime, uCore: u.uCore.value };
    f.update(0.5, stubCamera(0, 0, 10));
    f.update(0.25, stubCamera(0, 0, 10));
    expect(u.uTime.value).toBeCloseTo(t0 + 0.75, 6);
    expect(u.uTime).toBe(before.uTime);
    expect(u.uCore.value).toBe(before.uCore);
    f.dispose();
  });

  it('grows with distance (capped) and fades the small layers', () => {
    const f = new Flame({ distanceScale: { start: 25, rate: 0.02, max: 2.5 }, fadeDistance: 40 });
    f.update(0, stubCamera(0, 0, 10));
    expect(f.scale.x).toBe(1);
    expect(f.material.uniforms.uOpacity.value).toBe(1);
    f.update(0, stubCamera(0, 0, 75));
    expect(f.scale.x).toBeCloseTo(2, 6);
    expect(f.scale.y).toBeCloseTo(2, 6);
    expect(f.material.uniforms.uOpacity.value).toBeCloseTo(2 - 75 / 40, 6);
    f.update(0, stubCamera(0, 0, 500));
    expect(f.scale.x).toBe(2.5);
    expect(f.material.uniforms.uOpacity.value).toBe(0);
    f.dispose();
  });

  it('dispose releases the geometry and material and detaches from the parent', () => {
    const scene = new THREE.Scene();
    const f = new Flame();
    scene.add(f);
    let geo = 0;
    let mat = 0;
    f.geometry.addEventListener('dispose', () => geo++);
    f.material.addEventListener('dispose', () => mat++);
    f.dispose();
    expect(geo).toBe(1);
    expect(mat).toBe(1);
    expect(scene.children).toHaveLength(0);
  });

  it('colour ramp gets whiter and the shader embeds the noise and tone mapping', () => {
    const cool = flameRamp(0);
    const hot = flameRamp(1);
    expect(hot.core.b).toBeGreaterThan(cool.core.b);
    expect(cool.edge.r).toBeLessThan(hot.edge.r);
    expect(FLAME_FRAG).toContain(NOISE_GLSL.trim());
    expect(FLAME_FRAG).toContain('#include <tonemapping_fragment>');
    expect(FLAME_FRAG).toContain('#include <colorspace_fragment>');
  });
});

describe('Embers and Smoke', () => {
  it('build the requested point counts with a seed attribute and dispose', () => {
    const e = new Embers({ count: 50 });
    const s = new Smoke(null, { count: 12 });
    expect(e.geometry.attributes.position.count).toBe(50);
    expect(e.geometry.attributes.seed.itemSize).toBe(4);
    expect(s.geometry.attributes.position.count).toBe(12);
    expect(e.material.blending).toBe(THREE.AdditiveBlending);
    expect(s.material.blending).toBe(THREE.NormalBlending);
    expect(e.material.depthWrite).toBe(false);
    expect(s.material.depthWrite).toBe(false);
    e.update(0.1);
    s.update(0.1);
    let disposed = 0;
    for (const o of [e, s]) {
      o.geometry.addEventListener('dispose', () => disposed++);
      o.material.addEventListener('dispose', () => disposed++);
      o.dispose();
    }
    expect(disposed).toBe(4);
  });
});

describe('noise', () => {
  it('noise1 is smooth, bounded and deterministic; flicker stays near 1', () => {
    for (let t = 0; t < 20; t += 0.05) {
      const v = noise1(t);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
      expect(Math.abs(noise1(t + 0.01) - v)).toBeLessThan(0.05);
      expect(noise1(t)).toBe(v);
      expect(flicker(t)).toBeGreaterThan(0.7);
      expect(flicker(t)).toBeLessThan(1.3);
    }
  });
});

describe('ParticleSystem', () => {
  it('builds the altar fire, candles and coals, updates them and disposes cleanly', () => {
    const scene = new THREE.Scene();
    const ps = new ParticleSystem(scene); // no document: sprite is null
    const fire = ps.createFire(0, 13, -11, 4);
    expect(fire.children.filter((c) => c.name === 'flame')).toHaveLength(3);
    expect(fire.children.some((c) => c.name === 'embers')).toBe(true);
    expect(fire.children.some((c) => c.name === 'smoke')).toBe(true);
    const wick = new THREE.Object3D();
    scene.add(wick);
    ps.createCandle(wick, { light: 5 });
    expect(wick.children.some((c) => c.name === 'flame')).toBe(true);
    expect(wick.children.some((c) => c.isPointLight)).toBe(true);
    const coals = new THREE.Object3D();
    scene.add(coals);
    ps.createCoals(coals);
    expect(coals.children.map((c) => c.name).sort()).toEqual(['flame', 'smoke']);
    ps.createSmoke(1, 2, 3, 0.3);
    const fireLight = ps.lights[0].light;
    const i0 = fireLight.intensity;
    const cam = stubCamera(-22, 9.75, 0);
    ps.update(0.3, cam);
    ps.update(0.3, cam);
    expect(fireLight.intensity).not.toBe(i0); // noise-driven flicker
    expect(Math.abs(fireLight.intensity / 400 - 1)).toBeLessThan(0.3);
    ps.dispose();
    expect(ps.flames).toHaveLength(0);
    expect(ps.lights).toHaveLength(0);
    expect(scene.getObjectByName('fire')).toBeUndefined();
    expect(scene.getObjectByName('flame')).toBeUndefined();
    expect(scene.getObjectByName('smoke')).toBeUndefined();
    expect(wick.children).toHaveLength(0);
  });
});
