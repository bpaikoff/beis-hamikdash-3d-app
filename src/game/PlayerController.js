import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';

THREE.Mesh.prototype.raycast = acceleratedRaycast;

const _origin = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _sphere = new THREE.Sphere();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Merge every walkable mesh into one static collision mesh with a BVH, so the three
 * downward raycasts per frame cost O(log n) instead of a test against ~200 floors.
 * Only positions are kept; the meshes stay in the scene for rendering.
 */
function buildFloorCollider(floors) {
  const parts = [];
  for (const m of floors) {
    if (!m.geometry) continue;
    m.updateWorldMatrix(true, false);
    const g = m.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    g.applyMatrix4(m.matrixWorld);
    parts.push(g.index ? g.toNonIndexed() : g);
  }
  if (!parts.length) return null;
  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  merged.boundsTree = new MeshBVH(merged);
  const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ visible: false }));
  mesh.name = 'floorCollider';
  return mesh;
}

// ============================================================================
// PLAYER CONTROLLER
// ============================================================================
export class PlayerController {
  /**
   * @param {THREE.Camera} camera
   * @param {THREE.Mesh[]} floors   walkable meshes (userData.isFloor)
   * @param {THREE.Mesh[]} walls    blocking meshes (userData.isWall)
   * @param {{bounds?: {minX,maxX,minZ,maxZ}}} [opts]
   */
  constructor(camera, floors, walls, opts = {}) {
    this.camera = camera;
    this.collider = buildFloorCollider(floors);
    this.floors = this.collider ? [this.collider] : floors;
    // World-space boxes computed once; the walls never move.
    this.wallBoxes = walls
      .filter((w) => w.userData?.isWall)
      .map((w) => {
        w.updateWorldMatrix(true, false);
        return new THREE.Box3().setFromObject(w);
      });
    this.bounds = opts.bounds ?? { minX: -100, maxX: 100, minZ: -95, maxZ: 120 };
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.moveF = false;
    this.moveB = false;
    this.moveL = false;
    this.moveR = false;
    this.isRun = false;
    this.isLocked = false;
    this.groundY = 0;
    this.verticalVelocity = 0;
    this.isJumping = false;
    this.debugMode = false; // ghost: free flight, no collisions
    this.raycaster = new THREE.Raycaster();
    this.raycaster.firstHitOnly = true;
  }

  toggleDebug(callback) {
    this.debugMode = !this.debugMode;
    if (callback) callback(this.debugMode);
  }

  jump() {
    if (!this.isJumping && this.isLocked && !this.debugMode) {
      this.verticalVelocity = 7;
      this.isJumping = true;
    }
  }

  /** Height of the highest walkable surface under (x, z), or 0 if there is none. */
  getFloorHeight(x, z, fromY = 100) {
    _origin.set(x, fromY, z);
    this.raycaster.set(_origin, _down);
    this.raycaster.far = fromY + 100;
    const hits = this.raycaster.intersectObjects(this.floors, false);
    if (!hits.length) return 0;
    if (this.collider) return hits[0].point.y; // BVH with firstHitOnly returns the nearest = highest
    let highest = -Infinity;
    for (const hit of hits) if (hit.point.y > highest && hit.point.y < fromY) highest = hit.point.y;
    return highest > -Infinity ? highest : 0;
  }

  collides(pos) {
    _sphere.set(pos, CONFIG.PLAYER_RADIUS);
    for (const box of this.wallBoxes) if (box.intersectsSphere(_sphere)) return true;
    return false;
  }

  update(delta) {
    if (!this.isLocked) return;
    const speed = (this.isRun ? CONFIG.RUN_SPEED : CONFIG.MOVE_SPEED) * delta;
    const cam = this.camera;

    if (this.debugMode) {
      cam.getWorldDirection(_forward);
      _right.crossVectors(_forward, UP).normalize();
      _move.set(0, 0, 0);
      if (this.moveF) _move.addScaledVector(_forward, speed * 2);
      if (this.moveB) _move.addScaledVector(_forward, -speed * 2);
      if (this.moveR) _move.addScaledVector(_right, speed * 2);
      if (this.moveL) _move.addScaledVector(_right, -speed * 2);
      cam.position.add(_move);
      return;
    }

    const dx = Number(this.moveR) - Number(this.moveL);
    const dz = Number(this.moveF) - Number(this.moveB);
    const len = Math.hypot(dx, dz) || 1;
    cam.getWorldDirection(_forward);
    _forward.y = 0;
    _forward.normalize();
    _right.crossVectors(_forward, UP);
    _move.set(0, 0, 0).addScaledVector(_forward, (dz / len) * speed).addScaledVector(_right, (dx / len) * speed);

    // Horizontal move with step climbing, resolved per axis so walls are slid along, not stuck to.
    const currentFloorY = this.getFloorHeight(cam.position.x, cam.position.z);
    const feetY = cam.position.y - CONFIG.PLAYER_HEIGHT;
    for (const axis of ['x', 'z']) {
      if (_move[axis] === 0) continue;
      const next = cam.position.clone();
      next[axis] += _move[axis];
      const nextFloorY = this.getFloorHeight(next.x, next.z, feetY + CONFIG.STEP_HEIGHT + 1);
      const rise = nextFloorY - currentFloorY;
      if (rise > CONFIG.STEP_HEIGHT && !this.isJumping) continue;
      if (this.collides(next)) continue;
      cam.position[axis] = next[axis];
    }

    // Vertical: gravity, landing, and stepping up onto the surface we just walked onto.
    this.verticalVelocity -= 20 * delta;
    const floorY = this.getFloorHeight(cam.position.x, cam.position.z, feetY + CONFIG.STEP_HEIGHT + 1);
    const newFeet = feetY + this.verticalVelocity * delta;
    if (newFeet <= floorY) {
      cam.position.y = floorY + CONFIG.PLAYER_HEIGHT;
      this.verticalVelocity = 0;
      this.isJumping = false;
    } else {
      cam.position.y = newFeet + CONFIG.PLAYER_HEIGHT;
    }
    this.groundY = floorY;

    const b = this.bounds;
    cam.position.x = Math.max(b.minX, Math.min(b.maxX, cam.position.x));
    cam.position.z = Math.max(b.minZ, Math.min(b.maxZ, cam.position.z));
  }

  onMouseMove(e) {
    if (!this.isLocked) return;
    this.look(e.movementX || 0, e.movementY || 0);
  }

  /** Rotate the view by pixel deltas (mouse or touch drag). */
  look(dx, dy) {
    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= dx * CONFIG.LOOK_SPEED;
    this.euler.x -= dy * CONFIG.LOOK_SPEED;
    this.euler.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  }

  getElevation() {
    return this.groundY.toFixed(1);
  }
}
