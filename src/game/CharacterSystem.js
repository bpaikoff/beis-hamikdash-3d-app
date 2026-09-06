import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { byId, worldPos, levelWorldY } from '../content/index.js';
import { mulberry32 } from './random.js';
import manifest from '../../public/assets/characters/manifest.json';

/**
 * Rigged characters: the kohanim, the Kohen Gadol and the Yisraelim are one Quaternius
 * CC0 human (public/assets/characters/kohen.glb, see LICENSES.md) cloned per figure with
 * SkeletonUtils and dressed by vertex colour + a few meshes hung on bones; the animals
 * are the farm-pack sheep and cow. Each figure has its own AnimationMixer; the mixers
 * tick at MIXER_HZ and only within ANIMATE_RADIUS of the camera. Doves stay primitives on
 * fixed orbits around their spawn point.
 *
 * Model files are loaded once each through the shared LoadingManager (the one
 * TextureFactory uses), then every instance is a clone. Geometry and materials are shared
 * per role. A human's body draws in two groups, `skin` (the photographic maps from
 * manifest.textures, when present) and `garment` (vertex-coloured linen or wool), split
 * per triangle at the neck and the wrists of the rig's rest pose; the `Eyes` and `Hair`
 * meshes (on the base body the latter is the eyebrows) and the hat or gold are the small
 * parts. Per figure that is 5 draw calls (4 for a Yisrael), and `update` drops the small parts
 * beyond LOD.partsPixels and the whole figure beyond LOD.minPixels of projected size, the
 * way DistanceCuller does for plain meshes (it skips SkinnedMesh).
 */

export const CHARACTERS_PATH = '/assets/characters/';
export const CHARACTER_FILES = manifest.files;
/** Texture files (skin, hair, eyes) with bytes + sha256; absent until scripts/fetch_assets.mjs writes them. */
export const CHARACTER_TEXTURES = manifest.textures ?? {};
export const LIMITS = { humans: 20, animals: 14, doves: 12 };
export const MIXER_HZ = 30;
export const ANIMATE_RADIUS = 80;
/**
 * Skinned LOD: a figure is hidden once a sphere of its radius would cover fewer than
 * `minPixels` on screen, and loses its small parts (eyes, brows, hat, gold) below
 * `partsPixels`. With the 62 deg camera on a 720 px viewport that is ~300 m and ~30 m for
 * a human (radius 1), ~360 m and ~36 m for an animal (1.2).
 */
export const LOD = { minPixels: 4, partsPixels: 40 };
export const FIGURE_RADIUS = { human: 1, animal: 1.2 };
/** How far above the neck_01 joint the skin starts (the collar sits at the neck), metres. */
const NECK_MARGIN = 0.03;
/** How far before the hand joint, along the forearm, the sleeve ends, metres. */
const WRIST_MARGIN = 0.01;
/** Ground speed (m/s) at which each walk clip's feet do not slide; the mixer's timeScale follows speed / this. */
export const CLIP_SPEED = { kohen: 1.25, bull: 1.0 };
/** Clip names in the files (scripts/fetch_assets.mjs keeps exactly these). */
export const CLIPS = {
  kohen: { idle: 'Idle_Loop', talk: 'Idle_Talking_Loop', walk: 'Walk_Loop' },
  sheep: { idle: 'Idle' },
  bull: { idle: 'Idle' },
};

const SKIN = 0xd9a878;
const LINEN = 0xf2eee4;
const WOOL = 0xcdbfa3;
const TECHEILES = 0x1f3f8f;
const AVNET = 0x7a2e3e;
const GOLD = 0xd4a83a;

/** Model url with a cache-buster from the manifest (nginx serves /assets/ as immutable). */
export function modelUrl(name) {
  const f = CHARACTER_FILES[`${name}.glb`];
  return `${CHARACTERS_PATH}${name}.glb${f ? `?v=${f.sha256.slice(0, 8)}` : ''}`;
}

/** Texture url with the same cache-buster, or null when the manifest does not list the file. */
export function textureUrl(file, textures = CHARACTER_TEXTURES) {
  const f = textures[file];
  return f ? `${CHARACTERS_PATH}${file}?v=${f.sha256.slice(0, 8)}` : null;
}

/**
 * `k` for figureTier, as DistanceCuller computes it: a sphere of radius r is LOD.minPixels
 * tall on screen at distance r * k.
 */
export function lodK(fov, viewportHeight) {
  return viewportHeight / (LOD.minPixels * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
}

/**
 * The LOD tier of a figure whose bounding sphere has `radius`, `distance` metres from the
 * camera: 'hidden' below LOD.minPixels of projected diameter, 'body' (no small parts) below
 * LOD.partsPixels, else 'full'.
 * @returns {'hidden' | 'body' | 'full'}
 */
export function figureTier(distance, radius, k) {
  const far = radius * k;
  if (distance > far) return 'hidden';
  if (distance > far * (LOD.minPixels / LOD.partsPixels)) return 'body';
  return 'full';
}

/**
 * Where the skin ends in the rig's rest pose, from the bones rather than the mesh: skin is
 * everything above `headY` (the neck_01 joint plus NECK_MARGIN) and, per arm, everything past
 * the wrist plane through the hand joint, normal to the forearm (so the split does not care
 * whether the rest pose is a T or an A). Falls back to the UAL mannequin's numbers when a
 * bone is missing.
 * @param {THREE.Object3D} scene the loaded model, matrices up to date
 */
export function skinBounds(scene) {
  const v = new THREE.Vector3();
  const neck = scene.getObjectByName('neck_01');
  const head = scene.getObjectByName('Head');
  const headY = neck ? neck.getWorldPosition(v).y + NECK_MARGIN : head ? head.getWorldPosition(v).y - 0.05 : 1.56;
  const wrists = [];
  for (const side of ['l', 'r']) {
    const hand = scene.getObjectByName(`hand_${side}`);
    const forearm = scene.getObjectByName(`lowerarm_${side}`);
    if (!hand) continue;
    const origin = hand.getWorldPosition(new THREE.Vector3());
    const axis = forearm ? origin.clone().sub(forearm.getWorldPosition(v)).normalize() : new THREE.Vector3(Math.sign(origin.x) || 1, 0, 0);
    wrists.push({ origin, axis });
  }
  if (!wrists.length) {
    for (const sx of [1, -1]) wrists.push({ origin: new THREE.Vector3(sx * 0.78, 1.44, 0), axis: new THREE.Vector3(sx, 0, 0) });
  }
  return { headY, wrists };
}

/** Whether a bind-pose vertex is skin (head or hand) by `bounds` from skinBounds. */
function isSkin(x, y, z, bounds, tmp) {
  if (y > bounds.headY) return true;
  for (const w of bounds.wrists) {
    if (tmp.set(x, y, z).sub(w.origin).dot(w.axis) > -WRIST_MARGIN) return true;
  }
  return false;
}

/**
 * A per-role copy of a human body geometry: vertex colours for the garment (the Kohen
 * Gadol's techeiles meil covers the torso down to the knees but has no sleeves, so the
 * white kesones shows on the arms and at the hem) and the index reordered into two
 * groups, 0 = skin and 1 = garment, each triangle going with the majority of its three
 * vertices. The skin group takes material 0 (the textured skin), the garment group
 * material 1 (linen or wool with vertexColors).
 */
export function paintHuman(geometry, role, bounds = { headY: 1.56, wrists: [] }) {
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const skin = new Uint8Array(pos.count);
  const c = new THREE.Color();
  const tmp = new THREE.Vector3();
  const garment = role === 'yisrael' ? WOOL : LINEN;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), y = pos.getY(i), x = Math.abs(px);
    let hex = garment;
    if (isSkin(px, y, pos.getZ(i), bounds, tmp)) {
      hex = SKIN;
      skin[i] = 1;
    } else if (role === 'kohenGadol' && x < 0.3 && y > 0.5 && y < 1.5) hex = TECHEILES;
    else if (role !== 'yisrael' && x < 0.32 && y > 0.98 && y < 1.06) hex = AVNET;
    c.setHex(hex);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  const g = geometry.clone();
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // Split the triangles: skin first, then garment, as two groups over one index buffer.
  const src = geometry.index ? geometry.index.array : Uint32Array.from({ length: pos.count }, (_, i) => i);
  const tris = src.length / 3;
  const skinTris = [], garmentTris = [];
  for (let t = 0; t < tris; t++) {
    const a = src[t * 3], b = src[t * 3 + 1], d = src[t * 3 + 2];
    (skin[a] + skin[b] + skin[d] >= 2 ? skinTris : garmentTris).push(a, b, d);
  }
  const index = pos.count > 65535 ? new Uint32Array(src.length) : new Uint16Array(src.length);
  index.set(skinTris, 0);
  index.set(garmentTris, skinTris.length);
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.clearGroups();
  g.addGroup(0, skinTris.length, 0);
  g.addGroup(skinTris.length, garmentTris.length, 1);
  g.computeBoundingSphere();
  return g;
}

/** The choshen's twelve stones as one merged geometry (one draw call). */
function stonesGeometry() {
  const hues = [0xb22222, 0x2e8b57, 0x1e90ff, 0xdaa520, 0x8a2be2, 0x20b2aa, 0xff8c00, 0x800080, 0x006400, 0x191970, 0x808000, 0x800000];
  const parts = [];
  const c = new THREE.Color();
  for (let r = 0; r < 4; r++) {
    for (let k = 0; k < 3; k++) {
      const g = new THREE.BoxGeometry(0.045, 0.045, 0.012);
      c.setHex(hues[r * 3 + k]);
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.translate(-0.06 + k * 0.06, 0.08 - r * 0.055, 0);
      parts.push(g);
    }
  }
  return mergeGeometries(parts);
}

// ============================================================================
// CHARACTER SYSTEM
// ============================================================================
export class CharacterSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {{get?: (name: string) => THREE.Texture | null, manager?: THREE.LoadingManager}} tex
   *   TextureFactory (or a stub): `get` supplies the linen/wool/hide maps, `manager` the
   *   shared LoadingManager so the start screen's progress counts the model files.
   * @param {{loader?: {load: Function}, textureLoader?: {load: Function}, textures?: object}} [opts]
   *   loader stand-ins for tests (node has no Image); `textures` replaces manifest.textures.
   */
  constructor(scene, tex, opts = {}) {
    this.scene = scene;
    this.tex = tex;
    this.loader = opts.loader ?? new GLTFLoader(tex?.manager);
    // No default loader without a DOM (tests): ImageLoader needs `document`.
    this.textureLoader = opts.textureLoader ?? (typeof document === 'undefined' ? null : new THREE.TextureLoader(tex?.manager));
    this.textures = opts.textures ?? CHARACTER_TEXTURES;
    this.loadedTextures = []; // the skin/hair/eye maps, disposed with the system
    this.models = {}; // name -> { scene, animations, bones? } (the source; instances are clones)
    this.humans = [];
    this.animals = [];
    this.doves = [];
    this.materials = new Map();
    this.geometries = []; // per-role painted copies and hats, disposed with the system
    this.time = 0;
    this.mixerAcc = 0;
    this.loading = null;
    this._v = new THREE.Vector3();
  }

  // ------------------------------------------------------------------ loading

  /** Load every model once (kohen, sheep, bull). Resolves when all have loaded or failed. */
  load() {
    if (this.loading) return this.loading;
    this.loading = Promise.all(
      Object.keys(CLIPS).map(
        (name) =>
          new Promise((resolve) => {
            this.loader.load(
              modelUrl(name),
              (gltf) => {
                this.models[name] = this.prepare(name, gltf);
                resolve();
              },
              undefined,
              (err) => {
                console.warn(`CharacterSystem: ${name}.glb failed to load`, err);
                this.models[name] = null;
                resolve();
              }
            );
          })
      )
    ).then(() => this);
    return this.loading;
  }

  /** Per-model one-time setup: bounds for culling, painted geometries per role, bone lookups. */
  prepare(name, gltf) {
    const model = { scene: gltf.scene, animations: gltf.animations, roles: {} };
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        o.geometry.computeBoundingSphere();
        o.castShadow = true;
        o.frustumCulled = true;
      }
    });
    if (name === 'kohen') {
      // Body meshes (anything skinned that is not the Hair or Eyes) get the painted, grouped
      // copy per role; Hair and Eyes keep their geometry and only swap materials.
      model.skin = skinBounds(gltf.scene);
      // The crown of the head in the rest pose, where the hats sit (1.83 mannequin, 1.81 base body).
      let top = -Infinity;
      gltf.scene.traverse((o) => {
        if (o.isSkinnedMesh && !isPartMesh(o)) {
          o.geometry.computeBoundingBox();
          top = Math.max(top, o.geometry.boundingBox.max.y);
        }
      });
      model.headTop = Number.isFinite(top) ? top : 1.83;
      for (const role of ['kohen', 'kohenGadol', 'yisrael']) {
        const geoms = new Map();
        gltf.scene.traverse((o) => {
          if (o.isSkinnedMesh && !isPartMesh(o)) geoms.set(o.geometry.uuid, paintHuman(o.geometry, role, model.skin));
        });
        for (const g of geoms.values()) this.geometries.push(g);
        model.roles[role] = geoms;
      }
      model.head = gltf.scene.getObjectByName('Head');
      model.chest = gltf.scene.getObjectByName('spine_03');
    }
    return model;
  }

  material(key, make) {
    if (!this.materials.has(key)) this.materials.set(key, make());
    return this.materials.get(key);
  }

  /**
   * A character texture from manifest.textures through the shared manager (null when the
   * manifest has no such file). Colour maps are sRGB; glTF UVs need flipY off. On a failed
   * load `onFail` runs so the material can drop the slot instead of drawing a black surface.
   */
  loadTexture(file, { srgb = false } = {}, onFail = null) {
    const url = textureUrl(file, this.textures);
    if (!url || !this.textureLoader) return null;
    const tex = this.textureLoader.load(url, undefined, undefined, () => {
      console.warn(`CharacterSystem: ${url} failed to load`);
      onFail?.();
    });
    if (!tex) return null;
    tex.flipY = false;
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    this.loadedTextures.push(tex);
    return tex;
  }

  /** The body's material array: [skin, garment] for the two geometry groups. */
  humanMaterials(role) {
    return [this.skinMaterial(), this.garmentMaterial(role)];
  }

  /** Photographic skin when the manifest lists the maps, else a flat skin colour. */
  skinMaterial() {
    return this.material('skin', () => {
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
      const drop = (slot) => () => { mat[slot] = null; mat.needsUpdate = true; };
      mat.map = this.loadTexture('kohen_skin.jpg', { srgb: true }, drop('map'));
      mat.normalMap = this.loadTexture('kohen_skin_normal.jpg', {}, drop('normalMap'));
      mat.roughnessMap = this.loadTexture('kohen_skin_rough.jpg', {}, drop('roughnessMap'));
      mat.color.setHex(mat.map ? 0xffffff : SKIN);
      return mat;
    });
  }

  garmentMaterial(role) {
    return this.material(`garment:${role}`, () => {
      const map = this.tex?.get?.('whiteLinen') ?? null;
      return new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.85, metalness: 0 });
    });
  }

  hairMaterial() {
    return this.material('hair', () => {
      const mat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.8, metalness: 0 });
      mat.map = this.loadTexture('kohen_hair.jpg', { srgb: true }, () => { mat.map = null; mat.needsUpdate = true; });
      if (mat.map) mat.color.setHex(0xffffff);
      return mat;
    });
  }

  eyesMaterial() {
    return this.material('eyes', () => {
      const mat = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.4, metalness: 0 });
      mat.map = this.loadTexture('kohen_eyes.png', { srgb: true }, () => { mat.map = null; mat.needsUpdate = true; });
      if (mat.map) mat.color.setHex(0xffffff);
      return mat;
    });
  }

  animalMaterial(type, part) {
    const table = {
      sheep: { White: [0xede6d6, 'sheepWool'], Black: [0x2b2118], Pink: [0x9c6a62] },
      goat: { White: [0x8b6f4e, 'goatHide'], Black: [0x2b2118], Pink: [0x6b4a3a] },
      bull: { White: [0x4a3222, 'bullHide'], Black: [0x1e1512], Pink: [0x3a2a22] },
    };
    const [color, texName] = table[type]?.[part] ?? [0x888888];
    return this.material(`animal:${type}:${part}`, () => {
      const map = texName ? this.tex?.get?.(texName) ?? null : null;
      return new THREE.MeshStandardMaterial({ color, map, roughness: 0.95, metalness: 0 });
    });
  }

  /** Clone a loaded model with its own skeleton; null (with one warning) if the file did not load. */
  instantiate(name) {
    const model = this.models[name];
    if (!model) {
      if (model === undefined) console.warn(`CharacterSystem: ${name} used before load()`);
      return null;
    }
    const root = cloneSkeleton(model.scene);
    root.updateMatrixWorld(true);
    return root;
  }

  /**
   * Hang a mesh on a bone at a world position given in the model's rest pose: the mesh
   * stays upright relative to the bone's rest orientation and follows the bone from then on.
   */
  attachToBone(root, boneName, mesh, worldPoint) {
    const bone = root.getObjectByName(boneName);
    if (!bone) return;
    bone.updateWorldMatrix(true, false);
    mesh.position.copy(bone.worldToLocal(this._v.copy(worldPoint)));
    mesh.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
    mesh.castShadow = true;
    mesh.userData.lodPart = true; // hidden at the 'body' tier
    mesh.userData.noCull = true; // this system's LOD owns `visible`, not DistanceCuller
    bone.add(mesh);
  }

  // ------------------------------------------------------------------ figures

  /**
   * A human figure with its feet at (x, y, z), facing `facing` radians (0 = +z, east).
   * @param {boolean | {role?: 'kohen'|'kohenGadol'|'yisrael', clip?: 'idle'|'talk'|'walk',
   *   facing?: number, path?: number[][], closed?: boolean, speed?: number}} [opts]
   *   `true` is shorthand for the Kohen Gadol. `path` is a polyline of [x, z] the figure
   *   walks (closed loop or ping-pong) at `speed` m/s with the walk clip.
   */
  createKohen(x, y, z, opts = {}) {
    if (this.humans.length >= LIMITS.humans) {
      console.warn(`CharacterSystem: human limit ${LIMITS.humans} reached`);
      return null;
    }
    const o = typeof opts === 'boolean' ? { role: opts ? 'kohenGadol' : 'kohen' } : opts;
    const role = o.role ?? 'kohen';
    const root = this.instantiate('kohen');
    if (!root) return null;
    const model = this.models.kohen;
    const mats = this.humanMaterials(role);
    root.traverse((m) => {
      if (!m.isSkinnedMesh) return;
      if (m.name === 'Hair') {
        m.material = this.hairMaterial();
        m.userData.lodPart = true;
      } else if (m.name === 'Eyes') {
        m.material = this.eyesMaterial();
        m.userData.lodPart = true;
      } else {
        m.geometry = model.roles[role].get(m.geometry.uuid) ?? m.geometry;
        m.material = mats;
      }
    });
    this.dress(root, role);

    const g = new THREE.Group();
    g.name = role;
    g.add(root);
    g.position.set(x, y, z);
    g.rotation.y = o.facing ?? 0;
    const mixer = new THREE.AnimationMixer(root);
    const clipName = CLIPS.kohen[o.path ? 'walk' : o.clip ?? 'idle'] ?? CLIPS.kohen.idle;
    const clip = THREE.AnimationClip.findByName(model.animations, clipName);
    const action = clip ? mixer.clipAction(clip) : null;
    if (action) {
      action.time = Math.random() * clip.duration; // desynchronise the crowd
      action.play();
    }
    g.userData = { type: 'human', role, mixer, action, baseY: y, parts: lodParts(root), tier: 'full' };
    if (o.path && o.path.length >= 2) {
      const speed = o.speed ?? 1.1;
      g.userData.walker = makeWalker(o.path, o.closed ?? false, speed);
      if (action) action.timeScale = speed / CLIP_SPEED.kohen;
    }
    this.scene.add(g);
    this.humans.push(g);
    return g;
  }

  /**
   * Head covering and, for the Kohen Gadol, the golden garments. The hats hang from the
   * crown measured in prepare (model.headTop): the migba'as cylinder is centred 3 cm above
   * it (its 20 cm height reaches 7 cm down the skull), the mitznefes dome starts 5 cm below
   * it and the tzitz sits 9 cm below on the forehead.
   */
  dress(root, role) {
    const linen = this.material('hat:linen', () => new THREE.MeshStandardMaterial({ color: LINEN, map: this.tex?.get?.('whiteLinen') ?? null, roughness: 0.9 }));
    const gold = this.material('gold', () => new THREE.MeshStandardMaterial({ color: GOLD, map: this.tex?.get?.('goldEngraved') ?? null, roughness: 0.35, metalness: 0.85 }));
    const top = this.models.kohen?.headTop ?? 1.83;
    if (role === 'kohen') {
      // Migba'as: a tall cap.
      const hat = new THREE.Mesh(this.geometry('migbaas', () => new THREE.CylinderGeometry(0.1, 0.135, 0.2, 14)), linen);
      this.attachToBone(root, 'Head', hat, new THREE.Vector3(-0.02, top + 0.03, 0.01));
    } else if (role === 'kohenGadol') {
      // Mitznefes: a wound turban, wider and lower than the migba'as.
      const turban = new THREE.Mesh(this.geometry('mitznefes', () => new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1)), linen);
      this.attachToBone(root, 'Head', turban, new THREE.Vector3(-0.02, top - 0.05, 0.01));
      const tzitz = new THREE.Mesh(this.geometry('tzitz', () => new THREE.BoxGeometry(0.16, 0.045, 0.012)), gold);
      this.attachToBone(root, 'Head', tzitz, new THREE.Vector3(-0.02, top - 0.09, 0.13));
      const ephod = new THREE.Mesh(this.geometry('ephod', () => new THREE.BoxGeometry(0.34, 0.36, 0.035)), gold);
      this.attachToBone(root, 'spine_03', ephod, new THREE.Vector3(0, 1.3, 0.13));
      const choshen = new THREE.Mesh(this.geometry('choshen', () => new THREE.BoxGeometry(0.22, 0.24, 0.02)), gold);
      this.attachToBone(root, 'spine_03', choshen, new THREE.Vector3(0, 1.3, 0.16));
      const stones = new THREE.Mesh(this.geometry('stones', stonesGeometry), this.material('stones', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.1 })));
      this.attachToBone(root, 'spine_03', stones, new THREE.Vector3(0, 1.3, 0.175));
    }
  }

  geometry(key, make) {
    let g = this.geometries.find((x) => x.userData.key === key);
    if (!g) {
      g = make();
      g.userData.key = key;
      this.geometries.push(g);
    }
    return g;
  }

  /**
   * An animal standing at (x, y, z): 'sheep', 'goat' (the sheep model, narrowed and in
   * goat colours) or 'bull'. `facing` in radians (0 = +z).
   */
  createAnimal(type, x, y, z, { facing = Math.random() * Math.PI * 2 } = {}) {
    if (this.animals.length >= LIMITS.animals) {
      console.warn(`CharacterSystem: animal limit ${LIMITS.animals} reached`);
      return null;
    }
    const modelName = type === 'bull' ? 'bull' : 'sheep';
    const root = this.instantiate(modelName);
    if (!root) return null;
    root.traverse((m) => {
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const swapped = mats.map((mm) => this.animalMaterial(type, mm.name));
      m.material = Array.isArray(m.material) ? swapped : swapped[0];
    });
    if (type === 'goat') root.scale.set(0.85, 0.95, 0.9);
    const g = new THREE.Group();
    g.name = type;
    g.add(root);
    g.position.set(x, y, z);
    g.rotation.y = facing;
    const model = this.models[modelName];
    const mixer = new THREE.AnimationMixer(root);
    const clip = THREE.AnimationClip.findByName(model.animations, CLIPS[modelName].idle);
    const action = clip ? mixer.clipAction(clip) : null;
    if (action) {
      action.time = Math.random() * clip.duration;
      action.play();
    }
    g.userData = { type: 'animal', animalType: type, mixer, action, parts: lodParts(root), tier: 'full' };
    this.scene.add(g);
    this.animals.push(g);
    return g;
  }

  /** A dove circling a fixed orbit around (x, y, z). Primitives; no mixer. */
  createDove(x, y, z) {
    if (this.doves.length >= LIMITS.doves) return null;
    const g = new THREE.Group();
    const mat = this.material('dove', () => new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.7 }));
    const body = new THREE.Mesh(this.geometry('doveBody', () => new THREE.SphereGeometry(0.08, 8, 8).scale(1, 0.8, 1.3)), mat);
    g.add(body);
    const head = new THREE.Mesh(this.geometry('doveHead', () => new THREE.SphereGeometry(0.04, 8, 8)), mat);
    head.position.set(0, 0.05, 0.1);
    g.add(head);
    const beak = new THREE.Mesh(this.geometry('doveBeak', () => new THREE.ConeGeometry(0.015, 0.04, 4).rotateX(Math.PI / 2)), this.material('beak', () => new THREE.MeshStandardMaterial({ color: 0xffa500 })));
    beak.position.set(0, 0.04, 0.14);
    g.add(beak);
    const wingGeo = this.geometry('doveWing', () => new THREE.BoxGeometry(0.15, 0.01, 0.1));
    const wings = [-1, 1].map((side) => {
      const wing = new THREE.Mesh(wingGeo, mat);
      wing.position.set(side * 0.1, 0, 0);
      g.add(wing);
      return { wing, side };
    });
    g.position.set(x, y, z);
    g.userData = {
      type: 'dove', baseX: x, baseY: y, baseZ: z, wings,
      phase: Math.random() * Math.PI * 2, radius: 3 + Math.random() * 5, speed: 0.3 + Math.random() * 0.3,
    };
    this.scene.add(g);
    this.doves.push(g);
    return g;
  }

  /** Place one entry of templePlacements(). */
  place(p) {
    if (p.kind === 'human') return this.createKohen(p.x, p.y, p.z, p);
    if (p.kind === 'animal') return this.createAnimal(p.type, p.x, p.y, p.z, p);
    if (p.kind === 'dove') return this.createDove(p.x, p.y, p.z);
    return null;
  }

  // ------------------------------------------------------------------ per frame

  /**
   * Advance walkers and doves every frame (walkers keep moving while hidden); set each
   * figure's LOD tier from its projected size; tick the mixers at MIXER_HZ for figures
   * within ANIMATE_RADIUS of `camera` (others hold their pose).
   * @param {number} viewportHeight CSS pixels, the same value DistanceCuller gets
   */
  update(delta, camera = null, viewportHeight = 720) {
    this.time += delta;
    for (const h of this.humans) {
      const w = h.userData.walker;
      if (w) w.step(delta, h);
    }
    if (camera) this.applyLod(camera, viewportHeight);
    for (const d of this.doves) {
      const u = d.userData;
      const t = this.time * u.speed + u.phase;
      d.position.set(u.baseX + Math.cos(t) * u.radius, u.baseY + Math.sin(t * 2) * 0.5, u.baseZ + Math.sin(t) * u.radius);
      d.rotation.y = -t + Math.PI / 2;
      for (const { wing, side } of u.wings) wing.rotation.z = side * (0.3 + Math.sin(this.time * 15) * 0.4);
    }
    this.mixerAcc += delta;
    if (this.mixerAcc < 1 / MIXER_HZ) return;
    const step = this.mixerAcc;
    this.mixerAcc = 0;
    const cam = camera?.position;
    const r2 = ANIMATE_RADIUS * ANIMATE_RADIUS;
    for (const list of [this.humans, this.animals]) {
      for (const g of list) {
        if (cam && g.position.distanceToSquared(cam) > r2) continue;
        g.userData.mixer.update(step);
      }
    }
  }

  /** Hide figures below LOD.minPixels and their small parts below LOD.partsPixels. */
  applyLod(camera, viewportHeight) {
    const k = lodK(camera.fov ?? 60, viewportHeight);
    const cam = camera.position;
    for (const list of [this.humans, this.animals]) {
      const radius = list === this.humans ? FIGURE_RADIUS.human : FIGURE_RADIUS.animal;
      for (const g of list) {
        const tier = figureTier(g.position.distanceTo(cam), radius, k);
        if (tier === g.userData.tier) continue;
        g.userData.tier = tier;
        g.visible = tier !== 'hidden';
        const full = tier === 'full';
        for (const p of g.userData.parts) p.visible = full;
      }
    }
  }

  /** Stop the mixers and free everything this system created (clones, painted geometry, materials, textures). */
  dispose() {
    for (const g of [...this.humans, ...this.animals]) {
      g.userData.mixer?.stopAllAction();
      g.userData.mixer?.uncacheRoot(g.children[0]);
      g.traverse((o) => {
        if (o.isSkinnedMesh) o.skeleton?.dispose();
      });
      this.scene.remove(g);
    }
    for (const d of this.doves) this.scene.remove(d);
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials.values()) m.dispose();
    for (const t of this.loadedTextures) t.dispose();
    for (const model of Object.values(this.models)) {
      model?.scene.traverse((o) => {
        if (o.isMesh) o.geometry.dispose();
        if (o.isSkinnedMesh) o.skeleton?.dispose();
      });
    }
    this.humans = [];
    this.animals = [];
    this.doves = [];
    this.geometries = [];
    this.materials.clear();
    this.loadedTextures = [];
    this.models = {};
  }
}

/** The glb meshes that are small parts rather than the body (kept as-is, only re-materialed). */
function isPartMesh(mesh) {
  return mesh.name === 'Hair' || mesh.name === 'Eyes';
}

/** Every mesh under `root` tagged `userData.lodPart` (hats, gold, eyes, brows) that starts visible. */
function lodParts(root) {
  const parts = [];
  root.traverse((o) => {
    if (o.userData?.lodPart && o.visible) parts.push(o);
  });
  return parts;
}

/** A figure moving along a polyline of [x, z] at `speed`, turning toward its direction of travel. */
export function makeWalker(points, closed, speed) {
  const pts = points.map(([x, z]) => new THREE.Vector2(x, z));
  const segs = [];
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    segs.push({ a, b, len: a.distanceTo(b) });
  }
  const total = segs.reduce((s, x) => s + x.len, 0);
  const w = { s: Math.random() * total, dir: 1, total, closed, speed, points: pts };
  const tmp = new THREE.Vector2();
  /** Position at arc length s (0..total) and the segment heading. */
  w.at = (s, out = new THREE.Vector3()) => {
    let rest = Math.min(Math.max(s, 0), total);
    for (const seg of segs) {
      if (rest <= seg.len || seg === segs[segs.length - 1]) {
        tmp.copy(seg.b).sub(seg.a).normalize();
        out.set(seg.a.x + tmp.x * rest, 0, seg.a.y + tmp.y * rest);
        return { pos: out, yaw: Math.atan2(tmp.x, tmp.y) };
      }
      rest -= seg.len;
    }
    return { pos: out, yaw: 0 };
  };
  w.step = (delta, g) => {
    w.s += w.dir * speed * delta;
    if (closed) w.s = ((w.s % total) + total) % total;
    else if (w.s >= total) { w.s = total; w.dir = -1; }
    else if (w.s <= 0) { w.s = 0; w.dir = 1; }
    const { pos, yaw } = w.at(w.s, g.position);
    pos.y = g.userData.baseY;
    const target = w.dir > 0 ? yaw : yaw + Math.PI;
    // Turn smoothly (shortest way round) toward the direction of travel.
    let d = target - g.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * Math.min(1, delta * 6);
  };
  return w;
}

/**
 * Where everyone stands in the Temple, derived from the content JSON so the figures
 * follow the geometry when an entry moves. Coordinates are scene metres; `y` is the
 * floor level the figure stands on. Kept as data so Characters.test.js can probe every
 * spot (and every point of the walking loops) against the built Temple.
 */
export function templePlacements() {
  const at = (id, dx = 0, dz = 0, level) => {
    const [x, y, z] = worldPos(byId[id]);
    return [x + dx, level ? levelWorldY(level) : y, z + dz];
  };
  const kohanimY = levelWorldY('azaras_kohanim');
  const yisraelY = levelWorldY('azaras_yisrael');
  const nashimY = levelWorldY('ezras_nashim');
  const duchanY = levelWorldY('duchan');
  const W = Math.PI; // facing west (-z), toward the building
  const N = Math.PI / 2; // +x
  const S = -Math.PI / 2;
  const out = [];
  const human = (x, y, z, o = {}) => out.push({ kind: 'human', x, y, z, ...o });

  // The Kohen Gadol at the golden altar in the Heichal, facing it.
  const [gx, gy, gz] = at('mizbeach_hazahav', 0, 3, 'heichal');
  human(gx, gy, gz, { role: 'kohenGadol', facing: W });

  // Kohanim around the altar (x north/south of it, z east of it); the altar spans
  // x -8..8, z -19..-3 and the kevesh lies south of it.
  const [ax, , az] = at('mizbeach');
  for (const [dx, dz, facing] of [[10, 10, S], [-10, 10, N], [14, -2, S], [-14, 6, N], [-26, 2, N], [3, 9.5, W], [-4, 10, W]]) {
    human(ax + dx, kohanimY, az + dz, { facing });
  }
  // The slaughter lane: a loop between the altar's north face and the rings, out to the tables.
  human(ax + 9.5, kohanimY, az + 7, { path: [[ax + 9.5, az + 7], [ax + 9.5, az - 7], [ax + 24.5, az - 7], [ax + 24.5, az + 7]], closed: true, speed: 1.15 });
  human(ax + 24.5, kohanimY, az - 7, { path: [[ax + 9.5, az + 7], [ax + 9.5, az - 7], [ax + 24.5, az - 7], [ax + 24.5, az + 7]], closed: true, speed: 1.05 });
  // Two Levites pacing the Duchan platform (it stops 12 amos short of each side wall).
  const [dxx, , dz0] = at('duchan');
  const strip = dz0 + 0.35;
  human(dxx - 18, duchanY, strip, { path: [[dxx - 20, strip], [dxx + 20, strip]], speed: 0.9 });
  human(dxx + 12, duchanY, strip, { path: [[dxx + 20, strip], [dxx - 20, strip]], speed: 0.95 });

  // Yisraelim in the Ezras Yisrael, west of the Nicanor threshold (the middle one stands
  // 3 m north of the axis so tour stop 13 looks past him).
  const [nx, , nz] = at('nicanor_gate');
  human(nx + 8, yisraelY, nz - 3, { role: 'yisrael', clip: 'talk', facing: S });
  human(nx + 6.4, yisraelY, nz - 3.4, { role: 'yisrael', facing: N + 0.6 });
  human(nx - 8, yisraelY, nz - 3, { role: 'yisrael', facing: W });
  human(nx + 3, yisraelY, nz - 4, { role: 'yisrael', facing: W });
  // People in the Ezras Nashim.
  const [ex, , ez] = at('ezras_nashim', 0, 0, 'ezras_nashim');
  for (const [dx, dz, o] of [[0, 6, { facing: W }], [15, 10, { clip: 'talk', facing: S }], [15, 8.2, { facing: N }], [-12, -6, { facing: W }]]) {
    human(ex + dx, nashimY, ez + dz, { role: 'yisrael', ...o });
  }

  // The flock waiting at the rings: sheep, goats and two bulls (the pen chamber is in Beis HaMoked).
  const rand = mulberry32(11); // same flock on every load
  const [rx, , rz] = at('slaughter_rings');
  for (let i = 0; i < 8; i++) out.push({ kind: 'animal', type: 'sheep', x: rx - 1 + (rand() - 0.5) * 6, y: kohanimY, z: rz - 3 + (rand() - 0.5) * 6, facing: rand() * Math.PI * 2 });
  for (let i = 0; i < 4; i++) out.push({ kind: 'animal', type: 'goat', x: rx + 3 + (rand() - 0.5) * 4, y: kohanimY, z: rz + 4 + (rand() - 0.5) * 3, facing: rand() * Math.PI * 2 });
  out.push({ kind: 'animal', type: 'bull', x: rx - 4, y: kohanimY, z: rz + 5, facing: N + 0.4 });
  out.push({ kind: 'animal', type: 'bull', x: rx + 5.5, y: kohanimY, z: rz - 5, facing: S - 0.3 });
  // Doves over the Ezras Nashim.
  for (let i = 0; i < 12; i++) out.push({ kind: 'dove', x: ex + (rand() - 0.5) * 60, y: nashimY + 12 + rand() * 10, z: ez + (rand() - 0.5) * 60 });
  return out;
}
