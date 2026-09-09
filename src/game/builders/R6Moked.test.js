import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { TempleBuilder } from '../TempleBuilder.js';
import { PlayerController } from '../PlayerController.js';
import { areas, byId, worldBounds, worldPos, levelWorldY } from '../../content/index.js';
import { CONFIG } from '../../config.js';
import { AMAH, toWorld } from '../../content/units.js';
import { routes } from '../../../scripts/walk-routes/r6_moked.mjs';

/**
 * Round 6: the Middot 1:9 passage from Beis HaMoked's north-west chamber
 * (AzaraBuilder.buildTevilahPassage) and Shaar HaNitzotz's opening to the Cheil
 * (buildNitzotzWicket). Heights and fences are probed with the real PlayerController
 * over the whole Temple, and the round's routes (scripts/walk-routes/r6_moked.mjs)
 * are walked frame by frame the way scripts/walk.mjs does in the browser.
 */
const H = CONFIG.PLAYER_HEIGHT;
const DT = 1 / 60;
const STUCK_S = 3;
const STEP_TIMEOUT_S = 40;
const SAMPLE_FRAMES = 6;

let player;
let camera;
let floors;
let walls;

beforeAll(() => {
  const scene = new THREE.Scene();
  const tb = new TempleBuilder(scene, { get: () => null });
  ({ floors, walls } = tb.build());
  scene.updateMatrixWorld(true);
  const all = areas.map(worldBounds);
  const bounds = {
    minX: Math.min(...all.map((b) => b.minX)),
    maxX: Math.max(...all.map((b) => b.maxX)),
    minZ: Math.min(...all.map((b) => b.minZ)),
    maxZ: Math.max(...all.map((b) => b.maxZ)),
  };
  camera = new THREE.PerspectiveCamera();
  player = new PlayerController(camera, floors, walls, { bounds });
  player.isLocked = true;
});

function resolve(wp) {
  let x = wp.x ?? 0;
  let z = wp.z ?? 0;
  if (wp.id) {
    const e = byId[wp.id];
    if (!e) throw new Error(`unknown id ${wp.id}`);
    const [ex, , ez] = worldPos(e);
    x = ex + (wp.dx ?? 0);
    z = ez + (wp.dz ?? 0);
  }
  const level = wp.level ? levelWorldY(wp.level) : null;
  return { x, z, level, floor: player.getFloorHeight(x, z, 200) };
}

function teleport(x, y, z) {
  camera.position.set(x, y, z);
  player.verticalVelocity = 0;
}

function lookAt(x, z) {
  const c = camera.position;
  const yaw = Math.atan2(-(x - c.x), -(z - c.z));
  camera.rotation.set(0, yaw, 0, 'YXZ');
  player.euler.setFromQuaternion(camera.quaternion, 'YXZ');
}

function insideSolid() {
  const c = camera.position;
  const feetY = c.y - H;
  const p = player.probe(c.x, c.z, feetY + CONFIG.STEP_HEIGHT + 0.05);
  const feet = new THREE.Vector3(c.x, feetY + 0.3, c.z);
  return p.inside || player.wallBoxes.some((b) => b.containsPoint(feet));
}

function walkTo(wp) {
  const target = resolve(wp);
  const reach = wp.reach ?? 1.2;
  const startFeet = camera.position.y - H;
  const lowerLevel = Math.min(startFeet, target.level ?? target.floor);
  let lastDist = Infinity;
  let lastProgress = 0;
  let result = 'timeout';
  let detail = '';
  player.moveF = true;
  const maxFrames = STEP_TIMEOUT_S / DT;
  for (let f = 0; f < maxFrames; f++) {
    lookAt(target.x, target.z);
    player.update(DT);
    if (f % SAMPLE_FRAMES) continue;
    const c = camera.position;
    const feet = c.y - H;
    const dist = Math.hypot(target.x - c.x, target.z - c.z);
    if (dist < lastDist - 0.25) {
      lastDist = dist;
      lastProgress = f;
    }
    const at = `(${c.x.toFixed(1)}, ${feet.toFixed(2)}, ${c.z.toFixed(1)})`;
    if (feet < lowerLevel - 1.5) {
      result = 'fell';
      detail = `feet ${feet.toFixed(2)} below level ${lowerLevel.toFixed(2)} at ${at}`;
      break;
    }
    if (insideSolid()) {
      result = 'inside';
      detail = `feet inside a solid at ${at}`;
      break;
    }
    if (dist < reach) {
      result = 'ok';
      if (wp.minY != null) {
        if (feet < (target.level ?? 0) + wp.minY - 0.5) {
          result = 'low';
          detail = `arrived but feet ${feet.toFixed(2)}`;
        }
      } else if (target.level != null && Math.abs(feet - target.level) > 0.6) {
        result = 'wrong_level';
        detail = `feet ${feet.toFixed(2)}, expected ${target.level.toFixed(2)} at ${at}`;
      }
      break;
    }
    if (f - lastProgress > STUCK_S / DT) {
      result = 'stuck';
      detail = `${dist.toFixed(1)} m short at ${at}`;
      break;
    }
  }
  player.moveF = false;
  const c = camera.position;
  const pos = [c.x, c.y - H, c.z].map((v) => Number(v.toFixed(2)));
  if (wp.expect === 'blocked') {
    if (result === 'stuck' && wp.minY != null && pos[1] < (target.level ?? 0) + wp.minY - 0.5) {
      result = 'low';
      detail = `blocked but feet ${pos[1]} (expected >= ${((target.level ?? 0) + wp.minY).toFixed(2)})`;
    } else if (result === 'stuck') result = 'ok';
    else if (result === 'ok') {
      result = 'passed';
      detail = `walked through to ${pos.join(', ')}`;
    }
  }
  if (result !== 'ok') teleport(target.x, (target.level ?? target.floor) + H, target.z);
  return { result, detail, pos, target };
}

function walkRoute(waypoints) {
  const start = resolve(waypoints[0]);
  teleport(start.x, (start.level ?? start.floor) + H, start.z);
  for (let i = 0; i < 10; i++) player.update(DT);
  const failures = [];
  for (let i = 1; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const label = wp.id ? wp.id : `(${(wp.x / AMAH).toFixed(2)},${((wp.z - toWorld({ x: 0, y: 0, z: 0 })[2]) / AMAH).toFixed(2)})`;
    const r = walkTo(wp);
    if (r.result !== 'ok') failures.push(`#${i} -> ${label}: ${r.result} ${r.detail}`);
  }
  return failures;
}

/** World (x, z) of a point in amos. */
const xz = (x, z) => {
  const [wx, , wz] = toWorld({ x, y: 0, z });
  return [wx, wz];
};
/** World y of a height in amos over the Azarah floor. */
const yOf = (a) => toWorld({ x: 0, y: a, z: 0 })[1];
/** Highest walkable surface under (x, z) amos cast from `from` amos (or from far above), in amos. */
const hA = (x, z, from) => (player.getFloorHeight(...xz(x, z), from == null ? 200 : yOf(from)) - yOf(0)) / AMAH;
/** Is (x, y, z) amos inside a wall box? */
const wallAt = (x, y, z) => {
  const [wx, wy, wz] = toWorld({ x, y, z });
  const pt = new THREE.Vector3(wx, wy, wz);
  return player.wallBoxes.some((b) => b.containsPoint(pt));
};

const T = 2.55; // the hall and chamber floor (the court level plus a LIP)
const F = -13.41; // the vestibule, passage and pool floors (the Cheil pavement plus its LIP and a LIP)
const CEIL = 1.6; // under the hall floor slab
const PAV = -13.46; // the Cheil pavement

describe('Tevilah passage (Middot 1:9): the stair under the north-west chamber', () => {
  it('lands its flights and landings at their heights and keeps the old well', () => {
    expect(hA(78.25, -21.75)).toBeCloseTo(T - 0.5, 2); // C's top tread block, half an amah under the chamber floor: the slab's edge is the last rise
    expect(hA(77.25, -21.75)).toBeCloseTo(T - 1.5, 2);
    expect(hA(78.9, -21.75)).toBeCloseTo(T, 2); // the step-off floor beyond the well
    expect(hA(74.25, -21.75)).toBeCloseTo(-1.95, 2); // C's first tread, seen from above through the well: the eye (3.4 amos up) is under the hall floor slab (1.75)
    expect(hA(72.75, -20, CEIL)).toBeCloseTo(-2.45, 2); // landing L2
    expect(hA(74.25, -19.5, CEIL)).toBeCloseTo(-2.45, 2); // B's top tread
    expect(hA(79.25, -19.5, CEIL)).toBeCloseTo(-7.45, 2); // B's first tread
    expect(hA(80.5, -18, CEIL)).toBeCloseTo(-7.95, 2); // landing L1
    expect(hA(79.25, -17.25, CEIL)).toBeCloseTo(-7.95, 2); // A's top tread
    expect(hA(74.25, -17.25, CEIL)).toBeCloseTo(-12.95, 2); // A's first tread, a quarter metre over the vestibule floor
    for (const [x, z] of [[70, -17.25], [70, -24], [75, -24], [72.5, -24.5], [80, -24]]) expect(hA(x, z, CEIL), `${x},${z}`).toBeCloseTo(F, 2); // the pocket, the lane, the strip
    expect(hA(69.5, -8.75)).toBeCloseTo(T, 2); // the GEO-D well's top tread is untouched
    expect(hA(75, -14)).toBeCloseTo(T, 2);
  });

  it('fences every open side: walls to the ceiling, colliders through the slab, the parapet on the floor', () => {
    for (const x of [72, 75, 80]) expect(wallAt(x, -1, -22.9), `west ${x}`).toBe(true);
    for (const x of [75, 80]) expect(wallAt(x, -5, -20.6), `C/B ${x}`).toBe(true);
    for (const x of [72, 75, 79]) expect(wallAt(x, -5, -18.4), `B/A ${x}`).toBe(true);
    for (const x of [74, 77, 81]) expect(wallAt(x, -10, -16), `A outer ${x}`).toBe(true);
    expect(wallAt(71.4, -5, -20), 'L2 end').toBe(true);
    expect(wallAt(75, 3, -22.9), 'west collider through the slab').toBe(true);
    expect(wallAt(75, 3, -20.7), 'band collider, inner face only').toBe(true);
    expect(wallAt(75, 3, -20.4), 'nothing beyond it in the parapet').toBe(false);
    expect(wallAt(78.2, 3, -22.9), 'colliders stop short of the well end').toBe(false);
    for (const [x, z] of [[75, -20.5], [77.75, -20.5], [73.75, -21.75], [73.75, -20.5]]) expect(hA(x, z), `parapet ${x},${z}`).toBeCloseTo(T + 0.05 + 1.5, 2);
    expect(hA(75, -19.8)).toBeCloseTo(T, 2); // the floor on the parapet's room side
    expect(hA(72.5, -21.75), 'floor west of the foot-end parapet').toBeCloseTo(T, 2);
    // A's foot is sealed from the GEO-D switchback's foot: wall all along z -16.25 .. -15.75 from x 68.5 to the north wall.
    for (const x of [69, 73.4, 73.6, 78]) expect(wallAt(x, -10, -16.1), `seal ${x}`).toBe(true);
    expect(hA(73.5, -17.25, CEIL), 'the pocket at A\'s foot').toBeCloseTo(F, 2);
  });
});

describe('Tevilah passage: the vaulted passage and the bath-house', () => {
  it('floors the passage on the pavement, steps up to the bath-house and sinks the pool to the pavement', () => {
    for (const z of [-27, -33, -39.5]) expect(hA(75, z), `passage ${z}`).toBeCloseTo(F, 2); // the vault is not a floor
    expect(hA(75, -40.25)).toBeCloseTo(-12.91, 2);
    expect(hA(75, -41.25)).toBeCloseTo(-11.91, 2);
    expect(hA(75, -41.75)).toBeCloseTo(-11.41, 2);
    expect(hA(75, -42.5), 'the door threshold').toBeCloseTo(-11.41, 2);
    for (const [x, z] of [[75, -44.5], [78.5, -44.5], [75.5, -49], [78.5, -50.75]]) expect(hA(x, z), `floor ${x},${z}`).toBeCloseTo(-11.41, 2);
    expect(hA(74.5, -50.25), 'the hearth').toBeCloseTo(-11.41 + 0.5, 2);
    expect(hA(78.5, -46.25)).toBeCloseTo(-11.91, 2); // the three treads
    expect(hA(78.5, -46.75)).toBeCloseTo(-12.41, 2);
    expect(hA(78.5, -47.25)).toBeCloseTo(-12.91, 2);
    expect(hA(78.5, -49)).toBeCloseTo(F, 2); // the pool floor, on the pavement (the water is not a floor)
    for (const [x, z] of [[76.25, -48], [78.5, -50.25]]) expect(hA(x, z), `kerb ${x},${z}`).toBeCloseTo(-11.41 + 0.05 + 1.5, 2);
    expect(wallAt(76.75, -11, -33), 'the passage wall').toBe(true);
    expect(wallAt(76.75, -10, -33), 'up to the vault springing').toBe(true);
    expect(wallAt(76.75, -9.5, -33), 'the vault above it is not a collider').toBe(false);
    expect(wallAt(81, -13, -47), 'the bath-house north wall').toBe(true);
    expect(wallAt(81, -8, -47)).toBe(true);
    expect(wallAt(78, -12.5, -49), 'no wall in the pool').toBe(false);
    expect(wallAt(76.25, -12.5, -49), 'the pool wall under the floor').toBe(true);
    expect(wallAt(78, -12.5, -45.75), 'no wall under the floor on the treads\' side').toBe(false);
    expect(hA(82.4, -47)).toBeCloseTo(PAV, 2); // the lane along the Soreg
    expect(hA(82.4, -30)).toBeCloseTo(PAV, 2);
    expect(hA(78.5, -36)).toBeCloseTo(PAV, 2); // the Cheil in front of Shaar HaNashim, beside the vault
  });
});

describe("Shaar HaNitzotz's opening to the Cheil (Middot 1:5): the stair tower", () => {
  it('climbs from the wicket to the bay at the court level', () => {
    const K = levelWorldY('azaras_kohanim');
    expect(player.getFloorHeight(...xz(70.5, -85.5), 200)).toBeCloseTo(K, 2); // the bay through the wall
    expect(hA(75, -85.5)).toBeCloseTo(2.5, 2); // the top landing
    expect(hA(75, -87.25)).toBeCloseTo(2.5, 2); // the upper flight's top tread
    expect(hA(75, -94.75)).toBeCloseTo(-5, 2); // its first tread
    expect(hA(75, -96.5)).toBeCloseTo(-5.5, 2); // the turn landing
    expect(hA(78.5, -96.5)).toBeCloseTo(-5.5, 2);
    expect(hA(78.5, -94.75)).toBeCloseTo(-5.5, 2); // the lower flight's top tread
    expect(hA(78.5, -87.25)).toBeCloseTo(-13, 2); // its first tread
    expect(hA(78.5, -85.5)).toBeCloseTo(F, 2); // the entry strip
    expect(hA(78.5, -83.5)).toBeCloseTo(F, 2); // the wicket, on the tower floor
    expect(hA(78.5, -82)).toBeCloseTo(PAV, 2); // the Cheil outside
    expect(hA(82.4, -90)).toBeCloseTo(PAV, 2); // the lane along the Soreg
    for (const z of [-94, -90, -84.5]) expect(wallAt(76.75, -8, z), `band wall ${z}`).toBe(true);
    expect(wallAt(76.75, -8, -96.5), 'open at the turn').toBe(false);
    expect(wallAt(80.5, -8, -90), 'north wall').toBe(true);
    expect(wallAt(78.5, -12, -83.5), 'the wicket is open').toBe(false);
    expect(wallAt(75, -12, -83.5), 'the east wall beside it').toBe(true);
    expect(wallAt(70.5, 5, -85.5), 'the bay is open').toBe(false);
    expect(wallAt(70.5, -5, -85.5), 'the wall under the bay').toBe(true);
    expect(wallAt(70.5, 5, -82.5), "the gate's jamb between the bay and the gate").toBe(true);
  });
});

describe('Round 6 walking routes (scripts/walk-routes/r6_moked.mjs)', () => {
  for (const [name, waypoints] of Object.entries(routes)) {
    it(name, () => {
      const failures = walkRoute(waypoints);
      expect(failures, failures.join('\n')).toEqual([]);
    });
  }
});
