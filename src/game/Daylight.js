import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { CONFIG } from '../config.js';
import { daylight, DEFAULT_TIME } from './sun.js';

/**
 * The sky dome and the lights that follow the sun.
 *
 * `Daylight.createSky()` is what EnvironmentBuilder puts in the scene: three's Sky (the
 * Preetham dome) scaled to sit inside the far plane; TempleGame re-centres it on the camera
 * every frame. `set(time)` points the sun (Sky uniforms, the DirectionalLight named `sun`,
 * the HemisphereLight named `hemisphere`) and tints the fog to the dome's horizon, all
 * computed on the CPU by sun.js from the same model the shader draws.
 */
export class Daylight {
  static createSky() {
    const sky = new Sky();
    // Sky.js has no brightness control of its own; scale its radiance before the tone
    // mapping it applies (SUN[time].exposure, matched in sun.js for the fog).
    const mat = sky.material;
    mat.uniforms.skyExposure = { value: 1 };
    mat.uniforms.skySaturation = { value: 1 };
    mat.fragmentShader = mat.fragmentShader
      .replace('uniform float mieDirectionalG;', 'uniform float mieDirectionalG;\n\t\tuniform float skyExposure;\n\t\tuniform float skySaturation;')
      .replace(
        'gl_FragColor = vec4( retColor, 1.0 );',
        'float skyLum = dot( retColor, vec3( 0.2126, 0.7152, 0.0722 ) );\n' +
          '\t\t\tretColor = max( mix( vec3( skyLum ), retColor, skySaturation ), 0.0 );\n' +
          '\t\t\tgl_FragColor = vec4( retColor * skyExposure, 1.0 );'
      );
    sky.name = 'sky';
    sky.scale.setScalar(CONFIG.RENDER_DISTANCE * 0.9);
    sky.frustumCulled = false;
    sky.renderOrder = -1;
    return sky;
  }

  /**
   * @param {THREE.Scene} scene
   * @param {{ exposure?: number }} [opts] renderer.toneMappingExposure, so the fog matches the tone-mapped dome
   */
  constructor(scene, { exposure = 0.85 } = {}) {
    this.scene = scene;
    this.exposure = exposure;
    this.sky = scene.getObjectByName('sky');
    this.sun = scene.getObjectByName('sun');
    this.hemisphere = scene.getObjectByName('hemisphere');
    this.time = null;
    this.sunDistance = 200; // metres from the shadow target (the origin)
  }

  /** @param {'dawn' | 'morning' | 'afternoon' | 'dusk'} time */
  set(time = DEFAULT_TIME) {
    const d = daylight(time, { exposure: this.exposure });
    this.time = d.time;
    this.current = d;
    const dir = new THREE.Vector3(d.direction.x, d.direction.y, d.direction.z);
    if (this.sky?.material?.uniforms) {
      const u = this.sky.material.uniforms;
      u.sunPosition.value.copy(dir);
      u.turbidity.value = d.spec.turbidity;
      u.rayleigh.value = d.spec.rayleigh;
      u.mieCoefficient.value = d.spec.mieCoefficient;
      u.mieDirectionalG.value = d.spec.mieDirectionalG;
      u.skyExposure.value = d.spec.exposure ?? 1;
      u.skySaturation.value = d.spec.saturation ?? 1;
    }
    if (this.sun) {
      this.sun.position.copy(dir).multiplyScalar(this.sunDistance);
      // A low sun looks along the courts: the far plane must reach the Heichal behind the origin.
      if (this.sun.shadow) this.sun.shadow.camera.far = this.sunDistance + 250;
      this.sun.color.setRGB(...d.sunColor);
      this.sun.intensity = d.sunIntensity;
    }
    if (this.hemisphere) {
      this.hemisphere.color.setRGB(...d.hemisphereColor);
      this.hemisphere.intensity = d.hemisphereIntensity;
    }
    if (this.scene.fog) this.scene.fog.color.setRGB(...d.fogColor);
    return d;
  }
}
