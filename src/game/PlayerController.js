import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';

THREE.Mesh.prototype.raycast = acceleratedRaycast;

const _origin = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);
const _upRay = new THREE.Vector3(0, 1, 0);
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _body = new THREE.Box3();
const UP = new THREE.Vector3(0, 1, 0);
/** Hits closer together than this along a probe are treated as the same surface (metres). */
const COPLANAR = 1e-3;

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
  // DoubleSide so a probe that starts inside a solid hits its underside (a back face) and
  // reports "inside" instead of seeing through to the floor below.
  const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
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
    // HUD: analog input from the touch joystick ({x: strafe right, y: forward}, -1..1);
    // touchActive lets the controller move without pointer lock.
    this.moveVec = { x: 0, y: 0 };
    this.touchActive = false;
    this.groundY = 0;
    this.verticalVelocity = 0;
    this.isJumping = false;
    this.debugMode = false; // ghost: free flight, no collisions
    this.onGround = false;
    this.raycaster = new THREE.Raycaster();
    // All hits along the ray, nearest first: insideSolid() needs the coplanar ones.
    this.raycaster.firstHitOnly = false;
  }

  toggleDebug(callback) {
    this.debugMode = !this.debugMode;
    if (callback) callback(this.debugMode);
  }

  jump() {
    if (!this.isJumping && (this.isLocked || this.touchActive) && !this.debugMode) {
      this.verticalVelocity = 7;
      this.isJumping = true;
    }
  }

  /**
   * Cast straight down from (x, fromY, z). Returns the first surface hit and whether the
   * probe started inside a solid (see insideSolid). Probing from just above step height
   * catches walking into a block the player cannot climb; probing from above head height
   * finds the floor while ignoring balconies overhead.
   */
  probe(x, z, fromY) {
    _origin.set(x, fromY, z);
    this.raycaster.set(_origin, _down);
    this.raycaster.far = fromY + 100;
    const hits = this.raycaster.intersectObjects(this.floors, false);
    if (!hits.length) return { y: 0, inside: false };
    if (this.collider) return { y: hits[0].point.y, inside: this.insideSolid(x, fromY, z) };
    let highest = -Infinity;
    for (const hit of hits) if (hit.point.y > highest && hit.point.y < fromY) highest = hit.point.y;
    return { y: highest > -Infinity ? highest : 0, inside: false };
  }

  /**
   * Is the point (x, y, z) inside a walkable mass? A ray is cast upward through every
   * face above the point. Every mass is a closed body, so along the ray each face is an
   * entry (its normal faces down, toward us) or an exit (normal up); from a free point
   * entries and exits pair up, while from inside a body we leave it without having
   * entered, and the running count of bodies we are in goes negative. The whole ray is
   * walked because bodies overlap (the kevesh slab lies over its wedge). Hits within
   * COPLANAR of each other are one event with its exits counted first (a tier standing
   * on another shares a plane with it). Looking up rather than down keeps the answer
   * right for a body whose base is sunk below the floor it stands on.
   */
  insideSolid(x, y, z) {
    if (!this.collider) return false;
    _origin.set(x, y, z);
    this.raycaster.set(_origin, _upRay);
    this.raycaster.far = 400;
    const hits = this.raycaster.intersectObjects(this.floors, false);
    let depth = 0;
    for (let i = 0; i < hits.length; ) {
      const limit = hits[i].distance + COPLANAR;
      let exits = 0;
      let entries = 0;
      for (; i < hits.length && hits[i].distance <= limit; i++) {
        const n = hits[i].face?.normal;
        if (n && n.y > 0) exits++;
        else entries++;
      }
      if (depth < exits) return true;
      depth += entries - exits;
    }
    return false;
  }

  /** Height of the highest walkable surface under (x, z), or 0 if there is none. */
  getFloorHeight(x, z, fromY = 100) {
    return this.probe(x, z, fromY).y;
  }

  /**
   * Floor under the feet. Probed from just above step height so a slab overhead (the
   * kevesh over the sovev ledge, a balcony) is not taken for the ground; if that probe
   * starts inside a solid (the feet are embedded, e.g. after a teleport) the top of the
   * solid is found from above the head instead.
   */
  floorUnder(x, z, feetY) {
    let p = this.probe(x, z, feetY + CONFIG.STEP_HEIGHT + 0.05);
    if (p.inside) p = this.probe(x, z, feetY + CONFIG.PLAYER_HEIGHT + 0.3);
    return p;
  }

  /**
   * Does the player's body at head position `pos` overlap a wall box? The body is a
   * PLAYER_RADIUS-wide column from just above the feet to the head, so a knee-high
   * vessel blocks as well as a wall.
   */
  collides(pos) {
    const r = CONFIG.PLAYER_RADIUS;
    _body.min.set(pos.x - r, pos.y - CONFIG.PLAYER_HEIGHT + 0.1, pos.z - r);
    _body.max.set(pos.x + r, pos.y, pos.z + r);
    for (const box of this.wallBoxes) if (box.intersectsBox(_body)) return true;
    return false;
  }

  update(delta) {
    if (!this.isLocked && !this.touchActive) return;
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
      _move.addScaledVector(_forward, this.moveVec.y * speed * 2).addScaledVector(_right, this.moveVec.x * speed * 2); // HUD: joystick
      cam.position.add(_move);
      return;
    }

    const dx = Number(this.moveR) - Number(this.moveL) + this.moveVec.x; // HUD: joystick
    const dz = Number(this.moveF) - Number(this.moveB) + this.moveVec.y; // HUD: joystick
    const len = Math.max(1, Math.hypot(dx, dz)); // clamp to unit speed; a half-pushed stick walks slower
    cam.getWorldDirection(_forward);
    _forward.y = 0;
    _forward.normalize();
    _right.crossVectors(_forward, UP);
    _move.set(0, 0, 0).addScaledVector(_forward, (dz / len) * speed).addScaledVector(_right, (dx / len) * speed);

    // Horizontal move with step climbing, resolved per axis so walls are slid along, not stuck to.
    const feetY = cam.position.y - CONFIG.PLAYER_HEIGHT;
    for (const axis of ['x', 'z']) {
      if (_move[axis] === 0) continue;
      const next = cam.position.clone();
      next[axis] += _move[axis];
      // Probe from just above step height: inside a solid, or a surface higher than a step,
      // means the way is blocked.
      const p = this.probe(next.x, next.z, feetY + CONFIG.STEP_HEIGHT + 0.05);
      if (p.inside) continue;
      if (p.y - feetY > CONFIG.STEP_HEIGHT && !this.isJumping) continue;
      if (this.collides(next)) continue;
      cam.position[axis] = next[axis];
    }

    // Vertical: gravity, landing, and stepping up onto the surface we just walked onto.
    // While grounded, a floor within a step below the feet is snapped to (walking down
    // stairs or a ramp stays glued to the surface instead of bouncing); a longer drop
    // falls under gravity.
    this.verticalVelocity -= 20 * delta;
    const floorY = this.floorUnder(cam.position.x, cam.position.z, feetY).y;
    const newFeet = feetY + this.verticalVelocity * delta;
    const stepDown = this.onGround && !this.isJumping && feetY - floorY <= CONFIG.STEP_HEIGHT;
    if (newFeet <= floorY || stepDown) {
      cam.position.y = floorY + CONFIG.PLAYER_HEIGHT;
      this.verticalVelocity = 0;
      this.isJumping = false;
      this.onGround = true;
    } else {
      cam.position.y = newFeet + CONFIG.PLAYER_HEIGHT;
      this.onGround = false;
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
