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

    // Slaughter rings (Taba'os) - larger and more visible
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xB87333, metalness: 0.8, roughness: 0.3 });
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        // Ring base plate embedded in floor
        const basePlate = new THREE.Mesh(
          new THREE.CylinderGeometry(0.25, 0.25, 0.05, 16),
          ringMat
        );
        basePlate.position.set(centerX - 6 + col * 2, kohanimY + 0.025, centerZ + 3 - row * 1.5);
        this.scene.add(basePlate);

        // The actual ring
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.18, 0.04, 12, 24),
          ringMat
        );
        ring.position.set(centerX - 6 + col * 2, kohanimY + 0.15, centerZ + 3 - row * 1.5);
        ring.rotation.x = Math.PI / 2;
        ring.castShadow = true;
        this.scene.add(ring);
      }
    }

    // Sacrifice animals (lambs) on some tables - representing the daily Tamid
    this.addSacrificeAnimal(centerX - 4, kohanimY + 0.5, centerZ);       // Table 1
    this.addSacrificeAnimal(centerX - 1.5, kohanimY + 0.5, centerZ - 2); // Table 6

    // Hanging pillars with hooks
    [centerX - 8, centerX + 8].forEach(px => {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 6, 8),
        this.mat.cedar
      );
      pillar.position.set(px, kohanimY + 3, centerZ + 2);
      pillar.castShadow = true;
      this.scene.add(pillar);

      // Horizontal bar
      const bar = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 0.25), this.mat.cedar);
      bar.position.set(px, kohanimY + 5.8, centerZ + 2);
      bar.castShadow = true;
      this.scene.add(bar);

      // Iron hooks on the bar
      const hookMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.4 });
      for (let h = -2; h <= 2; h++) {
        const hook = new THREE.Mesh(
          new THREE.TorusGeometry(0.12, 0.025, 8, 16, Math.PI),
          hookMat
        );
        hook.position.set(px + h * 1.2, kohanimY + 5.5, centerZ + 2);
        hook.rotation.z = Math.PI;
        this.scene.add(hook);
      }
    });
  }

  addSacrificeAnimal(x, y, z) {
    // Simple lamb/sheep representation
    const lambMat = new THREE.MeshStandardMaterial({ color: 0xF5F5DC, roughness: 0.9 });
    const lamb = new THREE.Group();

    // Body
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 12, 12),
      lambMat
    );
    body.scale.set(1.3, 0.9, 0.9);
    lamb.add(body);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 10),
      lambMat
    );
    head.position.set(0.4, 0.1, 0);
    lamb.add(head);

    // Ears
    [-0.12, 0.12].forEach(ez => {
      const ear = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 6),
        lambMat
      );
      ear.position.set(0.45, 0.2, ez);
      ear.scale.set(0.5, 1, 0.8);
      lamb.add(ear);
    });

    // Legs (folded, lying down)
    [[-0.2, -0.15], [-0.2, 0.15], [0.15, -0.15], [0.15, 0.15]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.04, 0.2, 8),
        lambMat
      );
      leg.position.set(lx, -0.2, lz);
      leg.rotation.z = Math.PI / 2;
      lamb.add(leg);
    });

    lamb.position.set(x, y + 0.15, z);
    lamb.rotation.y = Math.random() * Math.PI * 2;
    lamb.traverse(c => { if (c.isMesh) c.castShadow = true; });
    this.scene.add(lamb);
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
