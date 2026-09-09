import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { TempleBuilder } from './TempleBuilder.js';
import { PlayerController } from './PlayerController.js';
import { byId, walkableBounds, worldPos, levelWorldY } from '../content/index.js';
import { AMAH, toAmos } from '../content/units.js';
import { CONFIG } from '../config.js';
import { SPAWN, entryBase, spawnCandidates, pickSpawn, readSpawn, yawToward, lineOfSight } from './spawn.js';

/** The old `?at=` rule, kept as the last resort: east of the entry at its own y, facing west. */
function legacy(entry) {
  const [x, y, z] = worldPos(entry);
  const depth = (entry.geometry?.d ?? entry.geometry?.w ?? 0) * AMAH;
  const height = (entry.geometry?.h ?? 0) * AMAH;
  const back = Math.max(4, depth / 2 + 3 + Math.min(height, 12) * 0.8);
  return { pos: [x, y + CONFIG.PLAYER_HEIGHT, z + back], yaw: 0, pitch: height > 6 ? 8 : 0 };
}

let player;

beforeAll(() => {
  const scene = new THREE.Scene();
  const { floors, walls } = new TempleBuilder(scene, { get: () => null }).build();
  scene.updateMatrixWorld(true);
  player = new PlayerController(new THREE.PerspectiveCamera(), floors, walls, { bounds: walkableBounds() });
});

describe('spawn candidates', () => {
  it('start with the old rule (east, facing west) and ring the entry front first', () => {
    const e = byId.maalos_ulam;
    const c = spawnCandidates(e);
    const old = legacy(e);
    expect(c[0].pos[0]).toBeCloseTo(old.pos[0], 9);
    expect(c[0].pos[2]).toBeCloseTo(old.pos[2], 9);
    expect(c[0].yaw).toBeCloseTo(0, 9);
    expect(c[0].pitch).toBe(old.pitch);
    expect(c.map((x) => x.bearing).slice(0, SPAWN.bearings.length)).toEqual(SPAWN.bearings);
    expect(c).toHaveLength(SPAWN.bearings.length * SPAWN.scales.length);
    // Every candidate faces the entry.
    const [x, , z] = worldPos(e);
    for (const k of c) {
      const dx = x - k.pos[0];
      const dz = z - k.pos[2];
      const facing = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(k.yaw));
      expect(facing.x * dx + facing.z * dz).toBeGreaterThan(Math.hypot(dx, dz) * 0.999);
    }
  });

  it('stand farther back on the long sides than on the short ones', () => {
    const c = spawnCandidates(byId.maalos_ulam); // 40 wide (x), 22 deep (z)
    const [x, , z] = worldPos(byId.maalos_ulam);
    const dist = (k) => Math.hypot(k.pos[0] - x, k.pos[2] - z);
    expect(dist(c.find((k) => k.bearing === 90))).toBeGreaterThan(dist(c.find((k) => k.bearing === 0)));
    expect(dist(c.find((k) => k.bearing === 0 && k.scale === 2))).toBeCloseTo(2 * dist(c[0]), 9);
  });

  it('take a steps entry base as half its rise below the mid-height hotspot', () => {
    expect(entryBase(byId.maalos_ulam)).toBeCloseTo(levelWorldY('azaras_kohanim'), 9);
    expect(entryBase(byId.mizbeach)).toBeCloseTo(worldPos(byId.mizbeach)[1], 9);
  });

  it('yawToward turns the camera (yaw 0 looks down -z) onto the target', () => {
    expect(yawToward(0, 10, 0, 0)).toBeCloseTo(0, 9);
    expect(yawToward(10, 0, 0, 0)).toBeCloseTo(90, 9); // from +x, face -x
    expect(Math.abs(yawToward(0, -10, 0, 0))).toBeCloseTo(180, 9);
  });
});

describe('pickSpawn in the built temple', () => {
  it('?at=maalos_ulam stands on the Ezras Kohanim floor, not on the altar top, and sees the steps', () => {
    const s = pickSpawn(byId.maalos_ulam, player);
    expect(s).not.toBeNull();
    const floor = levelWorldY('azaras_kohanim');
    expect(s.pos[1]).toBeCloseTo(floor + CONFIG.PLAYER_HEIGHT, 2);
    const a = toAmos(...s.pos);
    // Off the altar's footprint (x +-16, z -22 .. -54) and the steps' own (x +-20, z -54 .. -76).
    expect(Math.abs(a.x) > 16 || a.z < -54 || a.z > -22).toBe(true);
    expect(Math.abs(a.x) > 20 || a.z > -54).toBe(true);
    // Not the old result, which stood on the altar.
    const old = legacy(byId.maalos_ulam);
    expect(player.probe(old.pos[0], old.pos[2], floor + 8).y).toBeGreaterThan(floor + 4);
    expect(player.collides(new THREE.Vector3(...s.pos))).toBe(false);
    expect(player.probe(s.pos[0], s.pos[2], s.pos[1] - CONFIG.PLAYER_HEIGHT + CONFIG.STEP_HEIGHT + 0.05).inside).toBe(false);
  });

  it('keeps the old standing point where it already worked', () => {
    for (const id of ['ezras_nashim_gate', 'maalos_shir', 'mizbeach', 'heichal', 'even_hashtiya']) {
      const s = pickSpawn(byId[id], player);
      const old = legacy(byId[id]);
      expect(s, id).not.toBeNull();
      expect(s.bearing, id).toBe(0);
      expect(s.scale, id).toBe(1);
      expect(s.pos[0], id).toBeCloseTo(old.pos[0], 6);
      expect(s.pos[2], id).toBeCloseTo(old.pos[2], 6);
      expect(s.yaw, id).toBeCloseTo(0, 6);
    }
  });

  it('a gate on top of its flight is looked at from the floor below', () => {
    const s = pickSpawn(byId.ezras_nashim_gate, player);
    expect(s.pos[1]).toBeCloseTo(levelWorldY('cheil') + CONFIG.PLAYER_HEIGHT, 2);
  });

  it('readSpawn: ?cam= verbatim, ?at= through the picker, the old rule without a player, null otherwise', () => {
    expect(readSpawn('?cam=1,2,3,40,5')).toEqual({ pos: [1, 2, 3], yaw: 40, pitch: 5 });
    expect(readSpawn('?cam=1,x,3')).toBeNull();
    expect(readSpawn('?at=nowhere', player)).toBeNull();
    expect(readSpawn('')).toBeNull();
    expect(readSpawn('?at=maalos_ulam')).toEqual(legacy(byId.maalos_ulam));
    expect(readSpawn('?at=maalos_ulam', player)).toEqual(pickSpawn(byId.maalos_ulam, player));
  });
});

describe('pickSpawn on a synthetic scene', () => {
  function box(w, h, d, x, y, z, userData) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial());
    m.position.set(x, y, z);
    m.userData = userData;
    return m;
  }
  const entry = { id: 'thing', position: { x: 0, y: 0, z: 0 }, geometry: { kind: 'box', w: 4, d: 4, h: 4 } };
  const [ex, ey, ez] = worldPos(entry);
  // back = max(4, 1 + 3 + 2 * 0.8) = 5.6 m for every bearing
  const make = (extra = [], wallsExtra = []) => {
    const floor = box(200, 0.4, 200, ex, ey - 0.2, ez, { isFloor: true });
    const thing = box(2, 2, 2, ex, ey + 1, ez, { isFloor: true });
    const scene = new THREE.Scene();
    scene.add(floor, thing, ...extra, ...wallsExtra);
    scene.updateMatrixWorld(true);
    return new PlayerController(new THREE.PerspectiveCamera(), [floor, thing, ...extra], wallsExtra, { bounds: { minX: ex - 100, maxX: ex + 100, minZ: ez - 100, maxZ: ez + 100 } });
  };

  it('takes the front (east) when it is clear', () => {
    const s = pickSpawn(entry, make());
    expect(s.bearing).toBe(0);
    expect(s.pos[0]).toBeCloseTo(ex, 5);
    expect(s.pos[1]).toBeCloseTo(ey + CONFIG.PLAYER_HEIGHT, 5);
    expect(s.pos[2]).toBeCloseTo(ez + 5.6, 5);
  });

  it('skips a platform more than 1 m above the base, a mass the feet would be inside, and a wall', () => {
    const platform = box(6, 1.5, 6, ex, ey + 0.75, ez + 5.6, { isFloor: true }); // east: 1.5 m up
    const mass = box(2, 4, 2, ex + 5.6 * Math.sin(Math.PI / 6), ey + 2, ez + 5.6 * Math.cos(Math.PI / 6), { isFloor: true }); // 30 deg
    const wall = box(2, 3, 2, ex - 5.6 * Math.sin(Math.PI / 6), ey + 1.5, ez + 5.6 * Math.cos(Math.PI / 6), { isWall: true }); // -30 deg
    const s = pickSpawn(entry, make([platform, mass], [wall]));
    expect(s.bearing).toBe(60);
    expect(s.pos[1]).toBeCloseTo(ey + CONFIG.PLAYER_HEIGHT, 5);
  });

  it('accepts a kerb under 1 m and a floor below the base', () => {
    const kerb = box(6, 0.6, 6, ex, ey + 0.3, ez + 5.6, { isFloor: true });
    expect(pickSpawn(entry, make([kerb])).pos[1]).toBeCloseTo(ey + 0.6 + CONFIG.PLAYER_HEIGHT, 5);
    const low = { ...entry, position: { x: 0, y: 4, z: 0 } }; // 2 m over the floor
    const s = pickSpawn(low, make());
    expect(s.bearing).toBe(0);
    expect(s.pos[1]).toBeCloseTo(ey + CONFIG.PLAYER_HEIGHT, 5);
  });

  it('skips a candidate whose view of the entry is blocked by a mass or a wall outside the entry', () => {
    const screenE = box(2, 4, 0.5, ex, ey + 2, ez + 3.5, { isFloor: true }); // between the east point and the thing
    const screen30 = box(0.5, 4, 6, ex + 2.5, ey + 2, ez + 3, { isWall: true }); // crosses the 30 deg line
    const p = make([screenE], [screen30]);
    const eye = new THREE.Vector3(ex, ey + CONFIG.PLAYER_HEIGHT, ez + 5.6);
    expect(lineOfSight(p, eye, new THREE.Vector3(ex, ey + 1, ez), entry)).toBe(false);
    expect(lineOfSight(make(), eye, new THREE.Vector3(ex, ey + 1, ez), entry)).toBe(true); // the thing itself does not block
    const s = pickSpawn(entry, p);
    expect(s.bearing).toBe(-30);
  });

  it('falls back to the old rule when nothing round the entry stands', () => {
    const player = make();
    player.bounds = { minX: ex - 1, maxX: ex + 1, minZ: ez - 1, maxZ: ez + 1 };
    expect(pickSpawn(entry, player)).toBeNull();
  });
});
