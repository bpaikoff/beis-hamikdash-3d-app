import { describe, it, expect } from 'vitest';
import { levelWorldY, levels } from './index.js';
import { entries, areas, keilim, hotspots, worldPos, worldBounds, byId } from './index.js';
import { toWorld, toAmos, formatLength } from './units.js';
import data from './temple.json';

/** Ids the game code and HUD reference directly (builders, minimap, ?at= spawns). */
const REQUIRED_IDS = ['mizbeach', 'kevesh', 'nicanor_gate', 'menorah', 'shulchan', 'mizbeach_hazahav', 'paroches', 'kodesh_hakodashim', 'heichal', 'ezras_nashim', 'azaras_yisrael', 'azaras_kohanim', 'har_habayis', 'outside'];
const GEOMETRY_KINDS = ['box', 'room', 'gate', 'steps', 'ramp', 'arc_steps', 'pillar'];
/** Areas whose entries all lie inside the 187 x 135 Azarah rectangle (Mishnah Middot 5:1). */
const AZARAH_AREAS = ['azaras_yisrael', 'azaras_kohanim', 'ulam', 'heichal', 'kodesh_hakodashim'];
const AZARAH = { minX: -67.5, maxX: 67.5, minZ: -187, maxZ: 0 };
/** Entries flagged `outsideWall` sit in the Cheil just outside the Azarah wall (wall 6 + Cheil 10). */
const CHEIL_OUTER = { minX: -83.5, maxX: 83.5, minZ: -203, maxZ: 6 };

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
  it('dimensions, positions and sources look like Sefaria refs', () => {
    const refLike = /^[A-Z][A-Za-z' ,]+ \d+(:\d+)?[ab]?(:\d+)?$/;
    const check = (e, where) => {
      for (const d of e.dimensions ?? []) expect(d.source, `${where} ${d.label}`).toMatch(refLike);
      for (const s of e.sources ?? []) expect(s, where).toMatch(refLike);
      expect(e.position?.source, `${where}.position`).toMatch(refLike);
      for (const c of e.children ?? []) check(c, `${where}.${c.id}`);
    };
    for (const e of entries) check(e, e.id);
  });
  it('flattens children next to their parent, with parent set and their own position', () => {
    const c = byId.lishkas_telaei_korban;
    expect(c).toBeDefined();
    expect(c.parent).toBe('beis_hamoked');
    expect(c.position.x).toBe(58.5); // its own position, not the hall's
    expect(c.type).toBe('chamber');
    expect(c.area).toBe('azaras_kohanim');
    expect(hotspots().map((e) => e.id)).toContain('lishkas_telaei_korban');
    for (const p of entries.filter((e) => e.children?.length)) {
      for (const ch of p.children) expect(byId[ch.id]?.parent, ch.id).toBe(p.id);
    }
    expect(entries.filter((e) => e.parent)).toHaveLength(4);
  });
  it('the ids the code depends on exist', () => {
    for (const id of REQUIRED_IDS) expect(byId[id], id).toBeDefined();
    for (const id of ['ezras_nashim', 'azaras_yisrael', 'azaras_kohanim', 'har_habayis', 'outside', 'heichal', 'kodesh_hakodashim']) expect(byId[id].type, id).toBe('area');
  });
  it('every non-area entry has at least two sources, 2-4 questions, an icon and a parent area', () => {
    const areaIds = new Set(areas.map((a) => a.id));
    for (const e of keilim) {
      expect(e.sources.length, e.id).toBeGreaterThanOrEqual(2);
      expect(e.questions?.length, e.id).toBeGreaterThanOrEqual(2);
      expect(e.questions.length, e.id).toBeLessThanOrEqual(4);
      for (const qu of e.questions) {
        expect(qu.he, e.id).toBeTruthy();
        expect(qu.en, e.id).toBeTruthy();
      }
      expect(e.icon, e.id).toBeTruthy();
      expect(areaIds.has(e.area), `${e.id}.area=${e.area}`).toBe(true);
    }
  });
  it('geometry hints use a known kind and carry w/d/h in amos', () => {
    for (const e of entries) {
      if (!e.geometry) continue;
      expect(GEOMETRY_KINDS, `${e.id}.geometry.kind=${e.geometry.kind}`).toContain(e.geometry.kind);
      expect(data.meta.geometryKinds).toEqual(GEOMETRY_KINDS);
      for (const k of ['w', 'd', 'h']) expect(typeof e.geometry[k], `${e.id}.geometry.${k}`).toBe('number');
    }
  });
  it('dimensions use known units and children are entry-shaped', () => {
    for (const e of entries) {
      for (const d of e.dimensions ?? []) expect(['amah', 'tefach', 'etzba', 'count'], `${e.id} ${d.label}`).toContain(d.unit);
      for (const c of e.children ?? []) {
        expect(c.id, e.id).toMatch(/^[a-z0-9_]+$/);
        expect(c.name?.he && c.name?.en && c.desc?.he && c.desc?.en, `${e.id}.${c.id}`).toBeTruthy();
        expect(c.position?.frame, `${e.id}.${c.id}`).toBe('azarah');
        expect(c.sources?.length, `${e.id}.${c.id}`).toBeGreaterThan(0);
      }
    }
  });
  it('Azarah items lie within the Azarah rectangle (Middot 5:1)', () => {
    // Sub-rooms (`parent`) lie inside their parent's footprint; Beis HaMoked straddles the wall.
    for (const e of keilim.filter((e) => AZARAH_AREAS.includes(e.area) && !e.parent)) {
      const { x, z } = e.position;
      const b = e.outsideWall ? CHEIL_OUTER : AZARAH;
      if (e.outsideWall) expect(['north', 'south', 'east', 'west'], `${e.id}.outsideWall`).toContain(e.outsideWall);
      expect(x, `${e.id}.x`).toBeGreaterThanOrEqual(b.minX);
      expect(x, `${e.id}.x`).toBeLessThanOrEqual(b.maxX);
      expect(z, `${e.id}.z`).toBeGreaterThanOrEqual(b.minZ);
      expect(z, `${e.id}.z`).toBeLessThanOrEqual(b.maxZ);
    }
    for (const id of AZARAH_AREAS) {
      const b = byId[id].bounds;
      expect(b.minX, id).toBeGreaterThanOrEqual(AZARAH.minX);
      expect(b.maxX, id).toBeLessThanOrEqual(AZARAH.maxX);
      expect(b.minZ, id).toBeGreaterThanOrEqual(AZARAH.minZ);
      expect(b.maxZ, id).toBeLessThanOrEqual(AZARAH.maxZ);
    }
  });
  it('the Middot 5:1 east-west arithmetic is respected', () => {
    // 11 + 11 + 32 + 22 + 100 + 11 = 187
    expect(byId.mizbeach.position.z).toBe(-38); // 22 west of Nicanor + 16
    expect(byId.heichal.position.z).toBe(-118); // 76 + 5 + 11 + 6 + 20
    expect(byId.kodesh_hakodashim.position.z).toBe(-149); // 138 + 1 + 10
    expect(byId.ulam.position.z).toBe(-86.5);
    expect(byId.azaras_kohanim.position.y).toBe(2.5); // Middot 2:6
    expect(byId.heichal.position.y).toBe(8.5); // + 6 for the Ulam steps, Middot 3:6
    expect(byId.ezras_nashim.position.y).toBe(-7.5); // 15 half-amah steps
    expect(byId.cheil.position.y).toBe(-13.5); // 12 more
    expect(byId.taim.dimensions.find((d) => d.label === 'count').value).toBe(38);
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

describe('levels', () => {
  it('maps named floors to metres', () => {
    expect(levelWorldY('azaras_yisrael')).toBe(6.8);
    expect(levelWorldY('azaras_kohanim')).toBeCloseTo(6.8 + levels.azaras_kohanim * 0.5);
    expect(() => levelWorldY('nope')).toThrow();
  });
});
