import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { BaseBuilder } from './BaseBuilder.js';
import { byId, worldPos } from '../../content/index.js';

// ============================================================================
// LIGHTING BUILDER - Scene lighting setup
//
// three r155+ uses physical light units: point-light intensity is candela and falls off
// with the square of distance, so the old 0.4-2.0 values lit nothing. The image-based
// environment (scene.environment, set in TempleGame) now supplies most of the fill, so
// ambient and hemisphere are kept low to avoid a flat, washed look.
// ============================================================================
export class LightingBuilder extends BaseBuilder {
  build() {
    this.scene.add(new THREE.AmbientLight(0xfff8f0, 0.15));

    // Position, colour and intensity are overwritten by Daylight.set(timeOfDay); these
    // are the morning values so the scene is lit even before it runs.
    const sun = new THREE.DirectionalLight(0xfffaf0, 1.6);
    sun.position.set(-70, 92, 100);
    sun.castShadow = true;
    sun.shadow.mapSize.set(CONFIG.SHADOW_MAP_SIZE, CONFIG.SHADOW_MAP_SIZE);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120;
    sun.shadow.camera.bottom = -120;
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.04; // removes acne on the lathe columns
    sun.name = 'sun';
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0xb0c4de, 0.4);
    fill.position.set(-50, 80, -40);
    this.scene.add(fill);

    const hemisphere = new THREE.HemisphereLight(0x88aacc, 0xd4c4a8, 0.35);
    hemisphere.name = 'hemisphere'; // sky colour follows the dome (Daylight)
    this.scene.add(hemisphere);

    // Heichal interior: candela, no cutoff, physical decay.
    const heichalLight = new THREE.PointLight(0xffdd88, 250, 0, 2);
    const [hx, hy, hz] = worldPos(byId.heichal); // the Heichal's centre, from the content JSON
    heichalLight.position.set(hx, hy + 9, hz);
    heichalLight.name = 'heichalLight';
    this.scene.add(heichalLight);
  }
}
