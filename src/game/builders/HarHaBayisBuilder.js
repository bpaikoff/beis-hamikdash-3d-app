import * as THREE from 'three';
import { BaseBuilder } from './BaseBuilder.js';

// ============================================================================
// HAR HABAYIS BUILDER - Temple Mount platform and outer walls
// ============================================================================
export class HarHaBayisBuilder extends BaseBuilder {
  build() {
    this.buildPlatform();
    this.buildChuldahGateStairs();
    this.buildOuterWalls();
  }

  buildPlatform() {
    // Main platform - the Temple Mount floor
    this.addFloor(0, 1.8, 22, 140, 88, this.mat.floor, 'har-habayis');

    // Fill underneath the platform
    const platformFill = new THREE.Mesh(
      new THREE.BoxGeometry(140, 1.8, 88),
      this.mat.stone
    );
    platformFill.position.set(0, 0.9, 22);
    platformFill.receiveShadow = true;
    this.scene.add(platformFill);
  }

  buildChuldahGateStairs() {
    // Stairs from ground (y=0) up to Har HaBayis (y=1.8) through the Chuldah Gates
    // Left gate stairs (centered at x=-27)
    this.addStairs(-27, 0, 78, 12, 1.8, 12, 9, this.mat.stone, 'north');
    // Right gate stairs (centered at x=27)
    this.addStairs(27, 0, 78, 12, 1.8, 12, 9, this.mat.stone, 'north');
  }

  buildOuterWalls() {
    const wallH = 24;
    const wallThick = 5;
    const southZ = 68;
    const northZ = -22;
    const eastX = 72;
    const westX = -72;
    const gateWidth = 14;
    const gateHeight = 8;

    // === SOUTH WALL with two Chuldah Gate openings ===
    this.addWall(-53, 0, southZ, 38, wallH, wallThick, this.mat.stone);
    this.addWall(0, 0, southZ, 40, wallH, wallThick, this.mat.stone);
    this.addWall(53, 0, southZ, 38, wallH, wallThick, this.mat.stone);
    // Gate lintels
    this.addWall(-27, gateHeight, southZ, gateWidth, wallH - gateHeight, wallThick, this.mat.stone);
    this.addWall(27, gateHeight, southZ, gateWidth, wallH - gateHeight, wallThick, this.mat.stone);

    // === OTHER WALLS ===
    this.addWall(0, 0, northZ, 144, wallH, wallThick, this.mat.stone);
    this.addWall(eastX, 0, 23, wallThick, wallH, 90, this.mat.stone);
    this.addWall(westX, 0, 23, wallThick, wallH, 90, this.mat.stone);

    // === Crenellations ===
    for (let i = -68; i <= 68; i += 8) {
      if (Math.abs(i + 27) > gateWidth/2 && Math.abs(i - 27) > gateWidth/2) {
        this.addWall(i, wallH, southZ, 3, 3, wallThick + 0.5, this.mat.stone);
      }
      this.addWall(i, wallH, northZ, 3, 3, wallThick + 0.5, this.mat.stone);
    }
    for (let z = northZ + 5; z <= southZ - 5; z += 8) {
      this.addWall(eastX, wallH, z, wallThick + 0.5, 3, 3, this.mat.stone);
      this.addWall(westX, wallH, z, wallThick + 0.5, 3, 3, this.mat.stone);
    }

    // === Guard towers at corners ===
    [[westX, southZ], [eastX, southZ], [westX, northZ], [eastX, northZ]].forEach(([tx, tz]) => {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(10, wallH + 8, 10), this.mat.stone);
      tower.position.set(tx, (wallH + 8) / 2, tz);
      tower.castShadow = true;
      tower.receiveShadow = true;
      this.scene.add(tower);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 5, 4), this.mat.stonePolished);
      roof.position.set(tx, wallH + 8 + 2.5, tz);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      this.scene.add(roof);
    });
  }
}
