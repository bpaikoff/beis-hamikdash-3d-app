import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { BaseBuilder, TILE_METRES } from './BaseBuilder.js';
import { mulberry32 } from '../random.js';
import { Daylight } from '../Daylight.js';

// ============================================================================
// ENVIRONMENT BUILDER - Sky, ground, and distant scenery
// ============================================================================
export class EnvironmentBuilder extends BaseBuilder {
  build() {
    this.buildGround();
    this.buildSky();
    this.buildDistantHills();
  }

  buildGround() {
    // One quad: the 50 x 50 grid added 5,000 triangles to every frame (and to the
    // collision BVH) for a plane that is flat anyway. UVs tile at TILE_METRES.ground.
    const size = 500;
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
    const rand = mulberry32(7); // same hills on every load
    const hillMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.1, 0.2, 0.55), roughness: 0.9 });
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = 180 + rand() * 40;
      const height = 15 + rand() * 25;
      const m = new THREE.Mesh(new THREE.ConeGeometry(30 + rand() * 20, height, 6), hillMat);
      m.position.set(Math.cos(angle) * dist, height / 2 - 5, Math.sin(angle) * dist);
      m.rotation.y = rand() * Math.PI;
      m.userData.noCull = true; // scenery, not detail
      this.scene.add(m);
    }
  }
}
