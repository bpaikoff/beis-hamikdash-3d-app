import { mulberry32 } from './random.js';

// ============================================================================
// AUDIO - the Temple's ambience, all procedural on WebAudio (no recordings, no
// licences): wind from gusting low-passed noise, the altar fire's crackle from
// band-passed noise bursts, a crowd murmur from slowly modulated band-passed noise,
// birds as sparse oscillator chirps, and the Heichal's hush, a faint room tone.
//
// Where the listener stands sets the mix (`layerGains`, a pure function of the area,
// the time of day and the distance to the altar, so it is unit-tested): the wind is
// loudest on the mount and outside the walls, quieter in the courts, near silent
// indoors; the crowd fills the Ezras Nashim and the Ezras Yisrael by day; the birds
// sing outside by day (most at dawn); the fire is heard within ~60 m of the ma'aracha,
// falling off with the square of the distance; the hush replaces everything inside.
//
// Browsers only start audio on a gesture, so the context is created in `start()`
// from the HUD toggle's click (store.sound; `M` toggles it). Volume lives in the store
// and localStorage. The context suspends while the tab is hidden.
// ============================================================================

/** Which ambience an area belongs to (content area ids; anything unknown is the mount). */
export function zoneOf(areaId) {
  switch (areaId) {
    case 'ezras_nashim':
      return 'nashim';
    case 'azaras_yisrael':
      return 'yisrael';
    case 'azaras_kohanim':
      return 'kohanim';
    case 'ulam':
      return 'ulam';
    case 'heichal':
    case 'kodesh_hakodashim':
      return 'heichal';
    default:
      return 'mount';
  }
}

/**
 * Per-zone levels (0..1) before the time of day and the fire's distance are applied.
 * `fire` is the zone's ceiling for the crackle: the walls of the building shut it out.
 */
export const ZONE_MIX = {
  mount: { wind: 1.0, crowd: 0.12, birds: 1.0, fire: 1.0, hush: 0 },
  nashim: { wind: 0.5, crowd: 1.0, birds: 0.3, fire: 1.0, hush: 0 },
  yisrael: { wind: 0.45, crowd: 0.8, birds: 0.2, fire: 1.0, hush: 0 },
  kohanim: { wind: 0.4, crowd: 0.35, birds: 0.15, fire: 1.0, hush: 0 },
  ulam: { wind: 0.15, crowd: 0.1, birds: 0.05, fire: 0.25, hush: 0.5 },
  heichal: { wind: 0.04, crowd: 0, birds: 0, fire: 0, hush: 1.0 },
};

/** How the day shapes the crowd (busiest mid-day) and the birds (the dawn chorus). */
export const DAY_MIX = {
  dawn: { crowd: 0.45, birds: 1.0 },
  morning: { crowd: 1.0, birds: 0.8 },
  afternoon: { crowd: 1.0, birds: 0.6 },
  dusk: { crowd: 0.3, birds: 0.2 },
};

/** The fire is at full within this radius of the ma'aracha and inaudible past FIRE_FAR (metres). */
export const FIRE_NEAR = 12;
export const FIRE_FAR = 60;

/** Gain of the fire by distance from the ma'aracha: inverse square past FIRE_NEAR, 0 past FIRE_FAR. */
export function fireFalloff(distance) {
  if (!(distance >= 0) || distance >= FIRE_FAR) return 0;
  const d = Math.max(0, distance - FIRE_NEAR) / FIRE_NEAR;
  const g = 1 / (1 + d * d);
  // Fade the tail to exactly zero at FIRE_FAR so nothing pops at the boundary.
  const tail = Math.min(1, (FIRE_FAR - distance) / 10);
  return g * tail;
}

/**
 * The mix for a listener: per-layer gains in 0..1.
 * @param {{ area?: string|null, timeOfDay?: string, fireDistance?: number }} o
 *   `area` the content area id the player is in (null: the mount), `fireDistance` metres
 *   from the listener to the ma'aracha (Infinity when unknown).
 */
export function layerGains({ area = null, timeOfDay = 'morning', fireDistance = Infinity } = {}) {
  const zone = ZONE_MIX[zoneOf(area)];
  const day = DAY_MIX[timeOfDay] ?? DAY_MIX.morning;
  return {
    wind: zone.wind,
    fire: zone.fire * fireFalloff(fireDistance),
    crowd: zone.crowd * day.crowd,
    birds: zone.birds * day.birds,
    hush: zone.hush,
  };
}

/** Absolute level of each layer at gain 1 (the mix balance), applied under the master volume. */
export const LEVELS = { wind: 0.4, fire: 0.7, crowd: 0.22, birds: 0.35, hush: 0.1 };

/** How quickly a layer follows its target (seconds; setTargetAtTime's time constant). */
const RAMP = 0.6;
/** How often the mix is recomputed (seconds). */
const MIX_INTERVAL = 0.25;
const NOISE_SECONDS = 4;

const STORAGE_KEY = 'mikdash.audio';

/** Read the remembered {sound, volume} (localStorage; absent or unreadable -> muted at 0.7). */
export function loadAudioPrefs(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  const prefs = { sound: false, volume: 0.7 };
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (typeof v.sound === 'boolean') prefs.sound = v.sound;
      if (Number.isFinite(v.volume)) prefs.volume = Math.min(1, Math.max(0, v.volume));
    }
  } catch {
    /* private mode, quota, bad JSON: defaults */
  }
  return prefs;
}

export function saveAudioPrefs({ sound, volume }, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ sound, volume }));
  } catch {
    /* ignore */
  }
}

/** A looping white-noise source (seeded, so every session's texture is the same). */
function noiseSource(ctx, seed) {
  const rate = ctx.sampleRate || 44100;
  const buffer = ctx.createBuffer(1, Math.floor(rate * NOISE_SECONDS), rate);
  const data = buffer.getChannelData(0);
  const rand = mulberry32(seed);
  for (let i = 0; i < data.length; i++) data[i] = rand() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

/**
 * The ambience mixer. Nothing is allocated before `start()`, which needs a user gesture.
 *
 * @param {{ createContext?: () => AudioContext, document?: Document, random?: () => number }} [o]
 *   `createContext` is injected by the tests (a fake context); `document` for the
 *   visibility hook; `random` for the chirp/crackle timing.
 */
export class Ambience {
  constructor(o = {}) {
    this.createContext = o.createContext ?? (() => new (window.AudioContext || window.webkitAudioContext)());
    this.doc = o.document ?? (typeof document !== 'undefined' ? document : null);
    this.random = o.random ?? mulberry32(7);
    this.ctx = null;
    this.enabled = false;
    this.volume = 0.7;
    this.fire = null; // [x, y, z] of the ma'aracha, metres
    this.layers = null; // { wind, fire, crowd, birds, hush } gain nodes
    this.gains = { wind: 0, fire: 0, crowd: 0, birds: 0, hush: 0 }; // last targets
    this.mixAcc = 0;
    this.nextChirp = 2;
    this.nextCrackle = 0;
    this.onVisibility = () => this.applyState();
    this.doc?.addEventListener('visibilitychange', this.onVisibility);
  }

  /** True once the context runs (audio audible). */
  get running() {
    return Boolean(this.ctx) && this.ctx.state === 'running' && this.enabled;
  }

  /**
   * Create the context and the graph (call from a click / key handler) and run it.
   * Safe to call again: a second call only resumes.
   */
  start() {
    if (!this.ctx) {
      try {
        this.ctx = this.createContext();
      } catch (e) {
        console.warn('audio unavailable:', e?.message ?? e);
        return false;
      }
      this.buildGraph();
    }
    this.enabled = true;
    this.applyState();
    return true;
  }

  /** Mute (the context is suspended; the graph stays for a later start). */
  stop() {
    this.enabled = false;
    this.applyState();
  }

  setEnabled(on) {
    if (on) this.start();
    else this.stop();
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, Number(v) || 0));
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
  }

  /** Run while enabled and the tab is visible, suspended otherwise. */
  applyState() {
    const ctx = this.ctx;
    if (!ctx) return;
    const visible = !this.doc || this.doc.visibilityState !== 'hidden';
    if (this.enabled && visible) {
      if (ctx.state !== 'running') ctx.resume?.()?.catch?.(() => {});
    } else if (ctx.state === 'running') {
      ctx.suspend?.()?.catch?.(() => {});
    }
  }

  buildGraph() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    const layer = (name) => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.master);
      g.name = name;
      return g;
    };
    this.layers = { wind: layer('wind'), fire: layer('fire'), crowd: layer('crowd'), birds: layer('birds'), hush: layer('hush') };

    // Wind: low-passed noise whose cutoff breathes with a slow LFO (the gusts), plus a
    // random walk on the layer's own gain in update().
    {
      const src = noiseSource(ctx, 101);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      lp.Q.value = 0.7;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.06;
      const depth = ctx.createGain();
      depth.gain.value = 160;
      lfo.connect(depth);
      depth.connect(lp.frequency);
      src.connect(lp);
      lp.connect(this.layers.wind);
      src.start(t);
      lfo.start(t);
      this.wind = { src, lp, lfo, gust: 1 };
    }
    // Fire: a low rumble (low-passed noise) and the crackle, band-passed noise gated by
    // short random bursts scheduled in update().
    {
      const src = noiseSource(ctx, 202);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 180;
      const rumble = ctx.createGain();
      rumble.gain.value = 0.5;
      src.connect(lp);
      lp.connect(rumble);
      rumble.connect(this.layers.fire);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2200;
      bp.Q.value = 0.9;
      const crackle = ctx.createGain();
      crackle.gain.value = 0.12;
      src.connect(bp);
      bp.connect(crackle);
      crackle.connect(this.layers.fire);
      src.start(t);
      this.fireNodes = { src, crackle };
    }
    // Crowd: band-passed noise around the voice band, swelling and ebbing with an LFO.
    {
      const src = noiseSource(ctx, 303);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 420;
      bp.Q.value = 0.5;
      const swell = ctx.createGain();
      swell.gain.value = 0.7;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.21;
      const depth = ctx.createGain();
      depth.gain.value = 0.25;
      lfo.connect(depth);
      depth.connect(swell.gain);
      src.connect(bp);
      bp.connect(swell);
      swell.connect(this.layers.crowd);
      src.start(t);
      lfo.start(t);
      this.crowd = { src, lfo };
    }
    // Hush: the room tone, low-passed noise at a whisper.
    {
      const src = noiseSource(ctx, 404);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 110;
      src.connect(lp);
      lp.connect(this.layers.hush);
      src.start(t);
      this.hush = { src };
    }
    this.chirps = 0;
  }

  /**
   * One bird call: a sine sweeping up and back over each note, three to five notes,
   * panned to one side. The oscillator stops itself.
   */
  chirp() {
    const ctx = this.ctx;
    const r = this.random;
    const t0 = ctx.currentTime + 0.02;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    const base = 2400 + r() * 1400;
    const notes = 3 + Math.floor(r() * 3);
    const gap = 0.09 + r() * 0.06;
    for (let n = 0; n < notes; n++) {
      const t = t0 + n * gap;
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.linearRampToValueAtTime(base * (1.25 + r() * 0.2), t + gap * 0.45);
      osc.frequency.linearRampToValueAtTime(base * 0.95, t + gap * 0.8);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.6 + r() * 0.4, t + gap * 0.2);
      env.gain.linearRampToValueAtTime(0, t + gap * 0.85);
    }
    osc.connect(env);
    let out = env;
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = r() * 1.4 - 0.7;
      env.connect(pan);
      out = pan;
    }
    out.connect(this.layers.birds);
    osc.start(t0);
    osc.stop(t0 + notes * gap + 0.05);
    this.chirps++;
  }

  /** One crackle: the band-passed noise flares for a few tens of milliseconds. */
  crackle() {
    const g = this.fireNodes.crackle.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues?.(t);
    g.setValueAtTime(0.5 + this.random() * 0.9, t);
    g.setTargetAtTime(0.12, t + 0.01, 0.02 + this.random() * 0.03);
  }

  /**
   * Per frame: recompute the mix every MIX_INTERVAL seconds and ramp the layers to it;
   * schedule the crackles and the chirps. `listener` is the camera position (metres).
   * @param {number} delta seconds
   * @param {{ area?: string|null, timeOfDay?: string, listener?: {x:number,y:number,z:number} }} state
   */
  update(delta, state = {}) {
    if (!this.running) return;
    this.mixAcc += delta;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (this.mixAcc >= MIX_INTERVAL) {
      this.mixAcc = 0;
      const l = state.listener;
      const fireDistance = l && this.fire ? Math.hypot(l.x - this.fire[0], l.y - this.fire[1], l.z - this.fire[2]) : Infinity;
      const g = layerGains({ area: state.area, timeOfDay: state.timeOfDay, fireDistance });
      // The wind gusts: a random walk on its level, 0.55..1.45 of the zone's.
      this.wind.gust = Math.min(1.45, Math.max(0.55, this.wind.gust + (this.random() - 0.5) * 0.3));
      g.wind *= this.wind.gust;
      this.gains = g;
      for (const name of Object.keys(this.layers)) {
        this.layers[name].gain.setTargetAtTime(g[name] * LEVELS[name], now, RAMP);
      }
    }
    // Crackles: several a second beside the ma'aracha, sparser as the fire fades, none out
    // of earshot. The countdown runs at the layer's current gain, so moving between zones
    // takes effect at once instead of after a wait set somewhere else.
    if (this.gains.fire > 0.02) {
      this.nextCrackle -= delta * Math.min(1, this.gains.fire + 0.3);
      if (this.nextCrackle <= 0) {
        this.crackle();
        this.nextCrackle = 0.05 + this.random() * 0.35;
      }
    }
    // Birds: sparse, one call every few seconds where they sing, rarer where they are faint.
    if (this.gains.birds > 0.02) {
      this.nextChirp -= delta * Math.min(1, this.gains.birds + 0.25);
      if (this.nextChirp <= 0) {
        this.chirp();
        this.nextChirp = 2 + this.random() * 5;
      }
    }
  }

  dispose() {
    this.doc?.removeEventListener('visibilitychange', this.onVisibility);
    const ctx = this.ctx;
    this.ctx = null;
    this.enabled = false;
    this.layers = null;
    ctx?.close?.()?.catch?.(() => {});
  }
}
