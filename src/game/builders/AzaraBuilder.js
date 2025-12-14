import * as THREE from 'three';
import { BaseBuilder } from './BaseBuilder.js';

// ============================================================================
// AZARA BUILDER - Azaras Yisrael, Duchan, and Azaras Kohanim
// ============================================================================
export class AzaraBuilder extends BaseBuilder {
  build() {
    // Floor heights
    const yisraelY = 6.8;
    const duchanY = 7.0;
    const kohanimY = 7.3;
    const baseY = 3.8;
    const wallH = 14;
    const innerWidth = 52;

    this.buildAzarasYisrael(yisraelY, baseY, innerWidth);
    this.buildDuchan(yisraelY, duchanY, innerWidth);
    this.buildAzarasKohanim(duchanY, kohanimY, baseY, innerWidth);
    this.buildSideWalls(baseY, wallH, kohanimY);
    this.buildSlaughterArea(kohanimY);
    this.buildChambers(kohanimY);
  }

  buildAzarasYisrael(yisraelY, baseY, innerWidth) {
    // z=-7 to z=-11 (4 units deep)
    this.addFloor(0, yisraelY, -9, innerWidth, 4, this.mat.marbleW, 'azaras-yisrael');
    this.addSolidFill(0, baseY, yisraelY, -9, innerWidth, 4);
  }

  buildDuchan(yisraelY, duchanY, innerWidth) {
    // z=-11 to z=-13 (2 units deep)
    this.addFloor(0, duchanY, -12, innerWidth - 6, 2, this.mat.marbleR, 'duchan');
    this.addStepRow(0, yisraelY, -11, innerWidth - 6, duchanY - yisraelY);
  }

  buildAzarasKohanim(duchanY, kohanimY, baseY, innerWidth) {
    // z=-13 to z=-45 (32 units deep)
    const kohanimDepth = 32;
    const kohanimCenterZ = -29; // center of -13 to -45
    this.addFloor(0, kohanimY, kohanimCenterZ, innerWidth, kohanimDepth, this.mat.floor, 'azaras-kohanim');
    this.addSolidFill(0, baseY, kohanimY, kohanimCenterZ, innerWidth, kohanimDepth);
    this.addStepRow(0, duchanY, -13, innerWidth - 6, kohanimY - duchanY);
  }

  buildSideWalls(baseY, wallH, kohanimY) {
    // FIXED: Side walls now stop at z=-43 to leave opening for the 12 steps to Ulam
    // The 12 steps are 12 units wide (x=-6 to x=6), so we need to leave that opening
    const wallStartZ = -7;
    const wallEndZ = -43; // Changed from -45 to leave opening for stairs

    // West wall with gates
    this.buildSideWallWithGates(-26, baseY, wallH, wallStartZ, wallEndZ, [
      { z: -18, name: 'שער הדלק', nameEn: 'Kindling Gate' },
      { z: -29, name: 'שער המים', nameEn: 'Water Gate' },
      { z: -38, name: 'שער הבכורות', nameEn: 'Gate of Firstlings' }
    ], kohanimY);

    // East wall with gates
    this.buildSideWallWithGates(26, baseY, wallH, wallStartZ, wallEndZ, [
      { z: -18, name: 'שער בית המוקד', nameEn: 'Hearth Gate' },
      { z: -29, name: 'שער הניצוץ', nameEn: 'Flame Gate' },
      { z: -38, name: 'שער הקרבן', nameEn: 'Sacrifice Gate' }
    ], kohanimY);
  }

  buildSideWallWithGates(x, baseY, wallH, startZ, endZ, gates, floorY) {
    const gateWidth = 5;
    const gateHeight = 6;

    gates.sort((a, b) => b.z - a.z);

    let currentZ = startZ;
    gates.forEach((gate) => {
      const segmentStart = currentZ;
      const segmentEnd = gate.z + gateWidth/2;

      if (segmentStart > segmentEnd) {
        const segDepth = segmentStart - segmentEnd;
        const segCenterZ = (segmentStart + segmentEnd) / 2;
        this.addWall(x, baseY, segCenterZ, 2, wallH, segDepth, this.mat.stonePolished);
      }

      // Gate lintel - non-colliding
      this.addWallNonCollide(x, baseY + gateHeight, gate.z, 2, wallH - gateHeight, gateWidth, this.mat.stonePolished);
      this.addGateFrame(x, floorY, gate.z, gateWidth, gateHeight, this.mat.copperP, gate.nameEn);

      currentZ = gate.z - gateWidth/2;
    });

    // Final wall segment
    if (currentZ > endZ) {
      const segDepth = currentZ - endZ;
      const segCenterZ = (currentZ + endZ) / 2;
      this.addWall(x, baseY, segCenterZ, 2, wallH, segDepth, this.mat.stonePolished);
    }
  }

  buildSlaughterArea(kohanimY) {
    const centerX = 14;
    const centerZ = -38;

    // 8 marble slaughter tables
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        const table = new THREE.Mesh(
          new THREE.BoxGeometry(1.8, 0.5, 1.2),
          this.mat.marbleW
        );
        table.position.set(centerX - 4 + col * 2.5, kohanimY + 0.25, centerZ - row * 2);
        table.castShadow = true;
        table.receiveShadow = true;
        this.scene.add(table);
      }
    }

    // Slaughter rings
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.12, 0.025, 8, 16),
          this.mat.copper
        );
        ring.position.set(centerX - 6 + col * 2, kohanimY + 0.01, centerZ + 3 - row * 1.2);
        ring.rotation.x = Math.PI / 2;
        this.scene.add(ring);
      }
    }

    // Hanging pillars
    [centerX - 8, centerX + 8].forEach(px => {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 6, 8),
        this.mat.cedar
      );
      pillar.position.set(px, kohanimY + 3, centerZ + 2);
      pillar.castShadow = true;
      this.scene.add(pillar);

      const bar = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 0.2), this.mat.cedar);
      bar.position.set(px, kohanimY + 5.5, centerZ + 2);
      this.scene.add(bar);
    });
  }

  buildChambers(kohanimY) {
    // Lishkas HaGazis (Chamber of Hewn Stone) - Sanhedrin
    this.addChamberBuilding(-21, kohanimY, -35, 8, 6, 10, 'לשכת הגזית', 'Chamber of Hewn Stone');
    // Beis HaMoked (Chamber of the Hearth)
    this.addChamberBuilding(21, kohanimY, -20, 8, 6, 8, 'בית המוקד', 'Chamber of the Hearth');
  }

  addChamberBuilding(x, baseY, z, w, h, d, nameHeb, nameEn) {
    const chamber = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      this.mat.stonePolished
    );
    chamber.position.set(x, baseY + h/2, z);
    chamber.castShadow = true;
    chamber.receiveShadow = true;
    chamber.userData = { name: nameHeb, nameEn: nameEn };
    this.scene.add(chamber);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.5, 0.5, d + 0.5),
      this.mat.stone
    );
    roof.position.set(x, baseY + h + 0.25, z);
    this.scene.add(roof);
  }
}
