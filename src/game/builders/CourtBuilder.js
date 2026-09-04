import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BaseBuilder } from './BaseBuilder.js';
import { AMAH, toWorld } from '../../content/units.js';
import { byId, levels } from '../../content/index.js';

/**
 * Shared helpers for the court builders (Har HaBayis, Ezras Nashim, Azarah).
 *
 * Everything here is specified in amos in the azarah frame of src/content/temple.json
 * (origin = Nicanor threshold at the Azarah floor, +x north, -z west) and converted to
 * scene metres only through toWorld()/AMAH. Extents are given as [from, to] pairs in
 * amos rather than centre + size, so wall runs, floors and flights can be read straight
 * off the Middot arithmetic in meta.zLayout / meta.xLayout.
 */

/** Court walls are taken as 6 amos thick (meta.zLayout.azarah_east_wall; not given in Middot). */
export const WALL_T = byId.nicanor_gate.geometry.d;
/** BaseBuilder.addFloor slabs are 0.4 m thick; the same thickness in amos. */
export const SLAB = 0.4 / AMAH;
/** Lowest ground in the complex (Har HaBayis / Cheil); walls are founded a little below it. */
export const GROUND = levels.har_habayis - 0.5;
/** Jamb / lintel thickness of a gate frame, amos. */
const FRAME_T = 1;
/** Door leaf thickness, amos. */
const DOOR_T = 0.5;
/** Interior partition thickness of a chamber, amos (not given in the sources). */
export const ROOM_WALL_T = 1;
/**
 * A chamber floor sits this much above the court floor it is built on, so the two slabs
 * never z-fight (2.5 cm; invisible underfoot and well below CONFIG.STEP_HEIGHT).
 */
export const LIP = 0.05;

/** Value of a `dimensions[]` entry by label, or `fallback`. */
export function dim(entry, label, fallback) {
  const d = entry?.dimensions?.find((x) => x.label === label);
  return d ? d.value : fallback;
}

export class CourtBuilder extends BaseBuilder {
  constructor(scene, tex, mat, floors, walls) {
    super(scene, tex, mat, floors, walls);
    /** The real scene: entry groups are always added here, so every group is top-level. */
    this.root = scene;
  }

  /** temple.json entry by id; throws so a renamed id fails loudly in the builder tests. */
  entry(id) {
    const e = byId[id];
    if (!e) throw new Error(`temple.json has no entry "${id}"`);
    return e;
  }

  /** Floor level in amos above the Azarah floor (meta.levels). */
  level(name) {
    const v = levels[name];
    if (typeof v !== 'number') throw new Error(`unknown level: ${name}`);
    return v;
  }

  /**
   * Build under a Group tagged with the entry id and period. BaseBuilder adds to
   * `this.scene`, so the group stands in for the scene while `fn` runs; floors/walls
   * still register in the shared arrays and the group sits at the origin.
   */
  group(id, fn, extra) {
    const e = byId[id];
    const g = new THREE.Group();
    g.name = id;
    g.userData = { entryId: id, period: e?.period ?? null, ...extra };
    const parent = this.scene;
    this.scene = g;
    try {
      fn(g, e);
    } finally {
      this.scene = parent;
    }
    this.root.add(g);
    return g;
  }

  /** Amos in the azarah frame -> [x, y, z] metres. */
  pt(x, y, z) {
    return toWorld({ x, y, z });
  }

  /** Centre (metres) and size (metres) of a box spanning the given amos extents. */
  span(x1, x2, z1, z2, y1, y2) {
    const [cx, cy, cz] = this.pt((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    return { cx, cy, cz, w: Math.abs(x2 - x1) * AMAH, h: Math.abs(y2 - y1) * AMAH, d: Math.abs(z2 - z1) * AMAH };
  }

  /** Walkable floor slab whose top surface is exactly at `yTop` amos. */
  floorA(x1, x2, z1, z2, yTop, mat, name) {
    const { cx, cy, cz, w, d } = this.span(x1, x2, z1, z2, yTop, yTop);
    return this.addFloor(cx, cy - 0.2, cz, w, d, mat, name);
  }

  /** Collidable wall filling the extents. */
  wallA(x1, x2, z1, z2, y1, y2, mat) {
    const lo = Math.min(y1, y2);
    const { cx, cy, cz, w, d } = this.span(x1, x2, z1, z2, lo, lo);
    return this.addWall(cx, cy, cz, w, Math.abs(y2 - y1) * AMAH, d, mat);
  }

  /** Non-colliding solid (lintels, roofs, decoration). */
  decoA(x1, x2, z1, z2, y1, y2, mat) {
    const lo = Math.min(y1, y2);
    const { cx, cy, cz, w, d } = this.span(x1, x2, z1, z2, lo, lo);
    return this.addWallNonCollide(cx, cy, cz, w, Math.abs(y2 - y1) * AMAH, d, mat);
  }

  /** Solid walkable block from `yBottom` to `yTop` (a landing, a step, a platform). */
  blockA(x1, x2, z1, z2, yBottom, yTop, mat, name) {
    const { cx, cy, cz, w, h, d } = this.span(x1, x2, z1, z2, yBottom, yTop);
    const m = new THREE.Mesh(this.box(w, h, d, mat), mat);
    m.position.set(cx, cy, cz);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData = { isFloor: true, isStep: true, name };
    this.scene.add(m);
    this.floors.push(m);
    return m;
  }

  /** Invisible collider (blocks the player) over the extents; no draw call. */
  colliderA(x1, x2, z1, z2, y1, y2) {
    const m = this.wallA(x1, x2, z1, z2, y1, y2, this.mat.stone);
    m.visible = false;
    m.castShadow = false;
    return m;
  }

  /**
   * Straight flight of solid steps of equal rise. `axis` is the direction of travel
   * ('x' or 'z'); the flight runs from `from` to `to` along it and spans `[s1, s2]` on
   * the other axis. Step k tops out at yBase + (k + 1) * rise, so the last step is level
   * with the upper floor; each step is solid down to just below the lower floor.
   */
  flightA({ axis, span: [s1, s2], from, to, yBase, bottom, steps, rise, mat, name }) {
    const tread = (to - from) / steps;
    const base = bottom ?? yBase - SLAB;
    const out = [];
    for (let k = 0; k < steps; k++) {
      const a = from + k * tread;
      const b = a + tread;
      const top = yBase + (k + 1) * rise;
      const r = axis === 'z' ? [s1, s2, a, b] : [a, b, s1, s2];
      out.push(this.blockA(...r, base, top, mat, name));
    }
    return out;
  }

  /**
   * A wall along one axis with openings. `across` is the wall's extent on the other
   * axis (its thickness), `from`/`to` the run, `y1`/`y2` its bottom and top.
   *
   * Openings: `{ at, w, floor, h, entry?, frame?, doors?, doorMat?, threshold?, cut?, labels? }`.
   * `at` is the centre along the run; `floor` the threshold level (defaults to y1) and
   * `h` the clear height. Below the opening the wall is solid (collidable) up to a slab's
   * thickness under `floor`; above it a non-colliding lintel runs to `y2`. `cut` leaves
   * a plain gap (a chamber that straddles the wall builds its own faces). `entry` wraps
   * the gate furniture in a group tagged with that id; `frame` is a material for a
   * merged jamb + lintel frame; `doors` is 'open' (leaves folded against the reveals),
   * 'closed' (a collidable leaf across the opening) or undefined; `threshold` adds a
   * walkable slab through the wall at `floor`.
   */
  wallRunA({ along, across: [a1, a2], from, to, y1, y2, mat, openings = [] }) {
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    const ops = openings
      .map((o) => ({ ...o, lo: o.at - o.w / 2, hi: o.at + o.w / 2 }))
      .sort((p, q) => p.lo - q.lo);
    const seg = (s, e, b, t, collide = true) => {
      if (e - s < 1e-6 || t - b < 1e-6) return null;
      const r = along === 'x' ? [s, e, a1, a2] : [a1, a2, s, e];
      return collide ? this.wallA(...r, b, t, mat) : this.decoA(...r, b, t, mat);
    };
    let cursor = lo;
    for (const o of ops) {
      seg(cursor, Math.max(cursor, o.lo), y1, y2);
      if (!o.cut) {
        const floor = o.floor ?? y1;
        const top = floor + o.h;
        if (floor - SLAB > y1) seg(o.lo, o.hi, y1, floor - SLAB);
        if (y2 > top) seg(o.lo, o.hi, top, y2, false);
        const build = () => this.gateA({ along, across: [a1, a2], ...o, floor });
        if (o.entry) this.group(o.entry, build, o.labels ? { altEntryIds: o.labels } : undefined);
        else build();
      }
      cursor = Math.max(cursor, o.hi);
    }
    seg(cursor, hi, y1, y2);
  }

  /** Gate furniture inside an opening: merged frame, doors, threshold slab. */
  gateA({ along, across: [a1, a2], at, w, floor, h, frame, doors, doorMat, threshold, thresholdMat, name }) {
    const mid = (a1 + a2) / 2;
    const rect = (s, e, c1, c2) => (along === 'x' ? [s, e, c1, c2] : [c1, c2, s, e]);
    if (frame) {
      const parts = [
        this.frameBox(...rect(at - w / 2 - FRAME_T, at - w / 2, mid - FRAME_T / 2, mid + FRAME_T / 2), floor, floor + h, frame),
        this.frameBox(...rect(at + w / 2, at + w / 2 + FRAME_T, mid - FRAME_T / 2, mid + FRAME_T / 2), floor, floor + h, frame),
        this.frameBox(...rect(at - w / 2 - FRAME_T, at + w / 2 + FRAME_T, mid - FRAME_T / 2, mid + FRAME_T / 2), floor + h, floor + h + FRAME_T, frame),
      ];
      const geo = BufferGeometryUtils.mergeGeometries(parts, false);
      for (const p of parts) p.dispose();
      const m = new THREE.Mesh(geo, frame);
      m.castShadow = true;
      m.receiveShadow = true;
      m.name = name ? `${name} frame` : 'gate frame';
      this.scene.add(m);
    }
    const leaf = doorMat ?? this.mat.copperP;
    if (doors === 'closed') {
      this.wallA(...rect(at - w / 2, at + w / 2, mid - DOOR_T / 2, mid + DOOR_T / 2), floor, floor + h - FRAME_T / 2, leaf);
    } else if (doors === 'open') {
      // Two leaves folded back against the reveals, leaving the opening clear.
      const depth = Math.min(w / 2, a2 - a1 - 1);
      for (const side of [-1, 1]) {
        const s = at + side * (w / 2 - DOOR_T);
        this.decoA(...rect(Math.min(s, s + side * DOOR_T), Math.max(s, s + side * DOOR_T), mid - depth / 2, mid + depth / 2), floor, floor + h - FRAME_T / 2, leaf);
      }
    }
    if (threshold) this.floorA(...rect(at - w / 2, at + w / 2, a1, a2), floor, thresholdMat ?? this.mat.stonePolished, name);
  }

  /** A BoxGeometry translated to world position, for merging. */
  frameBox(x1, x2, z1, z2, y1, y2, mat) {
    const { cx, cy, cz, w, h, d } = this.span(x1, x2, z1, z2, y1, y2);
    return this.box(w, h, d, mat).translate(cx, cy, cz);
  }

  /**
   * A chamber: four walls of ROOM_WALL_T inside the extents, an optional floor slab a
   * LIP above `floor`, an optional roof and an optional solid base down to `base`.
   *
   * `doors`: `[{ face, at, w, h, frame?, doors?, doorMat?, cut? }]` where `face` is
   * 'n' (+x), 's' (-x), 'e' (+z) or 'w' (-z) and `at` the centre along that face.
   * `skip` lists faces that another structure already provides (e.g. a court wall).
   * `roof`: false | true (non-colliding slab) | 'walk' (a walkable slab in this.floors).
   */
  roomA({ x1, x2, z1, z2, floor, h, base, wallMat, floorMat, roofMat, roof = true, doors = [], skip = [], t = ROOM_WALL_T, name }) {
    const wm = wallMat ?? this.mat.stone;
    const y1 = base != null ? base : floor - SLAB;
    if (base != null && floor - SLAB > base) this.wallA(x1, x2, z1, z2, base, floor - SLAB, wm);
    if (floorMat) this.floorA(x1, x2, z1, z2, floor + LIP, floorMat, name);
    const faces = {
      n: { along: 'z', across: [x2 - t, x2], from: z1, to: z2 },
      s: { along: 'z', across: [x1, x1 + t], from: z1, to: z2 },
      e: { along: 'x', across: [z2 - t, z2], from: x1, to: x2 },
      w: { along: 'x', across: [z1, z1 + t], from: x1, to: x2 },
    };
    for (const f of Object.keys(faces)) {
      if (skip.includes(f)) continue;
      const openings = doors.filter((d) => d.face === f).map((d) => ({ ...d, floor: d.floor ?? floor + LIP, name: d.name ?? name }));
      this.wallRunA({ ...faces[f], y1, y2: floor + h, mat: wm, openings });
    }
    if (roof === 'walk') this.floorA(x1, x2, z1, z2, floor + h + 1, roofMat ?? wm, `${name ?? 'room'} roof`);
    else if (roof) this.decoA(x1, x2, z1, z2, floor + h, floor + h + 1, roofMat ?? wm);
  }
}
