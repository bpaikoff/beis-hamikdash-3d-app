import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { byId, worldPos } from '../content/index.js';
import { AMAH } from '../content/units.js';

/**
 * Where `?at=<entry>` stands the player.
 *
 * The old rule (still the last resort) stood east of the entry at the entry's own y,
 * which put `?at=maalos_ulam` on the altar top, level with the steps' middle, so the
 * steps were under the frame. Now a ring of standing points round the entry is tried,
 * nearest the front (east) first, and the first one that is on a floor near the entry's
 * base, not inside a mass, not in a wall, and with an open line of sight to the entry
 * is taken. The floor may be a little above the base (1 m: a kerb, a step) or well below
 * it (the gates on top of their flights are looked up at from the court in front).
 */
export const SPAWN = {
  /** Bearings tried, in order, in degrees from +z (east, the front); positive toward +x (north). */
  bearings: [0, 30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180],
  /** Multiples of the standing distance tried, near to far (an entry wedged among others). */
  scales: [1, 1.5, 2],
  /** A candidate's floor may be at most this far above the entry's base (metres) ... */
  above: 1,
  /** ... and this far below it. */
  below: 6,
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
  return [x, y, z].every(Number.isFinite) ? { pos: [x, y, z], yaw, pitch } : null;
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

/** Half-extents of the entry's footprint (metres): w along x, d (or w) along z. */
function halfExtents(entry) {
  const w = ((entry.geometry?.w ?? 0) * AMAH) / 2;
  const d = ((entry.geometry?.d ?? entry.geometry?.w ?? 0) * AMAH) / 2;
  return { w, d };
}

/** Yaw (degrees) that faces (tx, tz) from (cx, cz): the camera looks down -z at yaw 0. */
export function yawToward(cx, cz, tx, tz) {
  return Math.atan2(-(tx - cx), -(tz - cz)) / DEG;
}

/**
 * Standing points round `entry` in the order they are tried: for each scale, each
 * bearing, at a distance that takes the whole object in from that side (its half-extent
 * along the bearing, 3 m of clearance, and 0.8 of its height up to 12 m), facing the
 * entry. Positions are [x, y, z] of the feet at the entry's base; the caller lifts them
 * to the floor it finds. The first candidate is the old rule's point (bearing 0, scale 1).
 */
export function spawnCandidates(entry) {
  const [x, , z] = worldPos(entry);
  const base = entryBase(entry);
  const { w, d } = halfExtents(entry);
  const height = (entry.geometry?.h ?? 0) * AMAH;
  const rise = Math.min(height, 12) * 0.8;
  const out = [];
  for (const scale of SPAWN.scales) {
    for (const bearing of SPAWN.bearings) {
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
export function lineOfSight(player, eye, target, entry) {
  const [ex, , ez] = worldPos(entry);
  const { w, d } = halfExtents(entry);
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

/**
 * The first candidate that stands on a floor between `SPAWN.below` under and `SPAWN.above`
 * over the entry's base, outside every mass and wall, inside the player's bounds, and in
 * sight of the entry; null when none does. `player` is a PlayerController (probe,
 * collides, floors, wallBoxes, bounds).
 */
export function pickSpawn(entry, player) {
  const [tx, , tz] = worldPos(entry);
  const base = entryBase(entry);
  const height = (entry.geometry?.h ?? 0) * AMAH;
  // Aimed at: the entry's centre, at eye height over its base or at its mid-height if lower.
  _target.set(tx, base + Math.min(height / 2, CONFIG.PLAYER_HEIGHT), tz);
  const b = player.bounds;
  for (const c of spawnCandidates(entry)) {
    const [cx, , cz] = c.pos;
    if (b && (cx < b.minX || cx > b.maxX || cz < b.minZ || cz > b.maxZ)) continue;
    // Probed from head height over the base: a mass taller than that puts the probe inside it.
    const p = player.probe(cx, cz, base + CONFIG.PLAYER_HEIGHT + 0.3);
    if (p.inside) continue;
    if (p.y > base + SPAWN.above || p.y < base - SPAWN.below) continue;
    _eye.set(cx, p.y + CONFIG.PLAYER_HEIGHT, cz);
    if (player.collides(_eye)) continue;
    if (!lineOfSight(player, _eye, _target, entry)) continue;
    return { pos: [cx, _eye.y, cz], yaw: c.yaw, pitch: c.pitch, bearing: c.bearing, scale: c.scale };
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
