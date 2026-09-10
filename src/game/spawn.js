import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { byId, keilim, worldBounds, worldPos } from '../content/index.js';
import { AMAH } from '../content/units.js';

/**
 * Where `?at=<entry>` stands the player.
 *
 * The old rule (still the last resort) stood east of the entry at the entry's own y,
 * which put `?at=maalos_ulam` on the altar top, level with the steps' middle, so the
 * steps were under the frame. Now a ring of standing points round the entry is tried,
 * nearest the front first, and the first one that is on a floor near the entry's base,
 * not inside a mass, not in a wall, not inside some other chamber, and with an open line
 * of sight to the entry is taken. The front is east, except for a gate, whose front is
 * along its passage (found from the wall boxes flanking it), on the side a visitor
 * arrives from (away from its area's centre, unless that side is inside another room,
 * as Beis HaMoked's gate has the hall behind it). A climbable floor is preferred: the
 * ring is first searched for a floor within a step of the base (a kerb, the first
 * tread), and only if none stands is a floor up to `above` over it taken (a table top,
 * a bench tier: round 6 found `?at=slaughter_tables` on a table). The floor may be well
 * below the base (the gates on top of their flights are looked up at from the court).
 */
export const SPAWN = {
  /** Bearings tried, in order, in degrees from the front; positive toward the front's left (+x when the front is +z). */
  bearings: [0, 30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180],
  /** Multiples of the standing distance tried, near to far (an entry wedged among others). */
  scales: [1, 1.5, 2],
  /** A candidate's floor may be at most this far above the entry's base (metres) when no climbable one stands ... */
  above: 1,
  /** ... and this far below it. */
  below: 6,
  /** The floor a step (0.4 m) toward and away from the entry may differ from the candidate's by at most this (metres): level ground, not a ramp's foot. */
  level: 0.05,
};

const DEG = Math.PI / 180;
const _ray = new THREE.Ray();
const _dir = new THREE.Vector3();
const _hit = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _target = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
_raycaster.firstHitOnly = false;

/** Parse `?cam=x,y,z,yaw,pitch` (metres, degrees). */
function readCam(q) {
  const cam = q.get('cam');
  if (!cam) return null;
  const [x, y, z, yaw = 0, pitch = 0] = cam.split(',').map(Number);
  return [x, y, z].every(Number.isFinite)
    ? { pos: [x, y, z], yaw: Number.isFinite(yaw) ? yaw : 0, pitch: Number.isFinite(pitch) ? pitch : 0 }
    : null;
}

/**
 * The entry's base level (scene metres): its y, except for `steps`, whose hotspot sits at
 * mid-height (temple.json notes), so their base is half the rise below.
 */
export function entryBase(entry) {
  const [, y] = worldPos(entry);
  const h = (entry.geometry?.h ?? 0) * AMAH;
  return entry.geometry?.kind === 'steps' ? y - h / 2 : y;
}

/**
 * Half-extents of the entry's footprint (metres): w along x, d (or w) along z. A gate's
 * `w` is its opening's width along the wall and `d` the wall's thickness, so for a gate
 * whose passage runs along x (in a wall running along z) the two are swapped.
 */
function halfExtents(entry, axis = 'z') {
  const w = ((entry.geometry?.w ?? 0) * AMAH) / 2;
  const d = ((entry.geometry?.d ?? entry.geometry?.w ?? 0) * AMAH) / 2;
  return axis === 'x' ? { w: d, d: w } : { w, d };
}

/**
 * Is the floor at (x, z), found at `y`, level ground: within SPAWN.level of the floor a
 * step (0.4 m) either way along the bearing (sx, sz)? A ramp's foot (the kevesh rises
 * 28%) or a kerb's edge is not a standing point; a tread, a landing or a rim is.
 */
function levelGround(player, x, z, y, sx, sz, fromY) {
  for (const k of [0.4, -0.4]) {
    const p = player.probe(x + sx * k, z + sz * k, fromY);
    if (p.inside || Math.abs(p.y - y) > SPAWN.level) return false;
  }
  return true;
}

const _pt = new THREE.Vector3();
function inWall(player, x, y, z) {
  _pt.set(x, y, z);
  return player.wallBoxes.some((b) => b.containsPoint(_pt));
}

/**
 * The axis a gate's passage runs along, 'x' or 'z', found from the wall boxes: points
 * beyond the opening's width on both sides (1, 2 and 4 m past it, at mid-height, on the
 * gate's own line and a quarter of the wall's thickness either side of it) lie inside
 * the wall along the wall's run and not along the passage; the direction with more of
 * them in a wall is the run (a door beside the gate, as Lishkas Palhedrin's bay off Shaar
 * HaKorban, takes a sample or two out of the wall). 'z' (a gate in a wall running along x,
 * faced from the east) when there is no player or the walls say nothing.
 */
export function entryAxis(entry, player) {
  if (entry.geometry?.kind !== 'gate' || !player?.wallBoxes) return 'z';
  const [x, , z] = worldPos(entry);
  const y = entryBase(entry) + ((entry.geometry.h ?? 0) * AMAH) / 2;
  const half = ((entry.geometry.w ?? 0) * AMAH) / 2;
  const t = ((entry.geometry.d ?? entry.geometry.w ?? 0) * AMAH) / 4;
  let alongX = 0; // samples displaced along x that are in a wall: the wall runs along x
  let alongZ = 0;
  for (const sign of [1, -1]) {
    for (const m of [1, 2, 4]) {
      const s = sign * (half + m);
      for (const k of [-t, 0, t]) {
        if (inWall(player, x + s, y, z + k)) alongX++;
        if (inWall(player, x + k, y, z + s)) alongZ++;
      }
    }
  }
  return alongZ > alongX ? 'x' : 'z';
}

/**
 * Is (x, z) inside the footprint of a chamber other than `entry` (its parent and its own
 * rooms excepted) whose floor is at `floorY`? A standing point inside some other room
 * looks at that room's wall, not at the entry.
 */
export function insideOtherRoom(entry, x, z, floorY) {
  for (const r of keilim) {
    if (r.geometry?.kind !== 'room' || r === entry || r.id === entry.parent || r.parent === entry.id) continue;
    const [rx, ry, rz] = worldPos(r);
    if (Math.abs(ry - floorY) > 1) continue;
    const { w, d } = halfExtents(r);
    if (Math.abs(x - rx) < w && Math.abs(z - rz) < d) return true;
  }
  return false;
}

/**
 * The bearing (degrees from +z) of the entry's front. 0 (east) for everything but a
 * gate; a gate's front is along its passage, on the side away from the centre of its
 * area (the side a visitor comes from: the Ezras Nashim gate from Har HaBayis, Nicanor
 * from the Ezras Nashim, the Chuldah gates from outside the mount). pickSpawn also
 * accepts the opposite side when nothing stands on this one (the Azarah's side gates
 * have the Cheil 16 amos below them; Beis HaMoked's gate has the hall behind it).
 */
export function entryFront(entry, player, axis = entryAxis(entry, player)) {
  if (entry.geometry?.kind !== 'gate') return 0;
  const [x, , z] = worldPos(entry);
  const area = byId[entry.area];
  const b = area?.bounds ? worldBounds(area) : null;
  const cx = b ? (b.minX + b.maxX) / 2 : x;
  const cz = b ? (b.minZ + b.maxZ) / 2 : z;
  const sign = axis === 'x' ? Math.sign(x - cx) || 1 : Math.sign(z - cz) || 1;
  return axis === 'x' ? 90 * sign : sign > 0 ? 0 : 180;
}

/** Yaw (degrees) that faces (tx, tz) from (cx, cz): the camera looks down -z at yaw 0. */
export function yawToward(cx, cz, tx, tz) {
  return Math.atan2(-(tx - cx), -(tz - cz)) / DEG;
}

/** Wrap a bearing into (-180, 180]. */
const wrap = (deg) => {
  const d = ((((deg + 180) % 360) + 360) % 360) - 180;
  return d === -180 ? 180 : d;
};

/**
 * Standing points round `entry` in the order they are tried: for each scale, each
 * bearing (relative to `front`, the front first), at a distance that takes the whole
 * object in from that side (its half-extent along the bearing, 3 m of clearance, and 0.8
 * of its height up to 12 m), facing the entry. Positions are [x, y, z] of the feet at the
 * entry's base; the caller lifts them to the floor it finds. With the default front (0,
 * east) the first candidate is the old rule's point. `bearing` in the result is absolute
 * (degrees from +z), whatever the front.
 */
export function spawnCandidates(entry, { front = 0, axis = 'z' } = {}) {
  const [x, , z] = worldPos(entry);
  const base = entryBase(entry);
  const { w, d } = halfExtents(entry, axis);
  const height = (entry.geometry?.h ?? 0) * AMAH;
  const rise = Math.min(height, 12) * 0.8;
  const out = [];
  for (const scale of SPAWN.scales) {
    for (const rel of SPAWN.bearings) {
      const bearing = wrap(front + rel);
      const sx = Math.sin(bearing * DEG);
      const sz = Math.cos(bearing * DEG);
      const back = Math.max(4, Math.abs(sx) * w + Math.abs(sz) * d + 3 + rise) * scale;
      const cx = x + sx * back;
      const cz = z + sz * back;
      out.push({ pos: [cx, base, cz], yaw: yawToward(cx, cz, x, z), pitch: height > 6 ? 8 : 0, bearing, scale });
    }
  }
  return out;
}

/**
 * Is there an open line from `eye` to `target`, ignoring the entry's own body (hits
 * inside its footprint, padded half a metre)? Walkable masses are the player's floor
 * collider; walls are the player's boxes.
 */
export function lineOfSight(player, eye, target, entry, axis = 'z') {
  const [ex, , ez] = worldPos(entry);
  const { w, d } = halfExtents(entry, axis);
  const own = (p) => Math.abs(p.x - ex) <= w + 0.5 && Math.abs(p.z - ez) <= d + 0.5;
  const dist = eye.distanceTo(target);
  if (dist < 1e-6) return true;
  _dir.subVectors(target, eye).divideScalar(dist);
  _raycaster.set(eye, _dir);
  _raycaster.far = dist;
  for (const hit of _raycaster.intersectObjects(player.floors, false)) if (!own(hit.point)) return false;
  _ray.set(eye, _dir);
  for (const box of player.wallBoxes) {
    const p = _ray.intersectBox(box, _hit);
    if (p && p.distanceTo(eye) < dist && !own(p)) return false;
  }
  return true;
}

const _mid = new THREE.Vector3();

/**
 * The best candidate that stands on level ground (SPAWN.level) between `SPAWN.below`
 * under and a step over the entry's base (failing that, up to `SPAWN.above` over it),
 * outside every mass and wall, not inside another chamber, inside the player's bounds,
 * and in sight of the entry (its centre at eye height over the base, or, when a kerb or
 * a landing hides that, at its mid-height: the Nicanor gate over the edge of the Maalos
 * Shir's landing); null when none does. Best: the nearest scale, then the bearing
 * nearest the entry's front (for a gate, nearest its passage's axis on either side, the
 * front side first). `player` is a PlayerController (probe, collides, floors, wallBoxes,
 * bounds).
 */
export function pickSpawn(entry, player) {
  const [tx, , tz] = worldPos(entry);
  const base = entryBase(entry);
  const height = (entry.geometry?.h ?? 0) * AMAH;
  // Aimed at: the entry's centre, at eye height over its base or at its mid-height if lower.
  _target.set(tx, base + Math.min(height / 2, CONFIG.PLAYER_HEIGHT), tz);
  _mid.set(tx, base + height / 2, tz);
  const b = player.bounds;
  const axis = entryAxis(entry, player);
  const front = entryFront(entry, player, axis);
  const fronts = entry.geometry?.kind === 'gate' ? [front, wrap(front + 180)] : [front];
  const candidates = spawnCandidates(entry, { front, axis });
  const fromY = base + CONFIG.PLAYER_HEIGHT + 0.3;
  // Passes, strictest first. When nothing in the ring stands near the entry's level with a
  // view of it, a floor any depth below is accepted (Beis Avtinas' storey, 21.5 amos up, is
  // looked up at from the Cheil), then a floor near the level with no line of sight (the
  // ta'im are sealed cells beside the Heichal: stand in the Heichal), before readSpawn's old
  // rule, which for both dropped the player 11 m onto whatever lay below.
  const passes = [
    { above: CONFIG.STEP_HEIGHT, below: SPAWN.below, sight: true },
    { above: SPAWN.above, below: SPAWN.below, sight: true },
    { above: SPAWN.above, below: Infinity, sight: true },
    { above: SPAWN.above, below: SPAWN.below, sight: false },
  ];
  for (const { above, below, sight } of passes) {
    let best = null;
    for (const c of candidates) {
      const [cx, , cz] = c.pos;
      const off = Math.min(...fronts.map((f) => Math.abs(wrap(c.bearing - f))));
      if (best && (c.scale > best.c.scale || off >= best.off)) continue;
      if (b && (cx < b.minX || cx > b.maxX || cz < b.minZ || cz > b.maxZ)) continue;
      // Probed from head height over the base: a mass taller than that puts the probe inside it.
      const p = player.probe(cx, cz, fromY);
      if (p.inside) continue;
      if (p.y > base + above || p.y < base - below) continue;
      if (!levelGround(player, cx, cz, p.y, Math.sin(c.bearing * DEG), Math.cos(c.bearing * DEG), fromY)) continue;
      if (insideOtherRoom(entry, cx, cz, p.y)) continue;
      _eye.set(cx, p.y + CONFIG.PLAYER_HEIGHT, cz);
      if (player.collides(_eye)) continue;
      if (sight && !lineOfSight(player, _eye, _target, entry, axis) && !lineOfSight(player, _eye, _mid, entry, axis)) continue;
      best = { c, off, y: _eye.y };
      if (off === 0) break;
    }
    if (best) {
      // A floor well below the entry (the Avtinas storey from the court): aim at the entry's mid-height.
      const eyeY = best.y + CONFIG.PLAYER_HEIGHT;
      const dy = _mid.y - eyeY;
      const pitch = dy > 2 ? Math.round(THREE.MathUtils.radToDeg(Math.atan2(dy, Math.hypot(tx - best.c.pos[0], tz - best.c.pos[2])))) : best.c.pitch;
      return { pos: [best.c.pos[0], best.y, best.c.pos[2]], yaw: best.c.yaw, pitch, bearing: best.c.bearing, scale: best.c.scale, front };
    }
  }
  return null;
}

/**
 * The spawn for a URL: `?cam=x,y,z,yaw,pitch` verbatim, `?at=<entry id>` a standing
 * point from pickSpawn when a player (collision world) is given and one is found, else
 * the old rule: east of the entry at its own y, facing west. Null without either.
 */
export function readSpawn(search, player = null) {
  const q = new URLSearchParams(search);
  const cam = readCam(q);
  if (cam) return cam;
  const at = q.get('at');
  if (!at || !byId[at]) return null;
  const entry = byId[at];
  if (player) {
    const picked = pickSpawn(entry, player);
    if (picked) return picked;
  }
  const [, y] = worldPos(entry);
  const first = spawnCandidates(entry)[0];
  return { pos: [first.pos[0], y + CONFIG.PLAYER_HEIGHT, first.pos[2]], yaw: 0, pitch: first.pitch };
}
