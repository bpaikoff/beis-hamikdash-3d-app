import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { TempleBuilder } from '../TempleBuilder.js';
import { PlayerController } from '../PlayerController.js';
import { areas, byId, worldBounds, worldPos, levelWorldY } from '../../content/index.js';
import { CONFIG } from '../../config.js';
import { AMAH, toWorld } from '../../content/units.js';
import { routes } from '../../../scripts/walk-routes/azarah.mjs';

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
    // The leg must end against something (a closed gate) without clipping or falling.
    if (result === 'stuck') result = 'ok';
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
    const under = (x, z) => player.getFloorHeight(...xz(x, z), 200);
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
    // The muchni post stands on the kiyor's south side, outside the Ulam steps' x range (x -20 .. 20).
    const box = new THREE.Box3();
    const post = walls.find((w) => w.userData?.name === 'muchni-solid');
    box.setFromObject(post);
    const [kx] = xz(-22, -65);
    expect(box.max.x).toBeLessThan(kx);
    expect(box.max.x).toBeLessThan(xz(-20, -65)[0]);
  });

  it('floors Palhedrin at the Cheil level and lands its stair and the Avtinas stair at the levels of their doors', () => {
    const under = (x, z, from = 200) => player.getFloorHeight(...xz(x, z), from);
    expect(under(-78.5, -29, K)).toBeCloseTo(levelWorldY('cheil') + 0.04 * AMAH, 2); // the Cheil pavement is its floor
    expect(under(-76, -23.5, K + 6)).toBeCloseTo(K, 2); // its upper landing
    expect(under(-70.5, -23)).toBeCloseTo(K, 2); // the Water Gate passage bay
    expect(under(63.75, -43.9)).toBeCloseTo(K + LIP, 2); // the tower's entry landing
    const storey = (byId.beis_avtinas.position.y - byId.azaras_kohanim.position.y) * AMAH; // 21.5 amos over the court
    expect(under(63.75, -49.1)).toBeCloseTo(K + storey + LIP, 2); // its top landing, 21.5 amos up (43 half-amah steps)
    expect(under(67.5, -58, K + 26 * AMAH)).toBeCloseTo(K + storey + LIP, 2); // the storey floor (cast from under its roof)
  });
});

describe('Azarah walking routes (scripts/walk-routes/azarah.mjs)', () => {
  for (const [name, waypoints] of Object.entries(routes)) {
    it(name, () => {
      const failures = walkRoute(waypoints);
      expect(failures, failures.join('\n')).toEqual([]);
    });
  }
});
