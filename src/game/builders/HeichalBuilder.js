import * as THREE from 'three';
import { BaseBuilder } from './BaseBuilder.js';

// ============================================================================
// HEICHAL BUILDER - Ulam, Heichal, and Kodesh HaKodashim
// ============================================================================
export class HeichalBuilder extends BaseBuilder {
  build() {
    const kohanimY = 7.3;
    const ulamY = 8.0;
    const heichalY = 8.3;
    const wallH = 20;
    const groundY = 3.8;

    this.build12Steps(kohanimY, ulamY, groundY);
    this.buildUlam(ulamY, groundY, wallH);
    this.buildYachinBoaz(ulamY);
    this.buildHeichal(ulamY, heichalY, groundY, wallH);
    this.buildTaim(heichalY);
    this.buildKodeshHakodashim(heichalY, groundY, wallH);
  }

  build12Steps(kohanimY, ulamY, groundY) {
    // 12 Steps from Azara (z=-45) up to Ulam (z=-48)
    const stepDepth = 0.25;
    const totalStepDepth = 3;
    const risePerStep = (ulamY - kohanimY) / 12;

    for (let i = 0; i < 12; i++) {
      const stepY = kohanimY + (i + 1) * risePerStep;
      const stepZ = -45 - (i * totalStepDepth / 12);

      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(12, 0.15, stepDepth + 0.1),
        this.mat.marbleW
      );
      stepMesh.position.set(0, stepY, stepZ - stepDepth/2);
      stepMesh.receiveShadow = true;
      stepMesh.userData = { isFloor: true, isStep: true };
      this.scene.add(stepMesh);
      this.floors.push(stepMesh);
    }

    // Solid base under steps
    const stepsBase = new THREE.Mesh(
      new THREE.BoxGeometry(12, kohanimY - groundY, totalStepDepth),
      this.mat.stone
    );
    stepsBase.position.set(0, groundY + (kohanimY - groundY)/2, -46.5);
    this.scene.add(stepsBase);
  }

  buildUlam(ulamY, groundY, wallH) {
    const ulamWidth = 20;
    const ulamDepth = 10;
    const ulamCenterZ = -53;

    this.addFloor(0, ulamY, ulamCenterZ, ulamWidth, ulamDepth, this.mat.marbleW, 'ulam');

    const ulamBase = new THREE.Mesh(
      new THREE.BoxGeometry(ulamWidth, ulamY - groundY, ulamDepth),
      this.mat.stone
    );
    ulamBase.position.set(0, groundY + (ulamY - groundY)/2, ulamCenterZ);
    this.scene.add(ulamBase);

    // Ulam side walls
    this.addWall(-10, ulamY, ulamCenterZ, 2, wallH, ulamDepth + 2, this.mat.stonePolished);
    this.addWall(10, ulamY, ulamCenterZ, 2, wallH, ulamDepth + 2, this.mat.stonePolished);
  }

  buildYachinBoaz(ulamY) {
    [[-5, 'יכין', 'Yachin'], [5, 'בועז', 'Boaz']].forEach(([px, heb, eng]) => {
      const pillar = new THREE.Group();

      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 2, 16), this.mat.copper);
      base.position.y = 1;
      pillar.add(base);

      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 14, 16), this.mat.copper);
      shaft.position.y = 9;
      pillar.add(shaft);

      const capital = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 0.9, 3, 16), this.mat.copperP);
      capital.position.y = 17.5;
      pillar.add(capital);

      pillar.position.set(px, ulamY, -49);
      pillar.traverse(c => { if (c.isMesh) c.castShadow = true; });
      pillar.userData = { name: heb, nameEn: eng };
      this.scene.add(pillar);
    });
  }

  buildHeichal(ulamY, heichalY, groundY, wallH) {
    const heichalWidth = 10;
    const heichalDepth = 20;
    const heichalCenterZ = -68;

    this.addFloor(0, heichalY, heichalCenterZ, heichalWidth, heichalDepth, this.mat.cedar, 'heichal');

    // Step from Ulam to Heichal
    const ulamToHeichalStep = new THREE.Mesh(
      new THREE.BoxGeometry(heichalWidth, heichalY - ulamY, 1),
      this.mat.marbleW
    );
    ulamToHeichalStep.position.set(0, ulamY + (heichalY - ulamY)/2, -58);
    ulamToHeichalStep.userData = { isFloor: true, isStep: true };
    this.scene.add(ulamToHeichalStep);
    this.floors.push(ulamToHeichalStep);

    // Base
    const heichalBase = new THREE.Mesh(
      new THREE.BoxGeometry(heichalWidth, heichalY - groundY, heichalDepth),
      this.mat.stone
    );
    heichalBase.position.set(0, groundY + (heichalY - groundY)/2, heichalCenterZ);
    this.scene.add(heichalBase);

    // Heichal walls (gold plated)
    this.addWall(-5, heichalY, heichalCenterZ, 1, wallH, heichalDepth + 2, this.mat.goldEng);
    this.addWall(5, heichalY, heichalCenterZ, 1, wallH, heichalDepth + 2, this.mat.goldEng);

    // Back wall between Ulam and Heichal (with doorway)
    this.addWall(-7.5, ulamY, -58.5, 5, wallH, 1, this.mat.stonePolished);
    this.addWall(7.5, ulamY, -58.5, 5, wallH, 1, this.mat.stonePolished);
    this.addWall(0, ulamY + 8, -58.5, 10, wallH - 8, 1, this.mat.stonePolished);

    // Ceiling
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(heichalWidth, 1, heichalDepth), this.mat.cedar);
    ceiling.position.set(0, heichalY + wallH, heichalCenterZ);
    this.scene.add(ceiling);
  }

  buildTaim(heichalY) {
    // Ta'im (Side Chambers)
    [-8, 8].forEach(side => {
      for (let story = 0; story < 3; story++) {
        const storyH = 4;
        const storyY = heichalY + story * storyH;
        for (let zOff = 0; zOff < 3; zOff++) {
          const cell = new THREE.Mesh(
            new THREE.BoxGeometry(3, storyH - 0.5, 5),
            this.mat.stonePolished
          );
          cell.position.set(side, storyY + storyH/2, -60 - zOff * 7);
          cell.castShadow = true;
          this.scene.add(cell);
        }
      }
    });
  }

  buildKodeshHakodashim(heichalY, groundY, wallH) {
    const floorY = heichalY;

    // Paroches (double curtain)
    const parochesGeo = new THREE.PlaneGeometry(10, wallH);
    [0, 0.3].forEach(offset => {
      const paroches = new THREE.Mesh(parochesGeo, this.mat.paroches);
      paroches.position.set(0, floorY + wallH/2, -78 - offset);
      this.scene.add(paroches);
    });

    // Floor
    this.addFloor(0, floorY, -83, 10, 10, this.mat.gold, 'kodesh-hakodashim');

    // Base
    const kkBase = new THREE.Mesh(
      new THREE.BoxGeometry(10, floorY - groundY, 10),
      this.mat.stone
    );
    kkBase.position.set(0, groundY + (floorY - groundY)/2, -83);
    this.scene.add(kkBase);

    // Walls (solid gold)
    this.addWall(-5, floorY, -83, 1, wallH, 12, this.mat.gold);
    this.addWall(5, floorY, -83, 1, wallH, 12, this.mat.gold);
    this.addWall(0, floorY, -88.5, 11, wallH, 1, this.mat.gold);

    // Ceiling
    const kkCeiling = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 10), this.mat.gold);
    kkCeiling.position.set(0, floorY + wallH, -83);
    this.scene.add(kkCeiling);

    // Even HaShtiya (Foundation Stone)
    const even = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.5, 0.8, 16), this.mat.altar);
    even.position.set(0, floorY + 0.4, -83);
    even.castShadow = true;
    even.userData = { name: 'אבן השתיה', nameEn: 'Foundation Stone' };
    this.scene.add(even);
  }
}
