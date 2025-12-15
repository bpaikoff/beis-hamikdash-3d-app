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
    const harHaBayisY = 1.8;

    // West wall with gates
    const westGates = [
      { z: -18, name: 'שער הדלק', nameEn: 'Kindling Gate' },
      { z: -29, name: 'שער המים', nameEn: 'Water Gate' },
      { z: -38, name: 'שער הבכורות', nameEn: 'Gate of Firstlings' }
    ];
    this.buildSideWallWithGates(-26, baseY, wallH, wallStartZ, wallEndZ, westGates, kohanimY);

    // Add stairs to west gates
    westGates.forEach(gate => {
      this.addGateStairs(-26, harHaBayisY, kohanimY, gate.z, -1); // -1 for west (stairs go outward)
    });

    // East wall with gates
    const eastGates = [
      { z: -18, name: 'שער בית המוקד', nameEn: 'Hearth Gate' },
      { z: -29, name: 'שער הניצוץ', nameEn: 'Flame Gate' },
      { z: -38, name: 'שער הקרבן', nameEn: 'Sacrifice Gate' }
    ];
    this.buildSideWallWithGates(26, baseY, wallH, wallStartZ, wallEndZ, eastGates, kohanimY);

    // Add stairs to east gates
    eastGates.forEach(gate => {
      this.addGateStairs(26, harHaBayisY, kohanimY, gate.z, 1); // +1 for east (stairs go outward)
    });
  }

  addGateStairs(wallX, bottomY, topY, gateZ, direction) {
    // Create stairs from Har HaBayis level up to gate/Azara level
    // Stairs extend OUTWARD from the wall, with bottom step furthest from wall
    // and top step at the wall/gate level
    const stairWidth = 5;
    const stairDepth = 10; // How far stairs extend from wall
    const heightDiff = topY - bottomY;
    const numSteps = 12;
    const stepRise = heightDiff / numSteps;
    const stepRun = stairDepth / numSteps;

    for (let i = 0; i < numSteps; i++) {
      // Step 0 is at bottom (furthest from wall), step 11 is at top (closest to wall)
      const stepY = bottomY + (i + 1) * stepRise;
      // Stairs go from far (stairDepth away) toward the wall
      const stepX = wallX + direction * (stairDepth - i * stepRun);

      const step = new THREE.Mesh(
        new THREE.BoxGeometry(stepRun + 0.1, 0.3, stairWidth),
        this.mat.stone
      );
      step.position.set(stepX, stepY - 0.15, gateZ);
      step.receiveShadow = true;
      step.userData = { isFloor: true, isStep: true };
      this.scene.add(step);
      this.floors.push(step);
    }

    // Landing platform at gate level - exactly at topY
    const landing = new THREE.Mesh(
      new THREE.BoxGeometry(3, 0.3, stairWidth + 2),
      this.mat.stone
    );
    landing.position.set(wallX + direction * 1.5, topY, gateZ);
    landing.receiveShadow = true;
    landing.userData = { isFloor: true };
    this.scene.add(landing);
    this.floors.push(landing);
  }

  buildSideWallWithGates(x, baseY, wallH, startZ, endZ, gates, floorY) {
    const gateWidth = 7;
    const gateHeight = 8;

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
    this.buildLishkasHagazis(-21, kohanimY, -35);

    // Beis HaMoked (Chamber of the Hearth)
    this.buildBeisHamoked(21, kohanimY, -20);
  }

  buildLishkasHagazis(x, baseY, z) {
    // Chamber of Hewn Stone - where the Sanhedrin of 71 sat
    const w = 10, h = 6, d = 12;

    // Building shell (walls)
    this.addChamberWithInterior(x, baseY, z, w, h, d, 'לשכת הגזית', 'Chamber of Hewn Stone');

    // Semi-circular seating arrangement for the Sanhedrin (71 judges)
    // They sat in a semi-circle facing the entrance
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xD4A574, roughness: 0.8 }); // Same skin tone as Kohanim
    const robeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a4a, roughness: 0.8 }); // Dark blue robes

    // Create seated judges in a semi-circle
    const radius = 4;
    const numJudges = 12; // Representative number
    for (let i = 0; i < numJudges; i++) {
      const angle = (Math.PI / (numJudges - 1)) * i - Math.PI / 2;
      const jx = x + Math.cos(angle) * radius;
      const jz = z + Math.sin(angle) * (radius * 0.6);
      this.addSeatedFigure(jx, baseY, jz, robeMat, skinMat, Math.PI - angle);
    }

    // Stone benches (the seats)
    const benchMat = this.mat.stone;
    for (let i = 0; i < 3; i++) {
      const benchAngle = (Math.PI / 2) * i - Math.PI / 2;
      const bench = new THREE.Mesh(
        new THREE.BoxGeometry(3, 0.5, 1),
        benchMat
      );
      bench.position.set(
        x + Math.cos(benchAngle) * 3.5,
        baseY + 0.25,
        z + Math.sin(benchAngle) * 2
      );
      bench.rotation.y = -benchAngle;
      this.scene.add(bench);
    }
  }

  buildBeisHamoked(x, baseY, z) {
    // Chamber of the Hearth - where Kohanim slept and kept warm
    const w = 10, h = 6, d = 10;

    // Building shell
    this.addChamberWithInterior(x, baseY, z, w, h, d, 'בית המוקד', 'Chamber of the Hearth');

    // Central fire pit
    const fireBaseMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 1 });
    const firePit = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.5, 0.4, 16),
      fireBaseMat
    );
    firePit.position.set(x, baseY + 0.2, z);
    this.scene.add(firePit);

    // Fire glow (emissive)
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
    const fire = new THREE.Mesh(
      new THREE.ConeGeometry(0.8, 1.5, 8),
      fireMat
    );
    fire.position.set(x, baseY + 1, z);
    this.scene.add(fire);

    // Fire light
    const fireLight = new THREE.PointLight(0xff6600, 1, 8);
    fireLight.position.set(x, baseY + 1.5, z);
    this.scene.add(fireLight);

    // Sleeping mats with Kohanim around the fire
    const matMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.95 });
    const kohenRobe = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.8 }); // White robes
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xD4A574, roughness: 0.8 });

    const sleepPositions = [
      { x: x - 3, z: z - 2, rot: 0 },
      { x: x - 3, z: z + 2, rot: 0 },
      { x: x + 3, z: z - 2, rot: Math.PI },
      { x: x + 3, z: z + 2, rot: Math.PI }
    ];

    sleepPositions.forEach(pos => {
      // Sleeping mat
      const mat = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 0.1, 1.2),
        matMat
      );
      mat.position.set(pos.x, baseY + 0.05, pos.z);
      this.scene.add(mat);

      // Sleeping figure (lying down)
      this.addSleepingFigure(pos.x, baseY + 0.2, pos.z, kohenRobe, skinMat, pos.rot);
    });
  }

  addChamberWithInterior(x, baseY, z, w, h, d, nameHeb, nameEn) {
    // Create chamber with open front (so we can see inside)
    const wallThick = 0.5;

    // Back wall
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, wallThick),
      this.mat.stonePolished
    );
    backWall.position.set(x, baseY + h/2, z - d/2 + wallThick/2);
    backWall.castShadow = true;
    this.scene.add(backWall);

    // Side walls
    [-1, 1].forEach(side => {
      const sideWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThick, h, d),
        this.mat.stonePolished
      );
      sideWall.position.set(x + side * (w/2 - wallThick/2), baseY + h/2, z);
      sideWall.castShadow = true;
      this.scene.add(sideWall);
    });

    // Floor
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(w - wallThick, 0.3, d),
      this.mat.floor
    );
    floor.position.set(x, baseY + 0.15, z);
    floor.receiveShadow = true;
    floor.userData = { isFloor: true };
    this.scene.add(floor);
    this.floors.push(floor);

    // Roof
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.5, 0.5, d + 0.5),
      this.mat.stone
    );
    roof.position.set(x, baseY + h + 0.25, z);
    roof.castShadow = true;
    this.scene.add(roof);
  }

  addSeatedFigure(x, baseY, z, robeMat, skinMat, rotation) {
    const figure = new THREE.Group();

    // Body (seated, torso)
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.3, 0.8, 8),
      robeMat
    );
    torso.position.y = 0.9;
    figure.add(torso);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 10, 10),
      skinMat
    );
    head.position.y = 1.45;
    figure.add(head);

    // Legs (bent, seated)
    const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6);
    [-0.12, 0.12].forEach(lz => {
      const leg = new THREE.Mesh(legGeo, robeMat);
      leg.position.set(0.2, 0.4, lz);
      leg.rotation.z = Math.PI / 3;
      figure.add(leg);
    });

    figure.position.set(x, baseY, z);
    figure.rotation.y = rotation;
    figure.traverse(c => { if (c.isMesh) c.castShadow = true; });
    this.scene.add(figure);
  }

  addSleepingFigure(x, baseY, z, robeMat, skinMat, rotation) {
    const figure = new THREE.Group();

    // Body (lying down)
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.2, 1.2, 4, 8),
      robeMat
    );
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.2;
    figure.add(body);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 10, 10),
      skinMat
    );
    head.position.set(-0.7, 0.25, 0);
    figure.add(head);

    figure.position.set(x, baseY, z);
    figure.rotation.y = rotation;
    figure.traverse(c => { if (c.isMesh) c.castShadow = true; });
    this.scene.add(figure);
  }
}
