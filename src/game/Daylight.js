import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { CONFIG } from '../config.js';
import { daylight, DEFAULT_TIME, saturate, skyBand } from './sun.js';

/**
 * The image-based lighting rendered from the sky (`scene.environment`).
 *
 * `exposure` scales the dome's radiance for the environment only (the visible dome keeps
 * SUN[time].exposure; SUN[time].envExposure overrides this default per time): a smooth
 * dome anywhere near the panels' (ENV_PANELS) level flattens the gold's reflection, so
 * by day it stays well below them and the map is panel-dominated, while with the sun on
 * the horizon the panels are dim and the dome is raised. `saturation` is the environment
 * copy's colour boost (1 = the model's own grey-blue; the visible dome uses
 * SUN[time].saturation; below 1 keeps the sky's blue from greying the gold). `ground` is
 * the share of the horizon band's radiance at `groundExposure`, per channel (a dark sand
 * albedo), that the ground hemisphere below the horizon shows: undersides and interiors are
 * lit from a warm floor, not from black, and at dawn and dusk the walls take the horizon's
 * orange from below, while it stays dark enough that a vertical gold face keeps its
 * bright-above / dark-below gradient. `sigma` is the PMREM blur (radians); `panelSun`
 * the sunIntensity at which the panels show their listed radiance (a full sun is 1.6, so
 * 1.2 shows them a third over their listed values: round 6 measured the gold 8-11 %
 * brighter in hero / altar_fire / hero_dusk with no pixel reaching 240 of 255; 2.2 dimmed it).
 */
export const ENV = { exposure: 0.8, saturation: 0.85, groundExposure: 2.5, ground: [0.3, 0.27, 0.23], sigma: 0.04, panelSun: 1.2 };

/**
 * Bright panels in the environment scene around the sun: a smooth sky gives the burnished
 * gold a flat reflection, so, as the RoomEnvironment's light boxes did, a few small, very
 * bright emissive quads put gradient highlights on it (the normal map's burnish only shows
 * where the reflected direction crosses a bright/dark edge). Azimuth is degrees from the
 * sun's bearing, elevation above the horizon, width/height in scene units at
 * ENV_PANEL_RADIUS (6 wide = ~17 degrees), and `radiance` the linear value at a full sun
 * (`ENV.panelSun`): every `set(time)` scales it by the time's sunIntensity / panelSun and
 * tints it by the sun's colour, so the highlights dim and redden at dawn and dusk with the
 * map. They sit low (12-15 degrees): a vertical wall seen from eye level reflects the band
 * within ~20 degrees of the horizon, and the ring of azimuths gives every wall orientation
 * one to catch; the panel opposite the sun is a dim rim light.
 */
export const ENV_PANELS = [
  { azimuth: 0, elevation: 15, width: 5, height: 3, radiance: 60 }, // the sun-side highlight (45 before round 6)
  { azimuth: -45, elevation: 12, width: 5, height: 3, radiance: 20 },
  { azimuth: 45, elevation: 12, width: 5, height: 3, radiance: 20 },
  { azimuth: -100, elevation: 12, width: 5, height: 3, radiance: 10 },
  { azimuth: 100, elevation: 12, width: 5, height: 3, radiance: 10 },
  { azimuth: 180, elevation: 15, width: 6, height: 3, radiance: 8 },
];

/** The offscreen sky's scale, the ground hemisphere's and the panels' radii, inside fromScene's far plane (100). */
const ENV_SKY_SCALE = 40;
const ENV_GROUND_RADIUS = 30;
const ENV_PANEL_RADIUS = 20;
const DEG = Math.PI / 180;

/**
 * The sky dome and the lights that follow the sun.
 *
 * `Daylight.createSky()` is what EnvironmentBuilder puts in the scene: three's Sky (the
 * Preetham dome) scaled to sit inside the far plane; TempleGame re-centres it on the camera
 * every frame. `set(time)` points the sun (Sky uniforms, the DirectionalLight named `sun`,
 * the HemisphereLight named `hemisphere`) and tints the fog to the dome's horizon, all
 * computed on the CPU by sun.js from the same model the shader draws.
 *
 * Given a renderer (or a PMREM generator), `set(time)` also renders `scene.environment`
 * from a second copy of the dome over a ground hemisphere (`ENV`), once per time of day:
 * the PMREM is cached by time and never rebuilt per frame.
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
   * The scene the environment map is rendered from: a copy of the dome (same shader patch,
   * uniforms copied from the visible dome on every `set`) and, below the horizon, an
   * inverted hemisphere in the horizon's colour. fromScene's cube target has no depth
   * buffer, so draw order is what layers them: the dome first (renderOrder -1), the ground over it.
   */
  static createEnvironmentScene() {
    const scene = new THREE.Scene();
    const sky = Daylight.createSky();
    sky.name = 'envSky';
    sky.scale.setScalar(ENV_SKY_SCALE);
    scene.add(sky);
    const ground = new THREE.Mesh(
      new THREE.SphereGeometry(ENV_GROUND_RADIUS, 24, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, toneMapped: false })
    );
    ground.name = 'envGround';
    ground.frustumCulled = false;
    scene.add(ground);
    const panels = ENV_PANELS.map((spec, i) => {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(spec.width, spec.height),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: false, toneMapped: false })
      );
      panel.name = `envPanel${i}`;
      panel.userData.spec = spec;
      panel.frustumCulled = false;
      panel.renderOrder = 1; // over the dome and the ground (no depth buffer)
      scene.add(panel);
      return panel;
    });
    return { scene, sky, ground, panels };
  }

  /** Unit direction of a panel for the sun direction `dir` (scene frame: +y up). */
  static panelDirection(spec, dir) {
    const a = Math.atan2(dir.z, dir.x) + spec.azimuth * DEG;
    const el = spec.elevation * DEG;
    return new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
  }

  /**
   * @param {THREE.Scene} scene
   * @param {{ exposure?: number, renderer?: THREE.WebGLRenderer, pmrem?: { fromScene(scene: THREE.Scene, sigma: number): { texture: THREE.Texture, dispose(): void }, dispose?(): void } }} [opts]
   *   `exposure`: renderer.toneMappingExposure, so the fog matches the tone-mapped dome.
   *   `renderer` (or an injected `pmrem` generator): enables the sky environment map;
   *   without either, `set` leaves `scene.environment` as it is.
   */
  constructor(scene, { exposure = 0.85, renderer = null, pmrem = null } = {}) {
    this.scene = scene;
    this.exposure = exposure;
    this.sky = scene.getObjectByName('sky');
    this.sun = scene.getObjectByName('sun');
    this.hemisphere = scene.getObjectByName('hemisphere');
    this.time = null;
    this.sunDistance = 200; // metres from the shadow target (the origin)
    this.ownsPmrem = !pmrem && Boolean(renderer);
    this.pmrem = pmrem ?? (renderer ? new THREE.PMREMGenerator(renderer) : null);
    /** @type {Map<string, { texture: THREE.Texture, dispose(): void }>} PMREM targets by time */
    this.envCache = new Map();
    this.env = null;
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
    this.updateEnvironment(d);
    return d;
  }

  /** The ground hemisphere's linear radiance for `d`: the horizon band at the ground's exposure, per-channel share. */
  static groundColor(d) {
    const scale = (d.spec.exposure ?? 1) * ENV.groundExposure;
    return saturate(skyBand(d.direction, d.spec, 1.5), ENV.saturation).map((c, i) => c * scale * ENV.ground[i]);
  }

  /** Point the offscreen dome where the visible one points, at the environment's exposure. */
  applyEnvironment(d) {
    const { sky, ground } = this.env;
    const u = sky.material.uniforms;
    const v = this.sky?.material?.uniforms;
    if (v) {
      u.sunPosition.value.copy(v.sunPosition.value);
      u.turbidity.value = v.turbidity.value;
      u.rayleigh.value = v.rayleigh.value;
      u.mieCoefficient.value = v.mieCoefficient.value;
      u.mieDirectionalG.value = v.mieDirectionalG.value;
    } else {
      u.sunPosition.value.set(d.direction.x, d.direction.y, d.direction.z);
      u.turbidity.value = d.spec.turbidity;
      u.rayleigh.value = d.spec.rayleigh;
      u.mieCoefficient.value = d.spec.mieCoefficient;
      u.mieDirectionalG.value = d.spec.mieDirectionalG;
    }
    u.skyExposure.value = (d.spec.exposure ?? 1) * (d.spec.envExposure ?? ENV.exposure);
    u.skySaturation.value = ENV.saturation;
    ground.material.color.setRGB(...Daylight.groundColor(d));
    const sunScale = d.sunIntensity / ENV.panelSun;
    for (const panel of this.env.panels) {
      const spec = panel.userData.spec;
      panel.position.copy(Daylight.panelDirection(spec, d.direction)).multiplyScalar(ENV_PANEL_RADIUS);
      panel.lookAt(0, 0, 0);
      panel.material.color.setRGB(...d.sunColor.map((c) => c * spec.radiance * sunScale));
    }
  }

  /**
   * `scene.environment` for `d.time`: rendered once per time and cached. The texture that
   * was in place before this class took over (TempleGame's RoomEnvironment, if any) is
   * disposed when the first sky environment replaces it; cached targets live until dispose().
   */
  updateEnvironment(d) {
    if (!this.pmrem) return null;
    let target = this.envCache.get(d.time);
    if (!target) {
      this.env ??= Daylight.createEnvironmentScene();
      this.applyEnvironment(d);
      target = this.pmrem.fromScene(this.env.scene, ENV.sigma);
      this.envCache.set(d.time, target);
    }
    const prev = this.scene.environment;
    if (prev !== target.texture) {
      this.scene.environment = target.texture;
      if (prev && ![...this.envCache.values()].some((t) => t.texture === prev)) prev.dispose?.();
    }
    return target.texture;
  }

  /** Free the cached environment maps, the offscreen scene and the generator this class created. */
  dispose() {
    for (const target of this.envCache.values()) {
      if (this.scene.environment === target.texture) this.scene.environment = null;
      target.dispose();
    }
    this.envCache.clear();
    if (this.env) {
      this.env.sky.geometry.dispose();
      this.env.sky.material.dispose();
      this.env.ground.geometry.dispose();
      this.env.ground.material.dispose();
      for (const panel of this.env.panels) {
        panel.geometry.dispose();
        panel.material.dispose();
      }
      this.env = null;
    }
    if (this.ownsPmrem) this.pmrem?.dispose();
    this.pmrem = null;
  }
}
