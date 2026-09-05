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
/** The Cheil pavement stands this much above the mount (2 cm) so the two slabs never z-fight (HarHaBayisBuilder). */
export const CHEIL_LIP = 0.04;
/** Half-amah steps: the rise of every court flight in Middot (2:3, 2:6, 3:6), amos. */
export const STEP_RISE = 0.5;

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
   * Invisible solid mass standing on a floor at `y1`, registered as a walkable block
   * (this.floors). PlayerController tests walls only against a sphere at head height,
   * so a wall lower than the player's eyes (a table, a short pillar, a tank) never
   * blocks; a mass in the floor collider does, through the double-sided probe: taller
   * than STEP_HEIGHT from the side it reads "inside", and its top is walkable.
   *
   * The mass starts a LIP above the floor it stands on. With its underside coplanar
   * with the floor's top the downward probe from inside it meets both faces at the
   * same distance and may take the floor's (front face -> "not inside" -> walk through);
   * a LIP higher, the first face met is the mass's own underside. Visible masses built
   * with blockA on a floor want the same LIP.
   */
  solidA(x1, x2, z1, z2, y1, y2, name) {
    const m = this.blockA(x1, x2, z1, z2, y1 + LIP, y2, this.mat.stone, name);
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
   * Switchback stair of 32 half-amah steps in three flights (11 + 11 + 10) that climb
   * the 16 amos from `floor` to `top`, for a chamber whose door to the Cheil lies a
   * storey under its floor (Beis HaMoked, Lishkas HaGazis; reconstructions). The
   * flights run along z in three 2-amah bands parted by half-amah walls, side by side
   * from the partition at `x0` in the direction `sx` (+1 or -1): flight A in the outer
   * band (`wA` wide) climbs +z from `zFoot`, landing L1 lies across the outer two bands
   * at its top, flight B in the middle band climbs back -z, landing L2 across the inner
   * two bands, and flight C in the band beside the partition climbs +z again and tops
   * out level with the upper floor, which needs a well over that band from `zFoot` to
   * `zFoot + 5` (returned as `well`, with x1 < x2). Every step and landing is solid to
   * a slab under `floor`. The band walls and the walls fencing the landings' open
   * sides rise from `floor` to `ceiling` (the underside of the upper floor), each
   * stopping an amah short of the landing that joins its two flights, as in the Beis
   * Avtinas tower; `eWall` closes flight A's outer side and `nWall` L1's far end (pass
   * false where a room wall already stands there). Treads and rises are half an amah.
   *
   * Flight C's two side walls go on above the ceiling to `top + 1.5`, as thin walls
   * hidden inside the upper floor's slab and the well parapet ({@link wellParapetA}):
   * the parapet is a mass, which stops the player's centre only, and a player who
   * walked into the well less than a body's radius from its side would otherwise be
   * wedged in the band wall below the ceiling on the way down. They stop a body's
   * width short of the well's open end, so a walker passing the end on the upper floor
   * is not caught on them (the top two treads are above the band walls anyway).
   */
  switchbackA({ x0, sx, zFoot, floor, top, ceiling, wA = 2, eWall = true, nWall = true, mat, wallMat, name }) {
    const m = mat ?? this.mat.stonePolished;
    const wm = wallMat ?? this.mat.stone;
    const rise = STEP_RISE;
    const band = 2;
    const gap = 0.5;
    const bt = 0.25;
    const [nA, nB, nC] = [11, 11, 10];
    const bottom = floor - SLAB;
    const x = (d) => x0 + sx * d; // distance from the partition, signed
    const xC = [x(0), x(band)];
    const xB = [x(band + gap), x(2 * band + gap)];
    const xA = [x(2 * band + 2 * gap), x(2 * band + 2 * gap + wA)];
    const zA1 = zFoot + nA * rise; // top of A / foot of B
    const zL1 = zA1 + 2.5;
    const zL2 = zFoot - 2.5;
    const yA = top - (nA + nB + nC) * rise;
    const yB = yA + nA * rise;
    const yC = yB + nB * rise;
    this.flightA({ axis: 'z', span: xA, from: zFoot, to: zA1, yBase: yA, bottom, steps: nA, rise, mat: m, name: `${name} stair` });
    this.blockA(xB[0], xA[1], zA1, zL1, bottom, yB, m, `${name} landing`);
    this.flightA({ axis: 'z', span: xB, from: zA1, to: zFoot, yBase: yB, bottom, steps: nB, rise, mat: m, name: `${name} stair` });
    this.blockA(xC[0], xB[1], zL2, zFoot, bottom, yC, m, `${name} landing`);
    this.flightA({ axis: 'z', span: xC, from: zFoot, to: zFoot + nC * rise, yBase: yC, bottom, steps: nC, rise, mat: m, name: `${name} stair` });
    // Walls: L2's outer end; between A and B (to an amah short of L1); between B and C
    // (from an amah short of L2, along L1's inner side); L1's far end; A's outer side.
    this.wallA(xC[0], xA[0], zL2 - bt, zL2, floor, ceiling, wm);
    this.wallA(xB[1], xA[0], zL2, zA1 - 1, floor, ceiling, wm);
    this.wallA(xC[1], xB[0], zFoot + 1, zL1, floor, ceiling, wm);
    if (nWall) this.wallA(xC[1], xA[1] + (eWall ? sx * bt : 0), zL1, zL1 + bt, floor, ceiling, wm);
    if (eWall) this.wallA(xA[1], xA[1] + sx * bt, zFoot, zL1 + bt, floor, ceiling, wm);
    const zTop = zFoot + nC * rise;
    const zRail = zTop - 0.9;
    this.wallA(xC[0] - sx * bt, xC[0], zFoot, zRail, ceiling, top + 1.5, wm);
    this.wallA(xC[1], xC[1] + sx * bt, zFoot, zRail, ceiling, top + 1.5, wm);
    const [wx1, wx2] = [Math.min(...xC), Math.max(...xC)];
    return { well: { x1: wx1, x2: wx2, z1: zFoot, z2: zTop } };
  }

  /**
   * Floor slab with a rectangular well left open, as four slabs round it (the well's
   * -z end and both sides; the +z end is where a stair arrives).
   */
  floorWithWellA(x1, x2, z1, z2, well, yTop, mat, name) {
    this.floorA(x1, well.x1, z1, z2, yTop, mat, name);
    this.floorA(well.x2, x2, z1, z2, yTop, mat, name);
    this.floorA(well.x1, well.x2, z1, well.z1, yTop, mat, name);
    this.floorA(well.x1, well.x2, well.z2, z2, yTop, mat, name);
  }

  /**
   * Parapet round a stair well in a floor at `y`: half-amah masses 1.5 amos high along
   * both sides and the -z end (open at +z, where the flight arrives), standing a LIP
   * above the floor like every mass on a floor (see solidA). A mass, not a wall, so
   * that it stops the player although it is below the head-height wall test.
   */
  wellParapetA(well, y, mat, name) {
    const t = 0.5;
    const h = 1.5;
    const py = y + LIP;
    this.blockA(well.x1 - t, well.x1, well.z1 - t, well.z2, py, py + h, mat, name);
    this.blockA(well.x2, well.x2 + t, well.z1 - t, well.z2, py, py + h, mat, name);
    this.blockA(well.x1 - t, well.x2 + t, well.z1 - t, well.z1, py, py + h, mat, name);
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
   * walkable slab through the wall at `floor`. `solidAbove` makes the wall over the
   * opening collide too (an opening below a court floor, whose lintel is that floor's
   * wall face); `frameTop` caps the frame's lintel (see gateA).
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
        if (y2 > top) seg(o.lo, o.hi, top, y2, Boolean(o.solidAbove));
        const build = () => this.gateA({ along, across: [a1, a2], ...o, floor });
        if (o.entry) this.group(o.entry, build, o.labels ? { altEntryIds: o.labels } : undefined);
        else build();
      }
      cursor = Math.max(cursor, o.hi);
    }
    seg(cursor, hi, y1, y2);
  }

  /**
   * Gate furniture inside an opening: merged frame, doors, threshold slab. `frameTop`
   * (amos) caps the frame's lintel, for a gate under a storey whose floor slab is the
   * lintel: the jambs still rise to the opening's top, the lintel is cut or dropped.
   */
  gateA({ along, across: [a1, a2], at, w, floor, h, frame, frameTop = Infinity, doors, doorMat, threshold, thresholdMat, name }) {
    const mid = (a1 + a2) / 2;
    const rect = (s, e, c1, c2) => (along === 'x' ? [s, e, c1, c2] : [c1, c2, s, e]);
    if (frame) {
      const parts = [
        this.frameBox(...rect(at - w / 2 - FRAME_T, at - w / 2, mid - FRAME_T / 2, mid + FRAME_T / 2), floor, floor + h, frame),
        this.frameBox(...rect(at + w / 2, at + w / 2 + FRAME_T, mid - FRAME_T / 2, mid + FRAME_T / 2), floor, floor + h, frame),
      ];
      const lintelTop = Math.min(floor + h + FRAME_T, frameTop);
      if (lintelTop > floor + h + 1e-6) parts.push(this.frameBox(...rect(at - w / 2 - FRAME_T, at + w / 2 + FRAME_T, mid - FRAME_T / 2, mid + FRAME_T / 2), floor + h, lintelTop, frame));
      const geo = BufferGeometryUtils.mergeGeometries(parts, false);
      for (const p of parts) p.dispose();
      const m = new THREE.Mesh(geo, frame);
      m.castShadow = true;
      m.receiveShadow = true;
      m.name = name ? `${name} frame` : 'gate frame';
      this.scene.add(m);
    }
    const leaf = doorMat ?? this.mat.copper; // patina reads as green/orange blotches on flat leaves
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
