import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { TempleBuilder } from '../TempleBuilder.js';
import { PlayerController } from '../PlayerController.js';
import { areas, byId, worldBounds, worldPos, levelWorldY } from '../../content/index.js';
import { CONFIG } from '../../config.js';
import { AMAH, toWorld } from '../../content/units.js';
import { routes } from '../../../scripts/walk-routes/r6_north.mjs';

/**
 * Round 6, the north walker: the traps the browser walkers cannot see round the Middot
 * 1:9 passage (AzaraBuilder.buildTevilahPassage) and Shaar HaNitzotz's stair tower
 * (buildNitzotzWicket), probed with the real PlayerController over the whole Temple:
 * every landing's and flight's open side, the well shaft from the chamber and from the
 * treads, the pool's treads and kerb, the head clearance under the passage vault, the
 * wicket and the bay both ways, and the Cheil lane along the Soreg past the tower and
 * the bath-house. The visitor routes of scripts/walk-routes/r6_north.mjs are walked
 * frame by frame the way scripts/walk.mjs does in the browser.
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
let scene;

beforeAll(() => {
  scene = new THREE.Scene();
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
    const at = `(${(c.x / AMAH).toFixed(2)}, ${((feet - yOf(0)) / AMAH).toFixed(2)}, ${((c.z - toWorld({ x: 0, y: 0, z: 0 })[2]) / AMAH).toFixed(2)}) amos`;
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
/**
 * Stand at (x, z) amos on the surface `y` amos up and walk straight toward (tx, tz) for
 * up to `seconds`; returns where the feet ended (amos) and the walkTo result. A leg into
 * a wall or a mass ends "stuck" with the feet still up; a leg off an open edge ends with
 * the feet down.
 */
function push(x, z, y, tx, tz, o = {}) {
  const [wx, wz] = xz(x, z);
  teleport(wx, yOf(y) + H, wz);
  for (let i = 0; i < 10; i++) player.update(DT);
  const [twx, twz] = xz(tx, tz);
  const r = walkTo({ x: twx, z: twz, reach: 0.3, ...o });
  return { ...r, feet: (r.pos[1] - yOf(0)) / AMAH, x: r.pos[0] / AMAH, z: (r.pos[2] - toWorld({ x: 0, y: 0, z: 0 })[2]) / AMAH };
}

const T = 2.55; // the hall and chamber floor
const F = -13.41; // the vestibule, passage and pool floors
const PAV = -13.46; // the Cheil pavement
const K = 2.55; // the court (the Ezras Kohanim floor plus a LIP)

describe('Tevilah stair: no open side on any landing or flight (probed with the PlayerController)', () => {
  const cases = [
    // [from x, z, y, toward x, z, what]
    [72.75, -19.5, -2.45, 69, -19.5, "L2's end wall toward the lane"],
    [72.75, -21.75, -2.45, 72.75, -25, "L2's west wall"],
    [72.75, -19.5, -2.45, 72.75, -16, "L2's wall toward flight A"],
    [80.5, -18, -7.95, 80.5, -22, "L1's wall toward flight C's band"],
    [80.5, -18, -7.95, 80.5, -14, "L1's outer wall"],
    [80.5, -18, -7.95, 84, -18, "L1 against the vestibule's north wall"],
    [76.75, -19.5, -4.95, 76.75, -23, 'flight B into the C/B wall'],
    [76.75, -19.5, -4.95, 76.75, -15, 'flight B into the B/A wall'],
    [76.25, -17.25, -10.95, 76.25, -21, 'flight A into the B/A wall'],
    [76.25, -17.25, -10.95, 76.25, -13, "flight A into its outer wall (sealed from the GEO-D switchback's foot)"],
    [75.25, -21.75, -0.95, 75.25, -25, "flight C into the chamber's west wall through the slab"],
    [75.25, -21.75, -0.95, 75.25, -18, 'flight C into the band collider under the parapet'],
    [78.25, -21.75, 2.05, 78.25, -18, "C's top tread into the parapet"],
    [77.75, -21.75, 1.55, 77.75, -18, "C's second tread into the parapet"],
    [77.75, -21.75, 1.55, 77.75, -25, "C's second tread into the chamber wall"],
  ];
  for (const [x, z, y, tx, tz, what] of cases) {
    it(what, () => {
      const r = push(x, z, y, tx, tz, { expect: 'blocked' });
      expect(r.result, `${what}: ${r.result} ${r.detail}`).toBe('ok');
      expect(r.feet, `${what}: feet ended at ${r.feet.toFixed(2)} from ${y}`).toBeGreaterThan(y - 0.6);
    });
  }

  it('enters the well only from the step-off floor at its open end, and the parapet stops the room side', () => {
    let r = push(79, -21.75, T, 76, -21.75);
    expect(r.result).toBe('ok');
    expect(r.feet).toBeLessThan(T - 1); // four treads down
    r = push(76, -19.5, T, 76, -22.5, { expect: 'blocked' });
    expect(r.result, r.detail).toBe('ok');
    expect(r.feet).toBeGreaterThan(T - 0.1);
    r = push(73.9, -19.5, T, 73.9, -22.5, { expect: 'blocked' }); // the foot-end parapet beside the door
    expect(r.result, r.detail).toBe('ok');
    expect(r.feet).toBeGreaterThan(T - 0.1);
  });

  it('keeps the head under the hall floor slab on every tread and landing (1.8 m clear)', () => {
    // From the well's first tread down to the vestibule floor the eye (1.7 m up) must
    // clear the slab's underside; the slab's top is T, its underside T - 0.8 amos.
    const under = T - 0.05 - 0.8;
    for (const [x, z] of [[74.25, -21.75], [72.75, -20], [74.25, -19.5], [79.25, -19.5], [80.5, -18], [74.25, -17.25]]) {
      const top = hA(x, z, under);
      expect(under - top, `${x},${z}: ${(under - top) / 2} m clear`).toBeGreaterThanOrEqual(3.6);
    }
  });
});

describe('Tevilah passage: the vault, the door and the pool', () => {
  const vaultAt = (x, z) => {
    // Height of the vault's inner face over the floor at (x, z) amos, cast upward from the floor.
    const [wx, wz] = xz(x, z);
    const floor = player.getFloorHeight(wx, wz, 200);
    const ray = new THREE.Raycaster(new THREE.Vector3(wx, floor + 0.05, wz), new THREE.Vector3(0, 1, 0), 0, 10);
    const vaults = [];
    scene.traverse((o) => o.name?.startsWith('beis_hatevilah passage vault') && vaults.push(o));
    const hits = ray.intersectObjects(vaults, false);
    return hits.length ? hits[0].point.y - floor : Infinity;
  };

  it('gives 1.8 m of head room along the whole passage, including over the four steps', () => {
    for (let z = -26.5; z >= -41.75; z -= 0.75) {
      for (const x of [74.1, 75, 75.9]) {
        const c = vaultAt(x, z);
        expect(c, `vault ${(c).toFixed(2)} m over the floor at ${x},${z}`).toBeGreaterThanOrEqual(1.8);
      }
    }
  });

  it('walks the passage door both ways, and its leaf stands beside the opening, not in it', () => {
    let r = push(75, -24, F, 75, -29);
    expect(r.result, r.detail).toBe('ok');
    r = push(75, -29, F, 75, -24);
    expect(r.result, r.detail).toBe('ok');
    const leaves = [];
    scene.traverse((o) => o.name === 'beis_hatevilah passage door leaf' && leaves.push(o));
    expect(leaves.length).toBe(1);
    const box = new THREE.Box3().setFromObject(leaves[0]);
    const [dx1] = xz(73.5, 0);
    const [dx2] = xz(76.5, 0);
    // The opening is x 73.5 .. 76.5: the leaf lies wholly outside it.
    expect(box.min.x >= dx2 - 1e-6 || box.max.x <= dx1 + 1e-6, `leaf x ${box.min.x / AMAH} .. ${box.max.x / AMAH} amos`).toBe(true);
  });

  it('lets the player down the pool treads into the water and back out, and stops him at the kerb', () => {
    let r = push(78.5, -44.5, -11.41, 78.5, -49);
    expect(r.result, r.detail).toBe('ok');
    expect(r.feet).toBeCloseTo(F, 1);
    r = push(78.5, -49, F, 78.5, -44.5);
    expect(r.result, r.detail).toBe('ok');
    expect(r.feet).toBeCloseTo(-11.41, 1);
    for (const [x, z, tx, tz, what] of [
      [75, -48, 79, -48, 'the west kerb from the floor'],
      [78.5, -50.75, 78.5, -47, 'the south kerb from the floor'],
      [75.5, -45.7, 78.5, -45.7, 'the kerb\'s north-east return'],
      [77, -49, 74, -49, 'the pool wall from the water, west'],
      [77, -49, 77, -52, 'the pool wall from the water, south'],
      [79, -49, 82, -49, 'the north wall from the water'],
    ]) {
      const y = tx === 74 || tz === -52 || tx === 82 ? F : -11.41;
      r = push(x, z, y, tx, tz, { expect: 'blocked' });
      expect(r.result, `${what}: ${r.result} ${r.detail}`).toBe('ok');
      expect(r.feet, `${what}: feet ${r.feet}`).toBeGreaterThan(y - 0.3);
    }
  });

  it('the bath-house door both ways and the four steps', () => {
    let r = push(75, -38, F, 75, -45);
    expect(r.result, r.detail).toBe('ok');
    expect(r.feet).toBeCloseTo(-11.41, 1);
    r = push(75, -45, -11.41, 75, -38);
    expect(r.result, r.detail).toBe('ok');
    expect(r.feet).toBeCloseTo(F, 1);
  });
});

describe("Shaar HaNitzotz's tower: the wicket, the flights, the landings and the bay", () => {
  it('walks the wicket both ways and the bay both ways', () => {
    let r = push(78.5, -80, PAV, 78.5, -86);
    expect(r.result, r.detail).toBe('ok');
    r = push(78.5, -86, F, 78.5, -80);
    expect(r.result, r.detail).toBe('ok');
    r = push(64, -85.5, K, 75.5, -85.5);
    expect(r.result, r.detail).toBe('ok');
    expect(r.feet).toBeCloseTo(2.5, 1);
    r = push(75.5, -85.5, 2.5, 64, -85.5);
    expect(r.result, r.detail).toBe('ok');
    expect(r.feet).toBeCloseTo(K, 1);
  });

  const cases = [
    [75, -85.5, 2.5, 75, -81, "the top landing's east wall"],
    [75, -85.5, 2.5, 79, -85.5, 'the top landing into the wall between the flights'],
    [75, -85.5, 2.5, 71, -83.5, "the gate's jamb beside the bay"],
    [75, -90, -0.5, 79, -90, 'the upper flight into the wall between the flights'],
    [75, -90, -0.5, 71, -90, 'the upper flight into the court wall'],
    [75, -96.5, -5.5, 75, -101, "the turn landing's west wall"],
    [78.5, -96.5, -5.5, 83, -96.5, "the turn landing's north wall"],
    [78.5, -90, -10, 74, -90, 'the lower flight into the wall between the flights'],
    [78.5, -90, -10, 83, -90, 'the lower flight into the north wall'],
    [78.5, -85.5, F, 83, -85.5, "the entry strip's north wall"],
    [78.5, -85.5, F, 74, -85.5, 'the entry strip into the wall under the top landing'],
    [77.25, -84.5, F, 77.25, -80, 'the east wall beside the wicket, from inside (the strip is x 77 .. 80, the wicket 77.5 .. 79.5)'],
    [76, -81, PAV, 76, -85, 'the east wall beside the wicket, from the Cheil'],
  ];
  for (const [x, z, y, tx, tz, what] of cases) {
    it(what, () => {
      const r = push(x, z, y, tx, tz, { expect: 'blocked' });
      expect(r.result, `${what}: ${r.result} ${r.detail}`).toBe('ok');
      expect(r.feet, `${what}: feet ended at ${r.feet.toFixed(2)} from ${y}`).toBeGreaterThan(y - 0.6);
    });
  }
});

describe('The Cheil lane along the Soreg past the bath-house and the tower', () => {
  /** Free width of the lane at z amos: from the structure's outer face to the Soreg's first wall box, in metres. */
  const laneAt = (z, xFace) => {
    const [, wz] = xz(0, z);
    const y = yOf(PAV + 1);
    let soreg = Infinity;
    for (const b of player.wallBoxes) {
      if (wz < b.min.z || wz > b.max.z || y < b.min.y || y > b.max.y) continue;
      if (b.min.x > xz(xFace, 0)[0] && b.min.x < soreg) soreg = b.min.x;
    }
    return soreg - xz(xFace, 0)[0];
  };

  it('is at least 0.8 m clear between the walls and the Soreg', () => {
    for (const z of [-44, -47, -50]) expect(laneAt(z, 81.5), `bath-house z ${z}`).toBeGreaterThanOrEqual(0.8);
    for (const z of [-85, -90, -98]) expect(laneAt(z, 81), `tower z ${z}`).toBeGreaterThanOrEqual(0.8);
  });

  it('walks the lane past both without touching them and turns their corners', () => {
    for (const [x, z1, z2] of [[82.4, -40, -54], [82.4, -54, -40], [82.4, -81, -101], [82.4, -101, -81]]) {
      const r = push(x, z1, PAV, x, z2, { reach: 0.4 });
      expect(r.result, `${x} ${z1}->${z2}: ${r.result} ${r.detail}`).toBe('ok');
      expect(Math.abs(r.feet - PAV)).toBeLessThan(0.2);
    }
    // Into the faces: the walls stop the player on the pavement.
    for (const [x, z, tx, tz] of [[82.4, -47, 79, -47], [82.4, -90, 79, -90], [78, -40, 78, -45], [78, -54, 78, -49], [78, -81, 78, -85], [78, -101, 78, -96]]) {
      const r = push(x, z, PAV, tx, tz, { expect: 'blocked' });
      expect(r.result, `${x},${z}->${tx},${tz}: ${r.result} ${r.detail}`).toBe('ok');
    }
  });
});

describe('Round 6 north walker routes (scripts/walk-routes/r6_north.mjs)', () => {
  for (const [name, waypoints] of Object.entries(routes)) {
    it(name, () => {
      const failures = walkRoute(waypoints);
      expect(failures, failures.join('\n')).toEqual([]);
    });
  }
});
