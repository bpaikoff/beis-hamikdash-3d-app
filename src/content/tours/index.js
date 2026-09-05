/**
 * Guided tours: ordered stops over the entries of temple.json (see docs/content.md, "Tours").
 * The engine (src/game/Tour.js) reads `tours`/`byTourId`; the helpers below resolve a
 * stop's target entry and its camera position in amos so the JSON stays declarative.
 */
import tamid from './tamid.json';
import { byId, entries } from '../index.js';
import { AMAH } from '../units.js';

export const tours = [tamid];
export const byTourId = Object.fromEntries(tours.map((t) => [t.id, t]));

/**
 * The entry a tour id names. Beis HaMoked's four rooms are `children` of the hall until
 * they are flattened into `entries`; a child resolves to a copy with `parent` set.
 */
export function tourEntry(id) {
  if (byId[id]) return byId[id];
  for (const e of entries) for (const c of e.children ?? []) if (c.id === id) return { ...c, parent: e.id };
  return undefined;
}

/**
 * Where the camera stands for a stop, in amos in the azarah frame: an explicit `camera`,
 * or the `at` entry's position plus `offset` ({dx, dz} in metres, +x north, +z east).
 * `y` is the floor level the stop was authored at; the engine snaps to the real floor.
 */
export function stopCamera(stop) {
  if (stop.camera) return { x: stop.camera.x, y: stop.camera.y, z: stop.camera.z };
  const e = tourEntry(stop.at);
  if (!e) throw new Error(`tour stop ${stop.id}: unknown entry ${stop.at}`);
  const o = stop.offset ?? { dx: 0, dz: 0 };
  return { x: e.position.x + o.dx / AMAH, y: e.position.y, z: e.position.z + o.dz / AMAH };
}

/** The point a stop looks at, in amos: an entry id (its position) or an explicit {x, y?, z}. */
export function stopLook(stop) {
  if (typeof stop.look === 'string') {
    const e = tourEntry(stop.look);
    if (!e) throw new Error(`tour stop ${stop.id}: unknown look target ${stop.look}`);
    return { x: e.position.x, y: e.position.y, z: e.position.z };
  }
  return { x: stop.look.x, y: stop.look.y, z: stop.look.z };
}
