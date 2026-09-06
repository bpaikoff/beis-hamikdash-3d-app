import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  CharacterSystem, CHARACTER_FILES, CLIPS, LIMITS, ANIMATE_RADIUS, LOD, FIGURE_RADIUS,
  templePlacements, makeWalker, figureTier, lodK, skinBounds, paintHuman, textureUrl,
} from './CharacterSystem.js';
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

  it('kohen.glb is the textured body on the UAL rig: Body/Hair/Eyes skinned on 65 joints, three clips, no images inside', async () => {
    const gltf = await parseGlb('kohen');
    const meshes = [];
    gltf.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
    expect(meshes.map((m) => m.name).sort()).toEqual(['Body', 'Eyes', 'Hair']);
    expect(meshes.map((m) => m.material.name).sort()).toEqual(['MI_Eyes', 'MI_Hair_1', 'MI_Superhero_Male']);
    const joints = meshes[0].skeleton.bones.map((b) => b.name);
    expect(joints).toHaveLength(65);
    for (const j of ['root', 'pelvis', 'spine_03', 'neck_01', 'Head', 'hand_l', 'hand_r', 'foot_l', 'foot_r']) expect(joints).toContain(j);
    for (const m of meshes) {
      expect(m.isSkinnedMesh, m.name).toBe(true);
      expect(m.skeleton.bones.map((b) => b.name)).toEqual(joints);
      expect(m.geometry.attributes.uv, `${m.name} uv`).toBeTruthy();
      for (const k of ['map', 'normalMap', 'roughnessMap']) expect(m.material[k], `${m.name} ${k}`).toBeNull();
    }
    expect(gltf.animations.map((a) => a.name).sort()).toEqual(['Idle_Loop', 'Idle_Talking_Loop', 'Walk_Loop']);
    // The body faces +z (the eyes sit in front of the head) and the clips move the whole rig.
    const eyes = meshes.find((m) => m.name === 'Eyes');
    eyes.geometry.computeBoundingBox();
    expect(eyes.geometry.boundingBox.min.z).toBeGreaterThan(0);
    // Textures left the file: the GLB's JSON chunk has no images.
    const bytes = readFileSync(resolve(dir, 'kohen.glb'));
    const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    expect(json.images).toBeUndefined();
    expect(json.textures).toBeUndefined();
    expect(json.extensionsUsed ?? []).toEqual([]);
  });

  it('every texture in the manifest is on disk with its sha256 and LICENSES.md names both packs', async () => {
    const { createHash } = await import('node:crypto'); // this block may not touch the file's imports
    const manifest = JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf8'));
    const textures = manifest.textures ?? {};
    expect(Object.keys(textures).sort()).toEqual(['kohen_eyes.png', 'kohen_hair.jpg', 'kohen_skin.jpg', 'kohen_skin_normal.jpg', 'kohen_skin_rough.jpg']);
    for (const [file, t] of Object.entries(textures)) {
      const data = readFileSync(resolve(dir, file));
      expect(data.length, file).toBe(t.bytes);
      expect(createHash('sha256').update(data).digest('hex'), file).toBe(t.sha256);
      expect(t.size, file).toBeGreaterThanOrEqual(256);
      expect(t.source, file).toMatch(/^Universal Base Characters/);
    }
    expect(Object.values(textures).reduce((n, t) => n + t.bytes, 0), 'texture bytes').toBeLessThan(700 * 1024);
    const kohen = manifest.files['kohen.glb'];
    expect(kohen.pack).toBe('universal-base-characters');
    expect(kohen.animations.pack).toBe('universal-animation-library');
    expect(kohen.bytes, 'kohen.glb bytes').toBeLessThan(1.7 * 1024 * 1024);
    const licenses = readFileSync(resolve(dir, '../LICENSES.md'), 'utf8');
    for (const pack of ['universal-base-characters', 'universal-animation-library', 'lowpoly-animated-animals']) expect(licenses).toContain(`https://quaternius.itch.io/${pack}`);
    for (const file of Object.keys(textures)) expect(licenses).toContain(file);
  });
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
    const meshes = (g) => { const m = []; g.traverse((o) => { if (o.isSkinnedMesh && o.name !== 'Hair' && o.name !== 'Eyes') m.push(o); }); return m; }; // body meshes
    const c = sys.createKohen(4, 0, 0);
    expect(meshes(a)[0].geometry).toBe(meshes(c)[0].geometry);
    // The body draws its two groups with [skin, garment]; both materials shared per role.
    expect(meshes(a)[0].material).toHaveLength(2);
    expect(meshes(a)[0].material[0]).toBe(meshes(c)[0].material[0]);
    expect(meshes(a)[0].material[1]).toBe(meshes(c)[0].material[1]);
    expect(meshes(a)[0].material[0]).toBe(meshes(b)[0].material[0]);
    expect(meshes(a)[0].material[1]).not.toBe(meshes(b)[0].material[1]);
    expect(meshes(a)[0].geometry).not.toBe(meshes(b)[0].geometry);
    expect(meshes(a)[0].geometry.attributes.color).toBeTruthy();
    expect(meshes(a)[0].geometry.groups.map((g) => g.materialIndex)).toEqual([0, 1]);
    expect(b.name).toBe('kohenGadol');
    // The Kohen Gadol wears the gold; a kohen the migba'as.
    const names = (g) => { const n = []; g.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) n.push(o.geometry.userData.key); }); return n.sort(); };
    expect(names(b)).toEqual(['choshen', 'ephod', 'mitznefes', 'stones', 'tzitz']);
    expect(names(a)).toEqual(['migbaas']);
    const y = sys.createKohen(6, 0, 0, { role: 'yisrael' });
    expect(names(y)).toEqual(['sudar']);
    y.updateMatrixWorld(true);
    const sudar = y.getObjectByProperty('geometry', sys.geometries.find((g) => g.userData.key === 'sudar'));
    expect(sudar.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(sys.models.kohen.headTop - 0.06, 5);
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

  it('splits the body into skin and garment groups at the neck and the wrists of the rig', async () => {
    sys = new CharacterSystem(scene, stubTex, { loader: diskLoader });
    await sys.load();
    const { skin } = sys.models.kohen;
    const neck = sys.models.kohen.scene.getObjectByName('neck_01').getWorldPosition(new THREE.Vector3());
    const hand = sys.models.kohen.scene.getObjectByName('hand_l').getWorldPosition(new THREE.Vector3());
    expect(skin.headY).toBeCloseTo(neck.y + 0.03, 5);
    const foot = sys.models.kohen.scene.getObjectByName('foot_l').getWorldPosition(new THREE.Vector3());
    expect(skin.ankleY).toBeCloseTo(foot.y + 0.02, 5);
    expect(sys.models.kohen.headTop).toBeGreaterThan(1.78);
    expect(sys.models.kohen.headTop).toBeLessThan(1.86);
    expect(skin.wrists).toHaveLength(2);
    expect(skin.wrists[0].origin.x).toBeCloseTo(hand.x, 5);
    expect(skin.wrists[0].axis.x).toBeCloseTo(1, 3);
    expect(skin.wrists[1].axis.x).toBeCloseTo(-1, 3);
    for (const [, g] of sys.models.kohen.roles.kohen) {
      const [skinGroup, garmentGroup] = g.groups;
      expect(skinGroup.start).toBe(0);
      expect(skinGroup.count + garmentGroup.count).toBe(g.index.count);
      expect(skinGroup.count % 3).toBe(0);
      // Every skin triangle's vertices are (mostly) above the neck or past a wrist; every
      // garment triangle's mostly below and between.
      const pos = g.attributes.position;
      const above = (i) => pos.getY(i) > skin.headY || pos.getY(i) < skin.ankleY || Math.abs(pos.getX(i)) > hand.x - 0.01;
      for (let t = 0; t < g.index.count / 3; t++) {
        const votes = [0, 1, 2].filter((k) => above(g.index.getX(t * 3 + k))).length;
        expect(votes >= 2, `triangle ${t}`).toBe(t * 3 < skinGroup.count);
      }
    }
    sys.dispose();
  });

  it('flattens and puffs the garment from the limb frames and leaves the skin as loaded', async () => {
    sys = new CharacterSystem(scene, stubTex, { loader: diskLoader });
    await sys.load();
    const { skin: bounds, scene: src } = sys.models.kohen;
    const { limbs } = bounds;
    const upperarm = src.getObjectByName('upperarm_l').getWorldPosition(new THREE.Vector3());
    const thigh = src.getObjectByName('thigh_l').getWorldPosition(new THREE.Vector3());
    const pelvis = src.getObjectByName('pelvis').getWorldPosition(new THREE.Vector3());
    const hand = src.getObjectByName('hand_l').getWorldPosition(new THREE.Vector3());
    expect(limbs.shoulderX).toBeCloseTo(upperarm.x, 5);
    expect(limbs.thighX[0]).toBeCloseTo(thigh.x, 5);
    expect(limbs.hipY).toBeCloseTo(pelvis.y, 5);
    expect(limbs.waist[0]).toBeCloseTo(pelvis.y + 0.03, 5);
    expect(limbs.arms[1].axis.x).toBeCloseTo(-1, 2);
    let body;
    src.traverse((o) => { if (o.isSkinnedMesh && o.name !== 'Hair' && o.name !== 'Eyes' && !body) body = o; });
    const painted = sys.models.kohen.roles.yisrael.get(body.geometry.uuid);
    const p0 = body.geometry.attributes.position, p1 = painted.attributes.position, n1 = painted.attributes.normal;
    const col = painted.attributes.color;
    const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), n = new THREE.Vector3(), radial = new THREE.Vector3();
    let torso = 0, moved = 0, hem = 0, belt = 0, boundary = 0;
    for (let i = 0; i < p0.count; i++) {
      v0.fromBufferAttribute(p0, i);
      v1.fromBufferAttribute(p1, i);
      const skinV = v0.y > bounds.headY || v0.y < bounds.ankleY || Math.abs(v0.x) > hand.x - 0.01;
      if (skinV) {
        expect(v0.distanceTo(v1), `skin vertex ${i} moved`).toBe(0);
        continue;
      }
      const d = v1.distanceTo(v0);
      expect(d).toBeLessThanOrEqual(0.0301);
      const nearSkin = bounds.headY - v0.y < 0.03 || v0.y - bounds.ankleY < 0.03 || Math.abs(v0.x) > hand.x - 0.04;
      if (nearSkin) boundary++;
      else {
        expect(d, `garment vertex ${i} puffed`).toBeGreaterThan(0.029);
        moved++;
      }
      // Torso vertices at chest height: normal within ~45 deg of the radial direction and moved outward.
      if (Math.abs(v0.x) < 0.12 && v0.y > pelvis.y + 0.2 && v0.y < pelvis.y + 0.4 && Math.abs(v0.z) > 0.05) {
        n.fromBufferAttribute(n1, i);
        radial.set(v0.x, 0, v0.z).normalize();
        expect(n.dot(radial), `torso normal ${i}`).toBeGreaterThan(0.7);
        expect(radial.dot(v1) - radial.dot(v0)).toBeGreaterThan(0.015);
        torso++;
      }
      const hex = new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)).getHex();
      if (v0.y < bounds.ankleY + 0.12) { expect(hex).toBe(0x8a7a66); hem++; }
      else if (Math.abs(v0.x) < 0.32 && v0.y > pelvis.y + 0.03 && v0.y < pelvis.y + 0.11) { expect(hex).toBe(0x5a4632); belt++; }
      else expect(hex).toBe(0xd8d0c0);
    }
    expect(torso).toBeGreaterThan(20);
    expect(moved).toBeGreaterThan(1000);
    expect(boundary).toBeGreaterThan(10);
    expect(hem).toBeGreaterThan(20);
    expect(belt).toBeGreaterThan(20);
    // A kohen's garment is linen with the avnet at the same band; the Kohen Gadol's meil is techeiles.
    const kc = sys.models.kohen.roles.kohen.get(body.geometry.uuid).attributes.color;
    const gc = sys.models.kohen.roles.kohenGadol.get(body.geometry.uuid).attributes.color;
    const hexAt = (a, i) => new THREE.Color(a.getX(i), a.getY(i), a.getZ(i)).getHex();
    const beltI = [...Array(p0.count).keys()].find((i) => Math.abs(p0.getX(i)) < 0.1 && p0.getY(i) > pelvis.y + 0.05 && p0.getY(i) < pelvis.y + 0.09);
    expect(hexAt(kc, beltI)).toBe(0x7a2e3e);
    expect(hexAt(gc, beltI)).toBe(0x1f3f8f);
    sys.dispose();
  });

  it('textures come from the manifest with a cache-buster, sRGB for colour, and are optional', async () => {
    const urls = [];
    const fakeLoader = { load: (url) => { urls.push(url); return new THREE.Texture(); } };
    const textures = {
      'kohen_skin.jpg': { sha256: 'abcdef0123456789' }, 'kohen_skin_normal.jpg': { sha256: '1111111122222222' },
      'kohen_skin_rough.jpg': { sha256: '3333333344444444' }, 'kohen_hair.jpg': { sha256: '5555555566666666' }, 'kohen_eyes.png': { sha256: '7777777788888888' },
    };
    expect(textureUrl('kohen_skin.jpg', textures)).toBe('/assets/characters/kohen_skin.jpg?v=abcdef01');
    expect(textureUrl('kohen_skin.jpg', {})).toBeNull();
    sys = new CharacterSystem(scene, stubTex, { loader: diskLoader, textureLoader: fakeLoader, textures });
    await sys.load();
    sys.createKohen(0, 0, 0, { role: 'yisrael' });
    const [skin, garment] = sys.materials.get('skin') ? [sys.materials.get('skin'), sys.materials.get('garment:yisrael')] : [];
    expect(skin.map.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(skin.map.flipY).toBe(false);
    expect(skin.normalMap.colorSpace).not.toBe(THREE.SRGBColorSpace);
    expect(skin.roughnessMap).toBeTruthy();
    expect(skin.roughness).toBe(0.9);
    expect(skin.color.getHex()).toBe(0xffffff);
    expect(garment.vertexColors).toBe(true);
    // The Hair (eyebrows) and Eyes materials exist only when the glb has those meshes (the
    // mannequin has neither, the base body both); nothing breaks either way.
    const hasMesh = (n) => Boolean(sys.models.kohen.scene.getObjectByName(n));
    expect(sys.materials.has('eyes')).toBe(hasMesh('Eyes'));
    expect(sys.materials.has('hair')).toBe(hasMesh('Hair'));
    if (hasMesh('Eyes')) expect(sys.materials.get('eyes').map.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(urls.slice().sort()).toEqual([
      '/assets/characters/kohen_skin.jpg?v=abcdef01', '/assets/characters/kohen_skin_normal.jpg?v=11111111', '/assets/characters/kohen_skin_rough.jpg?v=33333333',
      ...(hasMesh('Hair') ? ['/assets/characters/kohen_hair.jpg?v=55555555'] : []),
      ...(hasMesh('Eyes') ? ['/assets/characters/kohen_eyes.png?v=77777777'] : []),
    ].sort());
    const loaded = urls.length;
    sys.dispose();
    expect(sys.loadedTextures).toHaveLength(0);

    // Without a `textures` map (today's manifest): a flat skin colour, no maps, no loads.
    sys = new CharacterSystem(scene, stubTex, { loader: diskLoader, textureLoader: fakeLoader, textures: {} });
    await sys.load();
    sys.createKohen(0, 0, 0);
    const plain = sys.materials.get('skin');
    expect(plain.map).toBeNull();
    expect(plain.normalMap).toBeNull();
    expect(plain.color.getHex()).toBe(0xd9a878);
    expect(urls).toHaveLength(loaded);
    sys.dispose();
  });

  it('paintHuman groups a non-indexed geometry too', () => {
    const g = new THREE.BufferGeometry();
    // Two triangles: one high (head), one low (torso).
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.7, 0, 0.1, 1.7, 0, 0, 1.8, 0, 0, 1, 0, 0.1, 1, 0, 0, 1.1, 0], 3));
    const out = paintHuman(g, 'kohen', { headY: 1.6, ankleY: 0.1, wrists: [] });
    expect(out.groups).toEqual([{ start: 0, count: 3, materialIndex: 0 }, { start: 3, count: 3, materialIndex: 1 }]);
    expect(Array.from(out.index.array)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(skinBounds(new THREE.Group()).headY).toBe(1.56);
  });

  it('hides figures by projected size and their small parts before that', async () => {
    sys = new CharacterSystem(scene, stubTex, { loader: diskLoader });
    await sys.load();
    const camera = new THREE.PerspectiveCamera(CONFIG.FOV);
    const k = lodK(CONFIG.FOV, 720);
    // fov 62 on 720 px: a 1 m radius is 4 px at ~300 m and 40 px at ~30 m.
    expect(k * FIGURE_RADIUS.human).toBeGreaterThan(290);
    expect(k * FIGURE_RADIUS.human).toBeLessThan(300);
    expect(figureTier(k * 1 + 0.01, 1, k)).toBe('hidden');
    expect(figureTier(k * 1 - 0.01, 1, k)).toBe('body');
    expect(figureTier(k * (LOD.minPixels / LOD.partsPixels) + 0.01, 1, k)).toBe('body');
    expect(figureTier(k * (LOD.minPixels / LOD.partsPixels) - 0.01, 1, k)).toBe('full');
    expect(figureTier(35, 1.2, k)).toBe('full'); // an animal's radius 1.2 keeps its parts to ~36 m
    expect(figureTier(40, 1.2, k)).toBe('body');
    expect(figureTier(35, 1, k)).toBe('body');
    expect(figureTier(25, 1, k)).toBe('full');

    const kohen = sys.createKohen(0, 0, 0);
    const gadol = sys.createKohen(0, 0, 2, true);
    const sheep = sys.createAnimal('sheep', 0, 0, 4);
    const walker = sys.createKohen(0, 0, 6, { path: [[0, 6], [0, 60]], speed: 1 });
    const parts = (g) => { const p = []; g.traverse((o) => { if (o.userData?.lodPart) p.push(o); }); return p; };
    // Attached parts (hat, gold) plus the glb's Eyes/Hair meshes when it has them.
    const attached = (g) => parts(g).filter((p) => !p.isSkinnedMesh).map((p) => p.geometry.userData.key).sort();
    expect(attached(kohen)).toEqual(['migbaas']);
    expect(attached(gadol)).toEqual(['choshen', 'ephod', 'mitznefes', 'stones', 'tzitz']);
    for (const p of parts(gadol)) if (!p.isSkinnedMesh) expect(p.userData.noCull).toBe(true);
    const visibleParts = (g) => parts(g).filter((p) => p.visible).length;

    camera.position.set(300, 1.7, 0);
    sys.update(1 / 60, camera, 720);
    for (const g of [kohen, gadol, walker]) expect(g.visible, g.name).toBe(false);
    expect(sheep.visible).toBe(true); // radius 1.2: 4 px until ~360 m
    expect(sheep.userData.tier).toBe('body');
    camera.position.set(400, 1.7, 0);
    sys.update(1 / 60, camera, 720);
    for (const g of [kohen, gadol, sheep, walker]) expect(g.visible, g.name).toBe(false);
    walker.userData.walker.s = 10; // a fixed start (makeWalker picks a random one): no ping-pong at the path's end
    const s0 = walker.userData.walker.s;
    for (let i = 0; i < 60; i++) sys.update(1 / 60, camera, 720);
    expect(walker.userData.walker.s - s0).toBeCloseTo(1, 3); // still walking while hidden
    expect(walker.visible).toBe(false);

    camera.position.set(80, 1.7, 0);
    sys.update(1 / 60, camera, 720);
    for (const g of [kohen, gadol, sheep, walker]) expect(g.visible, g.name).toBe(true);
    expect(visibleParts(kohen)).toBe(0);
    expect(visibleParts(gadol)).toBe(0);
    expect(kohen.userData.tier).toBe('body');

    camera.position.set(5, 1.7, 0);
    sys.update(1 / 60, camera, 720);
    expect(visibleParts(kohen)).toBe(parts(kohen).length);
    expect(visibleParts(gadol)).toBe(parts(gadol).length);
    expect(sheep.userData.tier).toBe('full');
    // A smaller viewport hides sooner: at 5 px per metre of radius, 80 m is already gone.
    camera.position.set(80, 1.7, 0);
    sys.update(1 / 60, camera, 60);
    expect(kohen.visible).toBe(false);
    sys.dispose();
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
