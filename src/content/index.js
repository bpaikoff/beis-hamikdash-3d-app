/**
 * Single source of truth for everything the walkthrough labels, places and explains.
 * Builders take positions from here; the HUD takes names, descriptions and sources.
 */
import data from './temple.json';
import { toWorld, AMAH, AZARAH_FLOOR_Y } from './units.js';

export const entries = data.entries;
export const byId = Object.fromEntries(entries.map((e) => [e.id, e]));

export const areas = entries.filter((e) => e.type === 'area');
export const keilim = entries.filter((e) => e.type !== 'area');

/** Entries visible for a period ('bayis_sheni' default). Entries with no `period` show always. */
export function hotspots(period = 'bayis_sheni') {
  return keilim.filter((e) => !e.period?.length || e.period.includes(period));
}

/** Scene-space position [x, y, z] in metres for an entry. */
export function worldPos(entry) {
  return toWorld(entry.position);
}

/** Area bounds in scene metres: { minX, maxX, minZ, maxZ }. */
export function worldBounds(area) {
  const b = area.bounds;
  const [minX, , minZ] = toWorld({ x: b.minX, y: 0, z: b.minZ });
  const [maxX, , maxZ] = toWorld({ x: b.maxX, y: 0, z: b.maxZ });
  return { minX: Math.min(minX, maxX), maxX: Math.max(minX, maxX), minZ: Math.min(minZ, maxZ), maxZ: Math.max(minZ, maxZ) };
}

/** Floor levels in amos relative to the Azarah floor (see meta.levels in temple.json). */
export const levels = data.meta.levels;

/** Scene-space y (metres) of a named floor level, e.g. levelWorldY('azaras_kohanim'). */
export function levelWorldY(name) {
  const lv = levels[name];
  if (typeof lv !== 'number') throw new Error(`unknown level: ${name}`);
  return AZARAH_FLOOR_Y + lv * AMAH;
}

/** Layout metadata (meta.zLayout / meta.xLayout) for builders that need the section arithmetic. */
export const layout = { z: data.meta.zLayout, x: data.meta.xLayout };
