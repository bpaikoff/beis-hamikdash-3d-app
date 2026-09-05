import { describe, it, expect } from 'vitest';
import { SUN, TIMES_OF_DAY, DEFAULT_TIME, parseTimeOfDay, sunDirection, skyRadiance, sunTransmittance, acesFilmic, daylight } from './sun.js';

const len = (v) => Math.hypot(v.x, v.y, v.z);
const deg = (r) => (r * 180) / Math.PI;

describe('sun position (scene frame: +y up, east +z, west -z, south -x)', () => {
  it('is a unit vector at the specified elevation for every time of day', () => {
    for (const t of TIMES_OF_DAY) {
      const d = sunDirection(t);
      expect(len(d)).toBeCloseTo(1, 6);
      expect(deg(Math.asin(d.y))).toBeCloseTo(SUN[t].elevation, 6);
    }
  });

  it('rises in the east and sets in the west', () => {
    expect(sunDirection('dawn').z).toBeGreaterThan(0.9); // just above the eastern horizon
    expect(sunDirection('morning').z).toBeGreaterThan(0); // still east of the meridian
    expect(sunDirection('afternoon').z).toBeLessThan(0); // past it, to the west
    expect(sunDirection('dusk').z).toBeLessThan(-0.9); // on the western horizon
    expect(sunDirection('dusk').y).toBeLessThan(sunDirection('morning').y);
  });

  it('keeps the daytime sun to the south (-x), as at Yerushalayim', () => {
    expect(sunDirection('morning').x).toBeLessThan(0);
    expect(sunDirection('afternoon').x).toBeLessThan(0);
    expect(sunDirection('afternoon').y).toBeGreaterThan(sunDirection('dawn').y);
  });

  it('parses ?time= and falls back to morning', () => {
    expect(DEFAULT_TIME).toBe('morning');
    expect(parseTimeOfDay('?time=dusk')).toBe('dusk');
    expect(parseTimeOfDay('?at=mizbeach&time=dawn')).toBe('dawn');
    expect(parseTimeOfDay('?time=midnight')).toBe('morning');
    expect(parseTimeOfDay('')).toBe('morning');
  });
});

describe('sky model (port of three/examples Sky.js)', () => {
  it('gives a blue zenith and a paler, warmer horizon in the morning', () => {
    const sun = sunDirection('morning');
    const zenith = skyRadiance({ x: 0, y: 1, z: 0 }, sun, SUN.morning);
    const horizon = skyRadiance({ x: 0, y: 0.02, z: -1 }, sun, SUN.morning);
    expect(zenith[2]).toBeGreaterThan(zenith[0]); // b > r
    expect(horizon[0] / horizon[2]).toBeGreaterThan(zenith[0] / zenith[2]); // horizon less blue
    for (const c of [...zenith, ...horizon]) expect(c).toBeGreaterThan(0);
  });

  it('reddens the sunlight at dawn and dusk and keeps it white by day', () => {
    const dawn = sunTransmittance(sunDirection('dawn'), SUN.dawn);
    const noon = sunTransmittance(sunDirection('morning'), SUN.morning);
    expect(dawn[0] / dawn[2]).toBeGreaterThan(2 * (noon[0] / noon[2]));
    expect(noon[2] / noon[0]).toBeGreaterThan(0.3); // blue survives the day-long path
    expect(dawn[2] / dawn[0]).toBeLessThan(0.1); // and hardly the dawn one
  });

  it('tone-maps into 0..1 monotonically', () => {
    expect(acesFilmic([0, 0, 0])).toEqual([0, 0, 0]);
    const a = acesFilmic([0.2, 0.2, 0.2], 0.85);
    const b = acesFilmic([0.8, 0.8, 0.8], 0.85);
    expect(b[0]).toBeGreaterThan(a[0]);
    expect(acesFilmic([50, 50, 50])[0]).toBeLessThanOrEqual(1);
  });

  it('daylight() dims and warms the sun toward dusk and tints the fog to the horizon', () => {
    const m = daylight('morning');
    const d = daylight('dusk');
    expect(m.sunIntensity).toBeGreaterThan(d.sunIntensity);
    expect(d.sunColor[0]).toBeCloseTo(1, 6);
    expect(d.sunColor[2]).toBeLessThan(m.sunColor[2]);
    for (const c of [...m.fogColor, ...d.fogColor]) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
    expect(daylight('nonsense').time).toBe('morning');
  });
});
