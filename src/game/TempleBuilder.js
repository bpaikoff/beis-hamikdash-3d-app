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

  /**
   * MeshStandardMaterial from a photographic set (TextureFactory.pbrSet) with the
   * procedural texture as the fallback (?pbr=0 or an unknown set).
   *
   * `roughness` multiplies the roughness map, and the shader clamps the product to 1, so
   * a multiplier above 1 lifts a set whose map sits low (the ambientCG procedural stone
   * and metal maps average 0.3-0.5) while keeping its variation. `roughnessMap: false`
   * drops a map that is near-black (Travertine009, Onyx010: mean 0.04, which would only
   * amplify JPEG noise) in favour of the constant. `albedo` swaps the colour map for a
   * procedural texture (gold keeps its painted albedo and takes only normal + roughness).
   * A texture source without pbrSet (the tests' stubs) gets the fallback as well.
   */
  pbrMaterial(set, { albedo, fallback, fallbackProps = {}, roughnessMap = true, aoMapIntensity = 0.8, ...props }) {
    const s = this.tex.pbrSet?.(set);
    if (!s) {
      const fb = { map: this.tex.get(fallback.map), ...fallbackProps };
      if (fallback.normalMap) fb.normalMap = this.tex.get(fallback.normalMap);
      return new THREE.MeshStandardMaterial(fb);
    }
    const p = { ...props, map: albedo ? this.tex.get(albedo) : s.map, normalMap: s.normalMap };
    if (roughnessMap && s.roughnessMap) p.roughnessMap = s.roughnessMap;
    if (s.aoMap) { p.aoMap = s.aoMap; p.aoMapIntensity = aoMapIntensity; }
    return new THREE.MeshStandardMaterial(p);
  }

  createMaterials() {
    const pbr = (set, o) => this.pbrMaterial(set, o);
    this.mat = {
      // Jerusalem limestone ashlar for the court and chamber walls (3 m tiles, ~1 m blocks).
      stone: pbr('ashlar', { roughness: 2.6, metalness: 0, fallback: { map: 'jerusalemStone', normalMap: 'normalMap' }, fallbackProps: { roughness: 0.85, metalness: 0.05 } }),
      // Plain dressed limestone for gate frames, ledges and chamber walls.
      stonePolished: pbr('limestone', { roughness: 0.55, metalness: 0, roughnessMap: false, fallback: { map: 'jerusalemStone' }, fallbackProps: { roughness: 0.4, metalness: 0.1 } }),
      // Same limestone at a finer tiling for objects a few metres across (altar, kiyor, steps).
      stoneFine: Object.assign(
        pbr('limestone', { roughness: 0.8, metalness: 0, roughnessMap: false, fallback: { map: 'jerusalemStone', normalMap: 'normalMap' }, fallbackProps: { roughness: 0.8, metalness: 0.05 } }),
        { userData: { tileMetres: 1.25 } }
      ),
      // stoneFine's maps under a shade, for the risers of dressed-stone steps: a lit tread
      // over a darker riser is what separates one step from the next at a distance (the
      // Ulam steps are 20 m wide and 0.25 m high; in one tone they merge into a slope).
      stoneRiser: Object.assign(
        pbr('limestone', { color: 0xa89b88, roughness: 0.8, metalness: 0, roughnessMap: false, fallback: { map: 'jerusalemStone', normalMap: 'normalMap' }, fallbackProps: { color: 0xa89b88, roughness: 0.8, metalness: 0.05 } }),
        { userData: { tileMetres: 1.25 } }
      ),
      // Gold keeps the painted albedo (the engraving pattern is the point of goldEng); the
      // metal set supplies the burnish (normal + roughness). Metal048C's roughness averages
      // 0.28: x1.5 lands near the 0.38 that kept the environment's panels from blooming.
      gold: pbr('gold', { albedo: 'goldPolished', roughness: 1.5, metalness: 0.9, envMapIntensity: 0.6, fallback: { map: 'goldPolished' }, fallbackProps: { roughness: 0.38, metalness: 0.9, envMapIntensity: 0.6 } }),
      goldEng: pbr('gold', { albedo: 'goldEngraved', roughness: 1.7, metalness: 0.88, envMapIntensity: 0.5, fallback: { map: 'goldEngraved' }, fallbackProps: { roughness: 0.45, metalness: 0.88, envMapIntensity: 0.5 } }),
      copper: new THREE.MeshStandardMaterial({ map: this.tex.get('copper'), roughness: 0.35, metalness: 0.85 }),
      copperP: new THREE.MeshStandardMaterial({ map: this.tex.get('copperPatina'), roughness: 0.5, metalness: 0.7 }),
      cedar: pbr('cedar', { roughness: 1.6, metalness: 0, fallback: { map: 'cedarWood' }, fallbackProps: { roughness: 0.7, metalness: 0.05 } }),
      acacia: pbr('acacia', { roughness: 1.6, metalness: 0, fallback: { map: 'acaciaWood' }, fallbackProps: { roughness: 0.65, metalness: 0.05 } }),
      marbleW: pbr('marbleWhite', { roughness: 3, metalness: 0, fallback: { map: 'marbleWhite' }, fallbackProps: { roughness: 0.2, metalness: 0.1 } }),
      marbleR: pbr('marbleRose', { roughness: 0.35, metalness: 0, roughnessMap: false, fallback: { map: 'marbleRose' }, fallbackProps: { roughness: 0.25, metalness: 0.1 } }),
      paroches: new THREE.MeshStandardMaterial({ map: this.tex.get('paroches'), roughness: 0.85, metalness: 0.1, side: THREE.DoubleSide }),
      ground: pbr('sand', { roughness: 1.6, metalness: 0, fallback: { map: 'groundSand' }, fallbackProps: { roughness: 0.95 } }),
      floor: pbr('limestoneTiles', { roughness: 1.6, metalness: 0, fallback: { map: 'floorTiles' }, fallbackProps: { roughness: 0.6 } }),
      mosaic: new THREE.MeshStandardMaterial({ map: this.tex.get('mosaic'), roughness: 0.55 }),
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
