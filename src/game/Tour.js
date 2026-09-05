import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { AMAH, toWorld } from '../content/units.js';
import { stopCamera, stopLook, tourEntry } from '../content/tours/index.js';

/**
 * Guided tour: a camera rail between the stops of a tour (src/content/tours/*.json) and
 * the state the TourCard shows (store.tour / tourStop / tourPlaying / tourDwellLeft).
 *
 * Positions: a stop's `camera` (or `at` + `offset`) is resolved in amos by the tours
 * index, converted to metres, and its y hint snapped to the real floor with
 * `player.floorUnder`; the camera stands PLAYER_HEIGHT above that. Between stops the
 * camera follows a Catmull-Rom curve (centripetal) through the previous stop, the
 * routing waypoints (see Router) and the next stop, at TOUR_SPEED with a trapezoidal
 * speed profile; the feet height is re-probed every SAMPLE_STEP along the curve and
 * smoothed, so ramps and stairs are followed without step jitter. During the first
 * LOOK_START of the travel the view turns from wherever it was to the direction of
 * travel; during the last (1 - LOOK_TURN) it slerps to the stop's look target.
 *
 * While a tour is active TempleGame calls `update(delta)` instead of `player.update`,
 * ignores the movement keys and does not take the pointer; `stop()` hands control back
 * at the current position.
 */
export const TOUR_SPEED = 3; // m/s cruise
export const TOUR_ACCEL = 0.8; // seconds to reach cruise speed (and to stop)
export const SAMPLE_STEP = 0.25; // metres between floor probes along a rail
export const RISE_LIMIT = CONFIG.STEP_HEIGHT + 0.1; // a step this high blocks (the Duchan riser is 0.5)
export const DROP_LIMIT = CONFIG.STEP_HEIGHT + 0.1; // walking off an edge this high blocks (the kevesh flank)
const CHEST = 1.0; // metres above the feet where the body clearance is probed
const SMOOTH_RADIUS = 1.0; // metres of feet-height smoothing on each side of a sample
const LOOK_START = 0.2; // fraction of the travel over which the view turns to the heading
const LOOK_TURN = 0.6; // from this fraction on, the view turns to the stop's look target
const NODE_REACH = 45; // metres: an endpoint only tries graph nodes this close
const DWELL_SYNC = 0.1; // seconds between store writes of the countdown

/**
 * Routing graph for transitions whose straight line would cut through the altar, the
 * kevesh, the building or a chamber wall. Nodes are walkable spots in amos (azarah
 * frame: +x north, -z west; `y` is the floor hint in amos) on the open court:
 *
 *   nicanor      inside the Nicanor threshold, Ezras Yisrael floor
 *   court_east   the Ezras Kohanim strip on the axis, east of the altar (z -22)
 *   lane_ne      the strip's north end, at the mouth of the lane between the altar
 *                (x 16) and the rings (x 24)
 *   moked_gate   the court outside Beis HaMoked's Azarah gate (x 52.5, z -14)
 *   moked_cross  inside Beis HaMoked, in the free cross between its four chambers
 *   court_se     the strip's south end, east of the kevesh (z -30)
 *   kevesh_foot  the court south of the kevesh's foot (the ramp starts at x -46)
 *   south_lane   the court south of the Ulam steps (x +-20) and the kiyor (x -22, z -65)
 *   gazis_door   the court outside Lishkas HaGazis' north door (x -57.5, z -103)
 *   gazis_in     inside the Gazis, its kodesh half
 *   ulam_foot_s  the court at the south-east corner of the Ulam steps (the flight's
 *                foot at z -54 meets the altar's west face, so it is entered at a corner)
 *   ulam_foot    on the second step, on the axis
 *   ulam_foot_n  the court at the north-east corner of the flight
 *   ulam         inside the Ulam, on the axis
 *
 * Edges are straight walks that were checked against the built geometry; Router still
 * verifies each one with the same probe as the transitions (an edge that fails is
 * dropped), so a builder change cannot send the camera through a wall silently.
 * Stops connect to any node their straight line reaches; Dijkstra picks the shortest
 * chain. Stop 4 -> 5 (terumas hadeshen -> the ma'aracha, on the ramp) therefore goes
 * court_se -> kevesh_foot and up the ramp's axis, never over its flank.
 */
export const NODES = {
  nicanor: { x: 0, z: -5, y: 0 },
  court_east: { x: 0, z: -17, y: 2.5 },
  lane_ne: { x: 20, z: -17, y: 2.5 },
  moked_gate: { x: 50, z: -15, y: 2.5 },
  moked_cross: { x: 67, z: -14, y: 2.5 },
  court_se: { x: -52, z: -20, y: 2.5 },
  kevesh_foot: { x: -52, z: -38, y: 2.5 },
  south_lane: { x: -54, z: -57, y: 2.5 },
  gazis_door: { x: -52, z: -103, y: 2.5 },
  gazis_in: { x: -61, z: -103, y: 2.5 },
  ulam_foot_s: { x: -21, z: -54.4, y: 2.5 },
  ulam_foot: { x: 0, z: -56.2, y: 3.5 },
  ulam_foot_n: { x: 21, z: -54.4, y: 2.5 },
  ulam: { x: 0, z: -86, y: 8.5 },
};

export const EDGES = [
  ['nicanor', 'court_east'],
  ['court_east', 'lane_ne'],
  ['lane_ne', 'moked_gate'],
  ['moked_gate', 'moked_cross'],
  ['court_east', 'court_se'],
  ['court_se', 'kevesh_foot'],
  ['kevesh_foot', 'south_lane'],
  ['south_lane', 'gazis_door'],
  ['gazis_door', 'gazis_in'],
  ['south_lane', 'ulam_foot_s'],
  ['ulam_foot_s', 'ulam_foot'],
  ['ulam_foot', 'ulam_foot_n'],
  ['ulam_foot_n', 'lane_ne'],
  ['ulam_foot', 'ulam'],
];

/** Where the body is probed around a sample: the centre and PLAYER_RADIUS to each side. */
const BODY = [
  [0, 0],
  [CONFIG.PLAYER_RADIUS, 0],
  [-CONFIG.PLAYER_RADIUS, 0],
  [0, CONFIG.PLAYER_RADIUS],
  [0, -CONFIG.PLAYER_RADIUS],
];

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _v = new THREE.Vector3();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();

const smoothstep = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

/** Quaternion looking from `from` to `to` (YXZ: yaw about y, then pitch). */
export function lookQuaternion(from, to, out = new THREE.Quaternion()) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const yaw = Math.atan2(-dx, -dz);
  const pitch = Math.atan2(dy, Math.hypot(dx, dz));
  _euler.set(pitch, yaw, 0, 'YXZ');
  return out.setFromEuler(_euler);
}

/**
 * Trapezoidal speed profile over a rail of `length` metres: accelerate for TOUR_ACCEL
 * seconds, cruise at TOUR_SPEED, decelerate; a short rail becomes a triangle.
 * Returns { duration, at(t) -> distance }.
 */
export function speedProfile(length, v = TOUR_SPEED, ta = TOUR_ACCEL) {
  const a = v / ta;
  const ramp = (v * ta) / 2; // distance covered while accelerating
  if (length <= 2 * ramp) {
    const half = Math.sqrt(length / a);
    const duration = 2 * half;
    const at = (t) => {
      t = Math.max(0, Math.min(duration, t));
      return t <= half ? (a * t * t) / 2 : length - (a * (duration - t) * (duration - t)) / 2;
    };
    return { duration, at };
  }
  const cruise = (length - 2 * ramp) / v;
  const duration = 2 * ta + cruise;
  const at = (t) => {
    t = Math.max(0, Math.min(duration, t));
    if (t <= ta) return (a * t * t) / 2;
    if (t <= ta + cruise) return ramp + v * (t - ta);
    const r = duration - t;
    return length - (a * r * r) / 2;
  };
  return { duration, at };
}

/** Points of a polyline sampled every `step` metres (ends included). */
function samplePolyline(points, step) {
  const out = [points[0].clone()];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const n = Math.max(1, Math.ceil(a.distanceTo(b) / step));
    for (let k = 1; k <= n; k++) out.push(a.clone().lerp(b, k / n));
  }
  return out;
}

// ============================================================================
// ROUTER
// ============================================================================
export class Router {
  /**
   * @param {{probe(x,z,fromY):{y,inside}, floorUnder(x,z,feetY):{y}, collides?(pos):boolean}} player
   */
  constructor(player, nodes = NODES, edges = EDGES) {
    this.player = player;
    this.nodes = {};
    for (const [name, n] of Object.entries(nodes)) {
      const [x, yHint, z] = toWorld({ x: n.x, y: n.y, z: n.z });
      this.nodes[name] = { name, x, z, feet: player.floorUnder(x, z, yHint).y };
    }
    this.edges = edges;
    this.adj = null;
  }

  /**
   * One sample of a walk: the floor under (x, z) coming from feet height `feet`, probed
   * from just above step height as the player does. Blocks when the probe starts inside
   * a solid, the floor rises above RISE_LIMIT or drops beyond DROP_LIMIT, a wall box
   * meets the body column, or the body at chest height touches a solid on any side (a
   * ledge along a wall, such as the altar's yesod, passes the floor test but not this).
   * Returns { ok, feet, reason }.
   */
  step(x, z, feet) {
    const p = this.player;
    const pr = p.probe(x, z, feet + CONFIG.STEP_HEIGHT + 0.05);
    if (pr.inside) return { ok: false, reason: 'inside', feet };
    if (pr.y - feet > RISE_LIMIT) return { ok: false, reason: 'rise', feet };
    if (feet - pr.y > DROP_LIMIT) return { ok: false, reason: 'drop', feet };
    feet = pr.y;
    if (p.collides) {
      _v.set(x, feet + CONFIG.PLAYER_HEIGHT, z);
      if (p.collides(_v)) return { ok: false, reason: 'wall', feet };
    }
    if (p.insideSolid) {
      for (const [dx, dz] of BODY) if (p.insideSolid(x + dx, feet + CHEST, z + dz)) return { ok: false, reason: 'body', feet };
    }
    return { ok: true, feet };
  }

  /**
   * Can the camera walk straight from (ax, az) with its feet at aFeet to (bx, bz)?
   * Every SAMPLE_STEP along the line is checked with step().
   */
  segmentClear(ax, az, aFeet, bx, bz) {
    const dist = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(dist / SAMPLE_STEP));
    let feet = aFeet;
    for (let k = 1; k <= n; k++) {
      const u = k / n;
      const x = ax + (bx - ax) * u;
      const z = az + (bz - az) * u;
      const s = this.step(x, z, feet);
      if (!s.ok) return { ok: false, reason: s.reason, at: [x, z] };
      feet = s.feet;
    }
    return { ok: true, feet };
  }

  /** Directed adjacency of the verified graph edges: name -> [{to, len}]. */
  graph() {
    if (this.adj) return this.adj;
    const adj = Object.fromEntries(Object.keys(this.nodes).map((k) => [k, []]));
    this.dropped = [];
    for (const [a, b] of this.edges) {
      const na = this.nodes[a];
      const nb = this.nodes[b];
      if (!na || !nb) throw new Error(`tour graph: unknown node in edge ${a}-${b}`);
      const len = Math.hypot(nb.x - na.x, nb.z - na.z);
      const ab = this.segmentClear(na.x, na.z, na.feet, nb.x, nb.z);
      const ba = this.segmentClear(nb.x, nb.z, nb.feet, na.x, na.z);
      if (ab.ok) adj[a].push({ to: b, len });
      else this.dropped.push({ edge: `${a}->${b}`, ...ab });
      if (ba.ok) adj[b].push({ to: a, len });
      else this.dropped.push({ edge: `${b}->${a}`, ...ba });
    }
    this.adj = adj;
    return adj;
  }

  /**
   * Waypoints (node names) between `start` and `end` ({x, z, feet} in metres): [] when
   * the straight line is clear, the shortest chain through the graph otherwise, or null
   * when neither endpoint can reach the graph.
   */
  route(start, end) {
    if (this.segmentClear(start.x, start.z, start.feet, end.x, end.z).ok) return [];
    const adj = this.graph();
    const names = Object.keys(this.nodes);
    // Endpoint links: every node within reach whose straight line is clear, in the walking direction.
    const fromStart = [];
    const toEnd = new Map();
    for (const name of names) {
      const n = this.nodes[name];
      const ds = Math.hypot(n.x - start.x, n.z - start.z);
      if (ds <= NODE_REACH && this.segmentClear(start.x, start.z, start.feet, n.x, n.z).ok) fromStart.push({ to: name, len: ds });
      const de = Math.hypot(end.x - n.x, end.z - n.z);
      if (de <= NODE_REACH && this.segmentClear(n.x, n.z, n.feet, end.x, end.z).ok) toEnd.set(name, de);
    }
    if (!fromStart.length || !toEnd.size) return null;
    // Dijkstra from the start over the small graph.
    const dist = Object.fromEntries(names.map((k) => [k, Infinity]));
    const prev = {};
    const done = new Set();
    for (const l of fromStart) {
      dist[l.to] = l.len;
      prev[l.to] = null;
    }
    let best = null;
    for (;;) {
      let cur = null;
      for (const k of names) if (!done.has(k) && dist[k] < Infinity && (cur === null || dist[k] < dist[cur])) cur = k;
      if (cur === null) break;
      done.add(cur);
      if (toEnd.has(cur)) {
        const total = dist[cur] + toEnd.get(cur);
        if (!best || total < best.total) best = { node: cur, total };
      }
      for (const { to, len } of adj[cur]) {
        if (done.has(to)) continue;
        const d = dist[cur] + len;
        if (d < dist[to]) {
          dist[to] = d;
          prev[to] = cur;
        }
      }
    }
    if (!best) return null;
    const chain = [];
    for (let k = best.node; k; k = prev[k]) chain.unshift(k);
    return chain;
  }
}

// ============================================================================
// TOUR
// ============================================================================
export class Tour {
  /**
   * @param {{player, camera: THREE.Camera, store: {setState, getState}}} game
   * @param {object} data  a tour from src/content/tours (id, title, stops[])
   */
  constructor(game, data) {
    this.game = game;
    this.player = game.player;
    this.camera = game.camera;
    this.store = game.store;
    this.data = data;
    this.stops = data.stops;
    this.router = new Router(this.player);
    this.state = 'idle'; // idle | travel | dwell | paused
    this.index = -1;
    this.auto = true; // advance after the dwell; off once the visitor navigates by hand
    this.hold = false; // hover/focus on the card, or the Ask panel open: the countdown waits
    this.ended = false; // the last stop's dwell ran out
    this.dwellLeft = 0;
    this.rail = null;
    this.t = 0;
    this.qStart = new THREE.Quaternion();
    this.qTarget = new THREE.Quaternion();
    this.qFrom = null;
    this.target = null; // {pos, feet, look} of the stop being travelled to / dwelt at
    this._synced = -1;
    this._stopCache = new Map();
  }

  get active() {
    return this.state !== 'idle';
  }

  get length() {
    return this.stops.length;
  }

  /** Eye position, feet height and look point (metres) of stop `i`, snapped to the floor. */
  stopWorld(i) {
    if (this._stopCache.has(i)) return this._stopCache.get(i);
    const stop = this.stops[i];
    const c = stopCamera(stop);
    const [x, yHint, z] = toWorld(c);
    const feet = this.player.floorUnder(x, z, yHint).y;
    const pos = new THREE.Vector3(x, feet + CONFIG.PLAYER_HEIGHT, z);
    const l = stopLook(stop);
    const [lx, , lz] = toWorld({ x: l.x, y: 0, z: l.z });
    let ly;
    if (typeof stop.look === 'string') {
      // An entry: aim a little up its body so tall things (the altar, a gate) fill the view.
      const h = tourEntry(stop.look)?.geometry?.h ?? 2;
      ly = toWorld({ x: 0, y: l.y ?? 0, z: 0 })[1] + Math.max(1.0, Math.min(3.0, h * AMAH * 0.45));
    } else if (typeof l.y === 'number') {
      ly = toWorld({ x: 0, y: l.y, z: 0 })[1];
    } else {
      ly = pos.y; // level pitch
    }
    const look = new THREE.Vector3(lx, ly, lz);
    const out = { pos, feet, look };
    this._stopCache.set(i, out);
    return out;
  }

  /** Where the camera stands now, as a router endpoint. */
  here() {
    const c = this.camera.position;
    const feet = this.player.floorUnder(c.x, c.z, c.y - CONFIG.PLAYER_HEIGHT).y;
    return { x: c.x, z: c.z, feet };
  }

  /**
   * The route from the current position (or from stop `from`) to stop `to`, for the
   * tests and the screenshot tooling: { names, points, length, curve, ok }.
   */
  plan(to, from = null) {
    const start = from === null ? this.here() : { x: this.stopWorld(from).pos.x, z: this.stopWorld(from).pos.z, feet: this.stopWorld(from).feet };
    const end = this.stopWorld(to);
    const names = this.router.route(start, { x: end.pos.x, z: end.pos.z, feet: end.feet });
    const via = (names ?? []).map((n) => this.router.nodes[n]);
    const points = [
      new THREE.Vector3(start.x, start.feet + CONFIG.PLAYER_HEIGHT, start.z),
      ...via.map((n) => new THREE.Vector3(n.x, n.feet + CONFIG.PLAYER_HEIGHT, n.z)),
      end.pos.clone(),
    ];
    return { names, points, routed: names !== null };
  }

  /**
   * Build the rail to stop `to`: the curve through the route points, sampled every
   * SAMPLE_STEP with the feet re-probed progressively; if the curve's samples do not pass
   * the same test (a rounded corner cutting into a solid) the polyline is used instead.
   */
  buildRail(to) {
    const { points, routed } = this.plan(to);
    const end = this.stopWorld(to);
    const startFeet = points[0].y - CONFIG.PLAYER_HEIGHT;
    const trace = (pts) => {
      const xs = [];
      const zs = [];
      const feet = [];
      let f = startFeet;
      let ok = true;
      let reason = null;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (i === 0) {
          f = startFeet;
        } else {
          const s = this.router.step(p.x, p.z, f);
          if (!s.ok && ok) {
            ok = false;
            reason = s.reason;
          }
          f = s.feet;
        }
        xs.push(p.x);
        zs.push(p.z);
        feet.push(f);
      }
      return { xs, zs, feet, ok, reason };
    };
    let samples = null;
    let curved = false;
    if (points.length >= 3) {
      const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
      const n = Math.max(2, Math.ceil(curve.getLength() / SAMPLE_STEP));
      const t = trace(curve.getSpacedPoints(n));
      if (t.ok) {
        samples = t;
        curved = true;
      }
    }
    if (!samples) samples = trace(samplePolyline(points, SAMPLE_STEP));
    const n = samples.xs.length;
    // Ends exact: the last sample is the stop's snapped feet, the first the current feet.
    samples.feet[n - 1] = end.feet;
    samples.xs[n - 1] = end.pos.x;
    samples.zs[n - 1] = end.pos.z;
    // Feet smoothing over +-SMOOTH_RADIUS with a window that shrinks toward the ends.
    const w = Math.round(SMOOTH_RADIUS / SAMPLE_STEP);
    const ys = new Array(n);
    for (let i = 0; i < n; i++) {
      const r = Math.min(w, i, n - 1 - i);
      let sum = 0;
      for (let k = i - r; k <= i + r; k++) sum += samples.feet[k];
      ys[i] = sum / (2 * r + 1) + CONFIG.PLAYER_HEIGHT;
    }
    const cum = new Array(n);
    cum[0] = 0;
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(samples.xs[i] - samples.xs[i - 1], samples.zs[i] - samples.zs[i - 1]);
    const length = cum[n - 1];
    const profile = speedProfile(length);
    return { xs: samples.xs, zs: samples.zs, ys, feet: samples.feet, cum, length, profile, routed, curved, ok: samples.ok, reason: samples.reason, points };
  }

  /** Position on the rail at arc length `s` (metres). */
  railAt(s, out = new THREE.Vector3()) {
    const r = this.rail;
    const n = r.cum.length;
    if (s <= 0) return out.set(r.xs[0], r.ys[0], r.zs[0]);
    if (s >= r.length) return out.set(r.xs[n - 1], r.ys[n - 1], r.zs[n - 1]);
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (r.cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const seg = r.cum[hi] - r.cum[lo] || 1;
    const u = (s - r.cum[lo]) / seg;
    return out.set(r.xs[lo] + (r.xs[hi] - r.xs[lo]) * u, r.ys[lo] + (r.ys[hi] - r.ys[lo]) * u, r.zs[lo] + (r.zs[hi] - r.zs[lo]) * u);
  }

  /** Feet height on the rail at arc length `s` (for the player's elevation readout). */
  feetAt(s) {
    const r = this.rail;
    const n = r.cum.length;
    if (s <= 0) return r.feet[0];
    if (s >= r.length) return r.feet[n - 1];
    let i = 0;
    while (i < n - 1 && r.cum[i + 1] < s) i++;
    return r.feet[i];
  }

  // -------------------------------------------------------------------------
  // Controls
  // -------------------------------------------------------------------------

  /** Begin the tour at stop `i`, standing there at once (no travel). */
  start(i = 0) {
    i = Math.max(0, Math.min(this.length - 1, i | 0));
    this.releasePlayer();
    this.auto = true;
    this.ended = false;
    this.index = i;
    this.target = this.stopWorld(i);
    this.camera.position.copy(this.target.pos);
    lookQuaternion(this.target.pos, this.target.look, this.camera.quaternion);
    this.rail = null;
    this.arrive();
    return this;
  }

  next(manual = true) {
    if (this.index >= this.length - 1) return false;
    return this.goTo(this.index + 1, manual);
  }

  prev(manual = true) {
    if (this.index <= 0) return false;
    return this.goTo(this.index - 1, manual);
  }

  /**
   * Travel to stop `i`. `manual` (a click, a key) turns auto-advance off: the visitor is
   * reading at their own pace until they press play again.
   */
  goTo(i, manual = true) {
    i = i | 0;
    if (i < 0 || i >= this.length) return false;
    if (this.state === 'idle') this.releasePlayer();
    if (manual) this.auto = false;
    this.ended = false;
    this.index = i;
    this.target = this.stopWorld(i);
    this.rail = this.buildRail(i);
    this.t = 0;
    this.qStart.copy(this.camera.quaternion);
    lookQuaternion(this.target.pos, this.target.look, this.qTarget);
    this.qFrom = null;
    if (this.rail.length < 0.05) {
      this.camera.position.copy(this.target.pos);
      this.camera.quaternion.copy(this.qTarget);
      this.arrive();
      return true;
    }
    this.state = 'travel';
    this.dwellLeft = 0;
    this.sync(true);
    return true;
  }

  /** Stop the countdown (the play button shows). */
  pause() {
    this.auto = false;
    if (this.state === 'dwell') this.state = 'paused';
    this.sync(true);
  }

  /** Resume auto-play: the countdown runs on and the tour advances. */
  resume() {
    this.auto = true;
    if (this.state === 'paused') {
      if (this.ended || this.dwellLeft <= 0) {
        if (this.index < this.length - 1) return this.next(false);
        this.dwellLeft = this.stops[this.index].dwell;
        this.ended = false;
      }
      this.state = 'dwell';
    }
    this.sync(true);
    return true;
  }

  toggle() {
    if (this.auto && this.state !== 'paused') this.pause();
    else this.resume();
  }

  /** Hover/focus on the card (or the Ask panel open): the countdown waits. */
  setHold(on) {
    this.hold = Boolean(on);
  }

  /** End the tour, leaving the camera where it is; the player takes over from there. */
  stop() {
    if (this.state === 'idle') return;
    this.state = 'travel'; // so syncPlayer snaps the feet to the rail/stop floor
    this.syncPlayer(this.target?.feet ?? this.camera.position.y - CONFIG.PLAYER_HEIGHT);
    this.state = 'idle';
    this.rail = null;
    this.qFrom = null;
    this.store.setState({ tour: null, tourStop: -1, tourPlaying: 'idle', tourDwellLeft: 0, tourDwell: 0 });
  }

  // -------------------------------------------------------------------------
  // Per frame
  // -------------------------------------------------------------------------

  update(delta) {
    if (this.state === 'travel') {
      this.t += delta;
      const r = this.rail;
      const s = r.profile.at(this.t);
      this.railAt(s, this.camera.position);
      const u = r.length > 0 ? s / r.length : 1;
      // Heading along the rail: yaw from the tangent, level pitch.
      const ahead = this.railAt(Math.min(r.length, s + 0.5), _v);
      const back = this.railAt(Math.max(0, s - 0.5), new THREE.Vector3());
      const hasTangent = ahead.distanceToSquared(back) > 1e-6;
      if (u < LOOK_TURN) {
        if (hasTangent) lookQuaternion({ x: back.x, y: 0, z: back.z }, { x: ahead.x, y: 0, z: ahead.z }, _qa);
        else _qa.copy(this.qStart);
        if (u < LOOK_START) this.camera.quaternion.copy(this.qStart).slerp(_qa, smoothstep(u / LOOK_START));
        else this.camera.quaternion.copy(_qa);
      } else {
        if (!this.qFrom) this.qFrom = this.camera.quaternion.clone();
        _qb.copy(this.qFrom).slerp(this.qTarget, smoothstep((u - LOOK_TURN) / (1 - LOOK_TURN)));
        this.camera.quaternion.copy(_qb);
      }
      this.syncPlayer(this.feetAt(s));
      if (this.t >= r.profile.duration) {
        this.camera.position.copy(this.target.pos);
        this.camera.quaternion.copy(this.qTarget);
        this.arrive();
      }
      return;
    }
    if (this.state === 'dwell') {
      if (!this.hold) {
        this.dwellLeft = Math.max(0, this.dwellLeft - delta);
        if (this.dwellLeft <= 0) {
          if (this.index < this.length - 1 && this.auto) {
            this.next(false);
            return;
          }
          this.ended = true;
          this.state = 'paused';
          this.sync(true);
          return;
        }
      }
      this.sync(false);
    }
    // dwell / paused: the touch drag-look may have turned the camera; keep the compass right.
    this.player.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
  }

  arrive() {
    this.dwellLeft = this.stops[this.index].dwell;
    this.state = this.auto ? 'dwell' : 'paused';
    this.syncPlayer(this.target.feet);
    this.sync(true);
  }

  /** The player controller mirrors the camera so the compass, telemetry and hand-over are right. */
  syncPlayer(feet) {
    const p = this.player;
    p.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    p.groundY = feet;
    p.verticalVelocity = 0;
    p.isJumping = false;
    p.onGround = true;
  }

  /** Drop the pointer and any held movement so the player stands still under the rail. */
  releasePlayer() {
    const p = this.player;
    p.moveF = p.moveB = p.moveL = p.moveR = false;
    p.isRun = false;
    p.verticalVelocity = 0;
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {
        /* not locked */
      }
    }
  }

  sync(force) {
    if (!force && Math.abs(this.dwellLeft - this._synced) < DWELL_SYNC) return;
    this._synced = this.dwellLeft;
    this.store.setState({
      tour: this.data.id,
      tourStop: this.index,
      tourPlaying: this.state,
      tourDwell: this.stops[this.index]?.dwell ?? 0,
      tourDwellLeft: this.dwellLeft,
      tourEnded: this.ended,
    });
  }
}
