import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { BaseBuilder, TILE_METRES } from './BaseBuilder.js';
import { mulberry32 } from '../random.js';
import { Daylight } from '../Daylight.js';
import { walkableBounds } from '../../content/index.js';

/** The terrain stays exactly flat this far outside the ground the player can reach (metres). */
export const HILL_CLEARANCE = 15;
/** Beyond the clearance the terrain blends from flat to its full height over this distance (metres). */
export const BLEND_WIDTH = 40;
/** A hill's foot (where its bump reaches 0) is this many times its seeded radius; gentler than the old cones. */
const HILL_FOOT = 1.6;
/** Peak-to-trough amplitude of the rolling ground noise (metres), on top of the hills. */
export const NOISE_AMPLITUDE = 3;
/** Wavelength of the noise's largest octave (metres). */
const NOISE_WAVELENGTH = 110;
/** The terrain runs this far beyond the farthest hill's foot (metres) when the fog does not need more. */
const GROUND_MARGIN = 60;
/** Where the fog starts and ends (metres); the terrain's edge lies beyond the fog end from every walkable point. */
export const FOG_NEAR = 140;
export const FOG_END = Math.round(CONFIG.RENDER_DISTANCE * 0.97);
/** Grid spacing (metres) where the hills stand and beyond them, where the ground is flat noise under fog. */
const FINE_CELL = 6;
const COARSE_CELL = 16;

/** Gap between (x, z) and an axis-aligned rectangle; 0 inside it. */
function rectGap(x, z, r) {
  const dx = Math.max(r.minX - x, 0, x - r.maxX);
  const dz = Math.max(r.minZ - z, 0, z - r.maxZ);
  return Math.hypot(dx, dz);
}

const smoothstep = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * The eight distant hills, the same on every load: one per compass octant, nominally
 * 180-220 m from the origin, each pushed further out along its bearing until its seeded
 * radius clears `walkable` (the union of the area bounds, TempleGame's player clamp) by
 * HILL_CLEARANCE. The mount is 250 m square and the `outside` ring reaches 20 m past
 * its wall, so the nominal distances would stand hills on the wall's corners.
 *
 * Octant 0 is +x (north in this frame); octant 2 is +z, east. The east hill is stretched
 * along x into a north-south ridge that stands for Har HaMishcha (Har HaZeisim, the Mount
 * of Olives) east of the mount: Middot 2:4 keeps the east wall low so the Kohen burning
 * the parah on Har HaMishcha sees the Heichal entrance over it. Its position, length and
 * height are a reconstruction; no source gives them.
 */
export function hillPlacements(walkable = walkableBounds()) {
  const rand = mulberry32(7);
  const hills = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    let dist = 180 + rand() * 40;
    const height = 15 + rand() * 25;
    const radius = 30 + rand() * 20;
    const rotation = rand() * Math.PI;
    while (rectGap(Math.cos(angle) * dist, Math.sin(angle) * dist, walkable) < radius + HILL_CLEARANCE) dist += 5;
    const ridge = i === 2 ? { stretchX: 3.2 } : null;
    hills.push({ x: Math.cos(angle) * dist, z: Math.sin(angle) * dist, dist, height, radius, rotation, ridge });
  }
  return hills;
}

/** One hill's contribution at (x, z): a cosine bump, `height` at its centre, 0 at HILL_FOOT radii. */
function hillBump(x, z, h) {
  const dx = (x - h.x) / (h.ridge?.stretchX ?? 1);
  const dz = z - h.z;
  const d = Math.hypot(dx, dz) / (h.radius * HILL_FOOT);
  return d >= 1 ? 0 : h.height * 0.5 * (1 + Math.cos(Math.PI * d));
}

/** Seeded value-noise lattice: the same rolling ground on every load. */
function makeNoise(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const lattice = (ix, iz) => perm[(perm[ix & 255] + iz) & 255] / 255;
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  /** Value noise in [0, 1] at lattice spacing 1. */
  const value = (x, z) => {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = fade(x - ix);
    const fz = fade(z - iz);
    const a = lattice(ix, iz) + (lattice(ix + 1, iz) - lattice(ix, iz)) * fx;
    const b = lattice(ix, iz + 1) + (lattice(ix + 1, iz + 1) - lattice(ix, iz + 1)) * fx;
    return a + (b - a) * fz;
  };
  /** Three-octave fbm in [-1, 1] with the given base wavelength (metres). */
  return (x, z, wavelength) => {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    let f = 1 / wavelength;
    for (let o = 0; o < 3; o++) {
      sum += (value(x * f + 37.1 * o, z * f + 91.7 * o) * 2 - 1) * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  };
}

const groundNoise = makeNoise(11);

/**
 * How far (x, z) is into the sloped part of the terrain: 0 anywhere within the walkable
 * ground plus HILL_CLEARANCE, rising smoothly to 1 over BLEND_WIDTH beyond it.
 */
export function terrainBlend(x, z, walkable = walkableBounds()) {
  return smoothstep((rectGap(x, z, walkable) - HILL_CLEARANCE) / BLEND_WIDTH);
}

/**
 * Terrain height (metres, y) at world (x, z): the sum of the hills' cosine bumps plus
 * low fbm value noise (±NOISE_AMPLITUDE / 2), all faded to exactly 0 within the walkable
 * ground + HILL_CLEARANCE so the ring the player is clamped to stays flat, and so the
 * mount's wall footings never meet a slope. Pure: the same inputs give the same height,
 * which is what the tests and the collider rely on.
 *
 * @param {number} x   @param {number} z
 * @param {ReturnType<typeof hillPlacements>} hills
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }} [walkable]
 */
export function terrainHeight(x, z, hills, walkable = walkableBounds()) {
  const blend = terrainBlend(x, z, walkable);
  if (blend === 0) return 0;
  let h = groundNoise(x, z, NOISE_WAVELENGTH) * (NOISE_AMPLITUDE / 2);
  for (const hill of hills) h += hillBump(x, z, hill);
  return h * blend;
}

/** Half-length of the ridge along x, or the foot radius for a round hill. */
function footX(h) {
  return h.radius * HILL_FOOT * (h.ridge?.stretchX ?? 1);
}

/** How far out along either axis the hills' feet reach (metres from the origin). */
function hillReach(hills) {
  return Math.max(...hills.map((h) => Math.max(Math.abs(h.x) + footX(h), Math.abs(h.z) + h.radius * HILL_FOOT)));
}

/**
 * Side of the square terrain: it covers every hill's foot with GROUND_MARGIN to spare and
 * reaches at least FOG_END beyond the farthest walkable point, so its edge is always
 * fully fogged (and mostly behind the far plane) wherever the player stands.
 */
export function groundSize(hills, walkable = walkableBounds()) {
  const walkReach = Math.max(Math.abs(walkable.minX), walkable.maxX, Math.abs(walkable.minZ), walkable.maxZ);
  return 2 * Math.ceil(Math.max(hillReach(hills) + GROUND_MARGIN, walkReach + FOG_END));
}

/**
 * Grid lines along one axis, symmetric about 0: FINE_CELL apart out to `fineReach`
 * (the hills and the blend need the resolution), COARSE_CELL beyond (flat noise under fog).
 */
export function gridCoords(half, fineReach) {
  const fineN = Math.ceil(fineReach / FINE_CELL);
  const coarseN = Math.max(0, Math.ceil((half - fineN * FINE_CELL) / COARSE_CELL));
  const coarseCell = coarseN ? (half - fineN * FINE_CELL) / coarseN : 0;
  const out = [];
  for (let i = -coarseN; i < 0; i++) out.push(-fineN * FINE_CELL + i * coarseCell);
  for (let i = -fineN; i <= fineN; i++) out.push(i * FINE_CELL);
  for (let i = 1; i <= coarseN; i++) out.push(fineN * FINE_CELL + i * coarseCell);
  return out;
}

/** Colours the terrain is tinted with (multiplying the sand map): the flat ring, scrub, and the higher rocky ground. */
const SAND_TINT = new THREE.Color(1, 1, 1);
const SCRUB_TINT = new THREE.Color().setHSL(0.11, 0.3, 0.5);
const ROCK_TINT = new THREE.Color().setHSL(0.09, 0.18, 0.66);

// ============================================================================
// ENVIRONMENT BUILDER - Sky and the terrain (the ground and the distant hills)
// ============================================================================
export class EnvironmentBuilder extends BaseBuilder {
  build() {
    this.hills = hillPlacements();
    this.buildGround();
    this.buildSky();
  }

  /**
   * One heightfield mesh is both the ground and the distant hills: a grid displaced by
   * terrainHeight (flat on the walkable ring, hills and rolling noise beyond), smooth
   * vertex normals, UVs tiling the sand at TILE_METRES.ground, and vertex colours that
   * blend the ring's sand into scrub and rock so the hills do not read as tiled sand.
   * It is the floor the player walks on (userData.isFloor, this.floors): the player is
   * clamped to the flat ring by TempleGame, so the slopes are never walked, but the
   * collider (PlayerController.buildFloorCollider) merges every floor, hence the coarse
   * outer grid. noCull: scenery, never distance-culled.
   */
  buildGround() {
    const hills = this.hills ?? hillPlacements();
    const walkable = walkableBounds();
    const size = groundSize(hills, walkable);
    const coords = gridCoords(size / 2, hillReach(hills));
    const n = coords.length;

    const positions = new Float32Array(n * n * 3);
    const uvs = new Float32Array(n * n * 2);
    const colors = new Float32Array(n * n * 3);
    const tint = new THREE.Color();
    const reps = 1 / TILE_METRES.ground;
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const i = iz * n + ix;
        const x = coords[ix];
        const z = coords[iz];
        const y = terrainHeight(x, z, hills, walkable);
        positions.set([x, y, z], i * 3);
        uvs.set([x * reps, z * reps], i * 2);
        // Sand on the flat ring; scrub as the ground rises; rock on the upper slopes.
        // A little noise mottles the tint so the 8 m sand tile does not repeat on the hills.
        const rise = smoothstep(y / 8);
        const upper = smoothstep((y - 10) / 20);
        const mottle = 1 + 0.12 * groundNoise(x + 500, z - 500, 23);
        tint.copy(SAND_TINT).lerp(SCRUB_TINT, rise).lerp(ROCK_TINT, upper).multiplyScalar(rise > 0 ? mottle : 1);
        colors.set([tint.r, tint.g, tint.b], i * 3);
      }
    }
    const index = new Uint32Array((n - 1) * (n - 1) * 6);
    let k = 0;
    for (let iz = 0; iz < n - 1; iz++) {
      for (let ix = 0; ix < n - 1; ix++) {
        const a = iz * n + ix;
        const b = a + 1;
        const c = a + n;
        const d = c + 1;
        // Counter-clockwise seen from above (+y): the face normal points up.
        index.set([a, c, b, b, c, d], k);
        k += 6;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const mat = this.mat.ground.clone();
    mat.vertexColors = true;
    const ground = new THREE.Mesh(geo, mat);
    ground.name = 'ground';
    ground.receiveShadow = true;
    ground.userData = { isFloor: true, noCull: true };
    this.scene.add(ground);
    this.floors.push(ground);
  }

  buildSky() {
    // three's Preetham dome (Daylight.createSky), kept inside the far plane and re-centred
    // on the camera every frame (TempleGame), so no part of it is ever clipped when the
    // player stands far from the origin. The sun, the fog colour and the lights that follow
    // it are set by Daylight.set(timeOfDay) once the lights exist. The fog ends just short
    // of the far plane: the terrain's edge is beyond it from every walkable point, while the
    // hills 200-350 m out still read.
    this.scene.add(Daylight.createSky());
    this.scene.fog = new THREE.Fog(0xd8e2ec, FOG_NEAR, FOG_END);
  }
}
