import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { BaseBuilder, TILE_METRES } from './BaseBuilder.js';
import { mulberry32 } from '../random.js';
import { Daylight } from '../Daylight.js';
import { walkableBounds } from '../../content/index.js';

/** A hill's cone base stays at least this far outside the ground the player can reach (metres). */
const HILL_CLEARANCE = 15;
/** The ground plane runs this far beyond the farthest hill's base (metres); the fog hides its edge. */
const GROUND_MARGIN = 60;

/** Gap between (x, z) and an axis-aligned rectangle; 0 inside it. */
function rectGap(x, z, r) {
  const dx = Math.max(r.minX - x, 0, x - r.maxX);
  const dz = Math.max(r.minZ - z, 0, z - r.maxZ);
  return Math.hypot(dx, dz);
}

/**
 * The eight distant hills, the same on every load: one per compass octant, nominally
 * 180-220 m from the origin, each pushed further out along its bearing until its cone
 * base clears `walkable` (the union of the area bounds, TempleGame's player clamp) by
 * HILL_CLEARANCE. The mount is 250 m square and the `outside` ring reaches 20 m past
 * its wall, so the nominal distances would stand hills on the wall's corners.
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
    hills.push({ x: Math.cos(angle) * dist, z: Math.sin(angle) * dist, dist, height, radius, rotation });
  }
  return hills;
}

/** Side of the square ground plane that covers every hill's base with GROUND_MARGIN to spare. */
export function groundSize(hills) {
  return 2 * Math.ceil(Math.max(...hills.map((h) => h.dist + h.radius)) + GROUND_MARGIN);
}

// ============================================================================
// ENVIRONMENT BUILDER - Sky, ground, and distant scenery
// ============================================================================
export class EnvironmentBuilder extends BaseBuilder {
  build() {
    this.hills = hillPlacements();
    this.buildGround();
    this.buildSky();
    this.buildDistantHills();
  }

  buildGround() {
    // One quad: the 50 x 50 grid added 5,000 triangles to every frame (and to the
    // collision BVH) for a plane that is flat anyway. UVs tile at TILE_METRES.ground.
    // Sized to run under every hill: the far plane (CONFIG.RENDER_DISTANCE) and the fog
    // end before its edge.
    const size = groundSize(this.hills ?? hillPlacements());
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    const uv = geo.attributes.uv;
    const reps = size / TILE_METRES.ground;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * reps, uv.getY(i) * reps);
    const ground = new THREE.Mesh(geo, this.mat.ground);
    ground.name = 'ground';
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData = { isFloor: true };
    this.scene.add(ground);
    this.floors.push(ground);
  }

  buildSky() {
    // three's Preetham dome (Daylight.createSky), kept inside the far plane and re-centred
    // on the camera every frame (TempleGame), so no part of it is ever clipped when the
    // player stands far from the origin. The sun, the fog colour and the lights that follow
    // it are set by Daylight.set(timeOfDay) once the lights exist.
    this.scene.add(Daylight.createSky());
    this.scene.fog = new THREE.Fog(0xd8e2ec, 140, CONFIG.RENDER_DISTANCE * 0.88);
  }

  buildDistantHills() {
    const hillMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.1, 0.2, 0.55), roughness: 0.9 });
    for (const h of this.hills ?? hillPlacements()) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(h.radius, h.height, 6), hillMat);
      m.name = 'hill';
      m.position.set(h.x, h.height / 2 - 5, h.z); // the base 5 m under the ground plane
      m.rotation.y = h.rotation;
      m.userData.noCull = true; // scenery, not detail
      this.scene.add(m);
    }
  }
}
