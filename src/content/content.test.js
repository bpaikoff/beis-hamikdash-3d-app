import { describe, it, expect } from 'vitest';
import { entries, areas, keilim, hotspots, worldPos, worldBounds } from './index.js';
import { toWorld, toAmos, formatLength } from './units.js';

describe('content/temple.json', () => {
  it('has unique snake_case ids', () => {
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9_]+$/);
  });
  it('every entry has bilingual name and desc, a type, and a position in the azarah frame', () => {
    for (const e of entries) {
      expect(e.name?.he, e.id).toBeTruthy();
      expect(e.name?.en, e.id).toBeTruthy();
      expect(e.desc?.he, e.id).toBeTruthy();
      expect(e.desc?.en, e.id).toBeTruthy();
      expect(['area', 'kli', 'gate', 'chamber', 'structure']).toContain(e.type);
      expect(e.position?.frame, e.id).toBe('azarah');
      expect(e.position?.unit, e.id).toBe('amah');
      for (const k of ['x', 'y', 'z']) expect(typeof e.position[k], `${e.id}.${k}`).toBe('number');
    }
  });
  it('areas carry bounds and keilim carry at least one source', () => {
    for (const a of areas) for (const k of ['minX', 'maxX', 'minZ', 'maxZ']) expect(typeof a.bounds?.[k], a.id).toBe('number');
    for (const k of keilim) expect(k.sources?.length, k.id).toBeGreaterThan(0);
  });
  it('periods are known and bayis_rishon items are hidden by default', () => {
    for (const e of entries) for (const p of e.period ?? []) expect(['bayis_rishon', 'bayis_sheni']).toContain(p);
    const shown = hotspots().map((e) => e.id);
    for (const e of keilim.filter((e) => e.period?.length === 1 && e.period[0] === 'bayis_rishon')) expect(shown).not.toContain(e.id);
  });
  it('dimensions and sources look like Sefaria refs', () => {
    const refLike = /^[A-Z][A-Za-z' ,]+ \d+(:\d+)?[ab]?(:\d+)?$/;
    for (const e of entries) {
      for (const d of e.dimensions ?? []) expect(d.source, `${e.id} ${d.label}`).toMatch(refLike);
      for (const s of e.sources ?? []) expect(s, e.id).toMatch(refLike);
    }
  });
});

describe('units', () => {
  it('round-trips amos and metres', () => {
    const [x, y, z] = toWorld({ x: 10, y: 2, z: -20 });
    expect(toAmos(x, y, z)).toEqual({ x: 10, y: 2, z: -20 });
    expect(worldPos({ position: { x: 0, y: 0, z: 0 } })).toEqual([0, 6.8, 8]);
  });
  it('formats lengths', () => {
    expect(formatLength(32)).toBe('32 amos (16 m)');
    expect(formatLength(1)).toBe('1 amos (0.5 m)');
  });
  it('normalises bounds', () => {
    const b = worldBounds({ bounds: { minX: -10, maxX: 10, minZ: -40, maxZ: 0 } });
    expect(b.minX).toBeLessThan(b.maxX);
    expect(b.minZ).toBeLessThan(b.maxZ);
  });
});
