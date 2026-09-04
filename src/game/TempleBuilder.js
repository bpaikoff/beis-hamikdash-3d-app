import * as THREE from 'three';

// Import all modular builders
import { EnvironmentBuilder } from './builders/EnvironmentBuilder.js';
import { HarHaBayisBuilder } from './builders/HarHaBayisBuilder.js';
import { EzrasNashimBuilder } from './builders/EzrasNashimBuilder.js';
import { AzaraBuilder } from './builders/AzaraBuilder.js';
import { HeichalBuilder } from './builders/HeichalBuilder.js';
import { KeilimBuilder } from './builders/KeilimBuilder.js';
import { LightingBuilder } from './builders/LightingBuilder.js';

// ============================================================================
// TEMPLE BUILDER - Orchestrates all modular builders
// ============================================================================
export class TempleBuilder {
  constructor(scene, tex) {
    this.scene = scene;
    this.tex = tex;
    this.floors = [];
    this.walls = [];
    this.createMaterials();
  }

  createMaterials() {
    this.mat = {
      stone: new THREE.MeshStandardMaterial({ map: this.tex.get('jerusalemStone'), normalMap: this.tex.get('normalMap'), roughness: 0.85, metalness: 0.05 }),
      stonePolished: new THREE.MeshStandardMaterial({ map: this.tex.get('jerusalemStone'), roughness: 0.4, metalness: 0.1 }),
      // Same stone at a finer tiling for objects a few metres across (altar, kiyor, steps): 4 m bricks read as slabs on them.
      stoneFine: Object.assign(new THREE.MeshStandardMaterial({ map: this.tex.get('jerusalemStone'), normalMap: this.tex.get('normalMap'), roughness: 0.8, metalness: 0.05 }), { userData: { tileMetres: 1.25 } }),
      gold: new THREE.MeshStandardMaterial({ map: this.tex.get('goldPolished'), roughness: 0.15, metalness: 0.95 }),
      goldEng: new THREE.MeshStandardMaterial({ map: this.tex.get('goldEngraved'), roughness: 0.25, metalness: 0.9 }),
      copper: new THREE.MeshStandardMaterial({ map: this.tex.get('copper'), roughness: 0.35, metalness: 0.85 }),
      copperP: new THREE.MeshStandardMaterial({ map: this.tex.get('copperPatina'), roughness: 0.5, metalness: 0.7 }),
      cedar: new THREE.MeshStandardMaterial({ map: this.tex.get('cedarWood'), roughness: 0.7, metalness: 0.05 }),
      acacia: new THREE.MeshStandardMaterial({ map: this.tex.get('acaciaWood'), roughness: 0.65, metalness: 0.05 }),
      marbleW: new THREE.MeshStandardMaterial({ map: this.tex.get('marbleWhite'), roughness: 0.2, metalness: 0.1 }),
      marbleR: new THREE.MeshStandardMaterial({ map: this.tex.get('marbleRose'), roughness: 0.25, metalness: 0.1 }),
      paroches: new THREE.MeshStandardMaterial({ map: this.tex.get('paroches'), roughness: 0.85, metalness: 0.1, side: THREE.DoubleSide }),
      ground: new THREE.MeshStandardMaterial({ map: this.tex.get('groundSand'), roughness: 0.95 }),
      floor: new THREE.MeshStandardMaterial({ map: this.tex.get('floorTiles'), roughness: 0.6 }),
      mosaic: new THREE.MeshStandardMaterial({ map: this.tex.get('mosaic'), roughness: 0.5 }),
      water: new THREE.MeshStandardMaterial({ map: this.tex.get('water'), roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.8 }),
      altar: new THREE.MeshStandardMaterial({ color: 0x5A4A40, roughness: 0.9 })
    };
    // Tiling is per mesh (BaseBuilder.scaleBoxUVs / TILE_METRES), not texture.repeat:
    // the textures and materials stay shared, which keeps them instancing-safe.
  }

  build() {
    // Create builders with shared state
    const builderArgs = [this.scene, this.tex, this.mat, this.floors, this.walls];

    // Build in order from outer to inner
    new EnvironmentBuilder(...builderArgs).build();
    new HarHaBayisBuilder(...builderArgs).build();
    new EzrasNashimBuilder(...builderArgs).build();
    new AzaraBuilder(...builderArgs).build();      // Fixed: walls end at z=-43 to leave opening for steps
    new HeichalBuilder(...builderArgs).build();
    new KeilimBuilder(...builderArgs).build();
    new LightingBuilder(...builderArgs).build();

    return { floors: this.floors, walls: this.walls };
  }
}
