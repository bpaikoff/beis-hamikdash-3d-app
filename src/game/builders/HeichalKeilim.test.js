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

let scene, floors, walls, groups, player, mat;

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
  ({ floors, walls, mat } = tb);
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
    let wicks = 0;
    scene.traverse((c) => {
      if (c.name === 'menorah-flame') wicks++;
    });
    expect(wicks).toBe(7); // anchors for ParticleSystem.createCandle
    expect(byName('golden-altar-coals').isMesh).toBe(true);
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
    // [id, level, a free spot 2 m away]: south of the kiyor (its body is an amah from the
    // Ulam steps on the north, the muchni post on its south at 2.05 amos), east of the Heichal vessels (the menorah and shulchan stand 2.5 amos from the walls)
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

describe('Ulam steps material (round 4)', () => {
  it('the twelve steps and three rovadim are dressed limestone (stoneFine), not the white marble', () => {
    const steps = [];
    groups.maalos_ulam.traverse((m) => { if (m.isMesh && /^maalos-ulam-(\d+|rovad-\d)$/.test(m.name)) steps.push(m); });
    expect(steps).toHaveLength(15);
    for (const m of steps) {
      expect(m.material, m.name).toBe(mat.stoneFine);
      expect(m.material, m.name).not.toBe(mat.marbleW);
      expect(m.userData.isFloor, m.name).toBe(true);
    }
    expect(steps.filter((m) => m.userData.isStep)).toHaveLength(12);
  });

  it('every step has one shaded riser facing, instanced, in the riser shade of the same stone', () => {
    const risers = groups.maalos_ulam.getObjectByName('maalos-ulam-risers');
    expect(risers?.isInstancedMesh).toBe(true);
    expect(risers.count).toBe(12);
    expect(risers.material).toBe(mat.stoneRiser);
    expect(mat.stoneRiser).not.toBe(mat.stoneFine);
    expect(mat.stoneRiser.userData.tileMetres).toBe(mat.stoneFine.userData.tileMetres);
    // Not a collider: the facings stand 1 cm proud of the risers only for the eye.
    expect(floors).not.toContain(risers);
    expect(walls).not.toContain(risers);
  });
});

describe('kiyor cistern rim (round 4)', () => {
  const K = () => levelWorldY('azaras_kohanim');

  it('is a walkable floor 0.12 m over the court, and the court is level just beyond it', () => {
    const rim = groups.kiyor.getObjectByName('kiyor-rim');
    expect(rim?.userData.isFloor).toBe(true);
    expect(floors).toContain(rim);
    const [x, , z] = worldPos(byId.kiyor);
    const R = rim.geometry.parameters.radiusTop;
    for (const [dx, dz] of [[R - 0.05, 0], [-(R - 0.05), 0], [0, R - 0.05], [0, -(R - 0.05)], [0.7 * R, 0.7 * R]]) {
      expect(player.getFloorHeight(x + dx, z + dz, 200), `${dx},${dz}`).toBeCloseTo(K() + 0.12, 2);
    }
    for (const [dx, dz] of [[R + 0.1, 0], [0, -(R + 0.1)]]) {
      expect(player.getFloorHeight(x + dx, z + dz, 200), `${dx},${dz}`).toBeCloseTo(K(), 2);
    }
  });

  it('reaches beyond the laver\'s solid by more than the player radius, so it can be stood on', () => {
    const rim = groups.kiyor.getObjectByName('kiyor-rim');
    const solid = walls.find((w) => w.userData?.name === 'kiyor-solid');
    const half = solid.geometry.parameters.width / 2;
    expect(rim.geometry.parameters.radiusTop - half).toBeGreaterThan(CONFIG.PLAYER_RADIUS + 0.1);
    expect(rim.geometry.parameters.height).toBeLessThan(CONFIG.STEP_HEIGHT);
  });

  it('the muchni post blocks at x -26.05 amos and leaves (-27, -65), a body south of it, walkable', () => {
    // Round 6: the post's solid is the post's own 0.12 m and stands half an amah inside the
    // rim's edge; before, at x -26.55 with a 0.16 m solid, collides() was already true at
    // (-27, -65) (backlog "Player and builders"), so the controller refused every move there.
    const post = walls.find((w) => w.userData?.name === 'muchni-solid');
    expect(post.geometry.parameters.width).toBeCloseTo(0.12, 6);
    expect(post.geometry.parameters.depth).toBeCloseTo(0.12, 6);
    const box = new THREE.Box3().setFromObject(post);
    const [px] = xz(-26.05, -65);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(px, 6);
    const eye = (xa, za) => new THREE.Vector3(...(([x, z]) => [x, K() + CONFIG.PLAYER_HEIGHT, z])(xz(xa, za)));
    expect(player.collides(eye(-27, -65))).toBe(false);
    expect(player.collides(eye(-27.4, -65))).toBe(false);
    expect(player.collides(eye(-26.05, -65))).toBe(true); // the post itself
    expect(player.collides(eye(-26.6, -65))).toBe(true); // a body's width from it still touches
    expect(blockedAt(...(([x, z]) => [x, K(), z])(xz(-27, -65)))).toBe(false);
  });

  it('is stood on by the controller walking in against the laver from the north, east and west', () => {
    // The route harness accepts feet >= level + minY - 0.5, so a leg's `minY` cannot tell the
    // rim (0.12 m) from the court; this walks each approach with the real controller and
    // reads the feet. The laver's solid (half 0.8 m) stops the centre 1.1 m out, inside the
    // rim's 1.275 m; the muchni post stands on the south side, so that approach is skipped.
    const rim = groups.kiyor.getObjectByName('kiyor-rim');
    const [x, , z] = worldPos(byId.kiyor);
    const H = CONFIG.PLAYER_HEIGHT;
    const cam = player.camera;
    for (const [dx, dz] of [[1, 0], [0, 1], [0, -1]]) {
      const [sx, sz] = [x + dx * 2.8 * AMAH, z + dz * 2.8 * AMAH];
      const [tx, tz] = [x + dx * 1.8 * AMAH, z + dz * 1.8 * AMAH];
      cam.position.set(sx, K() + H, sz);
      cam.rotation.set(0, Math.atan2(-(tx - sx), -(tz - sz)), 0, 'YXZ');
      player.isLocked = true;
      player.moveF = true;
      player.onGround = true;
      player.verticalVelocity = 0;
      let last = Infinity;
      for (let f = 0; f < 600; f++) {
        player.update(1 / 60);
        const d = Math.hypot(tx - cam.position.x, tz - cam.position.z);
        if (f % 30 === 29) {
          if (d > last - 0.01) break; // stopped against the body
          last = d;
        }
      }
      player.moveF = false;
      player.isLocked = false;
      const feet = cam.position.y - H;
      expect(feet - K(), `approach ${dx},${dz} ended at (${cam.position.x.toFixed(2)}, ${cam.position.z.toFixed(2)})`).toBeCloseTo(0.12, 2);
      expect(Math.hypot(cam.position.x - x, cam.position.z - z)).toBeLessThan(rim.geometry.parameters.radiusTop);
    }
  });
});
