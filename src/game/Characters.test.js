import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  CharacterSystem, CHARACTER_FILES, CLIPS, LIMITS, ANIMATE_RADIUS, LOD, FIGURE_RADIUS,
  templePlacements, makeWalker, figureTier, lodK, skinBounds, paintHuman, textureUrl, FOLD_SCALE, ROLES, LEVI_TURBAN, SUDAR, GOAT_PARTS,
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
      expect(prims, 'primitives per figure').toBeLessThanOrEqual(3);
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

  it('bull.glb is the Ultimate pack Bull from Poly Pizza, merged to one vertex-coloured primitive on 42 bones', async () => {
    const f = CHARACTER_FILES['bull.glb'];
    expect(f.pack).toBe('ultimate-animated-animals');
    expect(f.page).toBe('https://poly.pizza/m/a8PIIYwF7r');
    expect(f.url).toMatch(/^https:\/\/static\.poly\.pizza\/[0-9a-f-]+\.glb$/);
    expect(f.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(f.merged).toBe(true);
    expect(f.use).toMatch(/no CC0 rigged goat/);
    expect(f.bytes).toBeLessThan(450 * 1024);
    const gltf = await parseGlb('bull');
    const meshes = [];
    gltf.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
    expect(meshes).toHaveLength(1);
    const [m] = meshes;
    expect(m.isSkinnedMesh).toBe(true);
    expect(m.material.name).toBe('Painted');
    expect(m.material.vertexColors).toBe(true);
    expect(m.geometry.index).toBeTruthy();
    expect(m.geometry.attributes.color).toBeTruthy();
    expect(m.geometry.attributes.uv).toBeUndefined();
    expect(m.skeleton.bones).toHaveLength(42);
    expect(m.skeleton.bones.map((b) => b.name)).toContain('Head');
    // Several flat colours survived the merge (hide, light patches, hooves, horns, eyes).
    const col = m.geometry.attributes.color;
    const hexes = new Set();
    for (let i = 0; i < col.count; i++) hexes.add(new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)).getHexString());
    expect(hexes.size).toBeGreaterThanOrEqual(5);
    expect(hexes.size).toBeLessThanOrEqual(8);
    // Faces +z: posed in the first Idle frame, the topmost vertices (the horns) sit forward of the body's centre.
    const mixer = new THREE.AnimationMixer(gltf.scene);
    mixer.clipAction(gltf.animations[0]).play();
    mixer.update(0);
    gltf.scene.updateMatrixWorld(true);
    const pos = m.geometry.attributes.position;
    let topZ = 0, topY = -Infinity, maxZ = -Infinity;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { m.applyBoneTransform(i, v.fromBufferAttribute(pos, i)).applyMatrix4(m.matrixWorld); maxZ = Math.max(maxZ, v.z); if (v.y > topY) { topY = v.y; topZ = v.z; } }
    expect(topY).toBeGreaterThan(1.3);
    expect(topZ).toBeGreaterThan(0.1);
    expect(maxZ, 'the muzzle reaches forward of the centred body').toBeGreaterThan(0.9);
    const licenses = readFileSync(resolve(dir, '../LICENSES.md'), 'utf8');
    expect(licenses).toContain(f.page);
    expect(licenses).toContain(f.url);
    expect(licenses).toContain('Poly Pizza');
  });

  it('every texture in the manifest is on disk with its sha256 and LICENSES.md names both packs', async () => {
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
    expect(sudar.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(sys.models.kohen.headTop - SUDAR.drop, 5);
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
    // Twenty humans as before the Levite role; the two Duchan walkers are the Levites.
    expect(placements.filter((p) => p.kind === 'human')).toHaveLength(20);
    const levites = sys.humans.filter((h) => h.name === 'levi');
    expect(levites).toHaveLength(2);
    for (const l of levites) expect(l.userData.walker, 'a Levite walks the Duchan').toBeTruthy();
    expect(sys.humans.filter((h) => h.name === 'kohen' && h.userData.walker)).toHaveLength(2);
    // A walker starts where it is placed (the slaughter lane's pair half a loop apart).
    for (const p of placements.filter((q) => q.path)) {
      const g = sys.humans.find((h) => h.position.x === p.x && h.position.z === p.z);
      expect(g, `walker at ${p.x}, ${p.z}`).toBeTruthy();
      const { pos } = g.userData.walker.at(g.userData.walker.s);
      expect(Math.hypot(pos.x - p.x, pos.z - p.z), 'start on the path at the placement').toBeLessThan(1e-6);
    }
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

  it('writes a cylindrical uv1 and a tangent round each limb for the fold map, skin tangents from the atlas', async () => {
    sys = new CharacterSystem(scene, stubTex, { loader: diskLoader });
    await sys.load();
    const { skin: bounds, scene: src } = sys.models.kohen;
    const hand = src.getObjectByName('hand_l').getWorldPosition(new THREE.Vector3());
    const upperarm = src.getObjectByName('upperarm_l').getWorldPosition(new THREE.Vector3());
    let body;
    src.traverse((o) => { if (o.isSkinnedMesh && o.name !== 'Hair' && o.name !== 'Eyes' && !body) body = o; });
    const painted = sys.models.kohen.roles.kohen.get(body.geometry.uuid);
    const p0 = body.geometry.attributes.position, uv0 = body.geometry.attributes.uv;
    const { uv1, tangent, normal } = painted.attributes;
    expect(uv1.itemSize).toBe(2);
    expect(tangent.itemSize).toBe(4);
    expect(uv1.count).toBeGreaterThanOrEqual(p0.count); // seam vertices are duplicated across the cylindrical wrap
    // The unpainted geometry's own tangents, for the skin comparison.
    const ref = body.geometry.clone();
    ref.computeTangents();
    const refTan = ref.attributes.tangent;
    const v = new THREE.Vector3(), t = new THREE.Vector3(), n = new THREE.Vector3(), radial = new THREE.Vector3();
    let torso = 0, arm = 0, leg = 0, skinN = 0;
    for (let i = 0; i < p0.count; i++) {
      v.fromBufferAttribute(p0, i);
      const skinV = v.y > bounds.headY || v.y < bounds.ankleY || Math.abs(v.x) > hand.x - 0.01;
      if (skinV) {
        // Skin keeps the atlas tangent (its own normal map reads it); its uv1 is cylindrical
        // like the garment's, for the garment triangles at the collar, cuffs and hem.
        expect(tangent.getX(i)).toBe(refTan.getX(i));
        skinN++;
        continue;
      }
      t.fromBufferAttribute(tangent, i);
      n.fromBufferAttribute(normal, i);
      expect(t.length()).toBeCloseTo(1, 4);
      expect(Math.abs(t.dot(n)), `tangent ${i} not on the surface`).toBeLessThan(1e-4);
      expect(tangent.getW(i)).toBe(1);
      const u = uv1.getX(i), vv = uv1.getY(i);
      if (Math.abs(v.x) < 0.12 && v.y > 1.15 && v.y < 1.35 && Math.abs(v.z) > 0.05) {
        // Torso: v is height in tiles of 0.25 m, u the angle round the body (4 tiles), the
        // tangent runs round the body (horizontal, perpendicular to the radial direction).
        expect(vv).toBeCloseTo(v.y / 0.25, 5);
        expect(Math.abs(u)).toBeLessThanOrEqual(2);
        radial.set(v.x, 0, v.z).normalize();
        expect(Math.abs(t.y)).toBeLessThan(0.35);
        expect(Math.abs(t.dot(radial))).toBeLessThan(0.35);
        torso++;
      } else if (v.x > upperarm.x + 0.08 && v.x < hand.x - 0.08 && v.y > 1.3) {
        // Left arm: v runs along the bone from the shoulder, u round it (1 tile).
        expect(vv).toBeCloseTo((v.x - upperarm.x) / 0.25, 1);
        expect(Math.abs(u)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(t.x)).toBeLessThan(0.35); // round the arm, not along it
        arm++;
      } else if (v.y > 0.3 && v.y < 0.7 && Math.abs(v.x) > 0.05) {
        expect(vv).toBeCloseTo(v.y / 0.25, 5);
        expect(Math.abs(u)).toBeLessThanOrEqual(1);
        expect(Math.abs(t.y)).toBeLessThan(0.35);
        leg++;
      }
    }
    expect(skinN).toBeGreaterThan(500);
    expect(torso).toBeGreaterThan(20);
    expect(arm).toBeGreaterThan(20);
    expect(leg).toBeGreaterThan(50);
    sys.dispose();

    // The garment material takes the fold map on uv channel 1 when the factory has it; the skin does not.
    const folds = new THREE.Texture();
    const tex = { get: (name) => (name === 'clothFolds' ? folds : null), manager: new THREE.LoadingManager() };
    sys = new CharacterSystem(scene, tex, { loader: diskLoader });
    await sys.load();
    const k = sys.createKohen(0, 0, 0);
    let mesh;
    k.traverse((o) => { if (o.isSkinnedMesh && o.name !== 'Hair' && o.name !== 'Eyes' && !mesh) mesh = o; });
    const [skinMat, garment] = mesh.material;
    expect(garment.normalMap).toBe(folds);
    expect(folds.channel).toBe(1);
    expect(garment.normalScale.x).toBe(FOLD_SCALE);
    expect(skinMat.normalMap).toBeNull();
    expect(sys.materials.get('garment:kohen')).toBe(garment); // shared: no material per figure
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
    expect(skin.roughness).toBe(1); // the factor multiplies the map; 0.9 only without one
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

  it('wraps a Yisrael\'s head in a sudar that covers the scalp down to the ears', async () => {
    sys = new CharacterSystem(scene, stubTex, { loader: diskLoader });
    await sys.load();
    const y = sys.createKohen(0, 0, 0, { role: 'yisrael' });
    y.updateMatrixWorld(true);
    const parts = [];
    y.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) parts.push(o); });
    expect(parts.map((p) => p.geometry.userData.key)).toEqual(['sudar']); // one draw call: cap and band merged
    const sudar = parts[0];
    expect(sudar.material).toBe(sys.materials.get('hat:wool'));
    expect(sudar.geometry.attributes.uv, 'keeps uvs for the wool map').toBeTruthy();
    const top = sys.models.kohen.headTop;
    const origin = sudar.getWorldPosition(new THREE.Vector3());
    expect(origin.y).toBeCloseTo(top - SUDAR.drop, 5);
    expect(origin.x).toBeCloseTo(0, 5);
    sudar.geometry.computeBoundingBox();
    const bb = sudar.geometry.boundingBox;
    expect(bb.max.x - bb.min.x).toBeGreaterThan(0.23); // wider than the old 17 cm cap
    expect(bb.max.y, 'the cap tops out just over the crown').toBeCloseTo(SUDAR.h, 3);
    expect(bb.min.y).toBeCloseTo(-SUDAR.band, 3);
    // Every skull vertex of the rest pose from the crown down to the rim lies inside the
    // cap's ellipsoid with at least 8 mm to spare, so no scalp shows through the wool; the
    // rim reaches the ears (the skull's widest, 10-12 cm below the crown).
    let body;
    y.traverse((o) => { if (o.isSkinnedMesh && o.name !== 'Hair' && o.name !== 'Eyes' && !body) body = o; });
    const pos = body.geometry.attributes.position;
    const v = new THREE.Vector3();
    let checked = 0;
    let widest = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(body.matrixWorld).sub(origin);
      if (v.y < 0 || v.y > SUDAR.h) continue;
      const r = Math.hypot(v.x / SUDAR.a, v.y / SUDAR.h, v.z / SUDAR.c);
      const gap = (1 - r) * Math.min(SUDAR.a, SUDAR.h, SUDAR.c);
      expect(gap, `skull vertex ${i} at (${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`).toBeGreaterThan(0.008);
      checked++;
      if (v.y < 0.03) widest = Math.max(widest, Math.abs(v.x));
    }
    expect(checked).toBeGreaterThan(50);
    expect(widest, 'the rim sits at the ears').toBeGreaterThan(0.085);
    sys.dispose();
  });

  it('dresses a Levite in plain white linen with a flat wool turban', async () => {
    sys = new CharacterSystem(scene, stubTex, { loader: diskLoader });
    await sys.load();
    expect(ROLES).toEqual(['kohen', 'kohenGadol', 'levi', 'yisrael']);
    expect(Object.keys(sys.models.kohen.roles).sort()).toEqual([...ROLES].sort());
    const { skin: bounds, scene: src } = sys.models.kohen;
    const hand = src.getObjectByName('hand_l').getWorldPosition(new THREE.Vector3());
    let body;
    src.traverse((o) => { if (o.isSkinnedMesh && o.name !== 'Hair' && o.name !== 'Eyes' && !body) body = o; });
    const p0 = body.geometry.attributes.position;
    const lc = sys.models.kohen.roles.levi.get(body.geometry.uuid).attributes.color;
    const kc = sys.models.kohen.roles.kohen.get(body.geometry.uuid).attributes.color;
    const hexAt = (a, i) => new THREE.Color(a.getX(i), a.getY(i), a.getZ(i)).getHex();
    let garment = 0, avnet = 0;
    for (let i = 0; i < p0.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p0, i);
      if (v.y > bounds.headY || v.y < bounds.ankleY || Math.abs(v.x) > hand.x - 0.01) continue;
      expect(hexAt(lc, i), `levi vertex ${i}`).toBe(0xf2eee4); // linen everywhere: no band
      if (hexAt(kc, i) === 0x7a2e3e) avnet++;
      garment++;
    }
    expect(garment).toBeGreaterThan(1000);
    expect(avnet, 'the kohen has the avnet where the Levite has none').toBeGreaterThan(20);

    const l = sys.createKohen(0, 0, 0, { role: 'levi' });
    expect(l.name).toBe('levi');
    const parts = [];
    l.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) parts.push(o); });
    expect(parts.map((p) => p.geometry.userData.key)).toEqual(['leviTurban']); // one draw call
    const turban = parts[0];
    expect(turban.material).not.toBe(sys.materials.get('hat:linen'));
    expect(turban.material.color.getHex()).toBe(0xefeae0);
    expect(turban.material.roughness).toBeGreaterThan(0.9);
    expect(turban.userData.lodPart).toBe(true);
    l.updateMatrixWorld(true);
    const top = sys.models.kohen.headTop;
    expect(turban.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(top - LEVI_TURBAN.drop, 5);
    // Flat and wide: wider than the migba'as (27 cm) and about a third of its height (20 cm).
    turban.geometry.computeBoundingBox();
    const bb = turban.geometry.boundingBox;
    expect(bb.max.x - bb.min.x).toBeGreaterThan(0.28);
    expect(bb.max.z - bb.min.z).toBeGreaterThan(bb.max.x - bb.min.x); // follows the skull, longer in z
    expect(bb.max.y - bb.min.y).toBeLessThan(0.09);
    expect(bb.max.y - bb.min.y).toBeGreaterThan(0.08);
    expect(bb.max.y + top - LEVI_TURBAN.drop, 'the dome tops out just above the crown').toBeLessThan(top + 0.01);
    // The kohen's cap is the migba'as; its material is the linen, and the garment materials differ per role.
    const k = sys.createKohen(2, 0, 0);
    const keys = (g) => { const n = []; g.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) n.push(o.geometry.userData.key); }); return n; };
    expect(keys(k)).toEqual(['migbaas']);
    expect(sys.materials.get('garment:levi')).toBeTruthy();
    expect(sys.materials.get('garment:levi')).not.toBe(sys.materials.get('garment:kohen'));
    sys.dispose();
  });

  it('a goat is the sheep in hide colours with horns and a beard on its head bone; the bull draws in one call', async () => {
    sys = new CharacterSystem(scene, stubTex, { loader: diskLoader });
    await sys.load();
    const goat = sys.createAnimal('goat', 0, 0, 0);
    const sheep = sys.createAnimal('sheep', 3, 0, 0);
    const bull = sys.createAnimal('bull', 6, 0, 0);
    const meshes = (g) => { const m = []; g.traverse((o) => { if (o.isMesh) m.push(o); }); return m; };
    const names = (g) => meshes(g).filter((o) => !o.isSkinnedMesh).map((o) => o.geometry.userData.key);
    expect(names(goat)).toEqual(['goatParts']);
    expect(names(sheep)).toEqual([]);
    expect(names(bull)).toEqual([]);
    expect(meshes(bull)).toHaveLength(1);
    expect(meshes(bull)[0].material.vertexColors).toBe(true);
    expect(meshes(bull)[0].material.map).toBeNull();
    expect(meshes(goat).filter((o) => o.isSkinnedMesh).map((o) => o.material.map === null)).toEqual([true, true]); // no wool map (stubTex has none either way)
    const goatSkin = meshes(goat).filter((o) => o.isSkinnedMesh).map((o) => o.material.color.getHex()).sort((a, b) => a - b);
    const sheepSkin = meshes(sheep).filter((o) => o.isSkinnedMesh).map((o) => o.material.color.getHex()).sort((a, b) => a - b);
    expect(goatSkin).toEqual([0x5a4432, 0x8b6f4e]); // hide, and the face/legs a shade darker: not a black-faced sheep
    expect(sheepSkin).toEqual([0x2b2118, 0xede6d6]);
    // The parts hang on the Head bone, at the bone, and follow it (LOD part, this system's cull).
    const parts = meshes(goat).find((o) => !o.isSkinnedMesh);
    expect(parts.parent.isBone).toBe(true);
    expect(parts.parent.name).toBe('Head');
    expect(parts.userData.lodPart).toBe(true);
    expect(parts.userData.noCull).toBe(true);
    goat.updateMatrixWorld(true);
    const head = goat.getObjectByName('Head').getWorldPosition(new THREE.Vector3());
    expect(parts.getWorldPosition(new THREE.Vector3()).distanceTo(head)).toBeLessThan(1e-5);
    expect(head.y).toBeCloseTo(0.88 * 0.95, 1); // the root's goat scale carries the bone and the parts
    // Horns above the crown (0.95 unscaled) and swept back, the beard below the chin and forward.
    parts.geometry.computeBoundingBox();
    const bb = parts.geometry.boundingBox; // in the bone's frame: y up along the head, offsets from GOAT_PARTS
    expect(bb.max.y).toBeGreaterThan(GOAT_PARTS.horn[1] + 0.05);
    expect(bb.min.y).toBeLessThan(GOAT_PARTS.beard[1] - GOAT_PARTS.beardLength + 0.01);
    expect(bb.max.z).toBeGreaterThan(GOAT_PARTS.beard[2] - 0.03);
    expect(parts.geometry.attributes.color).toBeTruthy();
    expect(parts.geometry.attributes.uv).toBeUndefined();
    expect(parts.geometry.groups.length).toBeLessThanOrEqual(1); // one draw call
    // In metres in the world, whatever the armature's scale: the horns span ~30 cm and rise
    // above the crown (0.95 unscaled, 0.90 at the goat's 0.95 y scale), the beard hangs below the chin.
    const world = new THREE.Box3().setFromObject(parts);
    expect(world.max.x - world.min.x).toBeGreaterThan(0.25);
    expect(world.max.x - world.min.x).toBeLessThan(0.45);
    expect(world.max.y).toBeGreaterThan(0.95);
    expect(world.min.y).toBeLessThan(0.62);
    // The kohen's hat is unaffected (unit-scaled rig): 27 cm across.
    const k = sys.createKohen(9, 0, 0);
    k.updateMatrixWorld(true);
    const hat = k.getObjectByProperty('geometry', sys.geometries.find((g) => g.userData.key === 'migbaas'));
    const hb = new THREE.Box3().setFromObject(hat);
    expect(hb.max.x - hb.min.x).toBeCloseTo(0.27, 1);
    expect(hat.scale.x).toBeCloseTo(1, 6);
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
    expect(figureTier(20, 0.8, k)).toBe('full'); // an animal's radius 0.8 keeps its parts to ~24 m
    expect(figureTier(28, 0.8, k)).toBe('body');
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

    camera.position.set(200, 1.7, 0);
    sys.update(1 / 60, camera, 720);
    for (const g of [kohen, gadol, sheep, walker]) expect(g.visible, g.name).toBe(true);
    expect(sheep.userData.tier).toBe('body'); // radius 0.8: 4 px until ~240 m
    camera.position.set(300, 1.7, 0);
    sys.update(1 / 60, camera, 720);
    for (const g of [kohen, gadol, walker]) expect(g.visible, g.name).toBe(false);
    expect(sheep.visible).toBe(false);
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
    expect(w.s).toBeGreaterThanOrEqual(0);
    expect(w.s).toBeLessThanOrEqual(10);
    // A start point is projected onto the path: on it, off it, and past its end.
    expect(makeWalker([[0, 0], [10, 0]], false, 1, [3, 0]).s).toBeCloseTo(3, 6);
    expect(makeWalker([[0, 0], [10, 0]], false, 1, [4, 2]).s).toBeCloseTo(4, 6);
    expect(makeWalker([[0, 0], [10, 0]], false, 1, [14, 0]).s).toBeCloseTo(10, 6);
    expect(makeWalker([[0, 0], [10, 0], [10, 10], [0, 10]], true, 1, [10, 3]).s).toBeCloseTo(13, 6);
    expect(makeWalker([[0, 0], [10, 0], [10, 10], [0, 10]], true, 1, [0, 4]).s).toBeCloseTo(36, 6);
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
