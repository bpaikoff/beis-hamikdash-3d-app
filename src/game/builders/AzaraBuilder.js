import * as THREE from 'three';
import { CourtBuilder, GROUND, LIP, ROOM_WALL_T, SLAB, WALL_T } from './CourtBuilder.js';
import { instance } from '../instanced.js';
import { AMAH } from '../../content/units.js';

// ============================================================================
// AZARAH BUILDER - Ezras Yisrael, Duchan, Ezras Kohanim, the seven gates, the lishkos
// and the slaughtering area. Everything in amos in the azarah frame (temple.json).
// The building west of z -54 (Ulam steps, Ulam, Heichal), the altar, kevesh, small
// kevashim and kiyor belong to HeichalBuilder / KeilimBuilder.
// ============================================================================

/** Azarah interior half-width (Middot 5:1: 135 wide) and outer face of its 6-amah walls. */
const X_IN = 67.5;
const X_OUT = X_IN + WALL_T;
/** West wall inner face (Middot 5:1: 187 long). */
const Z_WEST = -187;
/** Court wall tops, amos above the Azarah floor (not given in Middot; the gates are 20 high). */
const WALL_TOP = 30;
const EAST_WALL_TOP = 25;
/** The altar's west face and the foot of the Ulam steps: our floor ends here, HeichalBuilder's begins. */
const STEPS_Z = -54;
/** A 1-amah rise is exactly CONFIG.STEP_HEIGHT; the Duchan platform sits 5 mm lower so the float compare never blocks the step. */
const NUDGE = 0.01;
/** The Duchan flight stops this far short of the south wall and of the Beis HaMoked's face (reconstruction). */
const DUCHAN_END = 12;
/** Beside the flight's ends, the steps down from the gate frontages to the Ezras Yisrael: five half-amah rises over three amos. */
const FRONTAGE_STEPS = 5;
const FRONTAGE_RUN = 3;
/** Jamb thickness of a gate frame (CourtBuilder.gateA), amos. */
const FRAME_T = 1;

export class AzaraBuilder extends CourtBuilder {
  build() {
    this.yYisrael = this.level('azaras_yisrael');
    this.yDuchan = this.level('duchan');
    this.yKohanim = this.level('azaras_kohanim');
    this.buildEzrasYisrael();
    this.buildDuchan();
    this.buildEzrasKohanim();
    this.buildEastWall();
    this.buildSouthWall();
    this.buildNorthWall();
    this.buildWestWall();
    this.buildBeisHamoked();
    this.buildLishkasHagazis();
    this.buildNorthernLishkos();
    this.buildSouthernLishkos();
    this.buildBeisAvtinas();
    this.buildSlaughterArea();
    this.buildTamidPen();
  }

  /** Beis HaMoked projects 15 amos into the court at x 52.5 .. 67.5, z -26 .. -2. */
  get hall() {
    const e = this.entry('beis_hamoked');
    const { w, d } = e.geometry;
    return { x1: e.position.x - w / 2, x2: e.position.x + w / 2, z1: e.position.z - d / 2, z2: e.position.z + d / 2 };
  }

  buildEzrasYisrael() {
    const a = this.entry('azaras_yisrael').bounds;
    const { x1: hx, z2: hz2 } = this.hall;
    this.group('azaras_yisrael', () => {
      this.floorA(a.minX, hx, a.minZ, a.maxZ, this.yYisrael, this.mat.floor, 'azaras_yisrael');
      this.floorA(hx, a.maxX, hz2, a.maxZ, this.yYisrael, this.mat.floor, 'azaras_yisrael');
    });
  }

  /**
   * One-amah step to the Duchan platform, then three half-amah steps to the Ezras
   * Kohanim (Middot 2:6). The flight stops 12 amos short of the south wall and of the
   * Beis HaMoked's face, so the Water Gate (z -21 .. -11) and the hall's gate
   * (z -19 .. -9), whose thresholds are at the Ezras Kohanim level, open onto flat
   * court: beside the flight the Kohanim floor runs east to each gateway's east edge,
   * and five half-amah steps drop from there to the Ezras Yisrael. Middot gives the
   * Duchan no width (the Tanna Kama has only beam-heads), so the ends are a reconstruction.
   */
  buildDuchan() {
    const e = this.entry('duchan');
    const a = this.entry('azaras_yisrael').bounds;
    const z0 = e.position.z + e.geometry.d / 2; // -11
    const z1 = e.position.z - e.geometry.d / 2; // -14
    const platformDepth = 1.5;
    const x1 = a.minX + DUCHAN_END; // -55.5
    const x2 = this.hall.x1 - DUCHAN_END; // 40.5
    this.group('duchan', () => {
      this.blockA(x1, x2, z0, z0 - platformDepth, this.yYisrael - SLAB, this.yDuchan - NUDGE, this.mat.marbleW, 'duchan');
      this.flightA({
        axis: 'z', span: [x1, x2], from: z0 - platformDepth, to: z1, yBase: this.yDuchan, bottom: this.yYisrael - SLAB,
        steps: 3, rise: (this.yKohanim - this.yDuchan) / 3, mat: this.mat.marbleW, name: 'duchan steps',
      });
    });
    // The gate frontages beside the flight's ends, level with the gateways, and their steps down.
    for (const [xa, xb, gate] of [[a.minX, x1, this.entry('water_gate')], [x2, this.hall.x1, this.entry('beis_hamoked_gate')]]) {
      const zFront = gate.position.z + gate.geometry.w / 2; // the gateway's east edge
      this.group('azaras_kohanim', () => {
        this.blockA(xa, xb, z1, zFront, this.yYisrael - SLAB, this.yKohanim, this.mat.stonePolished, `${gate.id} frontage`);
        this.flightA({
          axis: 'z', span: [xa, xb], from: zFront + FRONTAGE_RUN, to: zFront, yBase: this.yYisrael, bottom: this.yYisrael - SLAB,
          steps: FRONTAGE_STEPS, rise: (this.yKohanim - this.yYisrael) / FRONTAGE_STEPS, mat: this.mat.marbleW, name: `${gate.id} frontage steps`,
        });
      }, { part: `${gate.id} frontage` });
    }
  }

  /**
   * Ezras Kohanim floor: full width from the Duchan steps to the altar's west face at
   * z -54 (the altar, kevesh and kiyor stand on it). West of z -54 the floor is
   * HeichalBuilder.buildWestCourtFloor's (the strips beside the building, notched for
   * the Ulam steps, the Ulam and the Heichal, and the strip behind it to z -187); the
   * two meet edge to edge at z -54, both with their top at the Ezras Kohanim level.
   */
  buildEzrasKohanim() {
    const y = this.yKohanim;
    const { x1: hx, z1: hz1 } = this.hall;
    const zDuchanTop = this.entry('duchan').position.z - this.entry('duchan').geometry.d / 2; // -14
    const m = this.mat.stonePolished;
    this.group('azaras_kohanim', () => {
      this.floorA(-X_IN, hx, zDuchanTop, hz1, y, m, 'azaras_kohanim');
      this.floorA(-X_IN, X_IN, hz1, STEPS_Z, y, m, 'azaras_kohanim');
    });
  }

  /** Gate opening spec for a temple.json gate entry in a wall run along `along`. */
  gateOpening(id, along, extra = {}) {
    const e = this.entry(id);
    const { w, h } = e.geometry;
    return {
      at: along === 'x' ? e.position.x : e.position.z, w, h, floor: e.position.y, entry: id, name: id,
      frame: this.mat.stonePolished, doors: 'closed', doorMat: this.mat.goldEng, threshold: true, ...extra,
    };
  }

  /**
   * East wall (z 0 .. 6) with the Nicanor opening and the two side chambers built into
   * it (their furniture is EzrasNashimBuilder's), and the doors of the Lishkos Klei Shir
   * under the Ezras Yisrael floor, opening east.
   */
  buildEastWall() {
    const nic = this.entry('nicanor_gate');
    const klei = this.entry('lishkos_klei_shir');
    const openings = [{ at: 0, w: nic.geometry.w, h: nic.geometry.h, floor: this.yYisrael, cut: false }];
    for (const id of ['lishkas_pinchas_hamalbish', 'lishkas_osei_chavitin']) {
      const c = this.entry(id);
      openings.push({ at: c.position.x, w: c.geometry.w, h: c.geometry.h, floor: c.position.y });
    }
    // The Klei Shir doors lie wholly below the Ezras Yisrael floor, so the wall over them is
    // the court's east face at floor level and must collide (a plain lintel let the player
    // walk through the wall at x +-20 and drop 7.5 amos into the chamber).
    for (const s of [1, -1]) openings.push({ at: s * klei.position.x, w: 4, h: klei.geometry.h, floor: klei.position.y, frame: this.mat.cedar, name: 'lishkos_klei_shir', solidAbove: true });
    this.group('azaras_yisrael', () => {
      this.wallRunA({ along: 'x', across: [0, WALL_T], from: -X_OUT, to: X_OUT, y1: GROUND, y2: EAST_WALL_TOP, mat: this.mat.stone, openings });
    }, { part: 'east wall' });
  }

  /**
   * The Palhedrin's upper door opens into a bay of the Water Gate passage: an opening
   * through the wall at the court level just west of the gate's south reveal (Yoma 19a;
   * reconstruction), {@link buildSouthernLishkos}.
   */
  get palhedrinBay() {
    const wg = this.entry('water_gate');
    const z2 = wg.position.z - wg.geometry.w / 2; // -21, the gate's south edge
    return { z1: z2 - 4, z2, w: 3, h: 7 };
  }

  /** South wall: Mayim, Bechoros, Delek (Middot 1:4), Shaar HaElyon of the 13-gate count, Lishkas HaGazis and HaEtz straddling it. */
  buildSouthWall() {
    const gz = this.entry('lishkas_hagazis');
    const etz = this.entry('lishkas_haetz');
    const bay = this.palhedrinBay;
    this.group('azaras_kohanim', () => {
      this.wallRunA({
        along: 'z', across: [-X_OUT, -X_IN], from: WALL_T, to: Z_WEST - WALL_T, y1: GROUND, y2: WALL_TOP, mat: this.mat.stone,
        openings: [
          this.gateOpening('water_gate', 'z'),
          this.gateOpening('bechoros_gate', 'z'),
          this.gateOpening('delek_gate', 'z'),
          this.gateOpening('shaar_elyon', 'z'),
          { at: (bay.z1 + bay.z2) / 2, w: bay.z2 - bay.z1, h: bay.h, floor: this.yKohanim, threshold: true, entry: 'lishkas_palhedrin', name: 'lishkas_palhedrin passage' },
          { at: gz.position.z, w: gz.geometry.d, cut: true },
          { at: etz.position.z, w: etz.geometry.d, cut: true },
        ],
      });
    }, { part: 'south wall' });
  }

  /**
   * The Beis Avtinas stair tower stands east of the storey, against its east wall
   * (which it shares), up to the Shaar HaNashim's west jamb, in the storey's own x band
   * (6 amos into the court and the wall's thickness), {@link buildBeisAvtinas}.
   */
  get avtinasTower() {
    const e = this.entry('beis_avtinas');
    const nashim = this.entry('shaar_hanashim');
    return {
      x1: e.position.x - e.geometry.w / 2, x2: X_OUT,
      z1: e.position.z + e.geometry.d / 2 - ROOM_WALL_T, z2: nashim.position.z - nashim.geometry.w / 2 - FRAME_T,
    };
  }

  /** The Beis Avtinas storey's extents (it straddles the north wall over the Korban gate), {@link buildBeisAvtinas}. */
  get avtinasStorey() {
    const e = this.entry('beis_avtinas');
    const { w, d, h } = e.geometry;
    return { x1: e.position.x - w / 2, x2: e.position.x + w / 2, z1: e.position.z - d / 2, z2: e.position.z + d / 2, floor: e.position.y, h };
  }

  /**
   * North wall: Nitzotz (= Yechonya), Korban, Beis HaMoked (= HaShir) per Middot 1:5 / 2:6,
   * Shaar HaNashim, the hall and the Avtinas stair tower straddling it. The Avtinas storey
   * straddles the wall too, so its z range is cut from the run and the wall under its
   * floor is built separately with the Korban gate in it; above the floor the storey's
   * own walls carry the wall line. The storey's floor (y 24) leaves 1.5 amos between the
   * gate's top (22.5) and the underside of its slab (23.2), so the gate's frame keeps a
   * lintel there, capped at the slab (`frameTop`); at the earlier y 22.5 the cap fell
   * below the gate's top and the lintel was dropped.
   */
  buildNorthWall() {
    const { z1, z2 } = this.hall;
    const tower = this.avtinasTower;
    const storey = this.avtinasStorey;
    this.group('azaras_kohanim', () => {
      this.wallRunA({
        along: 'z', across: [X_IN, X_OUT], from: WALL_T, to: Z_WEST - WALL_T, y1: GROUND, y2: WALL_TOP, mat: this.mat.stone,
        openings: [
          this.gateOpening('nitzotz_gate', 'z', { labels: ['shaar_yechonya'] }),
          this.gateOpening('shaar_hanashim', 'z'),
          { at: (z1 + z2) / 2, w: z2 - z1, cut: true },
          { at: (tower.z1 + tower.z2) / 2, w: tower.z2 - tower.z1, cut: true },
          { at: (storey.z1 + storey.z2) / 2, w: storey.z2 - storey.z1, cut: true },
        ],
      });
      // Under the storey, up to the underside of its floor slab (the gate's lintel is
      // capped there too); the tower's own wall closes z -51 .. -50 (buildBeisAvtinas),
      // so the run stops at the tower.
      const under = storey.floor - SLAB;
      this.wallRunA({
        along: 'z', across: [X_IN, X_OUT], from: storey.z1, to: Math.min(tower.z1, storey.z2), y1: GROUND, y2: under, mat: this.mat.stone,
        openings: [this.gateOpening('korban_gate', 'z', { frameTop: under })],
      });
    }, { part: 'north wall' });
  }

  buildWestWall() {
    this.group('azaras_kohanim', () => {
      this.wallRunA({
        along: 'x', across: [Z_WEST - WALL_T, Z_WEST], from: -X_OUT, to: X_OUT, y1: GROUND, y2: WALL_TOP, mat: this.mat.stone,
        openings: [this.gateOpening('shaar_maaravi_north', 'x'), this.gateOpening('shaar_maaravi_south', 'x')],
      });
    }, { part: 'west wall' });
  }

  /**
   * Beis HaMoked: a domed hall straddling the north wall (Middot 1:6-8), its gate to the
   * Azarah at x 52.5 (threshold at the Ezras Kohanim level; the hall floor is at that
   * level too, y 2.5, and a flight down is built only if the content ever lowers it),
   * a closed gate to the Cheil, four corner chambers and stone ledges.
   */
  buildBeisHamoked() {
    const e = this.entry('beis_hamoked');
    const gate = this.entry('beis_hamoked_gate');
    const { x1, x2, z1, z2 } = this.hall;
    const floor = e.position.y;
    const h = 25; // temple.json gives 12, too low for the 20-amah gate (Middot 2:3); "large domed hall"
    const zc = gate.position.z;
    this.group('beis_hamoked', () => {
      this.roomA({
        x1, x2, z1, z2, floor, h, base: GROUND, floorMat: this.mat.floor, roofMat: this.mat.stone, name: 'beis_hamoked',
        doors: [
          { face: 's', at: zc, w: gate.geometry.w, h: gate.geometry.h, floor: this.yKohanim, entry: 'beis_hamoked_gate', labels: ['shaar_hashir'], frame: this.mat.stonePolished, doors: 'open', doorMat: this.mat.goldEng, threshold: true, name: 'beis_hamoked_gate' },
          { face: 'n', at: zc, w: gate.geometry.w, h: gate.geometry.h, floor: floor + LIP, frame: this.mat.stonePolished, doors: 'closed', doorMat: this.mat.goldEng, name: 'beis_hamoked north gate' },
        ],
      });
      // Down from the Azarah gate to the hall floor, when the hall lies below the court.
      if (this.yKohanim - floor - LIP > 0.01) {
        this.flightA({ axis: 'x', span: [zc - gate.geometry.w / 2, zc + gate.geometry.w / 2], from: x1 + 3.5, to: x1 + 1, yBase: floor + LIP, steps: 5, rise: (this.yKohanim - floor - LIP) / 5, mat: this.mat.marbleW, name: 'beis_hamoked steps' });
      }
      // The court wall continues above the hall.
      this.decoA(X_IN, X_OUT, z1, z2, floor + h + 1, WALL_TOP, this.mat.stone);
      // Dome.
      const r = (z2 - z1) / 2;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(r * AMAH, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.mat.stone);
      dome.position.set(...this.pt((x1 + x2) / 2, floor + h + 1, (z1 + z2) / 2));
      dome.castShadow = true;
      this.scene.add(dome);
      // Stone ledges to sleep on (Middot 1:8), along the east and west inner faces between the corner chambers.
      for (const [za, zb] of [[z2 - 2, z2 - 1], [z1 + 1, z1 + 2]]) this.blockA(x1 + 10, x2 - 10, za, zb, floor + 2 * LIP, floor + LIP + 1, this.mat.stonePolished, 'beis_hamoked ledge');
      // Four 8 x 8 corner chambers (Middot 1:6), doors toward the middle of the hall.
      for (const c of e.children ?? []) {
        const s = 4;
        const cx = c.position.x;
        const cz = c.position.z;
        const toward = cx < (x1 + x2) / 2 ? 'n' : 's';
        this.group(c.id, () => {
          this.roomA({ x1: cx - s, x2: cx + s, z1: cz - s, z2: cz + s, floor: floor + LIP, h: 8, name: c.id, doors: [{ face: toward, at: cz, w: 3, h: 6, frame: this.mat.cedar }] });
        }, { period: e.period });
      }
    });
  }

  /** Lishkas HaGazis straddles the south wall (Yoma 25a), half in the kodesh and half in the chol. */
  buildLishkasHagazis() {
    const e = this.entry('lishkas_hagazis');
    const { w, d, h } = e.geometry;
    const x1 = e.position.x - w / 2;
    const x2 = e.position.x + w / 2;
    const z1 = e.position.z - d / 2;
    const z2 = e.position.z + d / 2;
    this.group('lishkas_hagazis', () => {
      this.roomA({
        x1, x2, z1, z2, floor: e.position.y, h, base: GROUND, floorMat: this.mat.marbleW, wallMat: this.mat.stonePolished, name: 'lishkas_hagazis',
        doors: [
          { face: 'n', at: e.position.z, w: 5, h: 8, frame: this.mat.cedar, doors: 'open', doorMat: this.mat.cedar },
          { face: 's', at: e.position.z - 7, w: 4, h: 7, frame: this.mat.cedar, doors: 'closed', doorMat: this.mat.cedar }, // to the Cheil, 16 amos below (no steps in the sources): kept closed
          { face: 'w', at: this.etzDoorX, w: 3, h: 7, frame: this.mat.cedar }, // into Lishkas HaEtz behind (Abba Shaul)
        ],
      });
      // Seats of the Sanhedrin in a half-circle facing east (Sanhedrin 4:3): three tiers of benches.
      for (let t = 0; t < 3; t++) this.decoA(x1 + 2 + t * 1.5, x1 + 3 + t * 1.5, z1 + 3 + t, z2 - 3 - t, e.position.y + LIP + t * 0.5, e.position.y + LIP + t * 0.5 + 0.6, this.mat.cedar);
      // The court wall continues above the chamber.
      this.decoA(-X_OUT, -X_IN, z1, z2, e.position.y + h + 1, WALL_TOP, this.mat.stone);
    });
  }

  /**
   * Madichin, Parvah and Melach against the north wall (Middot 5:3). The Parvah's roof
   * carries the Kohen Gadol's mikveh, reached by a stair inside the Madichin; the three
   * roofs form one walkable terrace with a parapet. Each room's width is its own
   * (the Madichin is 15, the others 16), so the court-edge parapet follows each roof's
   * edge with a return where the edge steps.
   */
  buildNorthernLishkos() {
    const ids = ['lishkas_hamadichin', 'lishkas_haparvah', 'lishkas_hamelach'];
    const rooms = ids.map((id) => {
      const e = this.entry(id);
      const { w, d, h } = e.geometry;
      return { id, e, h, x1: X_IN - w, x2: X_IN, z1: e.position.z - d / 2, z2: e.position.z + d / 2, floor: e.position.y };
    });
    const [mad, par, mel] = rooms;
    const roofY = mad.floor + mad.h + 1;
    // Stair well along the court wall (the room's north side), so the door in the south
    // face opens onto clear floor and not onto the side of the flight; the stair climbs
    // westward from the well's east end.
    const wellX = [mad.x2 - 6, mad.x2 - 1];
    const wellZ = [mad.z2 - 1.5, mad.z1 + 1];
    for (const r of rooms) {
      const first = r === mad;
      this.group(r.id, () => {
        this.roomA({
          x1: r.x1, x2: r.x2, z1: r.z1, z2: r.z2, floor: r.floor, h: r.h, floorMat: this.mat.marbleW, wallMat: this.mat.stonePolished, name: r.id,
          skip: first ? ['n'] : ['n', 'e'], roof: first ? false : 'walk', roofMat: this.mat.stone,
          doors: [{ face: 's', at: r.e.position.z, w: 4, h: 7, frame: this.mat.cedar }],
        });
      });
    }
    this.group('lishkas_hamadichin', () => {
      // Roof in four slabs around the stair well.
      this.floorA(mad.x1, wellX[0], mad.z1, mad.z2, roofY, this.mat.stone, 'lishkas_hamadichin roof');
      this.floorA(wellX[1], mad.x2, mad.z1, mad.z2, roofY, this.mat.stone, 'lishkas_hamadichin roof');
      this.floorA(wellX[0], wellX[1], wellZ[0], mad.z2, roofY, this.mat.stone, 'lishkas_hamadichin roof');
      this.floorA(wellX[0], wellX[1], mad.z1, wellZ[1], roofY, this.mat.stone, 'lishkas_hamadichin roof');
      this.flightA({ axis: 'z', span: wellX, from: wellZ[0], to: wellZ[1], yBase: mad.floor, steps: 22, rise: (roofY - mad.floor) / 22, mat: this.mat.stonePolished, name: 'lishkas_hamadichin stair' });
      // Parapet around the terrace (court edge, east and west ends): 1.5 amos, a solid
      // mass so it actually stops the player (a wall this low is below the head-height
      // test), standing a LIP above the roof like every mass on a floor (see solidA).
      // The court edge runs along each roof's own edge; where a wider roof follows a
      // narrower one, a return across the step (on the wider roof) closes the corner.
      const pY = roofY + LIP;
      const pH = 1.5;
      for (const r of rooms) this.blockA(r.x1, r.x1 + 0.5, r.z1, r.z2, pY, pY + pH, this.mat.stone, 'terrace parapet');
      for (let i = 1; i < rooms.length; i++) {
        const [a, b] = [rooms[i - 1], rooms[i]];
        if (Math.abs(a.x1 - b.x1) < 1e-6) continue;
        const wide = a.x1 < b.x1 ? a : b;
        const zc = a.z1; // the seam between the two roofs (a.z1 === b.z2)
        const [za, zb] = wide === a ? [zc, zc + 0.5] : [zc - 0.5, zc];
        this.blockA(Math.min(a.x1, b.x1), Math.max(a.x1, b.x1) + 0.5, za, zb, pY, pY + pH, this.mat.stone, 'terrace parapet');
      }
      this.blockA(mad.x1, mad.x2, mad.z2 - 0.5, mad.z2, pY, pY + pH, this.mat.stone, 'terrace parapet');
      this.blockA(mel.x1, mel.x2, mel.z1, mel.z1 + 0.5, pY, pY + pH, this.mat.stone, 'terrace parapet');
      // Round the stair well too (its court side, its east end and the amah between it and
      // the court wall), open only at the flight's top end: without it a step sideways off
      // the terrace dropped 11 amos onto the flight.
      this.blockA(wellX[0] - 0.5, wellX[0], wellZ[1], wellZ[0] + 0.5, pY, pY + pH, this.mat.stone, 'well parapet');
      this.blockA(wellX[1], mad.x2, wellZ[1], wellZ[0] + 0.5, pY, pY + pH, this.mat.stone, 'well parapet');
      this.blockA(wellX[0] - 0.5, mad.x2, wellZ[0], wellZ[0] + 0.5, pY, pY + pH, this.mat.stone, 'well parapet');
    }, { part: 'roof' });
    this.group('lishkas_haparvah', () => {
      // The mikveh on the roof (Middot 5:3, Yoma 3:3): a 4 x 4 tank rising 2 above the terrace (solid rim).
      const cx = (par.x1 + par.x2) / 2;
      const cz = (par.z1 + par.z2) / 2;
      const s = 2;
      const rim = this.mat.stonePolished;
      const rY = roofY + LIP;
      this.blockA(cx - s, cx - s + 0.5, cz - s, cz + s, rY, rY + 2, rim, 'mikveh rim');
      this.blockA(cx + s - 0.5, cx + s, cz - s, cz + s, rY, rY + 2, rim, 'mikveh rim');
      this.blockA(cx - s, cx + s, cz - s, cz - s + 0.5, rY, rY + 2, rim, 'mikveh rim');
      this.blockA(cx - s, cx + s, cz + s - 0.5, cz + s, rY, rY + 2, rim, 'mikveh rim');
      this.decoA(cx - s + 0.5, cx + s - 0.5, cz - s + 0.5, cz + s - 0.5, roofY + 1.5, roofY + 1.6, this.mat.water);
    }, { part: 'mikveh' });
  }

  /** Golah inside the south wall (Middot 5:4); Etz behind it and the Gazis (Abba Shaul); Palhedrin in the Cheil beside the Water Gate (Yoma 19a). */
  buildSouthernLishkos() {
    const golah = this.entry('lishkas_hagolah');
    {
      const { w, d, h } = golah.geometry;
      const x1 = -X_IN;
      const x2 = -X_IN + w;
      const z1 = golah.position.z - d / 2;
      const z2 = golah.position.z + d / 2;
      this.group('lishkas_hagolah', () => {
        this.roomA({ x1, x2, z1, z2, floor: golah.position.y, h, floorMat: this.mat.marbleW, wallMat: this.mat.stonePolished, skip: ['s'], name: 'lishkas_hagolah', doors: [{ face: 'n', at: golah.position.z, w: 4, h: 7, frame: this.mat.cedar }] });
        // Cistern mouth and wheel (Middot 5:4).
        const cx = (x1 + x2) / 2;
        const cz = (z1 + z2) / 2;
        const y = golah.position.y + LIP;
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.2 * AMAH, 1.4 * AMAH, 0.8 * AMAH, 20), this.mat.stonePolished);
        ring.position.set(...this.pt(cx, y + 0.4, cz));
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(1.5 * AMAH, 0.12 * AMAH, 8, 24), this.mat.cedar);
        wheel.position.set(...this.pt(cx, y + 2.2, cz - 1.8));
        for (const m of [ring, wheel]) {
          m.castShadow = true;
          this.scene.add(m);
        }
      });
    }
    // Lishkas HaEtz, the next room west of the Gazis in the band of its chol half and
    // the Cheil (x -67.5 .. -83.5), behind the Golah (Middot 5:4, Abba Shaul), entered
    // from the Gazis' chol half through a door in its east wall; the court wall goes on
    // above it as over the Gazis.
    const etz = this.entry('lishkas_haetz');
    {
      const { w, d, h } = etz.geometry;
      const x1 = etz.position.x - w / 2;
      const x2 = etz.position.x + w / 2;
      const z1 = etz.position.z - d / 2;
      const z2 = etz.position.z + d / 2;
      this.group('lishkas_haetz', () => {
        this.roomA({
          x1, x2, z1, z2, floor: etz.position.y, h, base: GROUND, floorMat: this.mat.floor, wallMat: this.mat.stonePolished, name: 'lishkas_haetz',
          doors: [{ face: 'e', at: this.etzDoorX, w: 3, h: 7, frame: this.mat.cedar }],
        });
        this.decoA(-X_OUT, -X_IN, z1, z2, etz.position.y + h + 1, WALL_TOP, this.mat.stone);
      });
    }
    // Lishkas Palhedrin, in the Cheil beside the Water Gate with its floor at the Cheil
    // level and its door to the Cheil (east). Inside, two flights of sixteen half-amah
    // steps (the Cheil steps' profile) climb the 16 amos to a landing at the court level,
    // whose door opens through the wall into a bay of the Water Gate passage (Yoma 19a;
    // reconstruction), so the chamber connects the Cheil to the court.
    const pal = this.entry('lishkas_palhedrin');
    {
      const { w, d, h } = pal.geometry;
      const x1 = pal.position.x - w / 2; // -83.5
      const x2 = pal.position.x + w / 2; // -73.5
      const z1 = pal.position.z - d / 2; // -37
      const z2 = pal.position.z + d / 2; // -21
      const floor = pal.position.y; // the Cheil level: the Cheil pavement is its floor
      const bay = this.palhedrinBay;
      const top = this.yKohanim;
      const steps = 16;
      const rise = (top - floor) / (2 * steps); // 0.5
      const run = steps * rise; // 8: half-amah treads
      const t = 1; // ROOM_WALL_T
      const bottom = floor - SLAB;
      this.group('lishkas_palhedrin', () => {
        this.roomA({
          x1, x2, z1, z2, floor, h, base: GROUND, wallMat: this.mat.stonePolished, name: 'lishkas_palhedrin',
          doors: [
            { face: 'e', at: pal.position.x, w: 4, h: 7, frame: this.mat.cedar },
            { face: 'n', at: (bay.z1 + bay.z2) / 2, w: bay.w, h: bay.h - 1, floor: top, frame: this.mat.cedar, threshold: true, name: 'lishkas_palhedrin upper door' },
          ],
        });
        // Lower flight along the south side, west from the entrance strip; landing across the west end; upper flight back east along the north side.
        const zFoot = z2 - t - 3; // -25: a 3-amah strip inside the Cheil door
        const zTurn = zFoot - run; // -33
        this.flightA({ axis: 'z', span: [x1 + t, x1 + t + 3], from: zFoot, to: zTurn, yBase: floor, bottom, steps, rise, mat: this.mat.stonePolished, name: 'lishkas_palhedrin stair' });
        this.blockA(x1 + t, x2 - t, zTurn, z1 + t, bottom, floor + run, this.mat.stonePolished, 'lishkas_palhedrin landing');
        this.flightA({ axis: 'z', span: [x2 - t - 3, x2 - t], from: zTurn, to: zFoot, yBase: floor + run, bottom, steps, rise, mat: this.mat.stonePolished, name: 'lishkas_palhedrin stair' });
        this.blockA(x2 - t - 3, x2 - t, zFoot, z2 - t, bottom, top, this.mat.stonePolished, 'lishkas_palhedrin landing');
      });
    }
  }

  /** x of the door between the Gazis' chol half and Lishkas HaEtz: the middle of the wall's thickness. */
  get etzDoorX() {
    return -(X_IN + X_OUT) / 2;
  }

  /**
   * Beis Avtinas: an upper storey over a court gate on whichever wall the content puts it
   * (north, over Shaar HaKorban, per Yoma 19a), reached by a stair tower beside the
   * gate's east jamb in the storey's own x band: four flights of half-amah steps round
   * the tower's walls (the storey's floor is 21.5 amos over the court: the 20-amah gate,
   * its lintel and the floor slab, so 43 steps in flights of 11, 11, 11 and 10), a door
   * from the court in its east face and a door into the storey at the top. The Kohen Gadol's first immersion
   * was on the roof of the Water Gate beside Palhedrin (Yoma 31a), so the mikveh sits on
   * the south wall top over that gate.
   */
  buildBeisAvtinas() {
    const e = this.entry('beis_avtinas');
    const { w, d, h } = e.geometry;
    const x1 = e.position.x - w / 2;
    const x2 = e.position.x + w / 2;
    const z1 = e.position.z - d / 2;
    const z2 = e.position.z + d / 2;
    const floor = e.position.y;
    const side = Math.sign(e.position.x); // +1 north wall, -1 south wall
    const [inner, edge] = side > 0 ? [x1, X_IN] : [-X_IN, x2]; // the part overhanging the court
    const tower = this.avtinasTower;
    const t = ROOM_WALL_T;
    const doorX = tower.x1 + t + 1.25; // the door is in the tower's first x band, x 62.5 .. 65
    const doorW = 2.5;
    this.group('beis_avtinas', () => {
      this.roomA({
        x1, x2, z1, z2, floor, h, floorMat: this.mat.floor, wallMat: this.mat.stonePolished, roof: 'walk', roofMat: this.mat.stone, name: 'beis_avtinas',
        doors: [{ face: 'e', at: doorX, w: doorW, h: 6, frame: this.mat.cedar }],
      });
      // Corbels under the part that overhangs the court, clear of the tower.
      for (const z of [z1 + 1, (z1 + z2) / 2, z2 - 1].filter((zc) => zc + 0.5 <= tower.z1)) this.decoA(inner, edge, z - 0.5, z + 0.5, floor - SLAB - 1.5, floor - SLAB, this.mat.stone);
    });
    // The stair tower: from the court floor to the storey, walls to the storey's roof. Its
    // west face is the storey's east wall (with the door at the top); below the storey a
    // plain wall closes that side.
    this.group('beis_avtinas', () => {
      const yCourt = this.yKohanim;
      const bottom = yCourt - SLAB;
      this.roomA({
        x1: tower.x1, x2: tower.x2, z1: tower.z1, z2: tower.z2, floor: yCourt, h: floor + h - yCourt, base: GROUND, floorMat: this.mat.floor, wallMat: this.mat.stone, name: 'beis_avtinas stair', skip: ['w'],
        doors: [{ face: 'e', at: doorX, w: doorW, h: 7, frame: this.mat.cedar, name: 'beis_avtinas stair door' }],
      });
      this.wallA(tower.x1, tower.x2, tower.z1, tower.z1 + t, GROUND, floor - SLAB, this.mat.stone);
      // Four flights along x in four z bands, landings at alternate ends, all solid to the court floor.
      const ix1 = tower.x1 + t;
      const ix2 = tower.x2 - t;
      const iz1 = tower.z1 + t;
      const iz2 = tower.z2 - t;
      const landing = 2.5;
      const band = (iz2 - iz1) / 4;
      // Half-amah risers throughout (the Cheil steps' profile): the last flight is a step
      // short, so the 43 steps close exactly on the storey's floor.
      const rise = 0.5;
      const total = Math.round((floor - yCourt) / rise); // 43
      const flights = [0, 1, 2, 3].map((k) => Math.ceil((total - k) / 4)); // 11, 11, 11, 10
      const from = ix1 + landing;
      const to = ix2 - landing;
      let y = yCourt + LIP;
      for (let k = 0; k < 4; k++) {
        const steps = flights[k];
        const za = iz2 - k * band;
        const zb = za - band;
        const up = k % 2 === 0; // even flights climb north (+x), odd ones back south
        this.flightA({ axis: 'x', span: [zb, za], from: up ? from : to, to: up ? to : from, yBase: y, bottom, steps, rise, mat: this.mat.stonePolished, name: 'beis_avtinas stair' });
        y += steps * rise;
        // Landing at the flight's top end, shared with the next flight's foot.
        const zc = k < 3 ? zb - band : zb;
        if (up) this.blockA(to, ix2, zc, za, bottom, y, this.mat.stonePolished, 'beis_avtinas landing');
        else this.blockA(ix1, from, zc, za, bottom, y, this.mat.stonePolished, 'beis_avtinas landing');
      }
      // A thin wall between each pair of flights, stopping an amah short of the landing
      // that joins them, so a walker on an upper flight cannot step off its side onto a
      // lower one (a 2 to 10-amah drop inside the tower).
      const bt = 0.25;
      for (let k = 1; k < 4; k++) {
        const zc = iz2 - k * band;
        const [xa, xb] = (k - 1) % 2 === 0 ? [ix1, to - 1] : [from + 1, ix2];
        this.wallA(xa, xb, zc - bt / 2, zc + bt / 2, yCourt, floor + h, this.mat.stonePolished);
      }
    }, { part: 'stair' });
    // Mikveh on the south wall top over the Water Gate (Yoma 31a).
    const wg = this.entry('water_gate');
    this.group('azaras_kohanim', () => {
      const ry = WALL_TOP;
      const cx = -(X_IN + X_OUT) / 2;
      const cz = wg.position.z;
      this.decoA(cx - 2, cx + 2, cz - 2, cz + 2, ry, ry + 1.5, this.mat.stonePolished);
      this.decoA(cx - 1.6, cx + 1.6, cz - 1.6, cz + 1.6, ry + 1.5, ry + 1.6, this.mat.water);
    }, { part: 'water gate roof' });
  }

  /**
   * North of the altar (Middot 3:5, 5:2): 24 rings set in the floor (x 24 .. 48, z -26 ..
   * -50, with the altar), eight marble tables at x 52 and eight short pillars at x 58
   * with cedar beams and three rows of hooks. The tables' column and the pillars' row
   * are as long as the ring area but centred on their own `position.z` (-39: an amah
   * further west than the rings, so their north ends stand clear of Beis HaMoked's
   * corner at z -26).
   */
  buildSlaughterArea() {
    const y = this.yKohanim;
    const tables = this.entry('slaughter_tables');
    const rings = this.entry('slaughter_rings');
    const pillars = this.entry('hanging_pillars');
    const half = rings.geometry.d / 2; // 12
    const z1 = rings.position.z + half; // -26
    const z2 = rings.position.z - half; // -50

    this.group('slaughter_tables', () => {
      const { w, d, h } = tables.geometry;
      const n = 8;
      const pitch = (2 * half) / n; // 3
      const tz1 = tables.position.z + half; // -27: the column's east end
      const positions = [];
      for (let i = 0; i < n; i++) positions.push({ position: this.pt(tables.position.x, y + h / 2, tz1 - pitch * (i + 0.5)) });
      const mesh = instance(this.box(w * AMAH, h * AMAH, d * AMAH, this.mat.marbleW), this.mat.marbleW, positions, { name: 'slaughter_tables' });
      this.scene.add(mesh);
      // One solid per table (a row-long collider sealed the amah between the tables), and
      // as a mass rather than a wall: a 1.5-amah table is below the head-height wall test.
      for (let i = 0; i < n; i++) {
        const zc = tz1 - pitch * (i + 0.5);
        this.solidA(tables.position.x - w / 2, tables.position.x + w / 2, zc + d / 2, zc - d / 2, y, y + h, 'slaughter_tables');
      }
    });

    this.group('slaughter_rings', () => {
      const rx1 = rings.position.x - rings.geometry.w / 2; // 24
      const cols = 6;
      const rows = 4;
      const geo = new THREE.TorusGeometry(0.5 * AMAH, 0.05 * AMAH, 8, 24);
      const items = [];
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = rx1 + (i + 0.5) * (rings.geometry.w / cols);
          const z = z1 - (j + 0.5) * ((z1 - z2) / rows);
          items.push({ position: this.pt(x, y + 0.03, z), rotation: [Math.PI / 2, 0, 0] });
        }
      }
      this.scene.add(instance(geo, this.mat.copper, items, { name: 'slaughter_rings', castShadow: false }));
    });

    this.group('hanging_pillars', () => {
      const { w, h } = pillars.geometry;
      const n = 8;
      const gap = 3;
      const zs = [];
      const pz1 = pillars.position.z + half - 1; // -28: the first pillar, an amah in from the row's east end
      for (let i = 0; i < n; i++) zs.push(pz1 - i * gap); // -28 .. -49
      const px = pillars.position.x;
      const shafts = zs.map((z) => ({ position: this.pt(px, y + h / 2, z) }));
      this.scene.add(instance(this.box(w * AMAH, h * AMAH, w * AMAH, this.mat.stone), this.mat.stone, shafts, { name: 'hanging_pillars' }));
      const caps = zs.map((z) => ({ position: this.pt(px, y + h + 0.25, z) }));
      this.scene.add(instance(this.box(1.5 * AMAH, 0.5 * AMAH, 1.5 * AMAH, this.mat.cedar), this.mat.cedar, caps, { name: 'hanging_pillars caps' }));
      // Cedar beam joining the caps, and three rows of iron hooks on each side of every pillar.
      this.decoA(px - 0.25, px + 0.25, zs[0] + 1, zs[n - 1] - 1, y + h + 0.5, y + h + 1, this.mat.cedar);
      const hooks = [];
      for (const z of zs) {
        for (let r = 0; r < 3; r++) {
          for (const s of [-1, 1]) hooks.push({ position: this.pt(px + s * 0.75, y + h - 0.5 - r * 0.8, z), rotation: [0, 0, s * 0.4] });
        }
      }
      this.scene.add(instance(new THREE.BoxGeometry(0.6 * AMAH, 0.08 * AMAH, 0.08 * AMAH), this.mat.copperP, hooks, { name: 'hanging_pillars hooks', castShadow: false }));
      // One solid per pillar so the two amos between them stay open.
      for (const z of zs) this.solidA(px - w / 2, px + w / 2, z + w / 2, z - w / 2, y, y + h, 'hanging_pillars');
    });
  }

  /** The Tamid lamb waits in a small cedar pen by the second ring (Tamid 4:1). */
  buildTamidPen() {
    const e = this.entry('tamid_lamb');
    const y = this.yKohanim;
    const { x, z } = e.position;
    const s = 1.5;
    this.group('tamid_lamb', () => {
      const rail = (x1, x2, z1, z2) => {
        for (const ry of [0.4, 0.9]) this.decoA(x1, x2, z1, z2, y + ry, y + ry + 0.12, this.mat.cedar);
      };
      rail(x - s, x + s, z - s, z - s + 0.15);
      rail(x - s, x + s, z + s - 0.15, z + s);
      rail(x - s, x - s + 0.15, z - s, z + s);
      rail(x + s - 0.15, x + s, z - s, z + s);
      for (const [px, pz] of [[x - s, z - s], [x - s, z + s], [x + s, z - s], [x + s, z + s]]) this.decoA(px - 0.1, px + 0.1, pz - 0.1, pz + 0.1, y, y + 1.1, this.mat.cedar);
      // The lamb: a woolly body and a head.
      this.decoA(x - 0.35, x + 0.35, z - 0.6, z + 0.6, y + 0.45, y + 1.05, this.mat.marbleW);
      this.decoA(x - 0.2, x + 0.2, z - 0.95, z - 0.55, y + 0.85, y + 1.2, this.mat.marbleW);
      for (const [lx, lz] of [[-0.2, -0.4], [0.2, -0.4], [-0.2, 0.4], [0.2, 0.4]]) this.decoA(x + lx - 0.06, x + lx + 0.06, z + lz - 0.06, z + lz + 0.06, y, y + 0.45, this.mat.stone);
    });
  }
}
