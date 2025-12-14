import * as THREE from 'three';
import { BaseBuilder } from './BaseBuilder.js';

// ============================================================================
// EZRAS NASHIM BUILDER - Court of the Women
// ============================================================================
export class EzrasNashimBuilder extends BaseBuilder {
  build() {
    const floorY = 3.8;
    const harHaBayisY = 1.8;
    const wallH = 14;
    const courtWidth = 66;
    const courtDepth = 50;
    const southZ = 58;
    const northZ = 8;
    const centerZ = 33;

    this.buildMainFloor(floorY, harHaBayisY, courtWidth, courtDepth, centerZ);
    this.buildEntranceStairs(harHaBayisY, floorY, southZ);
    this.buildWalls(floorY, wallH, southZ, northZ);
    this.buildCornerChambers(floorY);
    this.buildColonnade(floorY, southZ);
    this.buildNicanorGate(floorY, wallH, northZ);
    this.build15Steps(floorY, northZ);
  }

  buildMainFloor(floorY, harHaBayisY, courtWidth, courtDepth, centerZ) {
    this.addFloor(0, floorY, centerZ, courtWidth, courtDepth, this.mat.mosaic, 'ezras-nashim');

    const floorFill = new THREE.Mesh(
      new THREE.BoxGeometry(courtWidth, floorY - harHaBayisY, courtDepth),
      this.mat.stone
    );
    floorFill.position.set(0, harHaBayisY + (floorY - harHaBayisY) / 2, centerZ);
    floorFill.receiveShadow = true;
    this.scene.add(floorFill);
  }

  buildEntranceStairs(harHaBayisY, floorY, southZ) {
    this.addStairs(0, harHaBayisY, southZ + 6, 16, floorY - harHaBayisY, 8, 12, this.mat.stone, 'north');
  }

  buildWalls(floorY, wallH, southZ, northZ) {
    const gateWidth = 12;
    const gateHeight = 8;

    // South wall with Beautiful Gate (Sha'ar HaYafeh)
    this.addWall(-24, floorY, southZ, 18, wallH, 2, this.mat.stonePolished);
    this.addWall(24, floorY, southZ, 18, wallH, 2, this.mat.stonePolished);
    // Lintel - non-colliding so it doesn't block passage
    this.addWallNonCollide(0, floorY + gateHeight, southZ, gateWidth, wallH - gateHeight, 2, this.mat.stonePolished);
    this.addGateFrame(0, floorY, southZ - 1, gateWidth, gateHeight, this.mat.copperP, 'Beautiful Gate');

    // Side walls with gates
    const sideGateZ = 33;
    // East wall
    this.addWall(33, floorY, 47, 2, wallH, 20, this.mat.stonePolished);
    this.addWall(33, floorY, 19, 2, wallH, 20, this.mat.stonePolished);
    this.addWallNonCollide(33, floorY + 5, sideGateZ, 2, wallH - 5, 6, this.mat.stonePolished); // Lintel
    // West wall
    this.addWall(-33, floorY, 47, 2, wallH, 20, this.mat.stonePolished);
    this.addWall(-33, floorY, 19, 2, wallH, 20, this.mat.stonePolished);
    this.addWallNonCollide(-33, floorY + 5, sideGateZ, 2, wallH - 5, 6, this.mat.stonePolished); // Lintel
  }

  buildCornerChambers(floorY) {
    const chambers = [
      { pos: [-27, 52], name: 'לשכת השמנים', nameEn: 'Chamber of Oils', doorDir: 'east' },
      { pos: [27, 52], name: 'לשכת המצורעים', nameEn: 'Chamber of Lepers', doorDir: 'west' },
      { pos: [-27, 14], name: 'לשכת הנזירים', nameEn: 'Chamber of Nazarites', doorDir: 'east' },
      { pos: [27, 14], name: 'לשכת העצים', nameEn: 'Chamber of Wood', doorDir: 'west' }
    ];

    const chamberSize = 10;
    const chamberHeight = 8;
    const doorWidth = 3;
    const doorHeight = 5;

    chambers.forEach(ch => {
      const cx = ch.pos[0];
      const cz = ch.pos[1];
      const half = chamberSize / 2;

      // Back wall
      if (ch.doorDir === 'east') {
        this.addWallNonCollide(cx - half, floorY, cz, 0.5, chamberHeight, chamberSize, this.mat.stonePolished);
      } else {
        this.addWallNonCollide(cx + half, floorY, cz, 0.5, chamberHeight, chamberSize, this.mat.stonePolished);
      }

      // Front wall with door opening
      if (ch.doorDir === 'east') {
        this.addWallNonCollide(cx + half, floorY, cz - half + (chamberSize - doorWidth) / 4, 0.5, chamberHeight, (chamberSize - doorWidth) / 2, this.mat.stonePolished);
        this.addWallNonCollide(cx + half, floorY, cz + half - (chamberSize - doorWidth) / 4, 0.5, chamberHeight, (chamberSize - doorWidth) / 2, this.mat.stonePolished);
        this.addWallNonCollide(cx + half, floorY + doorHeight, cz, 0.5, chamberHeight - doorHeight, doorWidth, this.mat.stonePolished);
      } else {
        this.addWallNonCollide(cx - half, floorY, cz - half + (chamberSize - doorWidth) / 4, 0.5, chamberHeight, (chamberSize - doorWidth) / 2, this.mat.stonePolished);
        this.addWallNonCollide(cx - half, floorY, cz + half - (chamberSize - doorWidth) / 4, 0.5, chamberHeight, (chamberSize - doorWidth) / 2, this.mat.stonePolished);
        this.addWallNonCollide(cx - half, floorY + doorHeight, cz, 0.5, chamberHeight - doorHeight, doorWidth, this.mat.stonePolished);
      }

      // North and South walls
      this.addWallNonCollide(cx, floorY, cz + half, chamberSize, chamberHeight, 0.5, this.mat.stonePolished);
      this.addWallNonCollide(cx, floorY, cz - half, chamberSize, chamberHeight, 0.5, this.mat.stonePolished);

      // Chamber floor
      const chamberFloor = new THREE.Mesh(
        new THREE.BoxGeometry(chamberSize, 0.3, chamberSize),
        this.mat.floor
      );
      chamberFloor.position.set(cx, floorY + 0.15, cz);
      chamberFloor.receiveShadow = true;
      chamberFloor.userData = { isFloor: true };
      this.scene.add(chamberFloor);
      this.floors.push(chamberFloor);

      // Roof
      const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 4, 4), this.mat.stone);
      roof.position.set(cx, floorY + chamberHeight + 2, cz);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      this.scene.add(roof);
    });
  }

  buildColonnade(floorY, southZ) {
    for (let x = -24; x <= 24; x += 6) {
      this.addColumn(x, floorY, southZ - 3, 0.5, 10, this.mat.marbleW);
    }
    for (let z = 16; z <= 50; z += 6) {
      this.addColumn(-30, floorY, z, 0.5, 10, this.mat.marbleW);
      this.addColumn(30, floorY, z, 0.5, 10, this.mat.marbleW);
    }
  }

  buildNicanorGate(floorY, wallH, northZ) {
    // Gate opening is 14 units wide (matching the gate frame)
    const gateWidth = 14;
    const gateHeight = 10;

    // Left wall section - from x=-33 to x=-7 (leaving opening from -7 to +7)
    this.addWall(-20, floorY, northZ, 26, wallH, 2, this.mat.stonePolished);
    // Right wall section - from x=+7 to x=+33
    this.addWall(20, floorY, northZ, 26, wallH, 2, this.mat.stonePolished);

    // Lintel above gate - NOT a collision wall (use addWallNonCollide)
    this.addWallNonCollide(0, floorY + gateHeight, northZ, gateWidth, wallH - gateHeight, 2, this.mat.stonePolished);

    // Decorative gate frame
    this.addGateFrame(0, floorY, northZ - 1, gateWidth, gateHeight, this.mat.copper, 'Nicanor Gate');
  }

  build15Steps(floorY, northZ) {
    // 15 Steps (Shir HaMaalos) from Ezras Nashim up to Azaras Yisrael
    const stepsRise = 3.0;
    for (let i = 0; i < 15; i++) {
      const stepY = floorY + ((i + 1) / 15) * stepsRise;
      const stepZ = northZ - 1 - i;
      const stepWidth = 44 - i * 0.5;
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(stepWidth, 0.2, 1),
        this.mat.marbleW
      );
      stepMesh.position.set(0, stepY, stepZ);
      stepMesh.receiveShadow = true;
      stepMesh.userData = { isFloor: true, isStep: true, stepNum: i + 1 };
      this.scene.add(stepMesh);
      this.floors.push(stepMesh);
    }
  }
}
