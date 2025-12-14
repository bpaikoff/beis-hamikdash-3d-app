import * as THREE from 'three';
import { CONFIG } from '../config.js';

// ============================================================================
// PLAYER CONTROLLER
// ============================================================================
export class PlayerController {
  constructor(camera, floors, walls) {
    this.camera = camera;
    this.floors = floors;
    this.walls = walls;
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
    this.debugMode = false; // Noclip mode
    this.raycaster = new THREE.Raycaster();
    this.downVec = new THREE.Vector3(0, -1, 0);
  }

  toggleDebug(callback) {
    this.debugMode = !this.debugMode;
    console.log('Debug mode:', this.debugMode ? 'ON (noclip)' : 'OFF');
    if (callback) callback(this.debugMode);
  }

  jump() {
    if (!this.isJumping && this.isLocked && !this.debugMode) {
      this.verticalVelocity = 7;
      this.isJumping = true;
    }
  }

  getFloorHeight(x, z) {
    this.raycaster.set(new THREE.Vector3(x, 100, z), this.downVec);
    this.raycaster.far = 200;
    const hits = this.raycaster.intersectObjects(this.floors, false);
    let highest = -Infinity;
    for (const hit of hits) {
      if (hit.point.y > highest && hit.point.y < 100) highest = hit.point.y;
    }
    return highest > -Infinity ? highest : 0;
  }

  checkWallCollision(newPos) {
    for (const wall of this.walls) {
      if (!wall.userData?.isWall) continue;
      const box = new THREE.Box3().setFromObject(wall);
      const sphere = new THREE.Sphere(newPos, CONFIG.PLAYER_RADIUS);
      if (box.intersectsSphere(sphere)) return true;
    }
    return false;
  }

  update(delta) {
    if (!this.isLocked) return;
    const speed = (this.isRun ? CONFIG.RUN_SPEED : CONFIG.MOVE_SPEED) * delta;

    // Debug mode: free flight, no collisions
    if (this.debugMode) {
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      const move = new THREE.Vector3();
      if (this.moveF) move.add(forward.clone().multiplyScalar(speed * 2));
      if (this.moveB) move.add(forward.clone().multiplyScalar(-speed * 2));
      if (this.moveR) move.add(right.clone().multiplyScalar(speed * 2));
      if (this.moveL) move.add(right.clone().multiplyScalar(-speed * 2));
      this.camera.position.add(move);
      return;
    }

    const dir = new THREE.Vector3(Number(this.moveR) - Number(this.moveL), 0, Number(this.moveF) - Number(this.moveB)).normalize();
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
    const move = new THREE.Vector3().addScaledVector(forward, dir.z * speed).addScaledVector(right, dir.x * speed);
    const newPos = this.camera.position.clone().add(move);
    const currentFloorY = this.getFloorHeight(this.camera.position.x, this.camera.position.z);
    const newFloorY = this.getFloorHeight(newPos.x, newPos.z);
    const heightDiff = newFloorY - currentFloorY;

    // Horizontal movement with step climbing
    if (Math.abs(heightDiff) <= CONFIG.STEP_HEIGHT || heightDiff < 0 || this.isJumping) {
      if (!this.checkWallCollision(newPos)) {
        this.camera.position.x = newPos.x;
        this.camera.position.z = newPos.z;
        this.groundY = newFloorY;
      }
    }

    // Vertical movement (jumping/gravity)
    const gravity = 20;
    this.verticalVelocity -= gravity * delta;

    const currentY = this.camera.position.y - CONFIG.PLAYER_HEIGHT;
    const newY = currentY + this.verticalVelocity * delta;
    const floorY = this.getFloorHeight(this.camera.position.x, this.camera.position.z);

    if (newY <= floorY) {
      // Hit the ground
      this.camera.position.y = floorY + CONFIG.PLAYER_HEIGHT;
      this.verticalVelocity = 0;
      this.isJumping = false;
      this.groundY = floorY;
    } else {
      this.camera.position.y = newY + CONFIG.PLAYER_HEIGHT;
    }

    // Boundaries
    this.camera.position.x = Math.max(-100, Math.min(100, this.camera.position.x));
    this.camera.position.z = Math.max(-95, Math.min(120, this.camera.position.z));
  }

  onMouseMove(e) {
    if (!this.isLocked) return;
    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= (e.movementX || 0) * CONFIG.LOOK_SPEED;
    this.euler.x -= (e.movementY || 0) * CONFIG.LOOK_SPEED;
    this.euler.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  }

  getElevation() {
    return this.groundY.toFixed(1);
  }
}
