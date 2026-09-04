import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { AzaraBuilder } from './AzaraBuilder.js';
import { EzrasNashimBuilder } from './EzrasNashimBuilder.js';
import { HarHaBayisBuilder } from './HarHaBayisBuilder.js';
import { levelWorldY, byId, worldPos } from '../../content/index.js';
import { toWorld, AMAH } from '../../content/units.js';
import { CONFIG } from '../../config.js';

const MAT_KEYS = ['stone', 'stonePolished', 'gold', 'goldEng', 'copper', 'copperP', 'cedar', 'acacia', 'marbleW', 'marbleR', 'paroches', 'ground', 'floor', 'mosaic', 'water', 'altar'];

/** Build the three court builders into a bare scene with plain materials (no textures). */
function buildCourts() {
  const mat = Object.fromEntries(MAT_KEYS.map((k) => [k, new THREE.MeshStandardMaterial()]));
  const tex = { get: () => undefined };
  const scene = new THREE.Scene();
  const floors = [];
  const walls = [];
  const args = [scene, tex, mat, floors, walls];
  new HarHaBayisBuilder(...args).build();
  new EzrasNashimBuilder(...args).build();
  new AzaraBuilder(...args).build();
  scene.updateMatrixWorld(true);
  const wallBoxes = walls.filter((w) => w.userData?.isWall).map((w) => new THREE.Box3().setFromObject(w));
  return { scene, floors, walls, wallBoxes };
}

const ray = new THREE.Raycaster();
const down = new THREE.Vector3(0, -1, 0);
/** Highest walkable surface under (x, z) in metres, or -Infinity. */
function floorAt(floors, x, z, fromY = 60) {
  ray.set(new THREE.Vector3(x, fromY, z), down);
  ray.far = fromY + 100;
  const hits = ray.intersectObjects(floors, false);
  return hits.length ? hits[0].point.y : -Infinity;
}

/** Amos in the azarah frame -> world x, z. */
const xz = (x, z) => {
  const [wx, , wz] = toWorld({ x, y: 0, z });
  return [wx, wz];
};

let built;
beforeAll(() => {
  built = buildCourts();
});

describe('court builders', () => {
  it('tag every top-level group with entryId and period', () => {
    const groups = built.scene.children.filter((o) => o.isGroup);
    expect(groups.length).toBeGreaterThan(20);
    for (const g of groups) {
      expect(g.userData.entryId, g.name).toBeTruthy();
      expect(g.userData).toHaveProperty('period');
    }
    for (const id of ['har_habayis', 'cheil', 'cheil_steps', 'soreg', 'shaar_shushan', 'ezras_nashim', 'maalos_shir', 'nicanor_gate', 'azaras_yisrael', 'duchan', 'azaras_kohanim', 'beis_hamoked', 'lishkas_hagazis', 'lishkas_haparvah', 'slaughter_rings']) {
      expect(groups.some((g) => g.userData.entryId === id), id).toBe(true);
    }
  });

  it('floors sit at the content levels', () => {
    const { floors } = built;
    const near = (v, target) => expect(Math.abs(v - target), `${v} vs ${target}`).toBeLessThan(0.03);
    near(floorAt(floors, ...xz(0, 200)), levelWorldY('har_habayis'));
    near(floorAt(floors, ...xz(-200, -100)), levelWorldY('har_habayis'));
    near(floorAt(floors, ...xz(0, 155)), levelWorldY('cheil'));
    near(floorAt(floors, ...xz(-78, -60)), levelWorldY('cheil'));
    near(floorAt(floors, ...xz(0, 70)), levelWorldY('ezras_nashim'));
    near(floorAt(floors, ...xz(0, 144)), levelWorldY('ezras_nashim'));
    near(floorAt(floors, ...xz(-47.5, 26)), levelWorldY('ezras_nashim') + 0.05 * AMAH);
    near(floorAt(floors, ...xz(0, 8)), levelWorldY('azaras_yisrael'));
    near(floorAt(floors, ...xz(0, 3)), levelWorldY('azaras_yisrael'));
    near(floorAt(floors, ...xz(20, -5)), levelWorldY('azaras_yisrael'));
    near(floorAt(floors, ...xz(0, -11.5)), levelWorldY('duchan'));
    near(floorAt(floors, ...xz(0, -20)), levelWorldY('azaras_kohanim'));
    near(floorAt(floors, ...xz(-60, -40)), levelWorldY('azaras_kohanim'));
    near(floorAt(floors, ...xz(60, -120), levelWorldY('azaras_kohanim') + 2), levelWorldY('azaras_kohanim') + 0.05 * AMAH); // inside the Parvah (under its roof)
    near(floorAt(floors, ...xz(60, -112)), levelWorldY('azaras_kohanim') + (10 + 1) * AMAH); // the Parvah roof terrace
    near(floorAt(floors, ...xz(-60, -170)), levelWorldY('azaras_kohanim'));
    near(floorAt(floors, ...xz(0, -182)), levelWorldY('azaras_kohanim'));
    near(floorAt(floors, ...xz(67.5 + 7, -14)), levelWorldY('azaras_yisrael') + 0.05 * AMAH); // Beis HaMoked hall floor
  });

  it('leaves the altar area and the building to GEO-A', () => {
    const { floors } = built;
    // The Kohanim floor reaches z -54 at the axis and stops there; nothing of ours under the Ulam steps or the Heichal.
    expect(floorAt(built.floors, ...xz(0, -53))).toBeCloseTo(levelWorldY('azaras_kohanim'), 2);
    for (const [x, z] of [[0, -60], [0, -84], [0, -118], [30, -100], [-30, -150], [40, -84]]) {
      expect(floorAt(floors, ...xz(x, z)), `${x},${z}`).toBeLessThan(levelWorldY('har_habayis') + 0.5);
    }
  });

  it('is walkable from Har HaBayis to the Ezras Kohanim without a rise over STEP_HEIGHT', () => {
    // Half-amah treads are 0.25 m, so the walk is sampled every 0.25 m (a 1.5 m stride
    // would span six steps); the player controller moves a few cm per frame.
    const STRIDE = 0.25;
    const { floors, wallBoxes } = built;
    // Waypoints in amos: east of the Soreg, up the Cheil steps, through the Ezras Nashim
    // gate, across the court, up the fifteen steps, through Nicanor, over the Duchan.
    const path = [[0, 175], [0, 158], [0, 154], [0, 146], [0, 100], [0, 20], [0, 9], [0, 3], [0, -8], [0, -11.7], [0, -12.7], [0, -13.5], [0, -30], [0, -52]];
    const pts = [];
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, az] = xz(...path[i]);
      const [bx, bz] = xz(...path[i + 1]);
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / STRIDE));
      for (let k = 0; k < n; k++) pts.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
    }
    pts.push(xz(...path[path.length - 1]));
    let prev = floorAt(floors, ...pts[0]);
    expect(prev).toBeCloseTo(levelWorldY('har_habayis'), 1);
    const sphere = new THREE.Sphere();
    for (const [x, z] of pts) {
      const y = floorAt(floors, x, z);
      expect(y, `no floor at ${x},${z}`).toBeGreaterThan(-Infinity);
      expect(y - prev, `rise at ${x},${z}`).toBeLessThanOrEqual(CONFIG.STEP_HEIGHT);
      sphere.set(new THREE.Vector3(x, y + 0.9, z), CONFIG.PLAYER_RADIUS);
      const blocked = wallBoxes.find((b) => b.intersectsSphere(sphere));
      expect(blocked, `wall on the path at ${x},${z}`).toBeUndefined();
      prev = y;
    }
    expect(prev).toBeCloseTo(levelWorldY('azaras_kohanim'), 2);
  });

  it('keeps the draw-call budget', () => {
    let meshes = 0;
    let instanced = 0;
    let instances = 0;
    built.scene.traverse((o) => {
      if (o.isInstancedMesh) {
        instanced++;
        instances += o.count;
      } else if (o.isMesh && o.visible) meshes++;
    });
    console.log(`court builders: ${meshes} meshes + ${instanced} instanced meshes (${instances} instances) = ${meshes + instanced} draw calls`);
    expect(meshes + instanced).toBeLessThan(900);
  });

  it('places the gate groups on their content positions', () => {
    for (const id of ['shaar_shushan', 'shaar_tadi', 'shaar_kiponus', 'chuldah_gate_east', 'ezras_nashim_gate', 'nicanor_gate', 'water_gate', 'korban_gate', 'nitzotz_gate']) {
      const g = built.scene.children.find((o) => o.userData.entryId === id);
      expect(g, id).toBeTruthy();
      const box = new THREE.Box3().setFromObject(g);
      const [x, , z] = worldPos(byId[id]);
      expect(box.min.x - 0.6 <= x && x <= box.max.x + 0.6, `${id} x`).toBe(true);
      expect(box.min.z - 0.6 <= z && z <= box.max.z + 0.6, `${id} z`).toBe(true);
    }
    const y = built.scene.children.find((o) => o.userData.altEntryIds?.includes('shaar_yechonya'));
    expect(y?.userData.entryId).toBe('nitzotz_gate');
  });
});
