import * as THREE from 'three';
import { mulberry32 } from './random.js';

// ============================================================================
// FLAME - shader-driven fire: a cluster of camera-facing quads whose silhouette,
// colour and flicker come from time-scrolled 3D simplex noise; plus embers (rising
// sparks) and smoke (soft sprites) as GPU-animated point clouds. Nothing here
// allocates per frame: every animation is a function of a time uniform.
//
// Colours are linear HDR. The bloom pass in TempleGame thresholds at 1.2, so only the
// white-yellow core (up to ~1.8 x intensity per quad) blooms while the orange body and
// the deep red edges stay below it. A fire's outer layers use normal blending (the body
// is optically thick, and stacking eight additive quads would blow out to white); the
// small hot core layer is additive. The fragment shaders end with three's tone-mapping and
// colour-space chunks so a direct render (?bloom=0) matches the composer path.
// ============================================================================

/** Ashima Arts 3D simplex noise (MIT), returns roughly -1..1. */
export const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

export const FLAME_VERT = /* glsl */ `
uniform float uTime;
uniform float uSway;
attribute float phase;
varying vec2 vUv;
varying float vPhase;
void main() {
  vUv = uv;
  vPhase = phase;
  vec3 p = position;
  // The top of each tongue leans and sways; the base stays put on the fuel.
  float sway = sin(uTime * 1.7 + phase) * 0.6 + sin(uTime * 3.3 + phase * 2.0) * 0.4;
  p.x += sway * uv.y * uv.y * uSway;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const FLAME_FRAG = /* glsl */ `
uniform float uTime;
uniform float uScroll;
uniform float uIntensity;
uniform float uOpacity;
uniform vec3 uCore;
uniform vec3 uMid;
uniform vec3 uEdge;
varying vec2 vUv;
varying float vPhase;
${NOISE_GLSL}
void main() {
  float h = vUv.y;               // 0 at the base, 1 at the tip
  float x = vUv.x * 2.0 - 1.0;   // -1 .. 1 across the quad
  float t = uTime * uScroll;
  // Two octaves scrolling upward; every quad has its own phase so the cluster never repeats.
  float n = snoise(vec3(x * 2.0 + vPhase, h * 2.4 - t, vPhase * 1.7 + t * 0.15));
  n += 0.5 * snoise(vec3(x * 4.2 - vPhase, h * 5.0 - t * 1.6, t * 0.25 + vPhase));
  n *= 0.6667;
  // Silhouette: wide at the base, tapering to the tip; the noise tears the boundary
  // into wisps, increasingly toward the top.
  float w = 0.85 * sqrt(max(1.0 - h, 0.0)) + 0.02;
  float d = abs(x) / w + n * (0.25 + 0.7 * h) + h * h * 0.5;
  float body = 1.0 - smoothstep(0.45, 1.0, d);
  body *= smoothstep(0.0, 0.08, h);                     // soft bottom edge on the fuel
  body *= 1.0 - smoothstep(0.72, 1.0, h + n * 0.15);   // ragged, fading tip
  // Depth into the flame: white-yellow low and central, orange around, deep red at the edge.
  float core = clamp((1.0 - clamp(d, 0.0, 1.0)) * (1.0 - h * 0.7), 0.0, 1.0);
  vec3 col = mix(uEdge, uMid, smoothstep(0.0, 0.45, core));
  col = mix(col, uCore, smoothstep(0.4, 0.85, core));
  float bright = mix(0.3, 1.8, pow(core, 1.5)) * uIntensity;
  gl_FragColor = vec4(col * bright, body * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const EMBER_VERT = /* glsl */ `
uniform float uTime;
uniform float uHeight;
uniform float uSpread;
uniform float uLife;
uniform float uSize;
uniform float uScale;
attribute vec4 seed; // phase, speed, size, turbulence phase
varying float vLife;
varying float vFlicker;
void main() {
  float life = fract(uTime * seed.y / uLife + seed.x);
  vec3 p = position;
  p.y += life * uHeight * (0.6 + 0.4 * seed.z);
  float tw = seed.w * 6.2832;
  // Turbulence: sparks wander sideways more the higher they get.
  p.x += (sin(life * 7.0 + tw) + 0.5 * sin(uTime * 2.0 + tw * 3.0)) * uSpread * life;
  p.z += (cos(life * 6.0 + tw * 1.3) + 0.5 * cos(uTime * 1.7 + tw * 2.0)) * uSpread * life;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = max(uSize * (0.5 + 0.5 * seed.z) * uScale / -mv.z, 1.5);
  gl_Position = projectionMatrix * mv;
  vLife = life;
  vFlicker = 0.7 + 0.3 * sin(uTime * 25.0 * seed.y + seed.x * 40.0);
}
`;

export const EMBER_FRAG = /* glsl */ `
uniform float uIntensity;
varying float vLife;
varying float vFlicker;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  float a = (1.0 - smoothstep(0.3, 1.0, r)) * pow(1.0 - vLife, 1.5) * vFlicker;
  vec3 col = mix(vec3(1.0, 0.55, 0.15), vec3(0.7, 0.1, 0.0), smoothstep(0.0, 0.8, vLife));
  gl_FragColor = vec4(col * uIntensity * (1.6 - 1.1 * vLife), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const SMOKE_VERT = /* glsl */ `
uniform float uTime;
uniform float uRise;
uniform float uSpread;
uniform vec3 uDrift;
uniform float uLife;
uniform float uSize;
uniform float uGrow;
uniform float uScale;
attribute vec4 seed; // phase, speed, size, drift phase
varying float vLife;
void main() {
  float life = fract(uTime * seed.y / uLife + seed.x);
  vec3 p = position;
  float tw = seed.w * 6.2832;
  p.y += life * uRise;
  p += uDrift * life * uRise;
  p.x += sin(life * 3.0 + tw) * uSpread * life;
  p.z += cos(life * 2.5 + tw * 1.7) * uSpread * life;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float size = uSize * (0.6 + 0.4 * seed.z) * (1.0 + uGrow * life);
  gl_PointSize = max(size * uScale / -mv.z, 2.0);
  gl_Position = projectionMatrix * mv;
  vLife = life;
}
`;

export const SMOKE_FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec3 uColor;
uniform vec3 uColorHot;
uniform float uOpacity;
varying float vLife;
void main() {
  float a = texture2D(map, gl_PointCoord).a;
  a *= smoothstep(0.0, 0.12, vLife) * pow(1.0 - vLife, 1.3) * uOpacity;
  vec3 col = mix(uColorHot, uColor, smoothstep(0.0, 0.35, vLife));
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Deterministic hash of an integer lattice point to [0, 1). */
function hash(i) {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Smooth 1-D value noise in [-1, 1] (cubic interpolation over an integer lattice). */
export function noise1(t) {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  return (hash(i) + (hash(i + 1) - hash(i)) * u) * 2 - 1;
}

/** Fire flicker multiplier around 1: slow breathing plus a fast crackle. */
export function flicker(t, amount = 0.25) {
  return 1 + amount * (0.6 * noise1(t * 6) + 0.4 * noise1(t * 19 + 7.3));
}

/** Colour ramp (linear) by colour temperature 0 (dull orange coals) .. 1 (white-hot). */
export function flameRamp(temperature = 0.5) {
  const t = THREE.MathUtils.clamp(temperature, 0, 1);
  return {
    core: new THREE.Color(1.0, 0.82, 0.4).lerp(new THREE.Color(1.0, 0.98, 0.9), t),
    mid: new THREE.Color(1.0, 0.32, 0.04).lerp(new THREE.Color(1.0, 0.62, 0.15), t),
    edge: new THREE.Color(0.5, 0.05, 0.0).lerp(new THREE.Color(0.9, 0.22, 0.02), t),
  };
}

const _pos = new THREE.Vector3();
const _cam = new THREE.Vector3();
const _size = new THREE.Vector2();

/** Camera world position without allocating (stub cameras in tests only carry `position`). */
function cameraPosition(camera) {
  return camera.isObject3D ? camera.getWorldPosition(_cam) : camera.position;
}

/**
 * Per-object hook that feeds the point-size scale (pixels per metre at 1 m) to the ember
 * and smoke shaders: half the drawing-buffer height times the projection's focal term.
 */
function pointScaleHook(renderer, scene, camera, geometry, material) {
  renderer.getDrawingBufferSize(_size);
  material.uniforms.uScale.value = (_size.y / 2) * camera.projectionMatrix.elements[5];
}

/**
 * A cluster of camera-facing quads rendered with the flame shader.
 *
 * The quads lie in the local x-y plane facing +z; `update(delta, camera)` rotates the
 * mesh about y so +z points at the camera (a cylindrical billboard: the flame never tilts).
 * Assumes any parent is not rotated (the builders' groups only translate).
 *
 * @param {object} [o]
 * @param {number} [o.size=1] base width in metres
 * @param {number} [o.height=2] flame height in metres
 * @param {number} [o.intensity=1] HDR multiplier: a quad's core reaches ~1.8 x intensity
 * @param {number} [o.temperature=0.5] 0 dull orange .. 1 white-hot
 * @param {number} [o.quads=7] billboard count (6-8 reads as one flame)
 * @param {number} [o.scroll=1] noise scroll speed (small flames flicker faster)
 * @param {number} [o.seed=1]
 * @param {{start:number, rate:number, max:number}|null} [o.distanceScale] grow the cluster
 *   beyond `start` metres by `rate` per metre (capped at `max`) so it stays readable far away
 * @param {number} [o.fadeDistance=0] fade out between this distance and twice it (0 = never)
 * @param {number} [o.blending=THREE.AdditiveBlending]
 */
export class Flame extends THREE.Mesh {
  constructor(o = {}) {
    const {
      size = 1,
      height = 2,
      intensity = 1,
      temperature = 0.5,
      quads = 7,
      scroll = 1,
      seed = 1,
      distanceScale = null,
      fadeDistance = 0,
      blending = THREE.AdditiveBlending,
    } = o;
    const rand = mulberry32(seed);
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(quads * 12);
    const uv = new Float32Array(quads * 8);
    const phase = new Float32Array(quads * 4);
    const idx = new Uint16Array(quads * 6);
    for (let q = 0; q < quads; q++) {
      const halfW = size * (0.55 + 0.45 * rand()) * 0.5;
      const h = height * (0.7 + 0.4 * rand());
      const cx = (rand() - 0.5) * size * 0.5;
      const cz = (rand() - 0.5) * size * 0.3;
      const ph = rand() * 10;
      // Corners: (-1,0) (1,0) (1,1) (-1,1); uv.y is the height fraction used by the shader.
      const corners = [
        [-1, 0],
        [1, 0],
        [1, 1],
        [-1, 1],
      ];
      corners.forEach(([sx, sy], k) => {
        const v = q * 4 + k;
        pos[v * 3] = cx + sx * halfW;
        pos[v * 3 + 1] = sy * h;
        pos[v * 3 + 2] = cz;
        uv[v * 2] = sx * 0.5 + 0.5;
        uv[v * 2 + 1] = sy;
        phase[v] = ph;
      });
      const b = q * 4;
      idx.set([b, b + 1, b + 2, b, b + 2, b + 3], q * 6);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    // Sway moves the tips sideways by up to uSway; widen the bounds so culling stays right.
    geo.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, height / 2, 0),
      Math.hypot(size, height) * 0.75
    );

    const ramp = flameRamp(temperature);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: scroll },
        uSway: { value: size * 0.15 },
        uIntensity: { value: intensity },
        uOpacity: { value: 1 },
        uCore: { value: ramp.core },
        uMid: { value: ramp.mid },
        uEdge: { value: ramp.edge },
      },
      vertexShader: FLAME_VERT,
      fragmentShader: FLAME_FRAG,
      transparent: true,
      depthWrite: false,
      blending,
      side: THREE.DoubleSide,
      toneMapped: true,
    });
    super(geo, mat);
    this.name = 'flame';
    this.castShadow = false;
    this.receiveShadow = false;
    this.quads = quads;
    this.time = rand() * 100; // each flame starts at its own point in the noise
    mat.uniforms.uTime.value = this.time;
    this.distanceScale = distanceScale;
    this.fadeDistance = fadeDistance;
    this.distance = 0;
  }

  /** Base width, height and temperature can be retuned after construction. */
  setIntensity(v) {
    this.material.uniforms.uIntensity.value = v;
  }

  setTemperature(t) {
    const ramp = flameRamp(t);
    const u = this.material.uniforms;
    u.uCore.value.copy(ramp.core);
    u.uMid.value.copy(ramp.mid);
    u.uEdge.value.copy(ramp.edge);
  }

  /**
   * Advance the noise and face the camera (rotation about y only). Also applies the
   * distance growth and fade so the flame reads as one flame from across the court.
   */
  update(delta, camera) {
    this.time += delta;
    const u = this.material.uniforms;
    u.uTime.value = this.time;
    this.getWorldPosition(_pos);
    const cp = cameraPosition(camera);
    const dx = cp.x - _pos.x;
    const dz = cp.z - _pos.z;
    this.rotation.y = Math.atan2(dx, dz);
    const dist = Math.sqrt(dx * dx + dz * dz + (cp.y - _pos.y) * (cp.y - _pos.y));
    this.distance = dist;
    const ds = this.distanceScale;
    if (ds) {
      const s = Math.min(ds.max ?? 3, 1 + Math.max(0, dist - ds.start) * ds.rate);
      this.scale.setScalar(s);
    }
    if (this.fadeDistance > 0) {
      u.uOpacity.value = THREE.MathUtils.clamp(2 - dist / this.fadeDistance, 0, 1);
    }
  }

  dispose() {
    this.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * Sparks rising from a fire: tiny additive points, GPU-animated from a time uniform.
 *
 * @param {object} [o]
 * @param {number} [o.count=60]
 * @param {number} [o.height=3] rise before a spark dies (metres)
 * @param {number} [o.spread=0.5] spawn radius and sideways wander (metres)
 * @param {number} [o.size=0.06] spark diameter (metres); never below 1.5 px on screen
 * @param {number} [o.life=2.5] seconds
 * @param {number} [o.intensity=1]
 * @param {number} [o.seed=2]
 */
export class Embers extends THREE.Points {
  constructor(o = {}) {
    const {
      count = 60,
      height = 3,
      spread = 0.5,
      size = 0.06,
      life = 2.5,
      intensity = 1,
      seed = 2,
    } = o;
    const rand = mulberry32(seed);
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const sd = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * spread;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = rand() * 0.2 * height;
      pos[i * 3 + 2] = Math.sin(a) * r;
      sd[i * 4] = rand();
      sd[i * 4 + 1] = 0.7 + 0.6 * rand();
      sd[i * 4 + 2] = rand();
      sd[i * 4 + 3] = rand();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(sd, 4));
    geo.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, height * 0.6, 0),
      height * 0.7 + spread * 2
    );
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uHeight: { value: height },
        uSpread: { value: spread },
        uLife: { value: life },
        uSize: { value: size },
        uScale: { value: 300 },
        uIntensity: { value: intensity },
      },
      vertexShader: EMBER_VERT,
      fragmentShader: EMBER_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: true,
    });
    super(geo, mat);
    this.name = 'embers';
    this.time = rand() * 50;
    mat.uniforms.uTime.value = this.time;
    this.onBeforeRender = pointScaleHook;
  }

  update(delta) {
    this.time += delta;
    this.material.uniforms.uTime.value = this.time;
  }

  dispose() {
    this.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * Smoke: soft grey sprites (normal blending) that rise slowly, drift, expand and fade.
 *
 * @param {THREE.Texture|null} sprite radial alpha sprite (makeParticleTexture); may be null headless
 * @param {object} [o]
 * @param {number} [o.count=24]
 * @param {number} [o.rise=8] metres travelled over a puff's life
 * @param {number} [o.spread=0.5] spawn radius and sideways wander (metres)
 * @param {number[]} [o.drift=[0.15,0,0.05]] wind, as a fraction of the rise
 * @param {number} [o.size=1] starting puff diameter (metres)
 * @param {number} [o.grow=2] size multiplier gained over the life
 * @param {number} [o.life=6] seconds
 * @param {number} [o.opacity=0.35]
 * @param {number} [o.color=0x6e6e72]
 * @param {number} [o.seed=3]
 */
export class Smoke extends THREE.Points {
  constructor(sprite, o = {}) {
    const {
      count = 24,
      rise = 8,
      spread = 0.5,
      drift = [0.15, 0, 0.05],
      size = 1,
      grow = 2,
      life = 6,
      opacity = 0.35,
      color = 0x6e6e72,
      seed = 3,
    } = o;
    const rand = mulberry32(seed);
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const sd = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * spread;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = Math.sin(a) * r;
      sd[i * 4] = rand();
      sd[i * 4 + 1] = 0.8 + 0.4 * rand();
      sd[i * 4 + 2] = rand();
      sd[i * 4 + 3] = rand();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(sd, 4));
    const driftV = new THREE.Vector3(...drift);
    geo.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(driftV.x * rise * 0.5, rise / 2, driftV.z * rise * 0.5),
      rise * 0.6 + spread * 2 + size * (1 + grow)
    );
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: sprite },
        uTime: { value: 0 },
        uRise: { value: rise },
        uSpread: { value: spread },
        uDrift: { value: driftV },
        uLife: { value: life },
        uSize: { value: size },
        uGrow: { value: grow },
        uScale: { value: 300 },
        uOpacity: { value: opacity },
        uColor: { value: new THREE.Color(color) },
        uColorHot: { value: new THREE.Color(0.55, 0.38, 0.28) },
      },
      vertexShader: SMOKE_VERT,
      fragmentShader: SMOKE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      toneMapped: true,
    });
    super(geo, mat);
    this.name = 'smoke';
    this.time = rand() * 50;
    mat.uniforms.uTime.value = this.time;
    this.onBeforeRender = pointScaleHook;
  }

  update(delta) {
    this.time += delta;
    this.material.uniforms.uTime.value = this.time;
  }

  dispose() {
    this.removeFromParent();
    this.geometry.dispose();
    this.material.dispose(); // the sprite texture is shared and owned by ParticleSystem
  }
}
