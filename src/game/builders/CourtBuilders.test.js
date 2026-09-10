import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { AzaraBuilder } from './AzaraBuilder.js';
import { EzrasNashimBuilder } from './EzrasNashimBuilder.js';
import { HarHaBayisBuilder, TADI_GABLE_RISE, TADI_STONE_T } from './HarHaBayisBuilder.js';
import { levelWorldY, byId, worldPos } from '../../content/index.js';
import { toWorld, AMAH } from '../../content/units.js';
import { CONFIG } from '../../config.js';
import { PlayerController } from '../PlayerController.js';

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
    near(floorAt(floors, ...xz(-67.5, -103), levelWorldY('azaras_kohanim') + 2), levelWorldY('azaras_kohanim') + 0.05 * AMAH); // Lishkas HaGazis, on the wall line
    near(floorAt(floors, ...xz(-59.5, -133), levelWorldY('azaras_kohanim') + 2), levelWorldY('azaras_kohanim') + 0.05 * AMAH); // Lishkas HaGolah
    near(floorAt(floors, ...xz(67.5 + 7, -14)), levelWorldY('azaras_kohanim') + 0.05 * AMAH); // Beis HaMoked hall floor, at the level of the Ezras Kohanim strip its gate opens onto
  });

  it('leaves the court west of z -54 (the building, its steps and the strips beside it) to GEO-A', () => {
    const { floors } = built;
    // The Kohanim floor reaches z -54 across the whole width and stops there; west of it only the chambers have floors of ours
    // (HeichalBuilder.buildWestCourtFloor lays the strips, so a second slab here would z-fight; AzarahRoutes.test.js checks the seam).
    for (const x of [0, -60, 60]) expect(floorAt(floors, ...xz(x, -53.9)), `${x},-53.9`).toBeCloseTo(levelWorldY('azaras_kohanim'), 2);
    for (const [x, z] of [[0, -60], [0, -84], [0, -118], [30, -100], [-30, -150], [40, -84], [-60, -60], [60, -60], [-60, -170], [60, -170], [0, -182], [45, -120], [-45, -120]]) {
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

  it('lets the player through every chamber door on the court floor', () => {
    // The chambers west of z -54 (Gazis, Etz, Golah, Madichin, Parvah, Melach and the
    // Madichin stair) are entered over HeichalBuilder's strips, so they are walked with the
    // real PlayerController over the whole Temple in AzarahRoutes.test.js.
    const koh = levelWorldY('azaras_kohanim');
    walk([[40, -14], [56, -14], [66, -14], [66, -7], [70, -7], [70, -8], [78, -8]], 0.25, koh + 6); // Beis HaMoked: gate, hall (level with the Ezras Kohanim), past the stair well, Lishkas Avnei HaMizbeach
    walk([[65, -20], [58.5, -20]], 0.25, koh + 2); // into Lishkas Telaei Korban through its door facing the hall
    const en = levelWorldY('ezras_nashim') + 2;
    walk([[-20, 26], [-30, 26], [-40, 26]], 0.25, en); // chamber_oils
    walk([[20, 121], [30, 121], [40, 121]], 0.25, en); // chamber_wood
    walk([[20, 12], [20, 3], [20, -5]], 0.25, en); // Lishkos Klei Shir under the Ezras Yisrael, from the open court
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

  it('guards the gallery flights, their landings and the twelve steps with masses taller than a step', () => {
    const { floors } = built;
    const en = levelWorldY('ezras_nashim');
    const balcony = en + 10 * AMAH;
    const step = (v, from) => expect(v - from, `${v} over ${from}`).toBeGreaterThan(CONFIG.STEP_HEIGHT);
    for (const s of [1, -1]) {
      // Beside the eleventh tread (x 17.5 .. 16.5, top 5.5 amos over the court) the court-side balustrade tops out 2.5 amos higher.
      const tread = floorAt(floors, ...xz(s * 17.2, 135));
      expect(tread).toBeCloseTo(en + 5.5 * AMAH, 2);
      expect(floorAt(floors, ...xz(s * 17.2, 132.75))).toBeCloseTo(en + 8 * AMAH, 2);
      step(floorAt(floors, ...xz(s * 17.2, 132.75)), tread);
      step(floorAt(floors, ...xz(s * 17.2, 137.25)), tread); // gate side: the wall carrying the gallery's parapet
      expect(floorAt(floors, ...xz(s * 17.2, 137.25))).toBeCloseTo(balcony + 1.2 * AMAH, 2);
      step(floorAt(floors, ...xz(s * 5.5, 132.75)), balcony); // the landing's court edge
      step(floorAt(floors, ...xz(s * 3.25, 135)), balcony); // the landing's edge toward the axis
      expect(floorAt(floors, ...xz(s * 26.5, 132.75), en + 3.5)).toBeCloseTo(en, 2); // the two lowest treads stay open to the court (cast from under the gallery)
      expect(walk([[s * 26.8, 128], [s * 26.8, 135]], 0.25, en + 3.5).last).toBeCloseTo(en + 0.5 * AMAH, 2); // onto the first tread
      // The twelve steps' cheek walls, 1.2 amos over the gate threshold, from the Cheil up.
      const hb = levelWorldY('har_habayis');
      expect(floorAt(floors, ...xz(s * 10.25, 150))).toBeCloseTo(hb + 7.2 * AMAH, 2);
      step(floorAt(floors, ...xz(s * 10.25, 147.25)), floorAt(floors, ...xz(s * 9.5, 147.25)));
      expect(floorAt(floors, ...xz(s * 10.75, 150))).toBeCloseTo(hb, 1); // the Cheil beside them
    }
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
      // Round 7: Lishkas Palhedrin (x 73.5 .. 81, z -79 .. -63) fills the Cheil opposite Shaar HaNitzotz's opening up to the lane along the Soreg (x 81 .. 83.5).
      const xIn = id === 'nitzotz_gate' ? 82.4 : 78.5;
      const { last } = walk([[s * 90, g.position.z], [s * xIn, g.position.z]]);
      expect(last, id).toBeCloseTo(cheil, 1);
    }
    for (const id of ['shaar_maaravi_north', 'shaar_maaravi_south']) {
      const { last } = walk([[byId[id].position.x, -210], [byId[id].position.x, -198]]);
      expect(last, id).toBeCloseTo(cheil, 1);
    }
    expect(walk([[0, 165], [0, 155]]).last).toBeCloseTo(cheil, 1); // opposite the Ezras Nashim gate
  });

  it('closes the court walls where a room or an opening meets them (PW2 perimeter walk)', () => {
    const { wallBoxes } = built;
    const solidAt = (x, y, z) => {
      const [wx, wy, wz] = toWorld({ x, y, z });
      return wallBoxes.some((b) => b.containsPoint(new THREE.Vector3(wx, wy, wz)));
    };
    // The east wall over the Klei Shir doors (below the Ezras Yisrael floor) is the court's face at floor level.
    for (const x of [20, -20]) {
      expect(solidAt(x, 1, 3), `klei shir lintel x ${x}`).toBe(true);
      expect(solidAt(x, -3, 3), `klei shir door x ${x}`).toBe(false);
    }
    // The Beis Avtinas storey's interior (floor y 24; round 7: over the Water Gate, x -73.5 .. -61.5, z -24 .. -8) is clear of the south wall, which stands under its floor with the gate in it.
    for (const z of [-22, -16, -10]) expect(solidAt(-70, 25, z), `storey interior z ${z}`).toBe(false);
    for (const z of [-22.5, -9.5]) expect(solidAt(-70, 10, z), `wall under the storey z ${z}`).toBe(true);
    for (const z of [-22.5, -9.5]) expect(solidAt(-70, 23, z), `wall under the storey slab z ${z}`).toBe(true);
    expect(solidAt(-70.5, 10, -16), 'water gate leaves').toBe(true);
    expect(solidAt(-69, 10, -16), 'water gate reveal').toBe(false);
    // The Korban gate, no longer under the storey, has its full frame with the lintel over the opening (2.5 + 20 + 1).
    const korban = new THREE.Box3().setFromObject(built.scene.getObjectByName('korban_gate frame'));
    expect(korban.max.y).toBeCloseTo(toWorld({ x: 0, y: 23.5, z: 0 })[1], 2);
    // The gate's frame keeps its lintel between the gate's top (22.5) and the storey's slab (23.2).
    const lintel = built.scene.getObjectByName('water_gate frame');
    expect(lintel, 'water gate frame').toBeTruthy();
    const frameBox = new THREE.Box3().setFromObject(lintel);
    // (stopping 0.01 amah short of the slab: CourtBuilder FRAME_PROUD, round 7)
    expect(frameBox.max.y).toBeCloseTo(toWorld({ x: 0, y: 23.2 - 0.01, z: 0 })[1], 3);
    // Balustrades between the stair tower's flights (x -73.5 .. -61.5, z -32 .. -23; bands of 1.75 from the door end z -31), open at the landing that joins each pair.
    expect(solidAt(-66, 5, -29.25)).toBe(true);
    expect(solidAt(-70, 5, -27.5)).toBe(true);
    expect(solidAt(-66, 5, -25.75)).toBe(true);
    expect(solidAt(-71.25, 5, -29.25), 'landing 0').toBe(false);
    expect(solidAt(-63.75, 5, -27.5), 'landing 1').toBe(false);
    expect(solidAt(-67.5, 5, -30.1), 'flight 0').toBe(false);
    // Lishkas Palhedrin (round 7) closes the north Cheil at x 73.5 .. 81, z -79 .. -63, and leaves the lane to the Soreg open.
    expect(solidAt(80.5, -12, -71), "Palhedrin's north wall").toBe(true);
    expect(solidAt(82, -12, -71), 'the Cheil lane').toBe(false);
    expect(solidAt(78.5, -12, -63.5), "Palhedrin's Cheil door").toBe(false);
    expect(solidAt(70.5, 4, -65.5), "Palhedrin's bay through the north wall").toBe(false);
    expect(solidAt(70.5, -5, -65.5), 'the wall under the bay').toBe(true);
  });

  it('climbs from the Cheil into Beis HaMoked and Lishkas HaGazis by their vestibules and switchback stairs', () => {
    const { floors, wallBoxes } = built;
    const cheil = levelWorldY('cheil');
    const koh = levelWorldY('azaras_kohanim');
    const near = (v, target, msg) => expect(Math.abs(v - target), `${msg}: ${v} vs ${target}`).toBeLessThan(0.03);
    const solidAt = (x, y, z) => {
      const [wx, wy, wz] = toWorld({ x, y, z });
      return wallBoxes.some((b) => b.containsPoint(new THREE.Vector3(wx, wy, wz)));
    };
    // Under the chamber floors (cast from just below them): the vestibule floors, a LIP over
    // the Cheil pavement (which is 0.04 amos over the mount); the doors to the Cheil are clear.
    const underFloor = koh - 0.4 - 0.05; // below the slab
    const top = koh + 0.05 * AMAH; // the chamber floors' top
    for (const [id, x0, sx, zFoot, door] of [['beis_hamoked', 68.5, 1, -13.5, [82, -14, -18]], ['lishkas_hagazis', -68.5, -1, -97, [-77, -113, -108]]]) {
      const x = (d) => x0 + sx * d;
      near(floorAt(floors, ...xz(x(7.5), zFoot - 1), underFloor), cheil + 0.09 * AMAH, `${id} vestibule floor`);
      near(floorAt(floors, ...xz(x(6), zFoot + 0.25), underFloor), top - 15.5 * AMAH, `${id} flight A first tread`);
      near(floorAt(floors, ...xz(x(6), zFoot + 5.25), underFloor), top - 10.5 * AMAH, `${id} flight A top tread`);
      near(floorAt(floors, ...xz(x(4), zFoot + 6.5), underFloor), top - 10.5 * AMAH, `${id} landing L1`);
      near(floorAt(floors, ...xz(x(3.5), zFoot + 0.25), underFloor), top - 5 * AMAH, `${id} flight B top tread`);
      near(floorAt(floors, ...xz(x(1), zFoot - 1.5), underFloor), top - 5 * AMAH, `${id} landing L2`);
      near(floorAt(floors, ...xz(x(1), zFoot + 0.25), underFloor), top - 4.5 * AMAH, `${id} flight C first tread`);
      near(floorAt(floors, ...xz(x(1), zFoot + 4.75)), top, `${id} flight C top tread, level with the floor`);
      near(floorAt(floors, ...xz(x(1), zFoot + 6)), top, `${id} floor beyond the well`);
      // The parapet round the well: both sides and its -z end, 1.5 amos over the floor; the +z end open.
      for (const [dx, dz] of [[-0.25, 2.5], [2.25, 2.5], [1, -0.25]]) expect(floorAt(floors, ...xz(x(dx), zFoot + dz)) - koh, `${id} parapet ${dx},${dz}`).toBeCloseTo((0.05 + 0.05 + 1.5) * AMAH, 2);
      // Balustrades: the wall parting A from B beside A's fifth tread, and B from C beside B's fifth tread, an amah over the tread; none over the landings that join them.
      expect(solidAt(x(4.75), -10, zFoot + 2.5), `${id} wall A|B`).toBe(true);
      expect(solidAt(x(2.25), -4, zFoot + 3), `${id} wall B|C`).toBe(true);
      expect(solidAt(x(4.75), -8, zFoot + 6.5), `${id} L1 open to B`).toBe(false);
      expect(solidAt(x(2.25), -3, zFoot - 1), `${id} L2 open to C`).toBe(false);
      // The door to the Cheil: open at the Cheil level, wall beside it.
      const [dxw, dz1, dz2] = door;
      expect(solidAt(dxw, -12.5, dz1), `${id} door`).toBe(false);
      expect(solidAt(dxw, -12.5, dz2), `${id} wall beside the door`).toBe(true);
    }
    // The kodesh halves stand on solid bases; the walk up the Beis HaMoked stair (cast from under the hall floor, then from above for the well).
    expect(solidAt(60, -5, -14)).toBe(true);
    expect(solidAt(-62, -5, -103)).toBe(true);
    expect(solidAt(75, -5, -14)).toBe(false);
    expect(solidAt(-72, -5, -103)).toBe(false);
    const lower = walk([[80, -14], [74.5, -15], [74.5, -7], [72, -6.75], [72, -13], [72, -14.75], [69.5, -14.75], [69.5, -13], [69.5, -10]], 0.25, underFloor);
    near(lower.first, cheil + 0.09 * AMAH, 'vestibule');
    const upper = walk([[69.5, -10], [69.5, -7], [66, -7], [66, -14], [56, -14]]);
    near(upper.first, lower.last, 'seam of the two casts');
    near(upper.last, koh, 'the court');
    const gLower = walk([[-75, -113], [-75, -101], [-75, -90.25], [-72, -90.25], [-72, -96.5], [-72, -98.25], [-69.5, -98.25], [-69.5, -96.5], [-69.5, -93.5]], 0.25, underFloor);
    near(gLower.first, cheil + 0.09 * AMAH, 'gazis vestibule');
    near(walk([[-69.5, -93.5], [-69.5, -90.5], [-66, -90.5], [-66, -103], [-60, -103]]).last, koh + 0.05 * AMAH, 'the kodesh half, at its court door (the court west of z -54 is HeichalBuilder\'s)');
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

  /** Tadi: the opening's top (y 6.5), the ridge of the stones' undersides and of their tops, in world metres. */
  function tadiLevels() {
    const gate = byId.shaar_tadi;
    const top = gate.position.y + gate.geometry.h; // 6.5
    const rise = TADI_GABLE_RISE;
    const theta = Math.atan2(rise, gate.geometry.w / 2);
    const y = (a) => toWorld({ x: 0, y: a, z: 0 })[1];
    return { top: y(top), ridge: y(top + rise), ridgeTop: y(top + rise + TADI_STONE_T / Math.cos(theta)), wallTop: y(11.5), theta };
  }

  /** Every visible mesh of the mount's wall and Tadi (the groups tagged har_habayis wall / shaar_tadi). */
  function tadiMeshes() {
    const groups = built.scene.children.filter((o) => o.userData.entryId === 'shaar_tadi' || (o.userData.entryId === 'har_habayis' && o.userData.part === 'wall'));
    const meshes = [];
    for (const g of groups) g.traverse((o) => { if (o.isMesh) meshes.push(o); });
    return meshes;
  }

  /**
   * Every face a downward ray at content (x, z) crosses, from `fromY` metres, nearest
   * first. Undersides count too (the raycaster culls back faces for a FrontSide material,
   * so the materials are double-sided for the cast).
   */
  function hitsDown(meshes, x, z, fromY) {
    const [wx, wz] = xz(x, z);
    ray.set(new THREE.Vector3(wx, fromY, wz), down);
    ray.far = fromY + 100;
    const sides = meshes.map((m) => [m.material, m.material.side]);
    for (const m of meshes) m.material.side = THREE.DoubleSide;
    try {
      return ray.intersectObjects(meshes, false).map((h) => ({ y: h.point.y, name: h.object.name }));
    } finally {
      for (const [m, side] of sides) m.side = side;
    }
  }

  it("leaves Tadi's opening clear up to the two leaning stones, with no lintel (Middot 2:3)", () => {
    // In the wall's plane (x 200.5, the middle of the 6-thick north wall) at the gate's
    // centre and 3 amos to each side, the first thing under a ray from above the wall top
    // is a stone's top, and nothing spans the opening between its top and the underside
    // of the stones: the old box from y 6.5 to the wall top is gone.
    const L = tadiLevels();
    const meshes = tadiMeshes();
    const gate = byId.shaar_tadi;
    for (const dz of [0, -3, 3]) {
      const hits = hitsDown(meshes, 200.5, gate.position.z + dz, L.wallTop + 2);
      const stones = hits.filter((h) => /leaning stone/.test(h.name));
      const rest = hits.filter((h) => !/leaning stone/.test(h.name));
      expect(stones.length, `no stone over Tadi at dz ${dz}`).toBeGreaterThan(0);
      // Underside of the stones over this point (the inverted V) and their top, one slab up.
      const under = L.top + (L.ridge - L.top) * (1 - Math.abs(dz) / (gate.geometry.w / 2));
      const over = under + (L.ridgeTop - L.ridge);
      expect(Math.max(...stones.map((h) => h.y)), `stone top at dz ${dz}`).toBeCloseTo(over, 2);
      expect(Math.min(...stones.map((h) => h.y)), `stone underside at dz ${dz}`).toBeCloseTo(under, 2);
      // The wall's own faces (its top and the notch) all stay above the stones' undersides:
      // the notch is cut to the stones' tops, so the wall never reaches into the opening.
      const wallAbove = rest.filter((h) => h.y > L.top + 0.02); // below the opening lie its threshold and the wall's footing
      expect(Math.min(...wallAbove.map((h) => h.y)), `wall reaching under the stones at dz ${dz}`).toBeGreaterThan(over - 0.05);
      const inOpening = hits.filter((h) => h.y > L.top + 0.02 && h.y < under - 0.02);
      expect(inOpening, `mesh inside the gable void at dz ${dz}: ${JSON.stringify(inOpening)}`).toEqual([]);
      expect(rest.some((h) => Math.abs(h.y - L.top) < 0.02), `a lintel at the opening's top at dz ${dz}`).toBe(false);
    }
    // The wall over the gable is one non-colliding piece; the notch is not a collider either.
    const gableWall = meshes.filter((m) => m.name === 'gable wall');
    expect(gableWall).toHaveLength(1);
    expect(gableWall[0].userData.isWall).toBeUndefined();
    expect(built.walls).not.toContain(gableWall[0]);
  });

  it("builds Tadi's two stones proud of both faces, meeting at the ridge under the wall top", () => {
    const L = tadiLevels();
    const g = built.scene.children.find((o) => o.userData.entryId === 'shaar_tadi');
    const stones = [];
    g.traverse((o) => { if (o.isMesh && /leaning stone/.test(o.name)) stones.push(o); });
    expect(stones).toHaveLength(2);
    const [inner] = toWorld({ x: 197.5, y: 0, z: 0 });
    const [outer] = toWorld({ x: 203.5, y: 0, z: 0 });
    const [, , gz] = worldPos(byId.shaar_tadi);
    const boxes = stones.map((s) => new THREE.Box3().setFromObject(s));
    for (const box of boxes) {
      expect(box.min.x).toBeLessThan(inner - 0.2); // TADI_STONE_PROUD out of the inner face
      expect(box.max.x).toBeGreaterThan(outer + 0.2); // and of the outer face
      expect(box.max.y).toBeCloseTo(L.ridgeTop, 2); // both peak at the ridge of the tops
      expect(box.max.y).toBeLessThan(L.wallTop - 0.25 * AMAH); // >= half an amah under WALL_TOP
      expect(box.min.y).toBeGreaterThan(L.top - 0.02); // feet at the jamb tops
    }
    // One from each side, both overrunning the centre line so they overlap at the ridge.
    const [a, b] = boxes.sort((p, q) => p.min.z - q.min.z);
    expect(a.min.z).toBeLessThan(gz - 2);
    expect(b.max.z).toBeGreaterThan(gz + 2);
    expect(a.max.z).toBeGreaterThan(gz - 1e-3);
    expect(b.min.z).toBeLessThan(gz + 1e-3);
    // The tops meet at the ridge: from above the centre both stones are hit at the same height.
    const hits = hitsDown(stones, 200.5, byId.shaar_tadi.position.z, L.wallTop + 2).filter((h) => h.y > L.ridge);
    expect(new Set(hits.map((h) => h.name.length && h.y.toFixed(2))).size).toBe(1);
    expect(hits[0].y).toBeCloseTo(L.ridgeTop, 2);
    // And under the ridge the void is the opening: the undersides meet at `ridge`.
    const under = hitsDown(stones, 200.5, byId.shaar_tadi.position.z, L.ridge - 0.01);
    expect(under.filter((h) => h.y > L.top + 0.02)).toEqual([]);
  });

  it('drops the frame lintel over Tadi and keeps it on the other four gates of the mount', () => {
    const frames = Object.fromEntries(['shaar_tadi', 'shaar_shushan', 'shaar_kiponus', 'chuldah_gate_west', 'chuldah_gate_east'].map((id) => {
      const g = built.scene.children.find((o) => o.userData.entryId === id);
      let frame;
      g.traverse((o) => { if (o.isMesh && o.name === `${id} frame`) frame = o; });
      expect(frame, `${id} frame`).toBeTruthy();
      return [id, new THREE.Box3().setFromObject(frame)];
    }));
    const y = (a) => toWorld({ x: 0, y: a, z: 0 })[1];
    const tadi = byId.shaar_tadi;
    expect(frames.shaar_tadi.max.y).toBeCloseTo(y(tadi.position.y + tadi.geometry.h), 3); // jambs only
    for (const id of ['shaar_shushan', 'shaar_kiponus', 'chuldah_gate_west', 'chuldah_gate_east']) {
      const e = byId[id];
      expect(frames[id].max.y, id).toBeCloseTo(y(e.position.y + e.geometry.h + 1), 3); // + FRAME_T lintel
    }
  });

  it('walks the player through Tadi both ways at the mount level', () => {
    // The real controller over the court builders' floors and walls: from the threshold's
    // outer end (x 203, no ground plane outside the mount here) onto the plaza and back.
    const hb = levelWorldY('har_habayis');
    const H = CONFIG.PLAYER_HEIGHT;
    const camera = new THREE.PerspectiveCamera();
    const player = new PlayerController(camera, built.floors, built.walls, { bounds: { minX: -200, maxX: 200, minZ: -200, maxZ: 200 } });
    player.isLocked = true;
    const go = (from, to) => {
      const [sx, sz] = xz(...from);
      const [tx, tz] = xz(...to);
      camera.position.set(sx, hb + H, sz);
      player.verticalVelocity = 0;
      player.moveF = true;
      for (let f = 0; f < 60 * 20; f++) {
        const c = camera.position;
        camera.rotation.set(0, Math.atan2(-(tx - c.x), -(tz - c.z)), 0, 'YXZ');
        player.euler.setFromQuaternion(camera.quaternion, 'YXZ');
        player.update(1 / 60);
        expect(c.y - H, `feet at (${c.x.toFixed(2)}, ${c.z.toFixed(2)})`).toBeCloseTo(hb, 1);
        if (Math.hypot(tx - c.x, tz - c.z) < 0.5) return true;
      }
      return false;
    };
    const z = byId.shaar_tadi.position.z;
    expect(go([203, z], [188, z]), 'in through Tadi').toBe(true);
    expect(go([188, z], [203, z]), 'out through Tadi').toBe(true);
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
