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
 * parts. Per figure that is 5 draw calls (9 for the Kohen Gadol), and `update` drops the small parts
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
 * a human (radius 1), ~240 m and ~24 m for an animal (0.8: a sheep's posed radius is
 * under a metre and a bull's about one).
 */
export const LOD = { minPixels: 4, partsPixels: 40 };
export const FIGURE_RADIUS = { human: 1, animal: 0.8 };
/** How far above the neck_01 joint the skin starts (the collar sits at the neck), metres. */
const NECK_MARGIN = 0.03;
/** How far before the hand joint, along the forearm, the sleeve ends, metres. */
const WRIST_MARGIN = 0.01;
/** How far above the foot (ankle) joint the hem ends: everyone on Har HaBayis is barefoot (Berachos 54a). */
const ANKLE_MARGIN = 0.02;
/**
 * The garment over the base body: its normals are 3/4 a per-limb tube normal and 1/4 the
 * body's own (the body is muscular and its normals shade every muscle under a painted
 * robe), and its vertices are pushed GARMENT_PUFF along that normal, ramping to zero over
 * GARMENT_BLEND next to the skin so the neck, wrists and ankles do not open.
 */
const TUBE_WEIGHT = 0.75;
const GARMENT_PUFF = 0.03;
const GARMENT_BLEND = 0.03;
/**
 * The garment's fold map (TextureFactory `clothFolds`, tangent space, one tile =
 * FOLD_TILE metres of cloth) samples a second UV set: `uv1` is a cylindrical unwrap per
 * limb frame, u going round the torso / arm / leg (a whole number of tiles, so the seam
 * at the back is invisible) and v running up the limb in metres / FOLD_TILE, with the
 * tangent (+u) written per vertex so the folds run along the limb whatever the atlas UVs
 * do. FOLD_TILES: tiles round the torso, an arm, a leg. FOLD_SCALE is the normalScale.
 */
const FOLD_TILE = 0.25;
const FOLD_TILES = { torso: 4, arm: 1, leg: 2 };
export const FOLD_SCALE = 0.9;
/** The belt band (avnet / a Yisrael's belt) above the pelvis joint, metres, and how tall the hem band is. */
const WAIST_BAND = [0.03, 0.11];
const HEM_BAND = 0.12;
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
const WHITE_WOOL = 0xefeae0; // the Levite's turban
const WOOL = 0xd8d0c0; // the Yisraelim's light grey-beige wool
const WOOL_BELT = 0x5a4632;
const WOOL_HEM = 0x8a7a66;
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
 * everything above `headY` (the neck_01 joint plus NECK_MARGIN), everything below `ankleY`
 * (the higher foot joint plus ANKLE_MARGIN: bare feet) and, per arm, everything past the
 * wrist plane through the hand joint, normal to the forearm (so the split does not care
 * whether the rest pose is a T or an A). Also the limb frames the garment's tube normals
 * use (`limbs`): the shoulder x (upperarm joint), the hip and crotch heights (pelvis joint),
 * the belt band, each thigh's x and each arm's axis from the upperarm joint to the hand.
 * Falls back to the UAL mannequin's numbers when a bone is missing.
 * @param {THREE.Object3D} scene the loaded model, matrices up to date
 */
export function skinBounds(scene) {
  const v = new THREE.Vector3();
  const at = (name) => {
    const b = scene.getObjectByName(name);
    return b ? b.getWorldPosition(new THREE.Vector3()) : null;
  };
  const neck = scene.getObjectByName('neck_01');
  const head = scene.getObjectByName('Head');
  const headY = neck ? neck.getWorldPosition(v).y + NECK_MARGIN : head ? head.getWorldPosition(v).y - 0.05 : 1.56;
  const feet = ['foot_l', 'foot_r'].map((n) => scene.getObjectByName(n)).filter(Boolean);
  const ankleY = feet.length ? Math.max(...feet.map((f) => f.getWorldPosition(v).y)) + ANKLE_MARGIN : 0.12;
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
  const pelvis = at('pelvis') ?? new THREE.Vector3(0, 0.92, 0);
  const shoulder = at('upperarm_l') ?? new THREE.Vector3(0.2, 1.44, 0);
  const arms = [];
  for (const [side, sign] of [['l', 1], ['r', -1]]) {
    const origin = at(`upperarm_${side}`) ?? new THREE.Vector3(sign * 0.2, 1.44, 0);
    const hand = at(`hand_${side}`) ?? new THREE.Vector3(sign * 0.78, 1.44, 0);
    arms.push({ sign, origin, axis: hand.clone().sub(origin).normalize() });
  }
  const limbs = {
    shoulderX: Math.abs(shoulder.x),
    hipY: pelvis.y,
    crotchY: pelvis.y - 0.1,
    waist: [pelvis.y + WAIST_BAND[0], pelvis.y + WAIST_BAND[1]],
    thighX: [Math.abs(at('thigh_l')?.x ?? 0.09), -Math.abs(at('thigh_r')?.x ?? 0.09)],
    arms,
  };
  return { headY, ankleY, wrists, limbs };
}

/** Half-width of the blend between limb frames at the shoulder and the crotch, metres. */
const LIMB_BLEND = 0.05;
const _limb = new THREE.Vector3();

/**
 * The garment's "tube" normal at a bind-pose vertex: radial from the torso's vertical axis,
 * from the arm's bone axis (upperarm to hand) or from the vertical through the thigh joint,
 * by where the vertex sits (arm: beyond the shoulder and above the hip; leg: below the
 * crotch, the sign of x picking the side; else torso), the frames cross-faded over
 * LIMB_BLEND either side of the shoulder x and the crotch y. Writes into `out`.
 */
function tubeNormal(x, y, z, limbs, out) {
  out.set(x, 0, z); // torso
  if (out.lengthSq() < 1e-8) out.set(0, 0, 1);
  out.normalize();
  const armT = y > limbs.hipY ? Math.min(1, Math.max(0, (Math.abs(x) - limbs.shoulderX + LIMB_BLEND) / (2 * LIMB_BLEND))) : 0;
  if (armT > 0) {
    const arm = limbs.arms[x > 0 ? 0 : 1];
    _limb.set(x, y, z).sub(arm.origin);
    _limb.addScaledVector(arm.axis, -_limb.dot(arm.axis));
    if (_limb.lengthSq() < 1e-8) _limb.set(0, 1, 0);
    out.lerp(_limb.normalize(), armT);
  }
  const legT = Math.min(1, Math.max(0, (limbs.crotchY + LIMB_BLEND - y) / (2 * LIMB_BLEND)));
  if (legT > 0) {
    _limb.set(x - (x > 0 ? limbs.thighX[0] : limbs.thighX[1]), 0, z);
    if (_limb.lengthSq() < 1e-8) _limb.set(0, 0, 1);
    out.lerp(_limb.normalize(), legT);
  }
  return out.normalize();
}

const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

/**
 * The fold map's cylindrical `uv1` and tangent (+u, round the limb) at a bind-pose vertex:
 * the arm frame beyond the shoulder (above the hip), the leg frame below the crotch, else
 * the torso frame (the same tests as tubeNormal, without the cross-fade: a uv cannot be
 * blended across a seam, and the shoulder / crotch is where a sleeve or a skirt is sewn on).
 * Writes u, v into `uv` and the tangent into `tan`.
 */
function garmentUv(x, y, z, limbs, uv, tan) {
  const arm = y > limbs.hipY && Math.abs(x) >= limbs.shoulderX ? limbs.arms[x > 0 ? 0 : 1] : null;
  if (arm) {
    // Frame round the bone axis: e1 = up x axis, e2 = axis x e1.
    _e1.crossVectors(_up, arm.axis).normalize();
    _e2.crossVectors(arm.axis, _e1).normalize();
    _limb.set(x, y, z).sub(arm.origin);
    const along = _limb.dot(arm.axis);
    const angle = Math.atan2(_limb.dot(_e1), _limb.dot(_e2));
    uv.set((angle / (2 * Math.PI)) * FOLD_TILES.arm, along / FOLD_TILE);
    // +u: the angle's increasing direction, cos * e1 - sin * e2.
    tan.copy(_e1).multiplyScalar(Math.cos(angle)).addScaledVector(_e2, -Math.sin(angle));
    return;
  }
  const leg = y < limbs.crotchY;
  const cx = leg ? (x > 0 ? limbs.thighX[0] : limbs.thighX[1]) : 0;
  const tiles = leg ? FOLD_TILES.leg : FOLD_TILES.torso;
  const angle = Math.atan2(x - cx, z); // 0 at the front (+z), the seam at the back
  uv.set((angle / (2 * Math.PI)) * tiles, y / FOLD_TILE);
  tan.set(Math.cos(angle), 0, -Math.sin(angle));
}

/** Distance from a garment vertex to the nearest skin boundary (neck, ankle, wrist planes). */
function skinDistance(x, y, z, bounds, tmp) {
  let d = Math.min(bounds.headY - y, y - bounds.ankleY);
  for (const w of bounds.wrists) d = Math.min(d, -WRIST_MARGIN - tmp.set(x, y, z).sub(w.origin).dot(w.axis));
  return Math.max(d, 0);
}

/** Whether a bind-pose vertex is skin (head, hand or foot) by `bounds` from skinBounds. */
function isSkin(x, y, z, bounds, tmp) {
  if (y > bounds.headY || y < bounds.ankleY) return true;
  for (const w of bounds.wrists) {
    if (tmp.set(x, y, z).sub(w.origin).dot(w.axis) > -WRIST_MARGIN) return true;
  }
  return false;
}

/** Every human role: what paintHuman colours and dress hats. */
export const ROLES = ['kohen', 'kohenGadol', 'levi', 'yisrael'];

/**
 * A per-role copy of a human body geometry: vertex colours for the garment (white linen
 * with the dark-red avnet for kohanim; plain white linen for Levites; the Kohen Gadol's
 * techeiles meil covers the torso down to the knees but has no sleeves, so the white
 * kesones shows on the arms and at the hem; grey-beige wool with a brown belt and a
 * darker hem band for Yisraelim), garment
 * normals flattened to per-limb tubes and the garment puffed GARMENT_PUFF outward so the
 * muscles do not shade through (see TUBE_WEIGHT), and the index reordered into two groups,
 * 0 = skin and 1 = garment, each triangle going with the majority of its three vertices.
 * The skin group takes material 0 (the textured skin), the garment group material 1
 * (linen or wool with vertexColors). Skin vertices are left exactly as loaded.
 */
export function paintHuman(geometry, role, bounds = { headY: 1.56, ankleY: -Infinity, wrists: [] }) {
  const g = geometry.clone();
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const skin = new Uint8Array(pos.count);
  const c = new THREE.Color();
  const tmp = new THREE.Vector3(), tube = new THREE.Vector3(), n = new THREE.Vector3();
  const limbs = bounds.limbs;
  const waist = limbs?.waist ?? [0.98, 1.06];
  const hemY = bounds.ankleY + HEM_BAND;
  // The fold map's uv1 + tangent: atlas tangents for everything (the skin's own normal map
  // reads them), then the cylindrical frame per garment vertex. Needs index, normal and uv.
  const folds = Boolean(limbs && nor && g.index && g.attributes.uv);
  if (folds) {
    g.computeTangents();
    g.setAttribute('uv1', g.attributes.uv.clone());
  }
  const uv1 = g.attributes.uv1, tangent = g.attributes.tangent;
  const uv = new THREE.Vector2(), tan = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), y = pos.getY(i), pz = pos.getZ(i), x = Math.abs(px);
    let hex;
    if (isSkin(px, y, pz, bounds, tmp)) {
      // The skin material ignores vertex colour; a skin vertex shared by a garment triangle
      // at the collar or cuff must not bleed tan into the cloth, so it takes the cloth colour.
      hex = role === 'yisrael' ? WOOL : LINEN;
      skin[i] = 1;
    } else {
      if (role === 'yisrael') hex = x < 0.32 && y > waist[0] && y < waist[1] ? WOOL_BELT : y < hemY ? WOOL_HEM : WOOL;
      else if (role === 'kohenGadol' && x < (limbs?.shoulderX ?? 0.3) && y > 0.5 && y < 1.5) hex = TECHEILES; // sleeveless: ends at the shoulder joint
      else if (role === 'levi') hex = LINEN; // white linen throughout (2 Chron 5:12), no avnet: the belt is a priestly vestment
      else hex = x < 0.32 && y > waist[0] && y < waist[1] ? AVNET : LINEN;
      if (limbs && nor) {
        // Flatten the shading to the limb's tube and push the cloth out, except right at the skin.
        tubeNormal(px, y, pz, limbs, tube);
        n.set(nor.getX(i), nor.getY(i), nor.getZ(i)).multiplyScalar(1 - TUBE_WEIGHT).addScaledVector(tube, TUBE_WEIGHT).normalize();
        nor.setXYZ(i, n.x, n.y, n.z);
        const puff = GARMENT_PUFF * Math.min(1, skinDistance(px, y, pz, bounds, tmp) / GARMENT_BLEND);
        pos.setXYZ(i, px + n.x * puff, y + n.y * puff, pz + n.z * puff);
      }
      if (folds) {
        garmentUv(px, y, pz, limbs, uv, tan);
        uv1.setXY(i, uv.x, uv.y);
        // Keep the tangent perpendicular to the flattened normal; handedness +1.
        tan.addScaledVector(n, -tan.dot(n)).normalize();
        tangent.setXYZW(i, tan.x, tan.y, tan.z, 1);
      }
    }
    c.setHex(hex);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
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
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/**
 * The Levite's turban: a ring of major radius `ring` and tube `tube`, stretched `depth` in
 * z to follow the skull (10 cm back, 9 cm forward against 7.4 cm half-width, so the wool
 * hugs the head all round), under a dome of radius `dome` flattened to `domeHeight`; the
 * whole sits `drop` below the crown. Outer width 29 cm against the migba'as' 27 cm, height
 * 8.5 cm (the band's 7 plus the dome above the band's centre) against its 20 cm.
 */
export const LEVI_TURBAN = { ring: 0.11, tube: 0.035, depth: 1.2, dome: 0.1, domeHeight: 0.5, drop: 0.045 };

/** The turban as one geometry (one draw call): the ring and the dome merged. */
function leviTurbanGeometry() {
  const { ring, tube, depth, dome, domeHeight } = LEVI_TURBAN;
  const band = new THREE.TorusGeometry(ring, tube, 8, 24).rotateX(Math.PI / 2).scale(1, 1, depth);
  const cap = new THREE.SphereGeometry(dome, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, domeHeight, depth);
  for (const g of [band, cap]) g.deleteAttribute('uv');
  const merged = mergeGeometries([band, cap]);
  band.dispose();
  cap.dispose();
  return merged;
}

/**
 * The Yisrael's sudar: a wool head-wrap from the crown to just above the ears, an
 * ellipsoid cap of half-width `a` (x), depth `c` (z) and height `h` whose base sits `drop`
 * below the crown, with a rolled band (a torus of tube `band`) round its rim. The base
 * body's skull (rest pose, measured in Characters.test.js) is 9.1 cm half-wide at the
 * ears (10-12 cm below the crown), 10.6 cm back and 9.8 cm forward at the brow, so the
 * cap clears it by over a centimetre everywhere; the old 8.5 cm sphere cap sat 6 cm
 * down and left the scalp bare above the rim.
 */
export const SUDAR = { a: 0.108, c: 0.126, h: 0.145, drop: 0.12, band: 0.014 };

/** The sudar as one geometry (one draw call): the cap and the band merged, uvs kept for the wool. */
function sudarGeometry() {
  const { a, c, h, band } = SUDAR;
  const cap = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(a, h, c);
  const rim = new THREE.TorusGeometry(a, band, 8, 28).rotateX(Math.PI / 2).scale(1, 1, c / a);
  const merged = mergeGeometries([cap, rim]);
  cap.dispose();
  rim.dispose();
  return merged;
}

/**
 * A goat's horns and beard, relative to the sheep model's Head bone (rest pose: the bone at
 * (0, 0.88, 0.39), the crown at y 0.95, the chin's lowest point at (0, 0.67, 0.58), the
 * muzzle 25 cm forward of the bone): two horns 20 cm long rising from the crown 5 cm either
 * side of the midline, leaning back 35 deg and out 35 deg, and a beard 8 cm long hanging
 * from the chin, as one geometry with vertex colours (dark horn, hair a shade lighter).
 * GOAT_PARTS holds the offsets from the bone.
 */
export const GOAT_PARTS = { horn: [0.05, 0.065, 0], hornLength: 0.2, hornLean: 0.61, hornSplay: 0.61, beard: [0, -0.21, 0.19], beardLength: 0.08 };

function goatPartsGeometry() {
  const { horn, hornLength, hornLean, hornSplay, beard, beardLength } = GOAT_PARTS;
  const paint = (g, hex) => {
    const c = new THREE.Color(hex);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    return g;
  };
  const parts = [];
  for (const side of [1, -1]) {
    // A tapered horn: base on the crown, leaning back (rotateX toward -z) and out (rotateZ).
    const h = new THREE.CylinderGeometry(0.006, 0.026, hornLength, 6)
      .translate(0, hornLength / 2, 0)
      .rotateX(-hornLean)
      .rotateZ(-side * hornSplay)
      .translate(side * horn[0], horn[1], horn[2]);
    parts.push(paint(h, 0x3a3028));
  }
  const b = new THREE.ConeGeometry(0.022, beardLength, 6).rotateX(Math.PI).translate(beard[0], beard[1] - beardLength / 2, beard[2]);
  parts.push(paint(b, 0x6a5238));
  const merged = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  return merged;
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
   *   shared LoadingManager so the start screen's progress counts the model files (the skin
   *   maps are counted too, but the start screen does not wait for them: a body can draw
   *   flat for the first frames before its maps arrive).
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
      for (const role of ROLES) {
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
      // A map that fails to load drops its slot and falls back to the flat colour, never white.
      const drop = (slot) => () => { mat[slot] = null; if (slot === 'map') mat.color.setHex(SKIN); if (slot === 'roughnessMap') mat.roughness = 0.9; mat.needsUpdate = true; };
      mat.map = this.loadTexture('kohen_skin.jpg', { srgb: true }, drop('map'));
      mat.normalMap = this.loadTexture('kohen_skin_normal.jpg', {}, drop('normalMap'));
      mat.roughnessMap = this.loadTexture('kohen_skin_rough.jpg', {}, drop('roughnessMap'));
      if (mat.roughnessMap) mat.roughness = 1; // the factor multiplies the map
      mat.color.setHex(mat.map ? 0xffffff : SKIN);
      return mat;
    });
  }

  /**
   * The garment: the linen weave (atlas uv) times the vertex colour, with the fold normal
   * map on the cylindrical `uv1` (see FOLD_TILE) when the TextureFactory has it.
   */
  garmentMaterial(role) {
    return this.material(`garment:${role}`, () => {
      const map = this.tex?.get?.('whiteLinen') ?? null;
      const normalMap = this.tex?.get?.('clothFolds') ?? null;
      if (normalMap) normalMap.channel = 1;
      return new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(FOLD_SCALE, FOLD_SCALE), vertexColors: true, roughness: 0.85, metalness: 0 });
    });
  }

  hairMaterial() {
    return this.material('hair', () => {
      const mat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.8, metalness: 0 });
      mat.map = this.loadTexture('kohen_hair.jpg', { srgb: true }, () => { mat.map = null; mat.needsUpdate = true; });
      // The pack's hair map is a near-white sheen mask meant to be tinted: keep the colour.
      return mat;
    });
  }

  eyesMaterial() {
    return this.material('eyes', () => {
      const mat = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.4, metalness: 0 });
      mat.map = this.loadTexture('kohen_eyes.png', { srgb: true }, () => { mat.map = null; mat.color.setHex(0x2a1c12); mat.needsUpdate = true; });
      if (mat.map) mat.color.setHex(0xffffff);
      return mat;
    });
  }

  /**
   * The animals' materials by the source primitive's material name: the farm-pack sheep
   * has `White` (fleece), `Black` (face and legs) and `Pink`; as a goat the fleece is a
   * short brown hide, the face and legs the same hide a shade darker, and no wool map. The
   * bull is `Painted`: one primitive with the pack's own colours as vertex colours
   * (scripts/fetch_assets.mjs merges its seven), tinted warm so the black reads as hide.
   */
  animalMaterial(type, part) {
    const table = {
      sheep: { White: [0xede6d6, 'sheepWool'], Black: [0x2b2118], Pink: [0x9c6a62] },
      goat: { White: [0x8b6f4e, 'goatHide'], Black: [0x5a4432], Pink: [0x6b4a3a] },
      bull: { Painted: [0xf0e4d4, null, true], White: [0x4a3222, 'bullHide'], Black: [0x1e1512], Pink: [0x3a2a22] },
    };
    const [color, texName, vertexColors = false] = table[type]?.[part] ?? [0x888888];
    return this.material(`animal:${type}:${part}`, () => {
      const map = texName ? this.tex?.get?.(texName) ?? null : null;
      return new THREE.MeshStandardMaterial({ color, map, vertexColors, roughness: 0.95, metalness: 0 });
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
   * stays upright relative to the bone's rest orientation, keeps its size in metres (the
   * FBX-converted animals carry a centimetre armature under a metre root, so a bone's world
   * scale is far from 1) and follows the bone from then on.
   */
  attachToBone(root, boneName, mesh, worldPoint) {
    const bone = root.getObjectByName(boneName);
    if (!bone) return;
    bone.updateWorldMatrix(true, false);
    mesh.position.copy(bone.worldToLocal(this._v.copy(worldPoint)));
    mesh.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
    const ws = bone.getWorldScale(new THREE.Vector3());
    mesh.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z);
    mesh.castShadow = true;
    mesh.userData.lodPart = true; // hidden at the 'body' tier
    mesh.userData.noCull = true; // this system's LOD owns `visible`, not DistanceCuller
    bone.add(mesh);
  }

  // ------------------------------------------------------------------ figures

  /**
   * A human figure with its feet at (x, y, z), facing `facing` radians (0 = +z, east).
   * @param {boolean | {role?: 'kohen'|'kohenGadol'|'levi'|'yisrael', clip?: 'idle'|'talk'|'walk',
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
      g.userData.walker = makeWalker(o.path, o.closed ?? false, speed, [x, z]);
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
   * it, the tzitz sits 9 cm below on the forehead, a Yisrael's sudar 12 cm below (its
   * rim; see SUDAR) and a Levite's turban 4.5 cm below (see LEVI_TURBAN).
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
    } else if (role === 'levi') {
      // A flat white wool turban: a wound ring round the head with a low dome over the crown,
      // one merged geometry (LEVI_TURBAN). Wider than the migba'as and a third of its height,
      // so a Levite is told from a kohen at a glance; in wool, not the priestly linen.
      const wool = this.material('hat:whiteWool', () => new THREE.MeshStandardMaterial({ color: WHITE_WOOL, map: this.tex?.get?.('sheepWool') ?? null, roughness: 0.95 }));
      const turban = new THREE.Mesh(this.geometry('leviTurban', leviTurbanGeometry), wool);
      this.attachToBone(root, 'Head', turban, new THREE.Vector3(-0.02, top - LEVI_TURBAN.drop, 0.01));
    } else if (role === 'yisrael') {
      // Sudar: a wool head-wrap from the crown down to just above the ears, with a rolled
      // band at its rim (SUDAR). Centred on the skull's axis (x 0) since it hugs it.
      const wool = this.material('hat:wool', () => new THREE.MeshStandardMaterial({ color: 0xb5a992, map: this.tex?.get?.('sheepWool') ?? null, roughness: 0.95 }));
      const sudar = new THREE.Mesh(this.geometry('sudar', sudarGeometry), wool);
      this.attachToBone(root, 'Head', sudar, new THREE.Vector3(0, top - SUDAR.drop, 0));
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
   * An animal standing at (x, y, z): 'sheep', 'goat' (the sheep model, narrowed, in hide
   * colours, with horns and a beard hung on its head bone: no CC0 rigged goat exists) or
   * 'bull'. `facing` in radians (0 = +z).
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
    if (type === 'goat') {
      // Horns and beard on the head bone, placed in the unscaled rest pose (the root's
      // scale below carries them with the head). One merged geometry: one draw call.
      const parts = new THREE.Mesh(this.geometry('goatParts', goatPartsGeometry), this.material('goatParts', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 })));
      const head = root.getObjectByName('Head');
      if (head) this.attachToBone(root, 'Head', parts, head.getWorldPosition(new THREE.Vector3()));
      root.scale.set(0.85, 0.95, 0.9);
    }
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
    this.loading = null; // load() after dispose() loads again
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
export function makeWalker(points, closed, speed, start = null) {
  const pts = points.map(([x, z]) => new THREE.Vector2(x, z));
  const segs = [];
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    segs.push({ a, b, len: a.distanceTo(b) });
  }
  const total = segs.reduce((s, x) => s + x.len, 0);
  const tmp = new THREE.Vector2();
  // Start at the arc length of the path point nearest `start` (the placement's feet), so a
  // scene loads the same way every time; anywhere on the path when no start is given.
  let s0 = Math.random() * total;
  if (start) {
    const p = new THREE.Vector2(start[0], start[1]), ab = new THREE.Vector2();
    let best = Infinity, acc = 0;
    for (const seg of segs) {
      ab.copy(seg.b).sub(seg.a);
      const t = seg.len > 0 ? Math.min(1, Math.max(0, tmp.copy(p).sub(seg.a).dot(ab) / (seg.len * seg.len))) : 0;
      const d = tmp.copy(ab).multiplyScalar(t).add(seg.a).distanceTo(p);
      if (d < best) { best = d; s0 = acc + t * seg.len; }
      acc += seg.len;
    }
  }
  const w = { s: s0, dir: 1, total, closed, speed, points: pts };
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
  human(dxx - 18, duchanY, strip, { role: 'levi', path: [[dxx - 20, strip], [dxx + 20, strip]], speed: 0.9 });
  human(dxx + 12, duchanY, strip, { role: 'levi', path: [[dxx + 20, strip], [dxx - 20, strip]], speed: 0.95 });

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
