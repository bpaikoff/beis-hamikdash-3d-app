import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { PlayerController } from './PlayerController.js';
import { CONFIG } from '../config.js';
import { TempleBuilder } from './TempleBuilder.js';
import { byId, worldPos, levelWorldY } from '../content/index.js';
import { routes } from '../../scripts/walk-routes/building.mjs';

/**
 * A synthetic scene: a 40 x 40 floor slab whose top is at y 0, and on it a 2 x 2 x 2
 * solid block centred at (5, 1, 0) whose underside is coplanar with the floor's top,
 * exactly as the builders place an altar tier or a step on a court slab.
 */
function box(w, h, d, x, y, z, userData) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial());
  m.position.set(x, y, z);
  m.userData = userData;
  return m;
}

let player, camera;

beforeAll(() => {
  const floor = box(40, 0.4, 40, 0, -0.2, 0, { isFloor: true, name: 'floor' });
  const block = box(2, 2, 2, 5, 1, 0, { isFloor: true, name: 'block' });
  const wall = box(0.5, 3, 4, -5, 1.5, 0, { isWall: true });
  // A mass whose base is sunk below the floor (as the kevesh body is): its exit face is below the floor's top
  const sunk = box(2, 2, 2, 0, 0.8, 8, { isFloor: true, name: 'sunk' });
  const scene = new THREE.Scene();
  scene.add(floor, block, wall, sunk);
  scene.updateMatrixWorld(true);
  camera = new THREE.PerspectiveCamera();
  player = new PlayerController(camera, [floor, block, sunk], [wall], { bounds: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 } });
});

describe('probe', () => {
  it('finds the floor beside the block and is not inside anything', () => {
    const p = player.probe(3, 0, CONFIG.STEP_HEIGHT + 0.05);
    expect(p.inside).toBe(false);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it('reports inside for a probe that starts inside the block, even though its underside is coplanar with the floor', () => {
    const p = player.probe(5, 0, CONFIG.STEP_HEIGHT + 0.05);
    expect(p.inside).toBe(true);
  });

  it('reports inside for a probe inside a mass whose base is sunk below the floor', () => {
    expect(player.probe(0, 8, CONFIG.STEP_HEIGHT + 0.05).inside).toBe(true);
    expect(player.probe(0, 8, 3).inside).toBe(false);
    expect(player.probe(0, 8, 3).y).toBeCloseTo(1.8, 6);
    expect(player.probe(1.5, 8, CONFIG.STEP_HEIGHT + 0.05).inside).toBe(false);
  });

  it('sees the top of the block from above it', () => {
    const p = player.probe(5, 0, 10);
    expect(p.inside).toBe(false);
    expect(p.y).toBeCloseTo(2, 6);
  });

  it('floorUnder ignores a surface more than a step above the feet', () => {
    // Feet on the floor beside nothing: the floor
    expect(player.floorUnder(3, 0, 0).y).toBeCloseTo(0, 6);
    // Feet embedded in the block (teleported): the block's top from above the head
    expect(player.floorUnder(5, 0, 0).y).toBeCloseTo(2, 6);
  });
});

describe('update', () => {
  const step = 1 / 60;
  function place(x, z, feetY = 0) {
    camera.position.set(x, feetY + CONFIG.PLAYER_HEIGHT, z);
    camera.rotation.set(0, 0, 0, 'YXZ'); // looking down -z
    player.verticalVelocity = 0;
    player.onGround = true;
    player.isLocked = true;
    player.moveF = player.moveB = player.moveL = player.moveR = false;
  }
  function walk(seconds, dir) {
    player[dir] = true;
    for (let t = 0; t < seconds; t += step) player.update(step);
    player[dir] = false;
  }

  it('walks forward at MOVE_SPEED and stays on the floor', () => {
    place(0, 5);
    walk(1, 'moveF');
    expect(camera.position.z).toBeCloseTo(5 - CONFIG.MOVE_SPEED, 1);
    expect(camera.position.y).toBeCloseTo(CONFIG.PLAYER_HEIGHT, 6);
  });

  it('is stopped by the side of the block instead of walking into it', () => {
    // Face +x by looking along -z then strafing right (+x)
    place(2, 0);
    walk(2, 'moveR');
    expect(camera.position.x).toBeLessThan(4.01);
    expect(player.probe(camera.position.x, camera.position.z, CONFIG.STEP_HEIGHT + 0.05).inside).toBe(false);
  });

  it('slides along a wall box instead of sticking to it', () => {
    // The wall is at x -5.25 .. -4.75; approach it diagonally (forward-left) and keep moving in z
    place(-4, 2);
    player.moveF = true;
    player.moveL = true;
    for (let t = 0; t < 1; t += step) player.update(step);
    player.moveF = player.moveL = false;
    expect(camera.position.x).toBeGreaterThan(-4.75 - CONFIG.PLAYER_RADIUS - 0.01);
    expect(camera.position.z).toBeLessThan(0);
  });

  it('steps down off the block without leaving the ground when the drop is within STEP_HEIGHT', () => {
    const low = box(4, 0.4, 4, 0, 0.2, -8, { isFloor: true, name: 'low' }); // top at 0.4, a step up from the floor
    low.updateMatrixWorld(true);
    const p2 = new PlayerController(camera, [box(40, 0.4, 40, 0, -0.2, 0, { isFloor: true }), low], [], {});
    p2.isLocked = true;
    camera.position.set(0, 0.4 + CONFIG.PLAYER_HEIGHT, -8);
    camera.rotation.set(0, 0, 0, 'YXZ');
    p2.onGround = true;
    p2.moveF = true;
    let minFeet = Infinity;
    let maxFeet = -Infinity;
    for (let t = 0; t < 1.5; t += step) {
      p2.update(step);
      const feet = camera.position.y - CONFIG.PLAYER_HEIGHT;
      minFeet = Math.min(minFeet, feet);
      maxFeet = Math.max(maxFeet, feet);
      // Never airborne: the feet are always exactly on a surface
      expect(p2.onGround).toBe(true);
    }
    expect(maxFeet).toBeCloseTo(0.4, 6);
    expect(minFeet).toBeCloseTo(0, 6);
  });

  it('falls under gravity off a drop deeper than STEP_HEIGHT', () => {
    place(5.5, 0, 2); // on top of the block, walk off its far edge (+x)
    let airborne = 0;
    player.moveR = true;
    for (let t = 0; t < 1; t += step) {
      player.update(step);
      if (!player.onGround) airborne++;
    }
    player.moveR = false;
    expect(airborne).toBeGreaterThan(5);
    expect(player.onGround).toBe(true);
    expect(camera.position.y - CONFIG.PLAYER_HEIGHT).toBeCloseTo(0, 6);
    expect(camera.position.x).toBeGreaterThan(6);
  });
});

describe('in the built Temple', () => {
  const stubTex = { get: () => null, onProgress() {} };
  let temple;
  beforeAll(() => {
    const scene = new THREE.Scene();
    const { floors, walls } = new TempleBuilder(scene, stubTex).build();
    scene.updateMatrixWorld(true);
    temple = new PlayerController(new THREE.PerspectiveCamera(), floors, walls, {});
  });

  /** Resolve a walk-route waypoint the way scripts/walk.mjs does: entry position + dx/dz metres. */
  function resolve(wp) {
    const e = byId[wp.id];
    if (!e) throw new Error(`unknown id ${wp.id}`);
    const [x, , z] = worldPos(e);
    return { x: x + (wp.dx ?? 0), z: z + (wp.dz ?? 0), level: wp.level ? levelWorldY(wp.level) : null };
  }

  it('every waypoint of the building routes is a free spot on (or above) its level', () => {
    for (const [name, wps] of Object.entries(routes)) {
      for (const wp of wps) {
        const { x, z, level } = resolve(wp);
        const floor = temple.probe(x, z, 200).y; // highest surface
        const feet = wp.minY != null ? floor : level ?? floor;
        const p = temple.probe(x, z, feet + CONFIG.STEP_HEIGHT + 0.05);
        const label = `${name}: ${wp.id}(${wp.dx ?? 0},${wp.dz ?? 0})`;
        expect(p.inside, `${label} is inside a solid`).toBe(false);
        expect(temple.collides(new THREE.Vector3(x, feet + CONFIG.PLAYER_HEIGHT, z)), `${label} is inside a wall box`).toBe(false);
        if (wp.minY != null) expect(floor - level, `${label} height`).toBeGreaterThanOrEqual(wp.minY - 0.5);
        else if (level != null) expect(Math.abs(floor - level), `${label} level`).toBeLessThan(0.6);
      }
    }
  });

  it('the seam between the court floor and the foot of the kevesh has no hole', () => {
    const [kx, , kz] = worldPos(byId.kevesh);
    const K = levelWorldY('azaras_kohanim');
    const foot = kx - 15 * 0.5; // x -46 amos
    for (let dx = -0.305; dx <= 0.3; dx += 0.01) {
      const p = temple.probe(foot + dx, kz, K + CONFIG.STEP_HEIGHT + 0.05);
      expect(p.inside, `dx ${dx.toFixed(2)}`).toBe(false);
      expect(p.y, `dx ${dx.toFixed(2)}`).toBeGreaterThanOrEqual(K - 1e-6);
      expect(p.y - K, `dx ${dx.toFixed(2)}`).toBeLessThan(0.2);
    }
  });
});
