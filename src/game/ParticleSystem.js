import * as THREE from 'three';
import { Flame, Embers, Smoke, Motes, flicker } from './Flame.js';

/**
 * Sprite budget of the round-7 atmosphere (`?fx=0` leaves it out): the Tamid's smoke
 * column over the altar (two point clouds, a dense core and a thin outer veil) and the
 * Heichal's incense haze with its dust motes. Four draw calls, 400 sprites.
 */
export const FX_BUDGET = { columnCore: 120, columnVeil: 80, haze: 80, motes: 120 };

/**
 * The smoke column's tint by time of day: the fresh smoke over the fire is lit from below.
 * By day it is a warm grey that greys out within the first tenth of the rise; with the sun
 * on the horizon the fire is the brightest thing in the court and the lower column glows
 * orange for a quarter of its rise (Avos 5:5: the column stood straight, so it is the
 * glow, not the shape, that changes).
 */
export const COLUMN_GLOW = {
  day: { hot: [0.5, 0.42, 0.36], hotSpan: 0.1 },
  night: { hot: [1.6, 0.62, 0.22], hotSpan: 0.25 },
};

/**
 * Soft radial sprite shared by every particle system: white centre fading to transparent,
 * so the point colour/opacity does the tinting. 64 px is plenty for a blurred disc.
 */
export function makeParticleTexture(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ============================================================================
// PARTICLE SYSTEM - the fires of the Mikdash: the altar's ma'aracha (three layered
// shader flames, embers, smoke and a flickering physical light), the seven lamps of
// the Menorah and the coals on the golden altar. See Flame.js for the shaders.
// ============================================================================
export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.flames = []; // everything with update(delta, camera) and dispose()
    this.lights = []; // { light, baseIntensity, base: Vector3, rate, jitter }
    this.time = 0;
    this.sprite = typeof document !== 'undefined' ? makeParticleTexture() : null;
  }

  /** Track a flame/ember/smoke object under `parent` at a local offset. */
  attach(parent, obj, x = 0, y = 0, z = 0) {
    obj.position.set(x, y, z);
    parent.add(obj);
    this.flames.push(obj);
    return obj;
  }

  /**
   * A large wood fire: three layered flames (wide base, medium body, small hot core),
   * sparks, smoke and a physical point light. `size` is the fuel bed's width in metres;
   * the flames stand about 1.5 x size tall.
   */
  createFire(x, y, z, size = 1) {
    const g = new THREE.Group();
    g.name = 'fire';
    g.position.set(x, y, z);
    this.scene.add(g);
    const height = size * 1.5;
    // Grow the cluster beyond 25 m so it still reads as one flame from the Nicanor gate.
    const distanceScale = { start: 25, rate: 0.02, max: 2.5 };
    const normal = THREE.NormalBlending; // the body is opaque-ish; only the core adds up and blooms
    this.attach(
      g,
      new Flame({
        size,
        height,
        intensity: 0.9,
        temperature: 0.3,
        quads: 8,
        scroll: 0.9,
        seed: 11,
        distanceScale,
        blending: normal,
      })
    );
    this.attach(
      g,
      new Flame({
        size: size * 0.65,
        height: height * 0.75,
        intensity: 1.0,
        temperature: 0.5,
        quads: 7,
        scroll: 1.1,
        seed: 12,
        distanceScale,
        blending: normal,
      })
    );
    this.attach(
      g,
      new Flame({
        size: size * 0.35,
        height: height * 0.5,
        intensity: 1.3,
        temperature: 0.85,
        quads: 6,
        scroll: 1.4,
        seed: 13,
        distanceScale,
        fadeDistance: 40,
      })
    );
    this.attach(
      g,
      new Embers({
        count: 60,
        height: height * 1.4,
        spread: size * 0.3,
        size: size * 0.04,
        life: 2.5,
        intensity: 1,
        seed: 14,
      }),
      0,
      height * 0.2,
      0
    );
    this.attach(
      g,
      new Smoke(this.sprite, {
        count: 28,
        rise: height * 3,
        spread: size * 0.4,
        drift: [0.12, 0, 0.06],
        size: size * 0.5,
        grow: 2.5,
        life: 7,
        opacity: 0.32,
        seed: 15,
      }),
      0,
      height * 0.75,
      0
    );
    // Physical units (candela, inverse-square decay): the old intensity 2 lit nothing.
    const baseIntensity = 400;
    const light = new THREE.PointLight(0xff6622, baseIntensity, 0, 2);
    light.position.set(x, y + size, z);
    this.scene.add(light);
    this.lights.push({
      light,
      baseIntensity,
      base: light.position.clone(),
      rate: 1,
      jitter: size * 0.06,
    });
    return g;
  }

  /**
   * The Tamid's smoke column (Tamid 2:5, Avos 5:5): from the fire at (x, y, z) a dense
   * core rises straight up (no drift: the column never bent) for `rise` metres and thins
   * as the puffs grow and fade, with a wider, fainter veil around it. `size` is the fuel
   * bed's width, as for createFire. Visible from the courts and over the walls from the
   * mount; `setTimeOfDay` makes it glow from the fire below at dawn and dusk.
   */
  createSmokeColumn(x, y, z, size = 4, rise = 36) {
    const g = new THREE.Group();
    g.name = 'smoke-column';
    g.position.set(x, y, z);
    this.scene.add(g);
    const glow = COLUMN_GLOW.day;
    const core = new Smoke(this.sprite, {
      count: FX_BUDGET.columnCore,
      rise,
      spread: size * 0.11,
      drift: [0, 0, 0],
      size: size * 0.45,
      grow: 5,
      life: 16,
      opacity: 0.22,
      color: 0x76767c,
      hot: glow.hot,
      hotSpan: glow.hotSpan,
      seed: 51,
    });
    const veil = new Smoke(this.sprite, {
      count: FX_BUDGET.columnVeil,
      rise: rise * 0.85,
      spread: size * 0.25,
      drift: [0, 0, 0],
      size: size * 0.8,
      grow: 4,
      life: 14,
      opacity: 0.09,
      color: 0x8a8a90,
      hot: glow.hot,
      hotSpan: glow.hotSpan,
      seed: 52,
    });
    this.attach(g, core, 0, size * 0.9, 0);
    this.attach(g, veil, 0, size * 1.1, 0);
    this.column = g;
    return g;
  }

  /**
   * The Heichal's incense haze: a thin, slow cloud hanging over the golden altar's
   * anchor (it rises only a few metres and lingers) and dust motes turning in the light
   * of the doorway, in a box about (mx, my, mz) with half extents `box`.
   */
  createHaze(anchor, o = {}) {
    const { motesAt = null, box = [4, 2, 8] } = o;
    const haze = new Smoke(this.sprite, {
      count: FX_BUDGET.haze,
      rise: 3,
      spread: 2.2,
      drift: [0, 0, 0],
      size: 1.8,
      grow: 1.4,
      life: 26,
      opacity: 0.045,
      color: 0x9b98a6,
      hot: [0.6, 0.58, 0.64],
      hotSpan: 0.2,
      seed: 53,
    });
    this.attach(anchor, haze, 0, 1.0, 0);
    let motes = null;
    if (motesAt) {
      const g = new THREE.Group();
      g.name = 'haze';
      g.position.set(...motesAt);
      this.scene.add(g);
      motes = this.attach(g, new Motes({ count: FX_BUDGET.motes, box, size: 0.022, opacity: 0.35, seed: 54 }));
    }
    return { haze, motes };
  }

  /** Retint the smoke column for the light: it glows from the fire at dawn and dusk. */
  setTimeOfDay(time) {
    if (!this.column) return;
    const glow = time === 'dawn' || time === 'dusk' ? COLUMN_GLOW.night : COLUMN_GLOW.day;
    for (const c of this.column.children) c.setGlow?.(glow.hot, glow.hotSpan);
  }

  /** A free-standing smoke column (soft grey sprites rising and fading). */
  createSmoke(x, y, z, size = 0.5) {
    const smoke = new Smoke(this.sprite, {
      count: 20,
      rise: size * 12,
      spread: size * 0.3,
      drift: [0.05, 0, 0.02],
      size: size * 0.8,
      grow: 2.5,
      life: 8,
      opacity: 0.3,
      seed: 21,
    });
    return this.attach(this.scene, smoke, x, y, z);
  }

  /**
   * A lamp flame (the Menorah): one tiny hot flame hung on `anchor` (an Object3D the
   * builder placed at the wick) so it toggles with the vessel's period group.
   * `light` > 0 adds a small flickering point light (candela).
   */
  createCandle(anchor, o = {}) {
    const { size = 0.035, height = 0.11, light = 0 } = o;
    const flame = new Flame({
      size,
      height,
      intensity: 1.3,
      temperature: 0.6,
      quads: 4,
      scroll: 2.5,
      seed: 31 + this.flames.length,
      distanceScale: { start: 6, rate: 0.05, max: 2.5 },
    });
    this.attach(anchor, flame);
    if (light > 0) {
      const pl = new THREE.PointLight(0xffc266, light, 0, 2);
      pl.position.y = height;
      anchor.add(pl);
      this.lights.push({
        light: pl,
        baseIntensity: light,
        base: pl.position.clone(),
        rate: 3,
        jitter: 0,
      });
    }
    return flame;
  }

  /**
   * Glowing coals with a thin incense column (the golden altar): a low, dull flame
   * shimmering over the coal bed and a narrow smoke column rising straight up.
   */
  createCoals(anchor, o = {}) {
    const { size = 0.28, height = 0.16 } = o;
    const glow = new Flame({
      size,
      height,
      intensity: 0.7,
      temperature: 0.12,
      quads: 5,
      scroll: 1.8,
      seed: 41,
      distanceScale: { start: 6, rate: 0.05, max: 2 },
    });
    this.attach(anchor, glow, 0, 0.01, 0);
    const smoke = new Smoke(this.sprite, {
      count: 22,
      rise: 4,
      spread: 0.04,
      drift: [0.01, 0, 0.005],
      size: 0.14,
      grow: 2,
      life: 9,
      opacity: 0.28,
      color: 0x8a8a90,
      seed: 42,
    });
    this.attach(anchor, smoke, 0, height * 0.6, 0);
    return glow;
  }

  update(delta, camera) {
    this.time += delta;
    for (const f of this.flames) f.update(delta, camera);
    for (const l of this.lights) {
      const t = this.time * l.rate;
      l.light.intensity = l.baseIntensity * flicker(t, 0.25);
      if (l.jitter) {
        l.light.position.x = l.base.x + noiseOffset(t + 13.7) * l.jitter;
        l.light.position.z = l.base.z + noiseOffset(t + 29.1) * l.jitter;
      }
    }
  }

  dispose() {
    for (const f of this.flames) f.dispose();
    this.flames = [];
    for (const l of this.lights) {
      l.light.removeFromParent();
      l.light.dispose();
    }
    this.lights = [];
    this.column = null;
    for (const g of [...this.scene.children]) if (g.name === 'fire' || g.name === 'smoke-column' || g.name === 'haze') this.scene.remove(g);
    this.sprite?.dispose();
    this.sprite = null;
  }
}

/** -1..1 wander for the light position (the flame's centre of brightness moves). */
function noiseOffset(t) {
  return flicker(t, 1) - 1;
}
