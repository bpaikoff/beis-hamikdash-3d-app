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

/**
 * Walk a polyline of amos waypoints sampling every `stride` metres: every sample must
 * have a floor, rise at most STEP_HEIGHT from the previous one, and no wall box may
 * touch the player sphere. Returns the floor heights at the first and last sample.
 */
function walk(path, stride = 0.25, fromY = 60) {
  const { floors, wallBoxes } = built;
  const pts = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = xz(...path[i]);
    const [bx, bz] = xz(...path[i + 1]);
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / stride));
    for (let k = 0; k < n; k++) pts.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  pts.push(xz(...path[path.length - 1]));
  const first = floorAt(floors, pts[0][0], pts[0][1], fromY);
  let prev = first;
  const sphere = new THREE.Sphere();
  for (const [x, z] of pts) {
    const y = floorAt(floors, x, z, fromY);
    expect(y, `no floor at ${x},${z}`).toBeGreaterThan(-Infinity);
    expect(y - prev, `rise at ${x},${z}`).toBeLessThanOrEqual(CONFIG.STEP_HEIGHT);
    sphere.set(new THREE.Vector3(x, y + 0.9, z), CONFIG.PLAYER_RADIUS);
    const blocked = wallBoxes.find((b) => b.intersectsSphere(sphere));
    expect(blocked, `wall on the path at ${x},${z} (floor ${y})`).toBeUndefined();
    prev = y;
  }
  return { first, last: prev };
}

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
    const balcony = levelWorldY('ezras_nashim') + 10 * AMAH; // the gallery, 10 amos up (temple.json: y 2.5)
    near(floorAt(floors, ...xz(0, 139)), balcony);
    near(floorAt(floors, ...xz(-65.5, 70)), balcony);
    near(floorAt(floors, ...xz(25.5, 120)), balcony);
    near(floorAt(floors, ...xz(45, 99)), balcony);
    near(floorAt(floors, ...xz(0, 139), levelWorldY('ezras_nashim') + 2), levelWorldY('ezras_nashim')); // the court under it
    near(floorAt(floors, ...xz(8, 135)), balcony); // top step of the north flight
    near(floorAt(floors, ...xz(-5.5, 135)), balcony); // south landing
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
    near(floorAt(floors, ...xz(67.5 + 7, -14)), levelWorldY('azaras_kohanim') + 0.05 * AMAH); // Beis HaMoked hall floor, at the level of the Ezras Kohanim strip its gate opens onto
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
    // Waypoints in amos: east of the Soreg, up the Cheil steps, through the Ezras Nashim
    // gate, across the court, up the fifteen steps, through Nicanor, over the Duchan.
    // The gallery hangs over the way in from the gate (z 137 .. 141), so that stretch is cast from under it.
    const { first } = walk([[0, 175], [0, 158], [0, 154], [0, 146], [0, 100], [0, 20]], 0.25, levelWorldY('ezras_nashim') + 2);
    const { last } = walk([[0, 20], [0, 9], [0, 3], [0, -8], [0, -11.7], [0, -12.7], [0, -13.5], [0, -30], [0, -52]]);
    expect(first).toBeCloseTo(levelWorldY('har_habayis'), 1);
    expect(last).toBeCloseTo(levelWorldY('azaras_kohanim'), 2);
  });

  it('lets the player through every chamber door and up the Parvah stair', () => {
    const koh = levelWorldY('azaras_kohanim');
    const under = koh + 2; // cast from under the chamber roofs
    walk([[-40, -103], [-60, -103], [-70, -103]], 0.25, under); // Lishkas HaGazis, through to the chol half
    walk([[-70, -110], [-80, -110], [-81, -110]], 0.25, under); // on into Lishkas HaEtz (its west wall is at x -83.5, the Soreg line)
    walk([[-40, -133], [-58, -133]], 0.25, under); // Lishkas HaGolah
    walk([[40, -96], [58, -96]], 0.25, under); // Lishkas HaMadichin
    walk([[40, -112], [58, -112]], 0.25, under); // Lishkas HaParvah
    walk([[40, -128], [58, -128]], 0.25, under); // Lishkas HaMelach
    walk([[54.5, -90], [54.5, -102.5], [64.5, -102.5], [64.5, -112], [64.5, -130]], 0.25, koh + 9); // Madichin stair to the roof terrace, past the mikveh
    walk([[40, -14], [56, -14], [67.5, -14], [70, -8], [78, -8]], 0.25, koh + 6); // Beis HaMoked: gate, hall (level with the Ezras Kohanim), Lishkas Avnei HaMizbeach
    walk([[65, -20], [58.5, -20]], 0.25, koh + 2); // into Lishkas Telaei Korban through its door facing the hall
    const en = levelWorldY('ezras_nashim') + 2;
    walk([[-20, 26], [-30, 26], [-40, 26]], 0.25, en); // chamber_oils
    walk([[20, 121], [30, 121], [40, 121]], 0.25, en); // chamber_wood
    walk([[30, 12], [30, 3], [30, -5]], 0.25, en); // Lishkos Klei Shir under the Ezras Yisrael
    walk([[0, -5], [12, -5], [12, 3]], 0.25, levelWorldY('azaras_yisrael') + 2); // Lishkas Pinchas HaMalbish beside Nicanor
  });

  it('climbs to the Ezras Nashim gallery and round it', () => {
    const balcony = levelWorldY('ezras_nashim') + 10 * AMAH;
    // Up the north flight beside the gate, over the gate, in front of the wood store, along the north wall; then the mirror image down.
    // The lowest steps run under the gallery in front of the chamber (x 23.5 .. 27.5), so they are cast from beneath it.
    const foot = walk([[26.5, 128], [26.5, 135], [22, 135]], 0.25, levelWorldY('ezras_nashim') + 3.5);
    expect(foot.first).toBeCloseTo(levelWorldY('ezras_nashim'), 2);
    const up = walk([[22, 135], [8, 135], [5.5, 135], [5.5, 139], [0, 139], [25.5, 139], [25.5, 99], [45, 99], [65.5, 99], [65.5, 60]]);
    expect(up.first).toBeCloseTo(foot.last, 2);
    expect(up.last).toBeCloseTo(balcony, 2);
    walk([[-65.5, 60], [-65.5, 99], [-45, 99], [-25.5, 99], [-25.5, 139], [-5.5, 139], [-5.5, 135], [-8, 135]]);
    const down = walk([[-22, 135], [-8, 135]]); // the flight is checked upward (a rise, not a drop)
    expect(down.last).toBeCloseTo(balcony, 2);
    expect(walk([[-26.5, 128], [-26.5, 135], [-22, 135]], 0.25, levelWorldY('ezras_nashim') + 3.5).last).toBeCloseTo(down.first, 2);
  });

  it('passes through the five gates of the mount and the Soreg opening opposite every gate', () => {
    // No ground plane here, so each passage starts on the threshold at the wall's outer face.
    const hb = levelWorldY('har_habayis');
    for (const [id, path] of [
      ['shaar_shushan', [[0, 283.5], [0, 278], [0, 265]]],
      ['shaar_tadi', [[203, -20], [197.5, -20], [185, -20]]],
      ['shaar_kiponus', [[0, -227.5], [0, -222], [0, -210]]],
      ['chuldah_gate_west', [[-308, -30], [-302.5, -30], [-290, -30]]],
      ['chuldah_gate_east', [[-308, 90], [-302.5, 90], [-290, 90]]],
    ]) {
      const { first, last } = walk(path);
      expect(first, id).toBeCloseTo(hb, 1);
      expect(last, id).toBeCloseTo(hb, 1);
    }
    const cheil = levelWorldY('cheil');
    for (const id of ['water_gate', 'bechoros_gate', 'delek_gate', 'shaar_elyon', 'nitzotz_gate', 'korban_gate', 'shaar_hanashim']) {
      const g = byId[id];
      const s = Math.sign(g.position.x);
      const { last } = walk([[s * 90, g.position.z], [s * 78.5, g.position.z]]);
      expect(last, id).toBeCloseTo(cheil, 1);
    }
    for (const id of ['shaar_maaravi_north', 'shaar_maaravi_south']) {
      const { last } = walk([[byId[id].position.x, -210], [byId[id].position.x, -198]]);
      expect(last, id).toBeCloseTo(cheil, 1);
    }
    expect(walk([[0, 165], [0, 155]]).last).toBeCloseTo(cheil, 1); // opposite the Ezras Nashim gate
  });

  it('has no two floor slabs sharing a top surface', () => {
    const boxes = built.floors.filter((f) => f.userData?.isFloor && !f.userData.isStep).map((f) => ({ f, b: new THREE.Box3().setFromObject(f) }));
    const clashes = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].b;
        const b = boxes[j].b;
        if (Math.abs(a.max.y - b.max.y) > 0.005) continue;
        const ox = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
        const oz = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
        if (ox > 0.05 && oz > 0.05) clashes.push(`${boxes[i].f.userData.name} x ${boxes[j].f.userData.name} (${ox.toFixed(1)} x ${oz.toFixed(1)} m)`);
      }
    }
    expect(clashes).toEqual([]);
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
