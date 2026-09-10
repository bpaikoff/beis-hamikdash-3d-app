import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { TempleBuilder } from '../TempleBuilder.js';
import { PlayerController } from '../PlayerController.js';
import { areas, byId, worldBounds, worldPos, levelWorldY } from '../../content/index.js';
import { CONFIG } from '../../config.js';
import { AMAH, toWorld } from '../../content/units.js';
import { routes } from '../../../scripts/walk-routes/r7_flip.mjs';

/**
 * Round 7, the flip walker: the Beis Avtinas storey over Shaar HaMayim with its stair
 * tower (AzaraBuilder.buildBeisAvtinas, avtinasTower) and Lishkas Palhedrin in the north
 * Cheil (buildLishkasPalhedrin), probed with the real PlayerController over the whole
 * Temple: the tower's court door and storey door both ways, every flight and landing
 * and the band walls that fence them (the drop across each wall's open amah is a step,
 * never a fall), the storey's walls; Palhedrin's Cheil door both ways, both flights, the
 * turn landing, the top landing's bay into the Korban gate passage both ways, the
 * chamber's walls from the Cheil and the lane; the Even HaShtiya from four sides; the
 * kevesh. The visitor routes of scripts/walk-routes/r7_flip.mjs are walked frame by
 * frame the way scripts/walk.mjs does in the browser.
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
let mat;

beforeAll(() => {
  scene = new THREE.Scene();
  const tb = new TempleBuilder(scene, { get: () => null });
  mat = tb.mat;
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

const K = 2.55; // the court (the Ezras Kohanim floor plus a LIP) and the tower's floor
const PAV = -13.46; // the Cheil pavement
const F = -13.41; // Palhedrin's floor (the pavement plus a LIP)
const KHK = 8.5; // the Kodesh HaKodashim floor level

/** Walks (x1, z1) -> (x2, z2) from the surface `y` and expects to arrive; returns the feet height in amos. */
function walkOk(x1, z1, y, x2, z2, what, o = {}) {
  const r = push(x1, z1, y, x2, z2, { reach: 0.4, ...o });
  expect(r.result, `${what}: ${r.result} ${r.detail}`).toBe('ok');
  return r.feet;
}

/** Walks from (x, z, y) toward (tx, tz) and expects a wall or a mass to stop the player with the feet still up. */
function stopped(x, z, y, tx, tz, what) {
  const r = push(x, z, y, tx, tz, { expect: 'blocked' });
  expect(r.result, `${what}: ${r.result} ${r.detail}`).toBe('ok');
  expect(r.feet, `${what}: feet ended at ${r.feet.toFixed(2)} from ${y}`).toBeGreaterThan(y - 0.6);
  return r;
}

describe('Beis Avtinas tower (round 7, south): the doors, the flights, the landings and the band walls', () => {
  // Landings: L1 x -72.5 .. -70, z -31 .. -27.5 at 8.05; L2 x -65 .. -62.5, z -29.25 .. -25.75 at 13.55;
  // L3 x -72.5 .. -70, z -27.5 .. -24 at 19.05; top x -65 .. -62.5, z -25.75 .. -24 at 24.05.
  const [L1, L2, L3, TOP] = [8.05, 13.55, 19.05, 24.05];

  it('walks the court door both ways and the storey door both ways', () => {
    expect(walkOk(-63.75, -36, K, -63.75, -30.1, 'in through the court door')).toBeCloseTo(K, 1);
    expect(walkOk(-63.75, -30.1, K, -63.75, -36, 'out through the court door')).toBeCloseTo(K, 1);
    expect(walkOk(-63.75, -24.9, TOP, -63.75, -20, 'into the storey')).toBeCloseTo(TOP, 1);
    expect(walkOk(-63.75, -20, TOP, -63.75, -24.9, 'back onto the top landing')).toBeCloseTo(TOP, 1);
  });

  it('climbs each flight from its foot to its landing and down again', () => {
    expect(walkOk(-63.75, -30.1, K, -71.25, -30.1, 'flight 1 up')).toBeCloseTo(L1, 1);
    expect(walkOk(-71.25, -28.4, L1, -63.75, -28.4, 'flight 2 up')).toBeCloseTo(L2, 1);
    expect(walkOk(-63.75, -26.6, L2, -71.25, -26.6, 'flight 3 up')).toBeCloseTo(L3, 1);
    expect(walkOk(-71.25, -24.9, L3, -63.75, -24.9, 'flight 4 up')).toBeCloseTo(TOP, 1);
    expect(walkOk(-63.75, -24.9, TOP, -71.25, -24.9, 'flight 4 down')).toBeCloseTo(L3, 1);
    expect(walkOk(-71.25, -26.6, L3, -63.75, -26.6, 'flight 3 down')).toBeCloseTo(L2, 1);
    expect(walkOk(-63.75, -28.4, L2, -71.25, -28.4, 'flight 2 down')).toBeCloseTo(L1, 1);
    expect(walkOk(-71.25, -30.1, L1, -63.75, -30.1, 'flight 1 down')).toBeCloseTo(K, 1);
  });

  const cases = [
    // [from x, z, y, toward x, z, what]
    [-67.5, -30.1, 5.05, -67.5, -26, 'flight 1 into the band wall at z -29.25'],
    [-71.25, -29.25, L1, -71.25, -24, 'L1 into the band wall at z -27.5'],
    [-71.25, -29.25, L1, -75, -29.25, "L1 into the tower's west wall"],
    [-71.25, -29.25, L1, -71.25, -34, "L1 into the tower's south wall"],
    [-67.5, -28.4, 10.55, -67.5, -33, 'flight 2 into the band wall at z -29.25'],
    [-67.5, -28.4, 10.55, -67.5, -23, 'flight 2 into the band wall at z -27.5'],
    [-63.75, -27.5, L2, -63.75, -33, 'L2 into the band wall at z -29.25'],
    [-63.75, -27.5, L2, -63.75, -22, 'L2 into the band wall at z -25.75'],
    [-63.75, -27.5, L2, -59, -27.5, "L2 into the tower's east wall"],
    [-67.5, -26.6, 16.05, -67.5, -31, 'flight 3 into the band wall at z -27.5'],
    [-67.5, -26.6, 16.05, -67.5, -21, 'flight 3 into the band wall at z -25.75'],
    [-71.25, -25.75, L3, -71.25, -31, 'L3 into the band wall at z -27.5'],
    [-71.25, -25.75, L3, -71.25, -20, "L3 into the tower's wall toward the storey"],
    [-71.25, -25.75, L3, -75, -25.75, "L3 into the tower's west wall"],
    [-67.5, -24.9, 21.55, -67.5, -29, 'flight 4 into the band wall at z -25.75'],
    [-67.5, -24.9, 21.55, -67.5, -20, "flight 4 into the tower's wall toward the storey"],
    [-63.75, -24.9, TOP, -63.75, -29, 'the top landing into the band wall at z -25.75'],
    [-63.75, -24.9, TOP, -59, -24.9, "the top landing into the tower's east wall"],
    [-63.75, -30.1, K, -59, -30.1, "the entry strip into the tower's east wall"],
    [-60, -28, K, -64, -28, "the tower's east wall from the court"],
    [-66.3, -36, K, -66.3, -30, "the tower's west face from the court beside the door (x -67.5 .. -65)"],
  ];
  for (const [x, z, y, tx, tz, what] of cases) {
    it(what, () => {
      stopped(x, z, y, tx, tz, what);
    });
  }

  it('drops at most 1.5 amos across the open amah at the end of each band wall (a stumble onto the next flight, not a fall)', () => {
    // The band walls stop an amah short of the landing that joins their two flights; there
    // the higher flight's foot lies beside the lower one's top.
    for (const [x, zLow, zHigh, what] of [
      [-69.5, -30.1, -28.4, 'flight 1 top / flight 2 foot at the wall end'],
      [-65.5, -28.4, -26.6, 'flight 2 top / flight 3 foot at the court end'],
      [-69.5, -26.6, -24.9, 'flight 3 top / flight 4 foot at the wall end'],
    ]) {
      const drop = hA(x, zHigh) - hA(x, zLow);
      expect(drop, `${what}: ${drop.toFixed(2)} amos`).toBeGreaterThan(0);
      expect(drop, what).toBeLessThanOrEqual(1.5 + 1e-6);
      // Walked across the gap from the higher flight the feet stay within that drop.
      const r = push(x, zHigh, hA(x, zHigh), x, zLow - 0.5, { reach: 0.4 });
      expect(r.feet, `${what}: feet ${r.feet.toFixed(2)}`).toBeGreaterThan(hA(x, zLow) - 0.6);
    }
  });

  it('the storey floor is fenced by its four walls and the door is the only way out', () => {
    for (const [tx, tz, what] of [[-58, -14, 'north wall'], [-77, -14, 'south wall'], [-67.5, -4, 'east wall'], [-69, -27, 'west wall beside the door']]) {
      stopped(-67.5, -16, TOP, tx, tz, `the storey's ${what}`);
    }
    expect(hA(-63.75, -24.9)).toBeCloseTo(TOP, 2);
    expect(hA(-67.5, -16, 30)).toBeCloseTo(TOP, 2);
  });
});

describe('Lishkas Palhedrin (round 7, north): the Cheil door, the flights, the landings, the bay and the walls', () => {
  it('walks the Cheil door both ways and the bay both ways', () => {
    expect(walkOk(78.5, -58, PAV, 78.5, -65.5, 'in through the Cheil door')).toBeCloseTo(F, 1);
    expect(walkOk(78.5, -65.5, F, 78.5, -58, 'out through the Cheil door')).toBeCloseTo(PAV, 1);
    expect(walkOk(75, -65.5, K, 64, -65.5, 'out through the bay into the passage')).toBeCloseTo(K, 1);
    expect(walkOk(64, -65.5, K, 75, -65.5, 'in through the bay onto the top landing')).toBeCloseTo(K, 1);
  });

  it('climbs the lower flight to the turn landing and the upper flight to the top landing, and down', () => {
    expect(walkOk(78.5, -65.5, F, 78.5, -76.5, 'the lower flight up')).toBeCloseTo(-5.5, 1);
    expect(walkOk(78.5, -76.5, -5.5, 75, -76.5, 'across the turn landing')).toBeCloseTo(-5.5, 1);
    expect(walkOk(75, -76.5, -5.5, 75, -65.5, 'the upper flight up')).toBeCloseTo(K, 1);
    expect(walkOk(75, -65.5, K, 75, -76.5, 'the upper flight down')).toBeCloseTo(-5.5, 1);
    expect(walkOk(75, -76.5, -5.5, 78.5, -76.5, 'back across the turn landing')).toBeCloseTo(-5.5, 1);
    expect(walkOk(78.5, -76.5, -5.5, 78.5, -65.5, 'the lower flight down')).toBeCloseTo(F, 1);
  });

  const cases = [
    [78.5, -65.5, F, 83, -65.5, "the entry strip's north wall"],
    [78.5, -65.5, F, 74, -65.5, 'the entry strip into the wall between the flights'],
    [77.25, -64.5, F, 77.25, -60, 'the east wall beside the door, from inside'],
    [75, -58, PAV, 75, -66, 'the east wall beside the door, from the Cheil'],
    [80.5, -58, PAV, 80.5, -66, "the east wall's north end, from the Cheil"],
    [82.4, -70, PAV, 78, -70, 'the north wall from the lane'],
    [77, -81, PAV, 77, -76, 'the west wall from the Cheil between Palhedrin and the Nitzotz tower'],
    [78.5, -70.25, -10.5, 74, -70.25, 'the lower flight into the wall between the flights'],
    [78.5, -70.25, -10.5, 83, -70.25, 'the lower flight into the north wall'],
    [78.5, -76.5, -5.5, 78.5, -81, "the turn landing's west wall"],
    [78.5, -76.5, -5.5, 83, -76.5, "the turn landing's north wall"],
    [75, -76.5, -5.5, 71, -76.5, 'the turn landing into the court wall'],
    [75, -70.25, -0.5, 79, -70.25, 'the upper flight into the wall between the flights'],
    [75, -70.25, -0.5, 71, -70.25, 'the upper flight into the court wall'],
    [75, -65.5, K, 75, -60, "the top landing's east wall"],
    [75, -65.5, K, 79, -65.5, 'the top landing into the wall between the flights'],
    [70.5, -65.5, K, 70.5, -60, "the gate's west jamb beside the bay"],
    [70.5, -65.5, K, 70.5, -70, 'the wall west of the bay'],
  ];
  for (const [x, z, y, tx, tz, what] of cases) {
    it(what, () => {
      stopped(x, z, y, tx, tz, what);
    });
  }

  it("the open leaves of the Cheil door stand against the chamber's east face beside the opening, not in it", () => {
    const leaves = [];
    const [zFace] = [xz(0, -63)[1]];
    scene.traverse((o) => {
      if (!o.isMesh || o.material !== mat.cedar || !o.geometry?.parameters) return;
      const b = new THREE.Box3().setFromObject(o);
      if (Math.abs(b.min.z - zFace) < 1e-3 && b.min.x > xz(74, 0)[0] && b.max.x < xz(82, 0)[0] && b.min.y > yOf(PAV) - 0.1 && b.min.y < yOf(PAV) + 0.2) leaves.push(b);
    });
    expect(leaves.length, 'two leaves on the east face').toBe(2);
    const [d1, d2] = [xz(77.25, 0)[0], xz(79.75, 0)[0]];
    for (const b of leaves) {
      expect(b.max.x <= d1 + 1e-6 || b.min.x >= d2 - 1e-6, `leaf x ${(b.min.x / AMAH).toFixed(2)} .. ${(b.max.x / AMAH).toFixed(2)} amos is in the opening`).toBe(true);
      expect(b.max.z - b.min.z).toBeGreaterThan(0.01);
    }
  });

  it('the Cheil lane along the Soreg past Palhedrin is at least 0.8 m clear and is walked without touching it', () => {
    const y = yOf(PAV + 1);
    for (const z of [-64, -70, -78]) {
      const [, wz] = xz(0, z);
      let soreg = Infinity;
      for (const b of player.wallBoxes) {
        if (wz < b.min.z || wz > b.max.z || y < b.min.y || y > b.max.y) continue;
        if (b.min.x > xz(81, 0)[0] && b.min.x < soreg) soreg = b.min.x;
      }
      expect(soreg - xz(81, 0)[0], `lane at z ${z}`).toBeGreaterThanOrEqual(0.8);
    }
    for (const [z1, z2] of [[-58, -82], [-82, -58]]) {
      const feet = walkOk(82.4, z1, PAV, 82.4, z2, `the lane ${z1} -> ${z2}`);
      expect(Math.abs(feet - PAV)).toBeLessThan(0.2);
    }
  });
});

describe('The Even HaShtiya (round 7: a bedrock outcrop) from four sides, and the kevesh', () => {
  it('walks onto the stone and off it from every side', () => {
    const top = hA(0, -149);
    expect(top - hA(0, -145)).toBeGreaterThan(0.1); // three fingers and a little relief over the floor
    expect(top - hA(0, -145)).toBeLessThan(0.5);
    for (const [x1, z1, x2, z2, what] of [
      [0, -145, 0, -153, 'east to west'],
      [0, -153, 0, -145, 'west to east'],
      [4, -149, -4, -149, 'north to south'],
      [-4, -149, 4, -149, 'south to north'],
    ]) {
      const feet = walkOk(x1, z1, KHK + 0.05, x2, z2, `across the stone ${what}`);
      expect(Math.abs(feet - hA(x2, z2)), what).toBeLessThan(0.2);
    }
    let r = push(0, -145, KHK + 0.05, 0, -149, { reach: 0.3 });
    expect(r.result, r.detail).toBe('ok');
    expect(r.feet, 'standing on the stone').toBeGreaterThan(hA(0, -145) + 0.1);
  });

  it('climbs the kevesh to the altar top and comes down (the kohen walker on it is no collider)', () => {
    const feet = walkOk(-48, -38, K, -20, -38, 'up the kevesh');
    expect(feet).toBeGreaterThan(K + 7);
    expect(walkOk(-20, -38, feet, -10, -38, 'onto the altar top')).toBeGreaterThan(K + 8.5); // the altar's top is 9 amos over the court (Middot 3:1), its horns an amah more
    expect(walkOk(-10, -38, K + 10, -48, -38, 'down the kevesh')).toBeCloseTo(K, 1);
  });
});

describe('Round 7 flip walker routes (scripts/walk-routes/r7_flip.mjs)', () => {
  for (const [name, waypoints] of Object.entries(routes)) {
    it(name, () => {
      const failures = walkRoute(waypoints);
      expect(failures, failures.join('\n')).toEqual([]);
    });
  }
});
