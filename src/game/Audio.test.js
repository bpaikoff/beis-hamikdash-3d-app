import { describe, it, expect } from 'vitest';
import {
  Ambience, layerGains, zoneOf, fireFalloff, loadAudioPrefs, saveAudioPrefs, ZONE_MIX, DAY_MIX, LEVELS, FIRE_NEAR, FIRE_FAR,
} from './Audio.js';

// ----------------------------------------------------------------------------
// A fake WebAudio graph: enough of the API for the mixer to build and drive it, with
// every node and every scheduled AudioParam call recorded.
// ----------------------------------------------------------------------------
class FakeParam {
  constructor(value = 0) {
    this.value = value;
    this.events = [];
  }
  setValueAtTime(v, t) { this.events.push(['set', v, t]); this.value = v; }
  setTargetAtTime(v, t, tc) { this.events.push(['target', v, t, tc]); this.value = v; }
  linearRampToValueAtTime(v, t) { this.events.push(['ramp', v, t]); this.value = v; }
  cancelScheduledValues(t) { this.events.push(['cancel', t]); }
}
class FakeNode {
  constructor(ctx, kind) {
    this.ctx = ctx;
    this.kind = kind;
    this.outputs = [];
    this.started = null;
    this.stopped = null;
  }
  connect(to) { this.outputs.push(to); return to; }
  start(t) { this.started = t ?? this.ctx.currentTime; }
  stop(t) { this.stopped = t; }
}
class FakeContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.sampleRate = 48000;
    this.destination = new FakeNode(this, 'destination');
    this.nodes = [];
    this.resumed = 0;
    this.suspended = 0;
    this.closed = false;
  }
  node(kind, params) {
    const n = new FakeNode(this, kind);
    Object.assign(n, params);
    this.nodes.push(n);
    return n;
  }
  createGain() { return this.node('gain', { gain: new FakeParam(1) }); }
  createBiquadFilter() { return this.node('biquad', { type: 'lowpass', frequency: new FakeParam(350), Q: new FakeParam(1) }); }
  createOscillator() { return this.node('osc', { type: 'sine', frequency: new FakeParam(440) }); }
  createStereoPanner() { return this.node('panner', { pan: new FakeParam(0) }); }
  createBufferSource() { return this.node('source', { buffer: null, loop: false }); }
  createBuffer(channels, length, rate) {
    const data = new Float32Array(length);
    return { length, sampleRate: rate, numberOfChannels: channels, getChannelData: () => data };
  }
  async resume() { this.state = 'running'; this.resumed++; }
  async suspend() { this.state = 'suspended'; this.suspended++; }
  async close() { this.state = 'closed'; this.closed = true; }
}
const fakeDoc = (visibilityState = 'visible') => {
  const listeners = {};
  return {
    visibilityState,
    addEventListener: (k, fn) => { listeners[k] = fn; },
    removeEventListener: (k) => { delete listeners[k]; },
    fire: (k) => listeners[k]?.(),
    listeners,
  };
};
const memStorage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m };
};

describe('layerGains (area + time of day -> per-layer gains)', () => {
  it('maps the content areas to zones, unknown ones to the mount', () => {
    expect(zoneOf('har_habayis')).toBe('mount');
    expect(zoneOf('outside')).toBe('mount');
    expect(zoneOf(null)).toBe('mount');
    expect(zoneOf('ezras_nashim')).toBe('nashim');
    expect(zoneOf('azaras_yisrael')).toBe('yisrael');
    expect(zoneOf('azaras_kohanim')).toBe('kohanim');
    expect(zoneOf('ulam')).toBe('ulam');
    expect(zoneOf('heichal')).toBe('heichal');
    expect(zoneOf('kodesh_hakodashim')).toBe('heichal');
    for (const z of Object.values(ZONE_MIX)) for (const v of Object.values(z)) expect(v).toBeGreaterThanOrEqual(0);
    for (const d of Object.values(DAY_MIX)) for (const v of Object.values(d)) expect(v).toBeLessThanOrEqual(1);
  });

  it('wind: loudest on the mount, quieter in the courts, near silent indoors', () => {
    const mount = layerGains({ area: 'har_habayis' }).wind;
    const outside = layerGains({ area: 'outside' }).wind;
    const nashim = layerGains({ area: 'ezras_nashim' }).wind;
    const kohanim = layerGains({ area: 'azaras_kohanim' }).wind;
    const heichal = layerGains({ area: 'heichal' }).wind;
    expect(mount).toBe(1);
    expect(outside).toBe(mount);
    expect(nashim).toBeLessThan(mount);
    expect(kohanim).toBeLessThanOrEqual(nashim);
    expect(heichal).toBeLessThan(0.1);
  });

  it('crowd: the Ezras Nashim and Ezras Yisrael by day, faint at dawn and dusk, none in the Heichal', () => {
    const at = (area, timeOfDay) => layerGains({ area, timeOfDay }).crowd;
    expect(at('ezras_nashim', 'morning')).toBe(1);
    expect(at('azaras_yisrael', 'afternoon')).toBeGreaterThan(0.5);
    expect(at('azaras_kohanim', 'morning')).toBeLessThan(at('azaras_yisrael', 'morning'));
    expect(at('ezras_nashim', 'dawn')).toBeLessThan(0.5);
    expect(at('ezras_nashim', 'dusk')).toBeLessThan(at('ezras_nashim', 'dawn'));
    expect(at('heichal', 'morning')).toBe(0);
    expect(at('har_habayis', 'morning')).toBeLessThan(0.2); // a distant murmur only
  });

  it('birds: outside by day, most at dawn, none indoors', () => {
    const at = (area, timeOfDay) => layerGains({ area, timeOfDay }).birds;
    expect(at('har_habayis', 'dawn')).toBe(1);
    expect(at('har_habayis', 'morning')).toBeLessThan(at('har_habayis', 'dawn'));
    expect(at('har_habayis', 'dusk')).toBeLessThan(at('har_habayis', 'afternoon'));
    expect(at('ezras_nashim', 'morning')).toBeLessThan(at('har_habayis', 'morning'));
    expect(at('heichal', 'morning')).toBe(0);
    expect(at('kodesh_hakodashim', 'dawn')).toBe(0);
  });

  it('fire: full beside the ma\'aracha, falling with the square of the distance, silent past FIRE_FAR and indoors', () => {
    expect(fireFalloff(0)).toBe(1);
    expect(fireFalloff(FIRE_NEAR)).toBe(1);
    expect(fireFalloff(FIRE_NEAR * 2)).toBeCloseTo(0.5, 5);
    expect(fireFalloff(FIRE_NEAR * 3)).toBeCloseTo(0.2, 5);
    expect(fireFalloff(FIRE_FAR - 1)).toBeGreaterThan(0);
    expect(fireFalloff(FIRE_FAR)).toBe(0);
    expect(fireFalloff(Infinity)).toBe(0);
    expect(fireFalloff(NaN)).toBe(0);
    // Monotone.
    let last = 1;
    for (let d = 0; d <= FIRE_FAR; d += 0.5) {
      const g = fireFalloff(d);
      expect(g).toBeLessThanOrEqual(last + 1e-9);
      last = g;
    }
    expect(layerGains({ area: 'azaras_kohanim', fireDistance: 5 }).fire).toBe(1);
    expect(layerGains({ area: 'ezras_nashim', fireDistance: 40 }).fire).toBeCloseTo(fireFalloff(40), 9);
    expect(layerGains({ area: 'heichal', fireDistance: 5 }).fire).toBe(0);
    expect(layerGains({ area: 'ulam', fireDistance: 5 }).fire).toBeLessThan(0.5);
    expect(layerGains({ area: 'azaras_kohanim' }).fire).toBe(0); // distance unknown
  });

  it('hush: the Heichal only (half in the Ulam)', () => {
    expect(layerGains({ area: 'heichal' }).hush).toBe(1);
    expect(layerGains({ area: 'kodesh_hakodashim' }).hush).toBe(1);
    expect(layerGains({ area: 'ulam' }).hush).toBeGreaterThan(0);
    expect(layerGains({ area: 'ulam' }).hush).toBeLessThan(1);
    for (const a of ['har_habayis', 'ezras_nashim', 'azaras_yisrael', 'azaras_kohanim']) expect(layerGains({ area: a }).hush).toBe(0);
    // Every gain is 0..1 for every area and time.
    for (const a of [null, 'outside', 'har_habayis', 'ezras_nashim', 'azaras_yisrael', 'azaras_kohanim', 'ulam', 'heichal', 'kodesh_hakodashim']) {
      for (const t of ['dawn', 'morning', 'afternoon', 'dusk']) {
        for (const [k, v] of Object.entries(layerGains({ area: a, timeOfDay: t, fireDistance: 10 }))) {
          expect(v, `${a} ${t} ${k}`).toBeGreaterThanOrEqual(0);
          expect(v, `${a} ${t} ${k}`).toBeLessThanOrEqual(1);
        }
      }
    }
    expect(Object.keys(LEVELS).sort()).toEqual(['birds', 'crowd', 'fire', 'hush', 'wind']);
  });
});

describe('audio preferences', () => {
  it('default to muted at 0.7, round-trip through storage and survive bad values', () => {
    expect(loadAudioPrefs(null)).toEqual({ sound: false, volume: 0.7 });
    const s = memStorage();
    expect(loadAudioPrefs(s)).toEqual({ sound: false, volume: 0.7 });
    saveAudioPrefs({ sound: true, volume: 0.35 }, s);
    expect(loadAudioPrefs(s)).toEqual({ sound: true, volume: 0.35 });
    s.setItem('mikdash.audio', '{not json');
    expect(loadAudioPrefs(s)).toEqual({ sound: false, volume: 0.7 });
    s.setItem('mikdash.audio', JSON.stringify({ sound: 'yes', volume: 7 }));
    expect(loadAudioPrefs(s)).toEqual({ sound: false, volume: 1 });
    const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    expect(loadAudioPrefs(throwing)).toEqual({ sound: false, volume: 0.7 });
    expect(() => saveAudioPrefs({ sound: true, volume: 1 }, throwing)).not.toThrow();
  });
});

describe('Ambience (mocked AudioContext)', () => {
  const make = (doc = fakeDoc()) => {
    let ctx = null;
    const amb = new Ambience({ createContext: () => (ctx = new FakeContext()), document: doc, random: () => 0.5 });
    return { amb, doc, ctx: () => ctx };
  };

  it('allocates nothing until start(), then builds five layers under a master and resumes the context', () => {
    const { amb, ctx } = make();
    expect(ctx()).toBeNull();
    expect(amb.running).toBe(false);
    amb.update(1, { area: 'har_habayis' }); // a no-op before start
    expect(amb.start()).toBe(true);
    const c = ctx();
    expect(c).toBeTruthy();
    expect(c.resumed).toBe(1);
    expect(Object.keys(amb.layers).sort()).toEqual(['birds', 'crowd', 'fire', 'hush', 'wind']);
    for (const l of Object.values(amb.layers)) {
      expect(l.gain.value).toBe(0); // silent until the first mix
      expect(l.outputs).toEqual([amb.master]);
    }
    expect(amb.master.outputs).toEqual([c.destination]);
    // Four looping noise sources (wind, fire, crowd, hush), all started; two LFOs.
    const sources = c.nodes.filter((n) => n.kind === 'source');
    expect(sources).toHaveLength(4);
    for (const s of sources) {
      expect(s.loop).toBe(true);
      expect(s.buffer.length).toBe(48000 * 4);
      expect(s.started).not.toBeNull();
    }
    expect(c.nodes.filter((n) => n.kind === 'osc')).toHaveLength(2);
    // Wind: noise -> lowpass; the LFO drives the cutoff.
    expect(amb.wind.lp.type).toBe('lowpass');
    expect(amb.wind.lfo.frequency.value).toBeLessThan(0.5);
    const depth = amb.wind.lfo.outputs[0];
    expect(depth.outputs[0]).toBe(amb.wind.lp.frequency);
    // The seeded noise is deterministic and spans -1..1.
    const data = sources[0].buffer.getChannelData(0);
    expect(Math.min(...data.slice(0, 5000))).toBeLessThan(-0.9);
    expect(Math.max(...data.slice(0, 5000))).toBeGreaterThan(0.9);
    expect(amb.start()).toBe(true); // idempotent: no second graph
    expect(c.nodes.filter((n) => n.kind === 'source')).toHaveLength(4);
  });

  it('mixes by area and time and ramps the layer gains toward LEVELS x layerGains', () => {
    const { amb } = make();
    amb.start();
    amb.fire = [0, 13, -11];
    amb.update(0.3, { area: 'azaras_kohanim', timeOfDay: 'morning', listener: { x: 0, y: 13, z: -1 } }); // 10 m from the fire
    expect(amb.gains.fire).toBe(1);
    const fireEv = amb.layers.fire.gain.events.at(-1);
    expect(fireEv[0]).toBe('target');
    expect(fireEv[1]).toBeCloseTo(LEVELS.fire, 9);
    expect(amb.layers.hush.gain.events.at(-1)[1]).toBe(0);
    // The wind's random walk stays within its band of the zone level.
    expect(amb.gains.wind).toBeGreaterThan(0.4 * 0.5);
    expect(amb.gains.wind).toBeLessThan(0.4 * 1.5);
    // Into the Heichal: the fire and the crowd go, the hush comes.
    amb.update(0.3, { area: 'heichal', timeOfDay: 'morning', listener: { x: 0, y: 12.75, z: -50 } });
    expect(amb.gains.fire).toBe(0);
    expect(amb.gains.crowd).toBe(0);
    expect(amb.layers.hush.gain.events.at(-1)[1]).toBeCloseTo(LEVELS.hush, 9);
    // Between mixes (under the interval) nothing is rescheduled.
    const n = amb.layers.wind.gain.events.length;
    amb.update(0.1, { area: 'heichal', timeOfDay: 'morning' });
    expect(amb.layers.wind.gain.events.length).toBe(n);
  });

  it('schedules crackles near the fire and chirps on the mount by day, neither in the Heichal', () => {
    const { amb, ctx } = make();
    amb.start();
    amb.fire = [0, 13, -11];
    const near = { x: 3, y: 13, z: -11 };
    for (let i = 0; i < 40; i++) amb.update(0.1, { area: 'azaras_kohanim', timeOfDay: 'morning', listener: near });
    const crackles = amb.fireNodes.crackle.gain.events.filter((e) => e[0] === 'set');
    expect(crackles.length).toBeGreaterThan(5); // several a second beside the ma'aracha
    expect(amb.chirps).toBeLessThanOrEqual(1); // birds are faint in the Kohanim court (0.15 x 0.8): one call at most in 4 s
    const oscBefore = ctx().nodes.filter((n) => n.kind === 'osc').length;
    for (let i = 0; i < 100; i++) amb.update(0.1, { area: 'har_habayis', timeOfDay: 'dawn', listener: { x: 0, y: 1.7, z: 150 } });
    expect(amb.chirps).toBeGreaterThanOrEqual(2);
    const oscs = ctx().nodes.filter((n) => n.kind === 'osc').slice(oscBefore);
    expect(oscs.length).toBe(amb.chirps);
    for (const o of oscs) {
      expect(o.started).not.toBeNull();
      expect(o.stopped).toBeGreaterThan(o.started); // every chirp ends itself
      expect(o.frequency.events.length).toBeGreaterThanOrEqual(9); // 3+ notes, each a set and two ramps
      const env = o.outputs[0];
      expect(env.kind).toBe('gain');
      expect(env.gain.events.some((e) => e[0] === 'ramp' && e[1] > 0)).toBe(true);
    }
    const chirpsBefore = amb.chirps;
    const cracklesBefore = amb.fireNodes.crackle.gain.events.length;
    for (let i = 0; i < 100; i++) amb.update(0.1, { area: 'heichal', timeOfDay: 'morning', listener: { x: 0, y: 12.75, z: -50 } });
    expect(amb.chirps).toBe(chirpsBefore);
    expect(amb.fireNodes.crackle.gain.events.length).toBe(cracklesBefore);
  });

  it('follows the toggle, the volume and the tab visibility; dispose closes the context', () => {
    const doc = fakeDoc();
    const { amb, ctx } = make(doc);
    amb.setVolume(0.3); // before start: remembered for the master
    amb.start();
    const c = ctx();
    expect(amb.master.gain.value).toBe(0.3);
    amb.setVolume(2);
    expect(amb.volume).toBe(1);
    expect(amb.master.gain.events.at(-1)[1]).toBe(1);
    expect(amb.running).toBe(true);
    doc.visibilityState = 'hidden';
    doc.fire('visibilitychange');
    expect(c.state).toBe('suspended');
    expect(amb.running).toBe(false);
    doc.visibilityState = 'visible';
    doc.fire('visibilitychange');
    expect(c.state).toBe('running');
    amb.setEnabled(false);
    expect(c.state).toBe('suspended');
    expect(amb.running).toBe(false);
    amb.setEnabled(true);
    expect(c.state).toBe('running');
    amb.dispose();
    expect(c.closed).toBe(true);
    expect(amb.ctx).toBeNull();
    expect(doc.listeners.visibilitychange).toBeUndefined();
    amb.update(1, { area: 'heichal' }); // harmless after dispose
  });

  it('reports failure when no context can be made', () => {
    const amb = new Ambience({ createContext: () => { throw new Error('no audio'); }, document: fakeDoc() });
    expect(amb.start()).toBe(false);
    expect(amb.running).toBe(false);
    amb.dispose();
  });
});
