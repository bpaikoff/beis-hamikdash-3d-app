import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CharacterSystem, CHARACTER_FILES, CLIPS, LIMITS, ANIMATE_RADIUS, templePlacements, makeWalker } from './CharacterSystem.js';
import { PlayerController } from './PlayerController.js';
import { TempleBuilder } from './TempleBuilder.js';
import { CONFIG } from '../config.js';

// three's example loaders reach for `self`; node has none.
globalThis.self ??= globalThis;

const dir = resolve(import.meta.dirname, '../../public/assets/characters');
const toAB = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

/** Parse a committed GLB with GLTFLoader (no fetch: the file is read with fs). */
function parseGlb(name) {
  const bytes = readFileSync(resolve(dir, `${name}.glb`));
  return new Promise((res, rej) => new GLTFLoader().parse(toAB(bytes), '', res, rej));
}

/** A loader stand-in with GLTFLoader's load() signature that serves the files from disk. */
const diskLoader = {
  load(url, onLoad, _onProgress, onError) {
    const name = url.replace(/^.*\//, '').replace(/\.glb.*$/, '');
    parseGlb(name).then(onLoad, onError);
  },
};

/** Bounding box of a skinned model in its current pose. */
function skinnedBounds(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) box.expandByPoint(o.applyBoneTransform(i, v.fromBufferAttribute(pos, i)).applyMatrix4(o.matrixWorld));
  });
  return box;
}

describe('character GLBs', () => {
  it('the manifest lists the three files the system loads', () => {
    expect(Object.keys(CHARACTER_FILES).sort()).toEqual(['bull.glb', 'kohen.glb', 'sheep.glb']);
    for (const f of Object.values(CHARACTER_FILES)) expect(f.license).toBe('CC0-1.0');
  });

  for (const [name, clips] of Object.entries(CLIPS)) {
    it(`${name}.glb parses with the clips the manifest promises and a human-scale, grounded body`, async () => {
      const gltf = await parseGlb(name);
      expect(gltf.animations.map((a) => a.name).sort()).toEqual(CHARACTER_FILES[`${name}.glb`].clips.slice().sort());
      for (const key of Object.values(clips)) expect(THREE.AnimationClip.findByName(gltf.animations, key), key).toBeTruthy();
      let skinned = 0, prims = 0;
      gltf.scene.traverse((o) => { if (o.isMesh) prims++; if (o.isSkinnedMesh) skinned++; });
      expect(skinned).toBeGreaterThan(0);
      expect(prims, 'draw calls per figure').toBeLessThanOrEqual(3);
      // Pose the first frame of the first clip and measure.
      const mixer = new THREE.AnimationMixer(gltf.scene);
      mixer.clipAction(gltf.animations[0]).play();
      mixer.update(0);
      const bb = skinnedBounds(gltf.scene);
      const height = bb.max.y - bb.min.y;
      const expected = CHARACTER_FILES[`${name}.glb`].height ?? 1.8;
      expect(Math.abs(height - expected), `${name} height ${height.toFixed(2)}`).toBeLessThan(0.1);
      expect(Math.abs(bb.min.y), `${name} feet at y ${bb.min.y.toFixed(2)}`).toBeLessThan(0.05);
    });
  }
});

describe('CharacterSystem', () => {
  const stubTex = { get: () => null, manager: new THREE.LoadingManager() };
  let scene, sys;
  beforeAll(async () => {
    scene = new THREE.Scene();
    sys = new CharacterSystem(scene, stubTex, { loader: diskLoader });
    await sys.load();
  });

  it('loads each model once and clones a skeleton and mixer per figure', () => {
    expect(Object.keys(sys.models).sort()).toEqual(['bull', 'kohen', 'sheep']);
    const a = sys.createKohen(0, 0, 0);
    const b = sys.createKohen(2, 0, 0, true);
    const skel = (g) => { let s; g.traverse((o) => { if (o.isSkinnedMesh && !s) s = o.skeleton; }); return s; };
    expect(skel(a)).not.toBe(skel(b));
    expect(skel(a)).not.toBe(skel(sys.models.kohen.scene));
    expect(a.userData.mixer).not.toBe(b.userData.mixer);
    // Same painted geometry per role, different roles differ; materials shared per role.
    const meshes = (g) => { const m = []; g.traverse((o) => { if (o.isSkinnedMesh) m.push(o); }); return m; };
    const c = sys.createKohen(4, 0, 0);
    expect(meshes(a)[0].geometry).toBe(meshes(c)[0].geometry);
    expect(meshes(a)[0].material).toBe(meshes(c)[0].material);
    expect(meshes(a)[0].geometry).not.toBe(meshes(b)[0].geometry);
    expect(meshes(a)[0].geometry.attributes.color).toBeTruthy();
    expect(b.name).toBe('kohenGadol');
    // The Kohen Gadol wears the gold; a kohen the migba'as.
    const names = (g) => { const n = []; g.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) n.push(o.geometry.userData.key); }); return n.sort(); };
    expect(names(b)).toEqual(['choshen', 'ephod', 'mitznefes', 'stones', 'tzitz']);
    expect(names(a)).toEqual(['migbaas']);
    // The hat sits on the head: above 1.75 m in the rest pose.
    const hat = a.getObjectByProperty('geometry', sys.geometries.find((g) => g.userData.key === 'migbaas'));
    a.updateMatrixWorld(true);
    expect(hat.getWorldPosition(new THREE.Vector3()).y).toBeGreaterThan(1.75);
    sys.dispose();
  });

  it('places the whole Temple within the limits and ticks only the mixers near the camera', async () => {
    sys = new CharacterSystem(scene, stubTex, { loader: diskLoader });
    await sys.load();
    const placements = templePlacements();
    for (const p of placements) expect(sys.place(p), `${p.kind} ${p.type ?? p.role ?? ''}`).toBeTruthy();
    expect(sys.humans.length).toBeLessThanOrEqual(LIMITS.humans);
    expect(sys.animals.length).toBe(LIMITS.animals);
    expect(sys.doves.length).toBe(LIMITS.doves);
    expect(sys.humans.filter((h) => h.userData.walker)).toHaveLength(4);
    expect(sys.humans.filter((h) => h.name === 'kohenGadol')).toHaveLength(1);
    expect(placements.filter((p) => p.kind === 'human').length + placements.filter((p) => p.kind !== 'human').length).toBe(placements.length);

    const near = sys.humans[0];
    const far = sys.humans.find((h) => h.position.distanceTo(near.position) > ANIMATE_RADIUS + 5);
    expect(far, 'a figure beyond the animate radius').toBeTruthy();
    const camera = new THREE.PerspectiveCamera();
    camera.position.copy(near.position).add(new THREE.Vector3(3, 1.7, 3));
    const t0n = near.userData.mixer.time, t0f = far.userData.mixer.time;
    for (let i = 0; i < 6; i++) sys.update(1 / 60, camera); // 0.1 s: three 30 Hz ticks
    expect(near.userData.mixer.time - t0n).toBeCloseTo(0.1, 2);
    expect(far.userData.mixer.time).toBe(t0f);

    // Walkers advance along their path at their speed and stay on their level.
    const walker = sys.humans.find((h) => h.userData.walker);
    const start = walker.position.clone();
    for (let i = 0; i < 60; i++) sys.update(1 / 60, camera);
    expect(walker.position.distanceTo(start)).toBeGreaterThan(0.5);
    expect(walker.position.y).toBe(walker.userData.baseY);
    expect(walker.userData.action.timeScale).toBeCloseTo(walker.userData.walker.speed / 1.25, 5);

    // Doves orbit their own spawn point.
    const d = sys.doves[3];
    const u = d.userData;
    expect(Math.hypot(d.position.x - u.baseX, d.position.z - u.baseZ)).toBeCloseTo(u.radius, 5);

    const before = scene.children.length;
    sys.dispose();
    expect(scene.children.length).toBe(before - (LIMITS.animals + LIMITS.doves + placements.filter((p) => p.kind === 'human').length));
    expect(sys.humans).toHaveLength(0);
  });

  it('does not exceed the human limit', async () => {
    sys = new CharacterSystem(scene, stubTex, { loader: diskLoader });
    await sys.load();
    for (let i = 0; i < LIMITS.humans; i++) sys.createKohen(i, 0, 0);
    expect(sys.createKohen(99, 0, 0)).toBeNull();
    sys.dispose();
  });
});

describe('makeWalker', () => {
  it('ping-pongs on an open path and wraps on a closed loop', () => {
    const g = new THREE.Group();
    g.userData.baseY = 2;
    const w = makeWalker([[0, 0], [10, 0]], false, 1);
    w.s = 9.5;
    w.step(1, g);
    expect(w.dir).toBe(-1);
    expect(g.position.x).toBe(10);
    expect(g.position.y).toBe(2);
    const loop = makeWalker([[0, 0], [10, 0], [10, 10], [0, 10]], true, 1);
    loop.s = 39.5;
    loop.step(1, g);
    expect(loop.s).toBeCloseTo(0.5, 6);
    expect(g.position.x).toBeCloseTo(0.5, 6);
  });
});

describe('in the built Temple', () => {
  let temple;
  beforeAll(() => {
    const scene = new THREE.Scene();
    const { floors, walls } = new TempleBuilder(scene, { get: () => null, onProgress() {} }).build();
    scene.updateMatrixWorld(true);
    temple = new PlayerController(new THREE.PerspectiveCamera(), floors, walls, {});
  });

  /** Feet at (x, z) on level y: on the floor (within 5 cm), not inside a solid, not in a wall box. */
  function check(label, x, y, z) {
    const p = temple.probe(x, z, y + CONFIG.STEP_HEIGHT + 0.05);
    expect(p.inside, `${label} at (${x.toFixed(1)}, ${z.toFixed(1)}) is inside a solid`).toBe(false);
    expect(Math.abs(p.y - y), `${label} at (${x.toFixed(1)}, ${z.toFixed(1)}) floor ${p.y.toFixed(2)} vs feet ${y.toFixed(2)}`).toBeLessThan(0.05);
    expect(temple.collides(new THREE.Vector3(x, y + CONFIG.PLAYER_HEIGHT, z)), `${label} at (${x.toFixed(1)}, ${z.toFixed(1)}) is in a wall box`).toBe(false);
  }

  it('every placed figure stands on its floor and every walking loop is clear', () => {
    for (const p of templePlacements()) {
      if (p.kind === 'dove') continue;
      const label = `${p.kind} ${p.type ?? p.role ?? 'kohen'}`;
      check(label, p.x, p.y, p.z);
      if (!p.path) continue;
      const w = makeWalker(p.path, p.closed ?? false, 1);
      for (let s = 0; s <= w.total; s += 0.25) {
        const { pos } = w.at(s);
        check(`${label} walk`, pos.x, p.y, pos.z);
      }
    }
  });

  it('the doves fly in open air', () => {
    for (const p of templePlacements()) {
      if (p.kind !== 'dove') continue;
      for (const a of [0, 1, 2, 3, 4, 5]) {
        const x = p.x + Math.cos(a) * 8, z = p.z + Math.sin(a) * 8;
        expect(temple.probe(x, z, p.y + 1).inside, `dove at (${x.toFixed(0)}, ${z.toFixed(0)})`).toBe(false);
      }
    }
  });
});
