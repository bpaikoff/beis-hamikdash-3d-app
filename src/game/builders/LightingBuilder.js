import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { BaseBuilder } from './BaseBuilder.js';

// ============================================================================
// LIGHTING BUILDER - Scene lighting setup
// ============================================================================
export class LightingBuilder extends BaseBuilder {
  build() {
    // Ambient light
    this.scene.add(new THREE.AmbientLight(0xFFF8F0, 0.4));

    // Main sun light
    const sun = new THREE.DirectionalLight(0xFFFAF0, 1.5);
    sun.position.set(60, 120, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.width = CONFIG.SHADOW_MAP_SIZE;
    sun.shadow.mapSize.height = CONFIG.SHADOW_MAP_SIZE;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120;
    sun.shadow.camera.bottom = -120;
    sun.shadow.bias = -0.0002;
    this.scene.add(sun);

    // Fill light
    const fill = new THREE.DirectionalLight(0xB0C4DE, 0.35);
    fill.position.set(-50, 80, -40);
    this.scene.add(fill);

    // Hemisphere light
    this.scene.add(new THREE.HemisphereLight(0x88AACC, 0xD4C4A8, 0.5));

    // Heichal interior light
    const heichalLight = new THREE.PointLight(0xFFDD88, 2, 40);
    heichalLight.position.set(0, 25, -68);
    this.scene.add(heichalLight);
  }
}
