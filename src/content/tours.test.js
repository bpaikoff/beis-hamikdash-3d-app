import { describe, it, expect } from 'vitest';
import { tours, byTourId, tourEntry, stopCamera, stopLook } from './tours/index.js';
import { byId, entries } from './index.js';

const refLike = /^[A-Z][A-Za-z' ,]+ \d+(:\d+)?[ab]?(:\d+)?$/;
const bilingual = (o, where) => {
  expect(typeof o?.he, `${where}.he`).toBe('string');
  expect(o.he.trim(), `${where}.he`).not.toBe('');
  expect(typeof o?.en, `${where}.en`).toBe('string');
  expect(o.en.trim(), `${where}.en`).not.toBe('');
};
/** Every id a stop may point at: entries plus Beis HaMoked's children (until they are flattened). */
const knownIds = new Set([...entries.map((e) => e.id), ...entries.flatMap((e) => (e.children ?? []).map((c) => c.id))]);
/** Azarah rectangle (Mishnah Middot 5:1) with the Cheil strip for the chambers outside its wall. */
const CHEIL_OUTER = { minX: -83.5, maxX: 83.5, minZ: -203, maxZ: 6 };

describe('content/tours', () => {
  it('exports every tour by id with a snake_case id, bilingual title and intro, and verified-shaped sources', () => {
    expect(tours.length).toBeGreaterThan(0);
    for (const t of tours) {
      expect(t.id).toMatch(/^[a-z0-9_]+$/);
      expect(byTourId[t.id]).toBe(t);
      bilingual(t.title, `${t.id}.title`);
      bilingual(t.intro, `${t.id}.intro`);
      expect(t.sources.length).toBeGreaterThan(0);
      for (const s of t.sources) expect(s, t.id).toMatch(refLike);
    }
    expect(Object.keys(byTourId)).toEqual(tours.map((t) => t.id));
  });

  it('tamid has 10-14 stops with unique snake_case ids', () => {
    const t = byTourId.tamid;
    expect(t).toBeDefined();
    expect(t.stops.length).toBeGreaterThanOrEqual(10);
    expect(t.stops.length).toBeLessThanOrEqual(14);
    const ids = t.stops.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9_]+$/);
  });

  it('every stop targets an existing entry, looks at an entry or a point, and dwells 5-20 s', () => {
    for (const t of tours)
      for (const s of t.stops) {
        const where = `${t.id}.${s.id}`;
        expect(knownIds.has(s.at), `${where}.at=${s.at}`).toBe(true);
        expect(tourEntry(s.at), where).toBeDefined();
        if (typeof s.look === 'string') expect(knownIds.has(s.look), `${where}.look=${s.look}`).toBe(true);
        else {
          expect(typeof s.look?.x, `${where}.look.x`).toBe('number');
          expect(typeof s.look?.z, `${where}.look.z`).toBe('number');
        }
        expect(typeof s.dwell, `${where}.dwell`).toBe('number');
        expect(s.dwell, `${where}.dwell`).toBeGreaterThanOrEqual(5);
        expect(s.dwell, `${where}.dwell`).toBeLessThanOrEqual(20);
      }
  });

  it('every stop has exactly one of camera (amos) or offset (metres), inside the courts', () => {
    for (const t of tours)
      for (const s of t.stops) {
        const where = `${t.id}.${s.id}`;
        expect(Boolean(s.camera) !== Boolean(s.offset), `${where}: camera xor offset`).toBe(true);
        if (s.camera) for (const k of ['x', 'y', 'z']) expect(typeof s.camera[k], `${where}.camera.${k}`).toBe('number');
        if (s.offset) {
          for (const k of ['dx', 'dz']) expect(typeof s.offset[k], `${where}.offset.${k}`).toBe('number');
          expect(Math.hypot(s.offset.dx, s.offset.dz), `${where}.offset within 8 m`).toBeLessThanOrEqual(8);
        }
        const c = stopCamera(s);
        expect(c.x, `${where}.x`).toBeGreaterThanOrEqual(CHEIL_OUTER.minX);
        expect(c.x, `${where}.x`).toBeLessThanOrEqual(CHEIL_OUTER.maxX);
        expect(c.z, `${where}.z`).toBeGreaterThanOrEqual(CHEIL_OUTER.minZ);
        expect(c.z, `${where}.z`).toBeLessThanOrEqual(CHEIL_OUTER.maxZ);
        const l = stopLook(s);
        expect(typeof l.x).toBe('number');
        expect(typeof l.z).toBe('number');
        expect(Math.hypot(l.x - c.x, l.z - c.z), `${where}: look target is not the camera`).toBeGreaterThan(1);
      }
  });

  it('no camera stands inside the altar or the Heichal walls', () => {
    const inside = (c, b) => c.x > b.minX && c.x < b.maxX && c.z > b.minZ && c.z < b.maxZ;
    const altarTop = { minX: -16, maxX: 16, minZ: -54, maxZ: -22 };
    for (const t of tours)
      for (const s of t.stops) {
        const c = stopCamera(s);
        expect(inside(c, altarTop) && c.y < 12.5, `${t.id}.${s.id} inside the altar`).toBe(false);
        // Heichal walls are 6 thick (z -92..-98 and x +-10..+-16 along the interior); the doorway is open.
        if (c.z < -92 && c.z > -98) expect(Math.abs(c.x), `${t.id}.${s.id} in the Heichal east wall`).toBeLessThan(5);
        if (c.z <= -98 && c.z >= -159) expect(Math.abs(c.x) < 10 || Math.abs(c.x) > 35, `${t.id}.${s.id} in the building's walls`).toBe(true);
      }
  });

  it('every stop has bilingual title and text, 2-4 ref-shaped sources listed on the tour, and 1-2 bilingual questions', () => {
    for (const t of tours) {
      const top = new Set(t.sources);
      for (const s of t.stops) {
        const where = `${t.id}.${s.id}`;
        bilingual(s.title, `${where}.title`);
        bilingual(s.text, `${where}.text`);
        expect(s.sources.length, `${where}.sources`).toBeGreaterThanOrEqual(2);
        expect(s.sources.length, `${where}.sources`).toBeLessThanOrEqual(4);
        for (const r of s.sources) {
          expect(r, where).toMatch(refLike);
          expect(top.has(r), `${where}: ${r} missing from tour.sources`).toBe(true);
        }
        expect(s.questions.length, `${where}.questions`).toBeGreaterThanOrEqual(1);
        expect(s.questions.length, `${where}.questions`).toBeLessThanOrEqual(2);
        for (const q of s.questions) bilingual(q, `${where}.questions`);
        // Hebrew fields are Hebrew, not transliteration.
        for (const he of [s.title.he, s.text.he, ...s.questions.map((q) => q.he)]) expect(he, `${where} hebrew`).toMatch(/[א-ת]/);
      }
    }
  });

  it('tourEntry resolves top-level entries and Beis HaMoked children', () => {
    expect(tourEntry('mizbeach')).toBe(byId.mizbeach);
    const child = tourEntry('lishkas_telaei_korban');
    expect(child?.position?.x).toBeTypeOf('number');
    if (!byId.lishkas_telaei_korban) expect(child.parent).toBe('beis_hamoked');
    expect(tourEntry('no_such_entry')).toBeUndefined();
  });

  it('stopCamera applies metre offsets in amos and keeps explicit cameras', () => {
    const off = stopCamera({ id: 'x', at: 'duchan', offset: { dx: 0, dz: 3.75 } });
    expect(off).toEqual({ x: byId.duchan.position.x, y: byId.duchan.position.y, z: byId.duchan.position.z + 7.5 });
    expect(stopCamera({ id: 'y', at: 'duchan', camera: { x: 1, y: 2, z: 3 } })).toEqual({ x: 1, y: 2, z: 3 });
    expect(stopLook({ id: 'z', look: 'duchan' })).toEqual({ x: byId.duchan.position.x, y: byId.duchan.position.y, z: byId.duchan.position.z });
  });
});
