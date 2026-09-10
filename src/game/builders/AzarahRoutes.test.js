import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { TempleBuilder } from '../TempleBuilder.js';
import { PlayerController } from '../PlayerController.js';
import { areas, byId, worldBounds, worldPos, levelWorldY } from '../../content/index.js';
import { CONFIG } from '../../config.js';
import { LIP } from './CourtBuilder.js';
import { AMAH, toWorld } from '../../content/units.js';
import { routes } from '../../../scripts/walk-routes/azarah.mjs';
import { routes as stairRoutes } from '../../../scripts/walk-routes/stairs.mjs';
import { routes as r3Routes } from '../../../scripts/walk-routes/azarah_r3.mjs';
import { routes as r4Routes } from '../../../scripts/walk-routes/r4.mjs';

/**
 * Walks every Azarah route of scripts/walk-routes/azarah.mjs with the real
 * PlayerController over the whole Temple (every builder), frame by frame, the way
 * scripts/walk.mjs does in the browser: same waypoint format, same failure classes
 * (fell / inside / stuck / wrong_level / timeout / low), so a geometry regression shows
 * up in `npm test` in seconds instead of after a headless-Chromium run.
 */
const H = CONFIG.PLAYER_HEIGHT;
const DT = 1 / 60;
const STUCK_S = 3;
const STEP_TIMEOUT_S = 40;
const SAMPLE_FRAMES = 6; // ~100 ms, like walk.mjs

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

/** Waypoint -> world target, like walk.mjs. */
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

/** Walk one leg toward `wp`; returns { result, detail, pos }. */
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
    // The leg must end against something (a closed gate) without clipping or falling;
    // a minY still applies, so jamming at the bottom of a drop does not count as blocked.
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

/** Walk a whole route; returns the failing steps (with labels). */
export function walkRoute(waypoints) {
  const start = resolve(waypoints[0]);
  teleport(start.x, (start.level ?? start.floor) + H, start.z);
  for (let i = 0; i < 10; i++) player.update(DT); // settle onto the floor
  const failures = [];
  for (let i = 1; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const label = wp.id ? `${wp.id}${wp.dx || wp.dz ? `(${wp.dx ?? 0},${wp.dz ?? 0})` : ''}` : `(${wp.x},${wp.z})`;
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

/** Floor slabs (not steps or masses) whose top is at `yTop` under world (x, z). */
function slabsAt(x, z, yTop) {
  const box = new THREE.Box3();
  return floors.filter((f) => {
    if (!f.userData?.isFloor || f.userData.isStep) return false;
    box.setFromObject(f);
    return box.min.x <= x && x <= box.max.x && box.min.z <= z && z <= box.max.z && Math.abs(box.max.y - yTop) < 0.01;
  });
}

describe('Ezras Kohanim floor over the whole Temple', () => {
  const K = levelWorldY('azaras_kohanim');
  const LIP = 0.05 * AMAH;

  it('is flat across the seam between AzaraBuilder (east of z -54) and HeichalBuilder (west of it)', () => {
    for (const x of [-60, -30, 30, 60]) {
      for (const z of [-53.9, -54, -54.1]) expect(player.getFloorHeight(...xz(x, z), 200), `${x},${z}`).toBeCloseTo(K, 2);
    }
  });

  it('has exactly one slab under every point of the court floor (no z-fighting duplicates)', () => {
    for (const [x, z] of [[-60, -40], [60, -40], [0, -30], [-60, -60], [60, -60], [-45, -100], [45, -100], [-60, -170], [60, -170], [0, -182], [-60, -53.9], [-60, -54.1]]) {
      const names = slabsAt(...xz(x, z), K).map((f) => f.userData.name);
      expect(names, `${x},${z}: ${names.join(', ')}`).toHaveLength(1);
    }
  });

  it('puts the chamber floors a LIP above the court and the Parvah terrace 11 amos up', () => {
    const under = (x, z, from) => player.getFloorHeight(...xz(x, z), from);
    for (const [x, z] of [[-67.5, -103], [-75.5, -133], [-59.5, -133], [59.5, -100], [59.5, -116], [59.5, -132], [67.5, -14], [58.5, -20], [76.5, -8]]) {
      expect(under(x, z, K + 2), `${x},${z}`).toBeCloseTo(K + LIP, 2);
    }
    expect(under(64, -116, K + 9)).toBeCloseTo(K + 11 * AMAH, 2);
    expect(under(64, -136, K + 9)).toBeCloseTo(K + 11 * AMAH, 2);
  });

  it('opens the Water Gate and the Beis HaMoked gate onto flat court beside the Duchan, and the Duchan itself is a 1-amah step', () => {
    // Cast from under the Beis Avtinas storey (round 7: x -73.5 .. -61.5, z -24 .. -8, floor slab from y 23.2) where it stands over the frontage.
    const under = (x, z) => player.getFloorHeight(...xz(x, z), x < -61.5 && z > -24 ? K + 5 : 200);
    for (const [x, z] of [[-62, -20], [-62, -14], [-62, -11.5], [-57, -12], [46, -13], [46, -9.5], [51, -10]]) expect(under(x, z), `${x},${z}`).toBeCloseTo(K, 2);
    expect(under(-50, -11.7)).toBeCloseTo(levelWorldY('duchan') - 0.01 * AMAH, 2);
    expect(under(38, -11.7)).toBeCloseTo(levelWorldY('duchan') - 0.01 * AMAH, 2);
    expect(under(-62, -7)).toBeLessThan(K); // the frontage steps
    expect(under(-62, -4)).toBeCloseTo(levelWorldY('azaras_yisrael'), 2);
  });

  it('fences the terrace stair well and keeps the muchni clear of the Ulam steps (PW2 perimeter walk)', () => {
    const under = (x, z, from) => player.getFloorHeight(...xz(x, z), from);
    const roof = K + 11 * AMAH;
    const parapet = roof + LIP + 1.5 * AMAH; // LIP is in metres here
    // Parapet along the well's court side, its east end and the amah between it and the wall; the flight's top end stays open.
    for (const [x, z] of [[61.25, -95], [61.25, -106], [67, -100], [64, -93.25]]) expect(under(x, z, roof + 3), `${x},${z}`).toBeCloseTo(parapet, 2);
    expect(under(64, -107.5, roof + 3)).toBeCloseTo(roof, 2);
    expect(under(60, -95, roof + 3)).toBeCloseTo(roof, 2);
    // Inside the room the flight (x 61.5 .. 66.5, 22 treads of 0.5 from z -93.5 to -107) has a stepped parapet
    // 1.5 amos over each tread on its room side from the third tread on, and the amah between it and the
    // court wall (x 66.5 .. 67.5) is filled to the roof; the foot's first two treads stay open.
    // Cast from just under the roof slab (its underside is 0.4 m below its top); the top treads and their
    // parapet reach into the slab, so only treads up to the sixteenth are probed.
    const underRoof = roof - 0.45;
    const tread = 13.5 / 22;
    const top = (z) => K + (Math.floor((-93.5 - z) / tread) + 1) * 0.5 * AMAH;
    for (const z of [-95, -100, -103]) {
      expect(under(64, z, underRoof), `tread ${z}`).toBeCloseTo(top(z), 2);
      expect(under(61.25, z, underRoof), `parapet ${z}`).toBeCloseTo(top(z) + 1.5 * AMAH, 2);
      const box = new THREE.Box3();
      const [wx, wz] = xz(67, z);
      const pt = new THREE.Vector3(wx, K + 2, wz);
      expect(walls.some((w) => box.setFromObject(w).containsPoint(pt)), `slot wall ${z}`).toBe(true);
    }
    for (const z of [-93.75, -94.5]) expect(under(61.25, z, underRoof), `open foot ${z}`).toBeCloseTo(K + LIP, 2);
    // The court-edge parapet follows each roof's own edge (the Madichin is 15 wide, x 52.5 .. 67.5; Parvah and Melach 16), with a return across the step at z -108.
    for (const [x, z] of [[52.75, -100], [51.75, -116], [51.75, -132], [52.25, -108.25], [52.75, -108.25], [52, -139.75]]) expect(under(x, z, roof + 3), `${x},${z}`).toBeCloseTo(parapet, 2);
    expect(under(53.25, -100, roof + 3)).toBeCloseTo(roof, 2);
    expect(under(52, -100, roof + 3), 'no ledge outside the Madichin parapet').toBeLessThan(roof - 1);
    // The muchni post stands on the kiyor's south side, outside the Ulam steps' x range (x -20 .. 20),
    // and the kiyor's own body (3 amos) is clear of the steps' south end.
    const box = new THREE.Box3();
    const post = walls.find((w) => w.userData?.name === 'muchni-solid');
    box.setFromObject(post);
    const [kx] = xz(byId.kiyor.position.x, byId.kiyor.position.z);
    expect(box.max.x).toBeLessThan(kx);
    expect(box.max.x).toBeLessThan(xz(-20, -65)[0]);
    const body = walls.find((w) => w.userData?.name === 'kiyor-solid');
    box.setFromObject(body);
    expect(box.max.x).toBeLessThan(xz(-20 - 1, -65)[0]);
  });

  it('floors Palhedrin at the Cheil level and lands its stair and the Avtinas stair at the levels of their doors (round 7: Palhedrin north, Avtinas south)', () => {
    const under = (x, z, from = 200) => player.getFloorHeight(...xz(x, z), from);
    const cheil = levelWorldY('cheil');
    expect(under(78.5, -65.5, K)).toBeCloseTo(cheil + 0.09 * AMAH, 2); // the entry strip inside its Cheil door, a LIP over the pavement
    expect(under(78.5, -72.25, K)).toBeCloseTo(cheil + 11 * 0.5 * AMAH, 2); // the lower flight's eleventh tread (half-amah rises from the Cheil level)
    expect(under(77, -76.5, K)).toBeCloseTo(cheil + 8 * AMAH, 2); // the turn landing across the west end, 8 amos up
    expect(under(75, -65.5, K + 6)).toBeCloseTo(K, 2); // its upper landing at the court level
    expect(under(70.5, -65.5)).toBeCloseTo(K, 2); // the bay through the north wall into the Korban gate passage
    expect(under(-63.75, -30.1)).toBeCloseTo(K + LIP, 2); // the Avtinas tower's entry landing (x -65 .. -62.5, z -31 .. -29.25)
    const storey = (byId.beis_avtinas.position.y - byId.azaras_kohanim.position.y) * AMAH; // 21.5 amos over the court
    expect(under(-63.75, -24.9)).toBeCloseTo(K + storey + LIP, 2); // its top landing, 21.5 amos up (43 half-amah steps)
    expect(under(-67.5, -16, K + 26 * AMAH)).toBeCloseTo(K + storey + LIP, 2); // the storey floor over the Water Gate (cast from under its roof)
    expect(under(-71.25, -29.25)).toBeCloseTo(K + LIP + 11 * 0.5 * AMAH, 2); // the first landing at the wall end after 11 steps
    // The Cheil lane along the Soreg past Palhedrin (x 81 .. 83.5) is at least 0.8 m clear.
    const [, wz] = xz(0, -71);
    const y = cheil + 0.5;
    let soreg = Infinity;
    for (const b of player.wallBoxes) {
      if (wz < b.min.z || wz > b.max.z || y < b.min.y || y > b.max.y) continue;
      if (b.min.x > xz(81, 0)[0] && b.min.x < soreg) soreg = b.min.x;
    }
    expect(soreg - xz(81, 0)[0], 'the Cheil lane past Palhedrin').toBeGreaterThanOrEqual(0.8);
  });

  it('floors the Beis HaMoked and Gazis vestibules at the Cheil level and lands their stairs in the wells', () => {
    const under = (x, z, from = 200) => player.getFloorHeight(...xz(x, z), from);
    const cheil = levelWorldY('cheil');
    const below = K - 0.5; // under the chamber floor slabs
    for (const [x, z] of [[78, -14], [70, -20], [-72, -110], [-70, -100]]) expect(under(x, z, below), `${x},${z}`).toBeCloseTo(cheil + 0.09 * AMAH, 2); // the vestibule floors, cast from under the chamber floors (round 6: x 70 is the lane west of the Tevilah stair's landing)
    expect(under(70, -15, below)).toBeCloseTo(K + LIP - 5 * AMAH, 2); // landing L2 under the Beis HaMoked hall
    expect(under(69.5, -8.75)).toBeCloseTo(K + LIP, 2); // the top tread in the well, level with the hall floor
    expect(under(69.5, -13.25)).toBeCloseTo(K + LIP - 4.5 * AMAH, 2); // the first tread of flight C, seen from above through the well
    expect(under(-70.5, -98.5, below)).toBeCloseTo(K + LIP - 5 * AMAH, 2); // landing L2 under the Gazis
    expect(under(-69.5, -92.25)).toBeCloseTo(K + LIP, 2);
    expect(under(-69.5, -96.75)).toBeCloseTo(K + LIP - 4.5 * AMAH, 2);
    expect(under(75, -14)).toBeCloseTo(K + LIP, 2); // the hall floor over the vestibule
    expect(under(-72, -103)).toBeCloseTo(K + LIP, 2);
  });
});

/**
 * The Cheil stairs (GEO-D, CourtBuilder.switchbackA): every open side of every flight
 * and landing is fenced by a wall, and where the band walls stop an amah short of the
 * landings the flight across the gap is at most 1.5 amos (0.75 m) lower: a stumble
 * onto the neighbouring flight at the same turn, never a fall to a lower one. The
 * walk harness cannot see a drop that lands right, so the heights are asserted here.
 */
describe('Cheil stair landing edges and band-wall gaps', () => {
  /** World y of a height in amos over the Azarah floor. */
  const yOf = (a) => toWorld({ x: 0, y: a, z: 0 })[1];
  /** Highest surface under (x, z) amos cast from `from` amos, in amos. */
  const hA = (x, z, from = 200) => (player.getFloorHeight(...xz(x, z), from === 200 ? 200 : yOf(from)) - yOf(0)) / AMAH;
  /** Is (x, y, z) amos inside a wall box? */
  const wallAt = (x, y, z) => {
    const [wx, wy, wz] = toWorld({ x, y, z });
    const pt = new THREE.Vector3(wx, wy, wz);
    return player.wallBoxes.some((b) => b.containsPoint(pt));
  };
  const CEIL = 1.6; // under the chamber floor slabs (their underside is at 1.7)
  const F = -13.41; // the vestibule floors: the Cheil pavement plus its LIP and the stair's LIP
  const H = 2.55; // the chamber floors: the court level plus a LIP
  const PARAPET = H + 0.05 + 1.5;

  /** One stair: `s` mirrors x (+1 Beis HaMoked, -1 Gazis); z values are the stair's own. */
  const cases = [
    // xOuter: inside flight A's outer wall (Beis HaMoked: the stair's own quarter-amah wall at x 75.5; Gazis: the vestibule's wall x -77.5 .. -76.5).
    { name: 'Beis HaMoked', s: 1, zFoot: -13.5, zL1: [-8, -5.5], zL2: [-16, -13.5], y: -5, xOuter: 75.625 },
    { name: 'Lishkas HaGazis', s: -1, zFoot: -97, zL1: [-91.5, -89], zL2: [-99.5, -97], y: -5, xOuter: -77 },
  ];
  for (const c of cases) {
    const x = (d) => c.s * d; // distance from the court wall line (x +-67.5), signed
    const [zA1, zTop] = [c.zFoot + 5.5, c.zFoot + 5]; // top of A / foot of B; top of C
    const xA = x(74.5);
    const xB = x(72);
    const xC = x(69.5);
    const xAB = x(73.25);
    const xBC = x(70.75);

    it(`${c.name}: the flights and landings are at their heights`, () => {
      expect(hA(xA, c.zFoot + 0.25, CEIL)).toBeCloseTo(F + 0.46, 2); // A's first tread, a quarter metre over the vestibule floor
      expect(hA(xA, zA1 - 0.25, CEIL)).toBeCloseTo(-7.95, 2); // A's top tread
      expect(hA(xB, (c.zL1[0] + c.zL1[1]) / 2, CEIL)).toBeCloseTo(-7.95, 2); // L1
      expect(hA(xA, (c.zL1[0] + c.zL1[1]) / 2, CEIL)).toBeCloseTo(-7.95, 2);
      expect(hA(xB, zA1 - 0.25, CEIL)).toBeCloseTo(-7.45, 2); // B's first tread
      expect(hA(xB, c.zFoot + 0.25, CEIL)).toBeCloseTo(-2.45, 2); // B's top tread
      expect(hA(xC, (c.zL2[0] + c.zL2[1]) / 2, CEIL)).toBeCloseTo(-2.45, 2); // L2
      expect(hA(xC, c.zFoot + 0.25, CEIL)).toBeCloseTo(-1.95, 2); // C's first tread
      expect(hA(xC, zTop - 0.25)).toBeCloseTo(H, 2); // C's top tread, level with the chamber floor
      expect(hA(xC, zTop + 0.25)).toBeCloseTo(H, 2); // the chamber floor past the well's open end
    });

    it(`${c.name}: every open side of every flight and landing is fenced`, () => {
      // Flight A: its outer side is the outer wall, its inner side the A/B band wall up to an amah short of L1.
      for (const z of [c.zFoot + 0.5, zA1 - 1.25]) {
        expect(wallAt(c.xOuter, -10, z), `A outer ${z}`).toBe(true);
        expect(wallAt(xAB, -10, z), `A/B ${z}`).toBe(true);
      }
      // L1: the B/C band wall on its inner side, the end wall / the chamber wall at its far end, the outer wall.
      for (const z of [c.zL1[0] + 0.25, c.zL1[1] - 0.25]) expect(wallAt(xBC, c.y, z), `L1 inner ${z}`).toBe(true);
      expect(wallAt(xB, c.y, c.zL1[1] + 0.25), 'L1 far end').toBe(true);
      expect(wallAt(xA, c.y, c.zL1[1] + 0.25), 'L1 far end').toBe(true);
      expect(wallAt(c.xOuter, c.y, (c.zL1[0] + c.zL1[1]) / 2), 'L1 outer').toBe(true);
      // Flight B: the A/B wall on one side, the B/C wall on the other, each to an amah short of the landing it does not serve.
      for (const z of [c.zFoot + 1.25, zA1 - 1.25]) {
        expect(wallAt(xAB, -3, z), `B/A ${z}`).toBe(true);
        expect(wallAt(xBC, -3, z), `B/C ${z}`).toBe(true);
      }
      // L2: its end wall, the A/B wall on its outer side, the partition on its inner side.
      expect(wallAt(xC, 0, c.zL2[0] - 0.125), 'L2 end').toBe(true);
      expect(wallAt(xB, 0, c.zL2[0] - 0.125), 'L2 end').toBe(true);
      for (const z of [c.zL2[0] + 0.25, c.zL2[1] - 0.25]) {
        expect(wallAt(xAB, 0, z), `L2 outer ${z}`).toBe(true);
        expect(wallAt(x(68), 0, z), `L2 inner ${z}`).toBe(true);
      }
      // Flight C: the partition, the B/C wall from an amah past its foot, and above the ceiling the well parapet on both sides and at its foot end.
      for (const z of [c.zFoot + 1.25, zTop - 0.25]) {
        expect(wallAt(x(68), 1, z), `C inner ${z}`).toBe(true);
        expect(wallAt(xBC, 1, z), `C/B ${z}`).toBe(true);
      }
      for (const z of [c.zFoot - 0.25, c.zFoot + 2, zTop - 0.25]) {
        expect(hA(x(68.25), z), `parapet inner ${z}`).toBeCloseTo(PARAPET, 2);
        expect(hA(x(70.75), z), `parapet outer ${z}`).toBeCloseTo(PARAPET, 2);
      }
      expect(hA(xC, c.zFoot - 0.25), 'parapet end').toBeCloseTo(PARAPET, 2);
      // The void beside L1 under the chamber floor (the C band past the well) is fenced from L1 by the B/C wall.
      expect(hA(xC, c.zL1[1] - 0.5, CEIL), 'void past the well').toBeCloseTo(F, 2);
      expect(wallAt(xBC, c.y, c.zL1[1] - 0.5)).toBe(true);
    });

    it(`${c.name}: the band walls run to the landings (no open shaft column) and the flights meet at the turns`, () => {
      // A/B wall: the whole way to L1's edge; the gap column beside it is closed.
      expect(wallAt(xAB, -10, zA1 - 1.25)).toBe(true);
      expect(wallAt(xAB, -10, zA1 - 0.75)).toBe(true);
      expect(wallAt(xAB, -10, zA1 - 0.1)).toBe(true);
      expect(hA(xA, zA1 - 0.75, CEIL)).toBeCloseTo(-8.45, 2);
      expect(hA(xB, zA1 - 0.75, CEIL)).toBeCloseTo(-6.95, 2); // B's second tread: 1.5 amos over A's tenth
      expect(hA(xA, zA1 - 0.25, CEIL)).toBeCloseTo(-7.95, 2);
      expect(hA(xB, zA1 - 0.25, CEIL)).toBeCloseTo(-7.45, 2); // half an amah
      // B/C wall: from L2's edge the whole way; the gap column beside the foot is closed.
      expect(wallAt(xBC, -3, c.zFoot + 1.25)).toBe(true);
      expect(wallAt(xBC, -3, c.zFoot + 0.75)).toBe(true);
      expect(wallAt(xBC, -3, c.zFoot + 0.1)).toBe(true);
      expect(hA(xC, c.zFoot + 0.75, CEIL)).toBeCloseTo(-1.45, 2);
      expect(hA(xB, c.zFoot + 0.75, CEIL)).toBeCloseTo(-2.95, 2); // B's tenth tread: 1.5 amos under C's second
      expect(hA(xC, c.zFoot + 0.25, CEIL)).toBeCloseTo(-1.95, 2);
      expect(hA(xB, c.zFoot + 0.25, CEIL)).toBeCloseTo(-2.45, 2);
    });
  }
});

/**
 * Round 4: the Sanhedrin's benches in Lishkas HaGazis are solid tiers (blockA), the
 * highest (0.8 m) against the south wall (x -77.5 .. -76.5 is the wall) and the lowest
 * (0.3 m) toward the room. A visitor on the chamber floor walking west beside the well
 * is stopped by the top tier's east end at floor level, and steps up onto the low tier.
 */
describe('Lishkas HaGazis benches (round 4)', () => {
  const K = 'azaras_kohanim';
  const KY = () => levelWorldY(K);
  const legTo = (x, z, o) => walkTo({ x: xz(x, z)[0], z: xz(x, z)[1], level: K, ...o });
  const standAt = (x, z) => {
    const [wx, wz] = xz(x, z);
    teleport(wx, KY() + H, wz);
    for (let i = 0; i < 10; i++) player.update(DT);
  };

  it('the three tiers are walkable masses at 0.8, 0.55 and 0.3 m over the chamber floor', () => {
    const floor = KY() + LIP * AMAH; // the chamber floor is a LIP over the court level
    expect(player.getFloorHeight(...xz(-75.9, -107), 200) - floor).toBeCloseTo(0.8, 2);
    expect(player.getFloorHeight(...xz(-74.6, -107), 200) - floor).toBeCloseTo(0.55, 2);
    expect(player.getFloorHeight(...xz(-73.4, -107), 200) - floor).toBeCloseTo(0.3, 2);
    expect(player.getFloorHeight(...xz(-72, -107), 200) - floor).toBeCloseTo(0, 2);
  });

  it('walking west into the top tier from the floor is blocked at its east end, at floor level', () => {
    standAt(-75.9, -95);
    const r = legTo(-75.9, -108, { expect: 'blocked', reach: 0.3, minY: 0 });
    expect(r.result, r.detail).toBe('ok');
    expect(r.pos[1] - KY()).toBeLessThan(0.1); // still on the floor, not on the tier
    expect(r.pos[2]).toBeGreaterThan(xz(-75.9, -99)[1] - 0.05); // stopped east of the tier's end (z -99)
  });

  it('walking west onto the low tier steps up 0.3 m, then up the tiers to the top', () => {
    standAt(-73.4, -95);
    let r = legTo(-73.4, -108, { reach: 0.4, minY: 0.3 });
    expect(r.result, r.detail).toBe('ok');
    expect(r.pos[1] - KY() - LIP * AMAH).toBeCloseTo(0.3, 1); // walkTo rounds to 2 decimals
    r = legTo(-75.9, -108, { reach: 0.4, minY: 0.8 });
    expect(r.result, r.detail).toBe('ok');
    expect(r.pos[1] - KY() - LIP * AMAH).toBeCloseTo(0.8, 1);
  });
});

describe('Azarah walking routes (scripts/walk-routes/azarah.mjs, stairs.mjs, azarah_r3.mjs, r4.mjs)', () => {
  for (const [name, waypoints] of [...Object.entries(routes), ...Object.entries(stairRoutes), ...Object.entries(r3Routes), ...Object.entries(r4Routes)]) {
    it(name, () => {
      const failures = walkRoute(waypoints);
      expect(failures, failures.join('\n')).toEqual([]);
    });
  }
});
