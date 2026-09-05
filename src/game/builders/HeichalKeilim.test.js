import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { TempleBuilder } from '../TempleBuilder.js';
import { HeichalBuilder } from './HeichalBuilder.js';
import { KeilimBuilder } from './KeilimBuilder.js';
import { byId, worldPos, levelWorldY } from '../../content/index.js';
import { AMAH } from '../../content/units.js';
import { CONFIG } from '../../config.js';
import { PlayerController } from '../PlayerController.js';

/** Map-like texture stub: no textures headless, every material is built without maps (null keeps three quiet). */
const stubTex = { get: () => null };

let scene, floors, walls, groups, player;

/** Height of the highest walkable surface under world (x, z), like PlayerController.getFloorHeight. */
function floorY(x, z) {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 200, z), new THREE.Vector3(0, -1, 0), 0, 400);
  const hits = ray.intersectObjects(floors, false);
  return hits.length ? hits[0].point.y : null;
}

/** World (x, z) metres of a point given in amos in the azarah frame, via a known entry. */
function xz(xa, za) {
  const e = byId.heichal;
  const [px, , pz] = worldPos(e);
  return [px + (xa - e.position.x) * AMAH, pz + (za - e.position.z) * AMAH];
}

beforeAll(() => {
  scene = new THREE.Scene();
  const tb = new TempleBuilder(scene, stubTex);
  ({ floors, walls } = tb);
  const args = [scene, stubTex, tb.mat, floors, walls];
  new HeichalBuilder(...args).build();
  new KeilimBuilder(...args).build();
  scene.updateMatrixWorld(true);
  player = new PlayerController(new THREE.PerspectiveCamera(), floors, walls, {});
  groups = {};
  for (const c of scene.children) if (c.userData?.entryId && !groups[c.userData.entryId]) groups[c.userData.entryId] = c;
});

describe('floor levels', () => {
  it('Ulam, Heichal and Kodesh HaKodashim floors sit at their content levels', () => {
    const pairs = [
      ['ulam', byId.ulam.position],
      ['heichal', byId.heichal.position],
      ['kodesh_hakodashim', { x: 3, z: byId.kodesh_hakodashim.position.z }], // beside the Even HaShtiya
    ];
    for (const [level, p] of pairs) {
      const [x, z] = xz(p.x, p.z);
      expect(floorY(x, z), level).toBeCloseTo(levelWorldY(level), 1);
      expect(Math.abs(floorY(x, z) - levelWorldY(level))).toBeLessThan(0.05);
    }
  });

  it('the Even HaShtiya rises three etzbaos above the Kodesh HaKodashim floor', () => {
    const [x, z] = xz(byId.even_hashtiya.position.x, byId.even_hashtiya.position.z);
    expect(floorY(x, z) - levelWorldY('kodesh_hakodashim')).toBeCloseTo(byId.even_hashtiya.geometry.h * AMAH, 2);
  });

  it('the top of the 12 steps meets the Ulam threshold; their foot is at the Kohanim level', () => {
    const [xt, zt] = xz(0, -75.5);
    expect(Math.abs(floorY(xt, zt) - levelWorldY('ulam'))).toBeLessThan(0.05);
    const [xf, zf] = xz(0, -54.5);
    expect(Math.abs(floorY(xf, zf) - (levelWorldY('azaras_kohanim') + 0.5 * AMAH))).toBeLessThan(0.05);
  });

  it('the court floor west of the altar is at the Kohanim level', () => {
    for (const [xa, za] of [
      [-40, -60],
      [40, -60],
      [-60, -85],
      [60, -120],
      [0, -182],
    ]) {
      const [x, z] = xz(xa, za);
      expect(Math.abs(floorY(x, z) - levelWorldY('azaras_kohanim')), `${xa},${za}`).toBeLessThan(0.05);
    }
  });

  it('the kevesh rises smoothly to the altar top at 9 amos', () => {
    const K = levelWorldY('azaras_kohanim');
    const top = worldPos(byId.mizbeach);
    expect(Math.abs(floorY(top[0], top[2]) - (K + 9 * AMAH))).toBeLessThan(0.05);
    // just below the top edge of the ramp (x -14.2) the slab is within a few cm of 9 amos
    const [xr, zr] = xz(-14.2, byId.kevesh.position.z);
    expect(Math.abs(floorY(xr, zr) - (K + 9 * AMAH))).toBeLessThan(0.05);
    // foot of the ramp
    const [xf, zf] = xz(-45.5, byId.kevesh.position.z);
    expect(Math.abs(floorY(xf, zf) - K)).toBeLessThan(0.1);
    // sample the slope every 0.5 m: never a rise the player cannot take
    let prev = floorY(xf, zf);
    for (let xa = -44.5; xa <= -14.5; xa += 1) {
      const [x, z] = xz(xa, byId.kevesh.position.z);
      const y = floorY(x, z);
      expect(y - prev).toBeLessThanOrEqual(CONFIG.STEP_HEIGHT);
      expect(y - prev).toBeGreaterThan(0);
      prev = y;
    }
  });

  it('walking the 12 steps never rises more than STEP_HEIGHT per 0.5 m and 6 amos in all', () => {
    // start on the first tread (z -54 exactly is the altar's west face and the yesod edge)
    const start = floorY(...xz(0, -54.5));
    let prev = start;
    let maxRise = 0;
    for (let za = -54.5; za >= -90; za -= 1) {
      const y = floorY(...xz(0, za));
      expect(y, `z ${za}`).not.toBeNull();
      maxRise = Math.max(maxRise, y - prev);
      expect(y - prev, `z ${za}`).toBeLessThanOrEqual(CONFIG.STEP_HEIGHT + 1e-6);
      expect(y - prev, `z ${za}`).toBeGreaterThanOrEqual(-1e-6);
      prev = y;
    }
    expect(maxRise).toBeCloseTo(0.5 * AMAH, 5);
    expect(prev - start).toBeCloseTo(6 * AMAH - 0.5 * AMAH, 5); // from the first tread to the Ulam floor
    expect(groups.maalos_ulam.userData.steps).toBe(12);
  });
});

describe('entry groups', () => {
  it('tags the keilim and structures with their entry ids and periods', () => {
    for (const id of [
      'mizbeach',
      'kevesh',
      'kevesh_katan_east',
      'kevesh_katan_west',
      'kiyor',
      'menorah',
      'shulchan',
      'mizbeach_hazahav',
      'paroches',
      'aron',
      'keruvim',
      'even_hashtiya',
      'yachin',
      'boaz',
      'ulam',
      'heichal',
      'kodesh_hakodashim',
      'taim',
      'maalos_ulam',
      'pesach_haheichal',
      'amah_traksin',
    ]) {
      expect(groups[id], id).toBeDefined();
      expect(groups[id].userData.entryId).toBe(id);
      expect(Array.isArray(groups[id].userData.period), id).toBe(true);
    }
  });

  it('Bayis Rishon-only groups are built hidden', () => {
    for (const id of ['aron', 'keruvim', 'yachin', 'boaz', 'amah_traksin']) {
      expect(groups[id].visible, id).toBe(false);
      expect(groups[id].userData.period).toEqual(['bayis_rishon']);
      let meshes = 0;
      groups[id].traverse((c) => {
        if (c.isMesh) meshes++;
      });
      expect(meshes, id).toBeGreaterThan(0);
    }
    expect(groups.mizbeach.visible).toBe(true);
    expect(groups.menorah.visible).toBe(true);
  });

  it('places vessels at worldPos(entry)', () => {
    for (const id of ['mizbeach', 'menorah', 'shulchan', 'mizbeach_hazahav', 'aron', 'kiyor']) {
      const [x, y, z] = worldPos(byId[id]);
      expect(groups[id].position.toArray().map((v) => +v.toFixed(6))).toEqual([x, y, z].map((v) => +v.toFixed(6)));
    }
  });

  it('instances the 38 ta\'im, 4 keranos, 12 kiyor spouts and 7 menorah flames', () => {
    const byName = (name) => {
      let found;
      scene.traverse((c) => {
        if (c.name === name) found = c;
      });
      return found;
    };
    expect(byName('taim-cells').count).toBe(byId.taim.dimensions.find((d) => d.label === 'count').value);
    expect(byName('keranos').count).toBe(4);
    expect(byName('kiyor-spouts').count).toBe(12);
    expect(byName('menorah-flames').count).toBe(7);
    expect(byName('menorah-flames').material.isMeshBasicMaterial).toBe(true);
    let lights = 0;
    scene.traverse((c) => {
      if (c.isLight) lights++;
    });
    expect(lights).toBe(0);
  });

  it('the parochos are DoubleSide and hang at z -138 and z -139', () => {
    const [, , z138] = worldPos(byId.paroches);
    const curtains = groups.paroches.children;
    expect(curtains).toHaveLength(2);
    expect(curtains[0].material.side).toBe(THREE.DoubleSide);
    expect(curtains[0].position.z).toBeCloseTo(z138, 6);
    expect(curtains[1].position.z).toBeCloseTo(z138 - AMAH, 6);
  });

  it('the altar has no yesod at its south-east corner', () => {
    const K = levelWorldY('azaras_kohanim');
    const [x, , z] = worldPos(byId.mizbeach);
    const half = 16 * AMAH;
    // south-east corner (x -16, z -22): nothing walkable above the court floor there
    expect(floorY(x - half + 0.25, z + half - 0.25)).toBeNull();
    // north-west corner: the yesod, one amah high
    expect(floorY(x + half - 0.25, z - half + 0.25)).toBeCloseTo(K + AMAH, 3);
    // south-west: the one amah of yesod along the south face
    expect(floorY(x - half + 0.25, z - half + 0.25)).toBeCloseTo(K + AMAH, 3);
  });

  it('keeps the draw-call count for the two builders under 150', () => {
    let draws = 0;
    scene.traverse((c) => {
      if (c.isMesh && c.visible) draws++;
    });
    expect(draws).toBeLessThan(150);
  });
});

/** The controller's view of a point: blocked when the step-height probe starts inside a solid or a wall box holds the feet. */
function blockedAt(x, feetY, z) {
  const p = player.probe(x, z, feetY + CONFIG.STEP_HEIGHT + 0.05);
  if (p.inside) return true;
  if (p.y - feetY > CONFIG.STEP_HEIGHT) return true;
  return player.collides(new THREE.Vector3(x, feetY + CONFIG.PLAYER_HEIGHT, z));
}

describe('solids', () => {
  const K = () => levelWorldY('azaras_kohanim');
  const H = () => levelWorldY('heichal');

  it('the altar\'s four sides and the kevesh flanks cannot be walked into from the court', () => {
    const [ax, , az] = worldPos(byId.mizbeach);
    const half = 16 * AMAH;
    // just inside each face of the sovev tier (x/z +-15), at court level
    for (const [x, z] of [
      [ax - half + 0.6, az],
      [ax + half - 0.6, az],
      [ax, az - half + 0.6],
      [ax, az + half - 0.6],
      [ax - half + 0.6, az + half - 0.6], // the yesod-less south-east corner, inside the sovev
    ]) {
      expect(blockedAt(x, K(), z), `${x},${z}`).toBe(true);
    }
    // the kevesh: inside its body under the slab, from either flank and from the foot end
    const [kx, , kz] = worldPos(byId.kevesh);
    expect(blockedAt(kx, K(), kz - 3.9)).toBe(true); // 0.1 m inside the west flank, where the ramp is 4 amos high
    expect(blockedAt(kx, K(), kz + 3.9)).toBe(true); // east flank
    expect(blockedAt(kx + 5, K(), kz)).toBe(true); // near the top, 8 amos high
    // but the foot of the ramp is a step onto the slab
    expect(blockedAt(kx - 7.4, K(), kz)).toBe(false);
    // and beside the altar on the court there is nothing in the way
    expect(blockedAt(ax - half - 1, K(), az + half + 1)).toBe(false);
  });

  it('the south-east corner of the altar has no yesod: the court floor is the only surface', () => {
    const [ax, , az] = worldPos(byId.mizbeach);
    const half = 16 * AMAH;
    // the yesod band would be x -16 .. -15 / z 15 .. 16; the point sits in it
    const p = player.probe(ax - half + 0.25, az + half - 0.25, K() + 5);
    expect(p.inside).toBe(false);
    expect(p.y).toBeLessThan(K() + 0.01); // no court floor is built here by these two builders: y 0 or below the level
  });

  it('the kiyor, menorah, shulchan and golden altar are solid', () => {
    // [id, level, a free spot 2 m away]: south of the kiyor (its north side is 2 amos from
    // the Ulam steps), east of the Heichal vessels (the menorah and shulchan stand 2.5 amos from the walls)
    for (const [id, level, dx, dz] of [
      ['kiyor', K(), -2, 0],
      ['menorah', H(), 0, 2],
      ['shulchan', H(), 0, 2],
      ['mizbeach_hazahav', H(), 0, 2],
    ]) {
      const [x, , z] = worldPos(byId[id]);
      expect(blockedAt(x, level, z), id).toBe(true);
      expect(blockedAt(x + dx, level, z + dz), `${id} beside`).toBe(false);
    }
  });

  it('the parochos do not block the way into the Kodesh HaKodashim', () => {
    const [x, , z] = worldPos(byId.paroches);
    for (const dz of [0.2, 0, -0.2, -0.5, -0.8]) expect(blockedAt(x, H(), z + dz), `dz ${dz}`).toBe(false);
  });

  it('the Ulam is 100 wide overall (Middot 4:7) with its end walls inside x +-50', () => {
    const [x, , z] = worldPos(byId.ulam);
    const U = levelWorldY('ulam');
    expect(blockedAt(x + 44 * AMAH, U, z)).toBe(false);
    expect(blockedAt(x + 47 * AMAH, U, z)).toBe(true); // inside the end wall
    expect(blockedAt(x + 52 * AMAH, U, z)).toBe(false); // beyond it: nothing of the Ulam
    // the court strip north of the wing behind the Ulam is at the Kohanim level, not inside the foundation
    const p = player.probe(x + 45 * AMAH, z - 12 * AMAH, K() + CONFIG.STEP_HEIGHT + 0.05);
    expect(p.inside).toBe(false);
  });
});
