import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CHEIL_LIP, CourtBuilder, GROUND, LIP, ROOM_WALL_T, SLAB, STEP_RISE, WALL_T } from './CourtBuilder.js';
import { instance } from '../instanced.js';
import { AMAH } from '../../content/units.js';
import { entries } from '../../content/index.js';

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
/** Length of the Beis Avtinas stair tower along the wall (amos), {@link AzaraBuilder#avtinasTower}. */
const AVTINAS_TOWER_LEN = 9;
/** The kodesh / chol line through a chamber that straddles a court wall (Yoma 25a): an inlaid strip in its floor, amos wide and high. */
const LINE_W = 0.3;
const LINE_H = 0.03;

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
    this.buildLishkasPalhedrin();
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
   * Lishkas Palhedrin's upper door opens through a 3-amah bay in the north wall beside
   * Shaar HaKorban's west jamb at the court level, like the Nitzotz bay (round 7;
   * reconstruction), {@link buildLishkasPalhedrin}. Until round 6 the chamber stood in
   * the south Cheil and its bay opened off the Water Gate passage; that bay is closed.
   */
  get palhedrinBay() {
    const g = this.entry('korban_gate');
    const z2 = g.position.z - g.geometry.w / 2 - FRAME_T; // -64: west of the gate's west jamb
    return { z1: z2 - 3, z2, h: 7 };
  }

  /**
   * The cuts a court wall needs for the Beis Avtinas storey and its stair tower when the
   * storey stands on that wall (`side` +1 north, -1 south; null otherwise), and the run
   * under the storey's floor slab that carries the gate below it, {@link buildBeisAvtinas}.
   * The storey's floor (y 24) leaves 1.5 amos between the gate's top (22.5) and the
   * underside of its slab (23.2), so the gate's frame keeps a lintel there, capped at the
   * slab (`frameTop`); at the earlier y 22.5 the cap fell below the gate's top and the
   * lintel was dropped. The tower's own wall closes the storey's wall line on the tower's
   * side down to the ground, so the run stops at the tower.
   */
  avtinasWall(side) {
    const e = this.entry('beis_avtinas');
    if (Math.sign(e.position.x) !== side) return null;
    const storey = this.avtinasStorey;
    const tower = this.avtinasTower;
    const gate = entries.find((g) => g.geometry?.kind === 'gate' && g.position.x === side * X_IN && g.position.z > storey.z1 && g.position.z < storey.z2);
    if (!gate) throw new Error(`no gate under the Beis Avtinas storey at z ${storey.z1} .. ${storey.z2}`);
    const under = storey.floor - SLAB;
    return {
      cuts: [
        { at: (tower.z1 + tower.z2) / 2, w: tower.z2 - tower.z1, cut: true },
        { at: (storey.z1 + storey.z2) / 2, w: storey.z2 - storey.z1, cut: true },
      ],
      under: {
        from: tower.z1 < storey.z1 ? tower.z2 : storey.z1,
        to: tower.z2 > storey.z2 ? tower.z1 : storey.z2,
        y2: under,
        openings: [this.gateOpening(gate.id, 'z', { frameTop: under })],
      },
    };
  }

  /**
   * South wall: Mayim, Bechoros, Delek (Middot 1:4), Shaar HaElyon of the 13-gate count,
   * Lishkas HaGazis and HaEtz straddling it, and since round 7 the Beis Avtinas storey
   * over the Water Gate with its stair tower ({@link avtinasWall}).
   */
  buildSouthWall() {
    const gz = this.entry('lishkas_hagazis');
    const etz = this.entry('lishkas_haetz');
    const av = this.avtinasWall(-1);
    this.group('azaras_kohanim', () => {
      this.wallRunA({
        along: 'z', across: [-X_OUT, -X_IN], from: WALL_T, to: Z_WEST - WALL_T, y1: GROUND, y2: WALL_TOP, mat: this.mat.stone,
        openings: [
          ...(av ? av.cuts : [this.gateOpening('water_gate', 'z')]),
          this.gateOpening('bechoros_gate', 'z'),
          this.gateOpening('delek_gate', 'z'),
          this.gateOpening('shaar_elyon', 'z'),
          { at: gz.position.z, w: gz.geometry.d, cut: true },
          { at: etz.position.z, w: etz.geometry.d, cut: true },
        ],
      });
      if (av) this.wallRunA({ along: 'z', across: [-X_OUT, -X_IN], from: av.under.from, to: av.under.to, y1: GROUND, y2: av.under.y2, mat: this.mat.stone, openings: av.under.openings });
    }, { part: 'south wall' });
  }

  /**
   * The Beis Avtinas stair tower stands beside the storey against the storey's wall
   * (which it shares), in the storey's own x band (6 amos into the court and the wall's
   * thickness): on the north wall east of the storey up to Shaar HaNashim's west jamb
   * (rounds A to 6, over Shaar HaKorban); on the south wall (round 7, over Shaar HaMayim)
   * west of it, AVTINAS_TOWER_LEN long, beside the gate's west jamb, {@link buildBeisAvtinas}.
   * `side` is +1 on the north wall and -1 on the south.
   */
  get avtinasTower() {
    const e = this.entry('beis_avtinas');
    const storey = this.avtinasStorey;
    const side = Math.sign(e.position.x);
    if (side > 0) {
      const nashim = this.entry('shaar_hanashim');
      return { x1: storey.x1, x2: X_OUT, z1: storey.z2 - ROOM_WALL_T, z2: nashim.position.z - nashim.geometry.w / 2 - FRAME_T, side };
    }
    const z2 = storey.z1 + ROOM_WALL_T;
    return { x1: -X_OUT, x2: storey.x2, z1: z2 - AVTINAS_TOWER_LEN, z2, side };
  }

  /** The Beis Avtinas storey's extents (it straddles a court wall over a gate: the Water Gate since round 7), {@link buildBeisAvtinas}. */
  get avtinasStorey() {
    const e = this.entry('beis_avtinas');
    const { w, d, h } = e.geometry;
    return { x1: e.position.x - w / 2, x2: e.position.x + w / 2, z1: e.position.z - d / 2, z2: e.position.z + d / 2, floor: e.position.y, h };
  }

  /**
   * North wall: Nitzotz (= Yechonya), Korban, Beis HaMoked (= HaShir) per Middot 1:5 / 2:6,
   * Shaar HaNashim and the hall straddling it; the Nitzotz wicket's bay (round 6) and
   * Lishkas Palhedrin's bay (round 7) beside the west jambs of their gates. The Beis
   * Avtinas storey and its tower stood here over Shaar HaKorban until round 6
   * ({@link avtinasWall} builds them on whichever wall the content puts the storey).
   */
  buildNorthWall() {
    const { z1, z2 } = this.hall;
    const nBay = this.nitzotzBay;
    const pBay = this.palhedrinBay;
    const av = this.avtinasWall(1);
    this.group('azaras_kohanim', () => {
      this.wallRunA({
        along: 'z', across: [X_IN, X_OUT], from: WALL_T, to: Z_WEST - WALL_T, y1: GROUND, y2: WALL_TOP, mat: this.mat.stone,
        openings: [
          this.gateOpening('nitzotz_gate', 'z', { labels: ['shaar_yechonya'] }),
          { at: (nBay.z1 + nBay.z2) / 2, w: nBay.z2 - nBay.z1, h: nBay.h, floor: this.yKohanim, threshold: true, name: 'nitzotz wicket passage' }, // round 6
          ...(av ? av.cuts : [this.gateOpening('korban_gate', 'z')]),
          { at: (pBay.z1 + pBay.z2) / 2, w: pBay.z2 - pBay.z1, h: pBay.h, floor: this.yKohanim, threshold: true, frame: this.mat.cedar, entry: 'lishkas_palhedrin', name: 'lishkas_palhedrin passage' }, // round 7
          this.gateOpening('shaar_hanashim', 'z'),
          { at: (z1 + z2) / 2, w: z2 - z1, cut: true },
        ],
      });
      if (av) this.wallRunA({ along: 'z', across: [X_IN, X_OUT], from: av.under.from, to: av.under.to, y1: GROUND, y2: av.under.y2, mat: this.mat.stone, openings: av.under.openings });
    }, { part: 'north wall' });
    this.buildNitzotzWicket();
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
   * its gate to the Cheil (Middot 1:7) in its north wall, four corner chambers and
   * stone ledges.
   *
   * The Cheil lies 16 amos below the hall floor, so the gate to it is built as a door
   * at the Cheil level into a vestibule under the hall's chol half (x 67.5 .. 82.5,
   * the Cheil pavement its floor), from which a switchback of 32 half-amah steps in
   * three flights climbs to a well beside the kodesh line in the hall floor, between
   * the two chol chambers and the hall's free cross ({@link CourtBuilder#switchbackA}).
   * The hall's own north gateway, over the door, is kept closed. A reconstruction (the
   * sources give the two gates and, in 1:9, a passage down to the mikveh, no stair);
   * the kodesh half's base stays solid and the line is inlaid in the hall floor.
   */
  buildBeisHamoked() {
    const e = this.entry('beis_hamoked');
    const gate = this.entry('beis_hamoked_gate');
    const { x1, x2, z1, z2 } = this.hall;
    const floor = e.position.y;
    const h = 25; // temple.json gives 12, too low for the 20-amah gate (Middot 2:3); "large domed hall"
    const zc = gate.position.z;
    const yPav = this.level('cheil') + CHEIL_LIP; // the Cheil pavement's top
    const under = floor - SLAB; // the underside of the hall floor slab
    this.group('beis_hamoked', () => {
      this.roomA({
        x1, x2, z1, z2, floor, h, roofMat: this.mat.stone, name: 'beis_hamoked',
        doors: [
          { face: 's', at: zc, w: gate.geometry.w, h: gate.geometry.h, floor: this.yKohanim, entry: 'beis_hamoked_gate', labels: ['shaar_hashir'], frame: this.mat.stonePolished, doors: 'open', doorMat: this.mat.goldEng, threshold: true, name: 'beis_hamoked_gate' },
          { face: 'n', at: zc, w: gate.geometry.w, h: gate.geometry.h, floor: floor + LIP, frame: this.mat.stonePolished, doors: 'closed', doorMat: this.mat.goldEng, name: 'beis_hamoked north gate' },
        ],
      });
      // The kodesh half stands on a solid base; the chol half on the vestibule.
      this.wallA(x1, X_IN, z1, z2, GROUND, under, this.mat.stone);
      this.roomA({
        x1: X_IN, x2, z1, z2, floor: yPav, h: under - yPav, base: GROUND, floorMat: this.mat.floor, wallMat: this.mat.stone, roof: false, name: 'beis_hamoked vestibule',
        doors: [
          { face: 'n', at: zc, w: 5, h: 8, frame: this.mat.cedar, name: 'beis_hamoked cheil door' },
          { face: 'w', at: this.mesibah.xc, w: this.mesibah.w, h: this.mesibah.h, frame: this.mat.cedar, name: 'beis_hamoked mesibah door' }, // round 6: to the Middot 1:9 passage
        ],
      });
      const { well } = this.switchbackA({ x0: X_IN + ROOM_WALL_T, sx: 1, zFoot: zc + 0.5, floor: yPav + LIP, top: floor + LIP, ceiling: under + LIP, name: 'beis_hamoked' });
      // The hall floor round this well and the Tevilah chamber's (round 6), the second stair and the passage.
      this.buildTevilahPassage({ x1, x2, z1, z2, well, floor, under, yPav });
      this.wellParapetA(well, floor + LIP, this.mat.stonePolished, 'beis_hamoked well parapet');
      // The kodesh / chol line (Yoma 25a), inlaid across the hall floor.
      this.decoA(X_IN - LINE_W / 2, X_IN + LINE_W / 2, z1 + ROOM_WALL_T, z2 - ROOM_WALL_T, floor + LIP, floor + LIP + LINE_H, this.mat.marbleR);
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


  /**
   * The winding passage of Middot 1:9 (round 6): its door out of the Beis HaMoked
   * vestibule's west wall, its width and height, and the bath-house it leads to. Every
   * value is a reconstruction ({@link buildTevilahPassage}).
   */
  get mesibah() {
    const bath = { x1: X_OUT, x2: X_OUT + 8, z1: -52, z2: -42 }; // the bath-house on the Cheil pavement, west of Shaar HaNashim's front
    return { xc: X_OUT + 1.5, w: 3, h: 5, x1: X_OUT, x2: X_OUT + 3, bath };
  }

  /**
   * Shaar HaNitzotz's opening to the Cheil (Middot 1:5): a 3-amah bay through the wall
   * beside the gate's west jamb at the court level, like the Palhedrin bay, into which
   * the stair tower's top landing opens ({@link buildNitzotzWicket}).
   */
  get nitzotzBay() {
    const g = this.entry('nitzotz_gate');
    const z2 = g.position.z - g.geometry.w / 2 - FRAME_T; // -84: west of the gate's west jamb
    return { z1: z2 - 3, z2, h: 7 };
  }

  /**
   * Middot 1:9 / Tamid 1:1: a kohen who became impure at night left Beis HaMoked by the
   * winding passage that "goes under the Birah, with lamps burning on either side, until
   * he reaches the bath-house", immersed, came up, dried and warmed himself at the fire.
   * The passage leaves the north-west chamber (`beis_hatevilah_descent`, in the chol):
   *
   * - A second stair well in the hall floor over that chamber (x 74 .. 78.5, z -22.75 ..
   *   -20.75, parapet on its room side and at its foot end, the chamber's west wall on
   *   the other), from which 32 half-amah rises in three flights along x (C 10 down from
   *   the well, the first of them the slab's edge, B 11, A 11; 2-amah bands parted by
   *   quarter-amah walls under the
   *   chamber, landings at the turns) go down 16 amos to the west bay of the vestibule
   *   under the hall's chol half, west of the GEO-D switchback and sealed from its foot.
   * - From the bay, through a door in its west wall, a vaulted passage 3 wide and 5 high
   *   (a half-cylinder vault on half-amah walls, lamps on brackets both sides) runs west
   *   along the foot of the north wall on the Cheil pavement, past Shaar HaNashim's front,
   *   to the bath-house at z -52 .. -42, where four steps rise to its floor 2 amos over
   *   the pavement and a pool 4 x 4 is sunk to the pavement with three treads and the
   *   floor as its four steps down, water 1.5 amos deep; a fire (Middot 1:9) in a corner.
   *
   * The Mishnah gives the line, the level and the size of none of this; the model's Cheil
   * pavement and mount slabs (HarHaBayisBuilder) are not cut, so nothing here goes below
   * the pavement and "under the Birah" is read as under the hall and the passage's own
   * vault (Tosafos Yoma 2a: a building on the mount; Rambam: the whole Mikdash). The
   * bath-house floor is raised so that the pool can be sunk; its size is dictated by the
   * pool and the lanes round it. Recorded in temple.json (beis_hatevilah_descent's note,
   * meta.disputes). The Cheil lane between these structures and the Soreg stays 2 amos.
   *
   * Also builds the hall floor slabs round both wells (the caller's floorWithWellA did
   * the first), so `well` is the GEO-D well.
   */
  buildTevilahPassage({ x1, x2, z1, z2, well, floor, under, yPav }) {
    const chamber = this.entry('beis_hatevilah_descent');
    const T = floor + LIP; // the hall and chamber floor
    const CEIL = under + LIP; // the vestibule ceiling (the floor slabs' underside)
    const F = yPav + LIP; // the vestibule floor, the Cheil pavement plus a LIP
    const bottom = F - SLAB;
    const rise = STEP_RISE;
    const wm = this.mat.stone;
    const sm = this.mat.stonePolished;
    const cx = chamber.position.x; // 76.5
    const cz = chamber.position.z; // -20
    const ix1 = cx - 4 + ROOM_WALL_T; // 73.5: the chamber's interior
    const iz1 = cz - 4 + ROOM_WALL_T; // -23
    // Bands along z (flights run along x): C at the chamber's west wall, B, A; quarter-amah walls between.
    const bt = 0.25;
    const zC = [iz1 + bt, iz1 + bt + 2]; // -22.75 .. -20.75
    const zB = [zC[1] + bt, zC[1] + bt + 2]; // -20.5 .. -18.5
    const zA = [zB[1] + bt, zB[1] + bt + 2]; // -18.25 .. -16.25
    // C has ten rises but nine tread blocks: the tenth rise is the floor slab's edge at the
    // well's open end (x 78.5, an amah short of the chamber's north wall, the step-off floor).
    // The eye (1.7 m over the feet) must be under the hall floor slab (1.75) by C's lowest
    // tread, whose foot lies within a body's radius of the chamber's south wall, whose
    // foundation inside the slab is a wall box; so that tread tops at -1.95 and L2 at -2.45.
    const [nC, nB, nA] = [9, 11, 11];
    const xW = [ix1 + 0.5, ix1 + 0.5 + nC * rise]; // the well, 74 .. 78.5: C's run
    const xL2 = [xW[0] - 2.5, xW[0]]; // 71.5 .. 74
    const xB = [xW[0], xW[0] + nB * rise]; // 74 .. 79.5
    const xL1 = [xB[1], xB[1] + 2]; // 79.5 .. 81.5, the vestibule's north wall
    const xA = [xB[1] - nA * rise, xB[1]]; // 74 .. 79.5
    const yL2 = T - (nC + 1) * rise; // -2.45
    const yL1 = yL2 - nB * rise; // -7.95
    const yA = yL1 - nA * rise; // -13.45: a quarter metre under the first tread
    const xIn = x2 - ROOM_WALL_T; // 81.5: the vestibule's north wall
    const wellsFloor = { x1: xW[0], x2: xW[1], z1: zC[0], z2: zC[1] };
    this.group('beis_hamoked', () => {
      this.hallFloorWithWellsA(x1, x2, z1, z2, [well, wellsFloor], T, this.mat.floor, 'beis_hamoked');
    }, { part: 'floor' });
    this.group('beis_hatevilah_descent', () => {
      // Flights and landings, solid to a slab under the vestibule floor.
      this.flightMergedA({ axis: 'x', span: zC, from: xW[0], to: xW[1], yBase: yL2, bottom, steps: nC, rise, mat: sm, name: 'beis_hatevilah stair' });
      this.blockA(xL2[0], xL2[1], zC[0], zB[1], bottom, yL2, sm, 'beis_hatevilah landing');
      this.flightMergedA({ axis: 'x', span: zB, from: xB[1], to: xB[0], yBase: yL1, bottom, steps: nB, rise, mat: sm, name: 'beis_hatevilah stair' });
      this.blockA(xL1[0], xL1[1], zB[0], zA[1], bottom, yL1, sm, 'beis_hatevilah landing');
      this.flightMergedA({ axis: 'x', span: zA, from: xA[0], to: xA[1], yBase: yA, bottom, steps: nA, rise, mat: sm, name: 'beis_hatevilah stair' });
      // Walls from the vestibule floor to its ceiling: C's west side (and L2's, and the
      // void past the well up to the north wall), L2's end, between C and B (from L2's edge
      // to the north wall, so L1's foot end is fenced), between B and A (from L2's far
      // side to L1's edge, so L2's other side is fenced), A's outer side (from the GEO-D
      // L2 end wall, which ends at x 73.5, to the north wall: the pocket at A's foot is
      // sealed from the switchback's foot).
      this.wallA(xL2[0], xIn, iz1, zC[0], F, CEIL, wm);
      this.wallA(xL2[0] - bt, xL2[0], iz1, zA[0], F, CEIL, wm);
      this.wallA(xW[0], xIn, zC[1], zB[0], F, CEIL, wm);
      this.wallA(xL2[0], xL1[0], zB[1], zA[0], F, CEIL, wm);
      this.wallA(ix1, xIn, zA[1], zA[1] + 2 * bt, F, CEIL, wm);
      // C's side walls go on through the floor slab and the parapet as invisible colliders
      // (switchbackA explains), stopping short of the well's open end.
      const xRail = xW[1] - 0.9;
      this.colliderA(xW[0], xRail, iz1, zC[0], CEIL, T + 1.5);
      this.colliderA(xW[0], xRail, zC[1], zC[1] + 0.1, CEIL, T + 1.5); // the band wall's inner face only: the floor beside the parapet keeps its width
      // Parapet: half-amah masses 1.5 high on the well's room side and across its foot end
      // (the chamber's west wall is its other side); the foot end stands beside the door.
      const py = T + LIP;
      this.blockA(xW[0], xW[1], zC[1], zC[1] + 0.5, py, py + 1.5, sm, 'beis_hatevilah well parapet');
      this.blockA(ix1, xW[0], iz1, zC[1] + 0.5, py, py + 1.5, sm, 'beis_hatevilah well parapet');
    }, { part: 'stair' });

    // The passage: on the Cheil pavement along the wall's outer face, from the vestibule's
    // west wall (z -26) to the bath-house's east wall (z -42); its floor a LIP over the
    // pavement like the vestibule's, a half-amah wall on the Cheil side, a vault of two
    // half-cylinder shells (inner face seen from inside, outer from the Cheil) springing
    // 3.5 amos up, crown 5 amos over the floor; the door leaf folded inside the bay.
    const m = this.mesibah;
    const zDoor = z1; // -26: the vestibule's west wall's outer face
    const zBath = m.bath.z2; // -42
    const stepsRun = 2; // four half-amah steps up to the bath-house floor, in the passage's last two amos
    const yBath = yPav + 2; // the bath-house floor sits 2 amos over the pavement (so the pool can be sunk to it)
    const stoneDS = this.mat.stone.clone();
    stoneDS.side = THREE.DoubleSide;
    this.group('beis_hatevilah_descent', () => {
      this.floorA(m.x1, m.x2, zBath + stepsRun, zDoor, F, this.mat.floor, 'beis_hatevilah passage');
      this.flightMergedA({ axis: 'z', span: [m.x1, m.x2], from: zBath + stepsRun, to: zBath, yBase: F, bottom, steps: 4, rise, mat: sm, name: 'beis_hatevilah passage steps' });
      const spring = F + m.h - 1.5;
      const zStep = zBath + stepsRun; // -40: where the four steps begin
      // The vault steps up with the floor: over the four steps its springing rises by
      // their two amos (the crown 5 amos over the top step as over the passage floor; at
      // one height the top step had 1.35 m of head room), with a diaphragm face at the
      // step closing the crescent between the two profiles (the north walker, round 6).
      const rise2 = stepsRun;
      this.wallA(m.x2, m.x2 + 0.5, zStep, zDoor, GROUND, spring, wm);
      this.wallA(m.x2, m.x2 + 0.5, zBath, zStep, GROUND, spring + rise2, wm);
      for (const [za, zb, y] of [[zStep, zDoor, spring], [zBath, zStep, spring + rise2]]) {
        for (const r of [1.5, 2]) {
          const geo = new THREE.CylinderGeometry(r * AMAH, r * AMAH, (zb - za) * AMAH, 24, 1, true, 0, Math.PI);
          geo.rotateZ(Math.PI / 2).rotateY(Math.PI / 2);
          const vault = new THREE.Mesh(geo, stoneDS);
          vault.position.set(...this.pt(m.xc, y, (za + zb) / 2));
          vault.castShadow = true;
          vault.receiveShadow = true;
          vault.name = 'beis_hatevilah passage vault';
          this.scene.add(vault);
        }
      }
      {
        // The diaphragm at the step, in the x-y plane: the upper outer profile (r 2 over
        // the raised springing) down to the lower springing, less the lower inner profile.
        const rI = 1.5 * AMAH;
        const rO = 2 * AMAH;
        const dy = rise2 * AMAH;
        const face = new THREE.Shape();
        face.moveTo(-rO, 0);
        face.lineTo(-rO, dy);
        face.absarc(0, dy, rO, Math.PI, 0, true);
        face.lineTo(rO, 0);
        face.lineTo(rI, 0);
        face.absarc(0, 0, rI, 0, Math.PI, false);
        face.lineTo(-rO, 0);
        const geo = new THREE.ExtrudeGeometry(face, { depth: 0.1 * AMAH, bevelEnabled: false });
        const diaphragm = new THREE.Mesh(geo, stoneDS);
        diaphragm.position.set(...this.pt(m.xc, spring, zStep));
        diaphragm.castShadow = true;
        diaphragm.receiveShadow = true;
        diaphragm.name = 'beis_hatevilah passage vault step';
        this.scene.add(diaphragm);
      }
      // The door's leaf, swung open against the bay's west wall beside the opening, on the
      // vestibule side (it stood in the opening before the north walker's pass).
      const leaf = this.decoA(m.x2, m.x2 + 3, zDoor + ROOM_WALL_T, zDoor + ROOM_WALL_T + 0.1, F, F + m.h - 0.5, this.mat.cedar);
      leaf.name = 'beis_hatevilah passage door leaf';
      // Lamps on either side (Middot 1:9): stone brackets, copper lamps, a still flame.
      const flame = new THREE.MeshStandardMaterial({ color: 0x201008, emissive: 0xffa040, emissiveIntensity: 2.5, roughness: 1 });
      const brackets = [];
      const lamps = [];
      const flames = [];
      for (let z = zDoor - 2.5; z > zBath + stepsRun + 1; z -= 3) {
        for (const [xa, xb] of [[m.x1, m.x1 + 0.4], [m.x2 - 0.4, m.x2]]) {
          const xm = (xa + xb) / 2;
          brackets.push({ position: this.pt(xm, F + 2.1, z) });
          lamps.push({ position: this.pt(xm, F + 2.35, z) });
          flames.push({ position: this.pt(xm, F + 2.58, z) }); // seated on the cup's rim (2.5), not floating over it
        }
      }
      this.scene.add(instance(this.box(0.4 * AMAH, 0.2 * AMAH, 0.5 * AMAH, sm), sm, brackets, { name: 'beis_hatevilah lamp brackets' }));
      this.scene.add(instance(new THREE.CylinderGeometry(0.12 * AMAH, 0.16 * AMAH, 0.3 * AMAH, 10), this.mat.copper, lamps, { name: 'beis_hatevilah lamps' }));
      this.scene.add(instance(new THREE.SphereGeometry(0.11 * AMAH, 8, 6), flame, flames, { name: 'beis_hatevilah lamp flames', castShadow: false }));
    }, { part: 'passage' });

    // The bath-house: an 8 x 10 room on the pavement against the wall (its south face),
    // floor 2 amos up, a plinth to the ground under its walls, the pool 4 x 4 against
    // the north wall with half-amah walls, three treads and the pavement as its four
    // steps down on the east side, a kerb 1.5 high on its other sides, water 1.5 deep,
    // and a fire in the south-west corner.
    const b = m.bath;
    const t = ROOM_WALL_T;
    const bx2 = b.x2 - t; // 80.5: the interior's north edge
    const pool = { x1: bx2 - 4, x2: bx2, z1: -50, z2: -46 };
    const pw = 0.5;
    const Y = yBath + LIP; // -11.41
    this.group('beis_hatevilah_descent', () => {
      this.roomA({
        x1: b.x1, x2: b.x2, z1: b.z1, z2: b.z2, floor: yBath, h: 6, wallMat: wm, roofMat: wm, skip: ['s'], name: 'beis_hatevilah bath-house',
        doors: [{ face: 'e', at: m.xc, w: m.w, h: m.h, frame: this.mat.cedar, threshold: true, name: 'beis_hatevilah bath-house door' }],
      });
      this.wallA(b.x2 - t, b.x2, b.z1, b.z2, GROUND, yBath - SLAB, wm); // plinth
      this.wallA(b.x1, b.x2, b.z1, b.z1 + t, GROUND, yBath - SLAB, wm);
      this.wallA(b.x1, b.x2, b.z2 - t, b.z2, GROUND, yBath - SLAB, wm);
      // Floor round the pool.
      this.floorA(b.x1, pool.x1, b.z1 + t, b.z2 - t, Y, this.mat.floor, 'beis_hatevilah bath-house');
      this.floorA(pool.x1, pool.x2, b.z1 + t, pool.z1, Y, this.mat.floor, 'beis_hatevilah bath-house');
      this.floorA(pool.x1, pool.x2, pool.z2, b.z2 - t, Y, this.mat.floor, 'beis_hatevilah bath-house');
      // The pool: its floor on the pavement, its walls under the floor slab, the treads, the water.
      this.floorA(pool.x1, pool.x2, pool.z1, pool.z2, F, sm, 'beis_hatevilah pool');
      this.wallA(pool.x1 - pw, pool.x1, pool.z1 - pw, pool.z2 + pw, yPav, Y - SLAB, sm);
      this.wallA(pool.x1 - pw, pool.x2, pool.z1 - pw, pool.z1, yPav, Y - SLAB, sm);
      // No wall on the east side: the treads fill it, and a wall box under the floor slab there
      // would top out at the body's bottom on the second tread and stop the climb out.
      this.flightMergedA({ axis: 'z', span: [pool.x1, pool.x2], from: pool.z2 - 1.5, to: pool.z2, yBase: F, bottom, steps: 3, rise, mat: sm, name: 'beis_hatevilah pool steps' });
      this.decoA(pool.x1, pool.x2, pool.z1, pool.z2, F + 1.5, F + 1.52, this.mat.water);
      // Kerb on the pool's south and west sides (the north is the wall, the east the steps).
      this.blockA(pool.x1 - pw, pool.x1, pool.z1 - pw, pool.z2 + pw, Y + LIP, Y + LIP + 1.5, sm, 'beis_hatevilah pool kerb');
      this.blockA(pool.x1 - pw, pool.x2, pool.z1 - pw, pool.z1, Y + LIP, Y + LIP + 1.5, sm, 'beis_hatevilah pool kerb');
      // The fire (Middot 1:9): a stone hearth with embers, in the south-west corner.
      const hx = b.x1 + 1;
      const hz = b.z1 + t + 0.75;
      this.blockA(hx - 0.6, hx + 0.6, hz - 0.6, hz + 0.6, Y + LIP, Y + 0.5, sm, 'beis_hatevilah hearth');
      const embers = new THREE.Mesh(this.box(0.9 * AMAH, 0.1 * AMAH, 0.9 * AMAH, sm), new THREE.MeshStandardMaterial({ color: 0x301008, emissive: 0xff6020, emissiveIntensity: 1.8, roughness: 1 }));
      embers.position.set(...this.pt(hx, Y + 0.55, hz));
      this.scene.add(embers);
      // The door's leaf, folded inside against the east wall's inner face (it sat inside
      // the wall's thickness before round 7, its back face flush with the wall's).
      this.decoA(m.x2, m.x2 + 3, b.z2 - t - 0.1, b.z2 - t, Y, Y + m.h - 0.5, this.mat.cedar);
    }, { part: 'bath-house' });
  }

  /**
   * {@link CourtBuilder#flightA} as one mesh: the step blocks merged into a single
   * walkable body (the probe and insideSolid treat each merged box as its own closed
   * body), so a 16-step flight is one draw call instead of sixteen.
   */
  flightMergedA({ axis, span: [s1, s2], from, to, yBase, bottom, steps, rise, mat, name }) {
    const tread = (to - from) / steps;
    const base = bottom ?? yBase - SLAB;
    const parts = [];
    for (let k = 0; k < steps; k++) {
      const a = from + k * tread;
      const b = a + tread;
      const top = yBase + (k + 1) * rise;
      const r = axis === 'z' ? [s1, s2, a, b] : [a, b, s1, s2];
      parts.push(this.frameBox(...r, base, top, mat));
    }
    const geo = BufferGeometryUtils.mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData = { isFloor: true, isStep: true, name };
    this.scene.add(m);
    this.floors.push(m);
    return m;
  }

  /**
   * Floor slab with rectangular wells left open: x bands between the wells (sorted by x,
   * not overlapping in x), and in each well's band the slabs before and after it along z.
   */
  hallFloorWithWellsA(x1, x2, z1, z2, wells, yTop, mat, name) {
    const ws = [...wells].sort((a, b) => a.x1 - b.x1);
    let cursor = x1;
    for (const w of ws) {
      if (w.x1 < cursor) throw new Error(`wells overlap in x at ${w.x1}`);
      if (w.x1 > cursor) this.floorA(cursor, w.x1, z1, z2, yTop, mat, name);
      this.floorA(w.x1, w.x2, z1, w.z1, yTop, mat, name);
      this.floorA(w.x1, w.x2, w.z2, z2, yTop, mat, name);
      cursor = w.x2;
    }
    if (cursor < x2) this.floorA(cursor, x2, z1, z2, yTop, mat, name);
  }

  /**
   * Shaar HaNitzotz's opening to the Cheil (Middot 1:5; round 6). The gate's threshold
   * lies 16 amos over the Cheil, so the opening is built as a wicket door 2 x 4 at the
   * Cheil level in the east face of a stair tower on the Cheil pavement west of the gate
   * (x 73.5 .. 81, z -99 .. -83; the court wall is its south face), like Lishkas
   * Palhedrin's: a lower flight of 16 half-amah steps along the Soreg side climbs west
   * from an entry strip inside the wicket, a landing crosses the west end, an upper
   * flight along the wall side climbs back east to a landing at the court level that
   * opens through a 3-amah bay in the wall beside the gate's west jamb
   * ({@link nitzotzBay}, cut in buildNorthWall) into the court; a quarter-amah wall
   * between the two flights. The gate's own doors stay closed. The tower stands like a
   * porch under the gate's west reveal (Middot 1:5, "like an exedra"). Its size, the bay
   * and the wicket's place are reconstructions (temple.json: nitzotz_gate's notes,
   * meta.disputes). The Cheil lane between the tower and the Soreg stays 2.5 amos.
   */
  buildNitzotzWicket() {
    const bay = this.nitzotzBay;
    const t = ROOM_WALL_T;
    const yPav = this.level('cheil') + CHEIL_LIP;
    const F = yPav + LIP;
    const floor = this.level('cheil'); // flights from the Cheil level, as Palhedrin's: 32 half-amah rises close on the court level
    const top = this.yKohanim;
    const steps = 16;
    const rise = (top - floor) / (2 * steps); // 0.5
    const run = steps * rise; // 8
    const x1 = X_OUT; // 73.5
    const x2 = X_OUT + 7.5; // 81
    const z2 = bay.z2 + FRAME_T; // -83: the gate's west reveal
    const z1 = z2 - 16; // -99
    const roof = top + 7; // 9.5
    const bottom = floor - SLAB;
    const xWall = [x1, x1 + 3]; // the wall-side band: the upper flight and the top landing
    const xSoreg = [x1 + 3.5, x2 - t]; // 77 .. 80: the lower flight and the entry strip
    const zFoot = bay.z1; // -87: the entry strip is z -87 .. -84 inside the wicket
    const zTurn = zFoot - run; // -95
    const wicketX = (xSoreg[0] + xSoreg[1]) / 2; // 78.5
    this.group('nitzotz_gate', () => {
      this.roomA({
        x1, x2, z1, z2, floor: yPav, h: roof - yPav, base: GROUND, floorMat: this.mat.floor, wallMat: this.mat.stone, roofMat: this.mat.stone, skip: ['s'], name: 'nitzotz stair',
        doors: [{ face: 'e', at: wicketX, w: 2, h: 4, frame: this.mat.cedar, name: 'nitzotz wicket' }],
      });
      this.flightMergedA({ axis: 'z', span: xSoreg, from: zFoot, to: zTurn, yBase: floor, bottom, steps, rise, mat: this.mat.stonePolished, name: 'nitzotz stair' });
      this.blockA(x1, x2 - t, zTurn, z1 + t, bottom, floor + run, this.mat.stonePolished, 'nitzotz landing');
      this.flightMergedA({ axis: 'z', span: xWall, from: zTurn, to: zFoot, yBase: floor + run, bottom, steps, rise, mat: this.mat.stonePolished, name: 'nitzotz stair' });
      this.blockA(xWall[0], xWall[1], zFoot, z2 - t, bottom, top, this.mat.stonePolished, 'nitzotz landing');
      // Between the flights, from the turn landing to the east wall.
      this.wallA(xWall[1], xSoreg[0], zTurn, z2 - t, F, roof, this.mat.stone);
      // The wicket's leaf, swung open against the tower's face between the wall and the door.
      this.decoA(wicketX - 3, wicketX - 1, z2, z2 + 0.1, F, F + 3.5, this.mat.cedar);
    }, { part: 'stair' });
  }

  /**
   * Lishkas HaGazis straddles the south wall (Yoma 25a), half in the kodesh and half in
   * the chol, with a door to each. The Cheil lies 16 amos below its floor, so the chol
   * door is built at the Cheil level, in the outer wall of a vestibule under the chol
   * half (x -77.5 .. -67.5, the Cheil pavement its floor), from which a switchback of
   * 32 half-amah steps in three flights climbs to a well beside the kodesh line in the
   * chamber floor, at its east end ({@link CourtBuilder#switchbackA}); a reconstruction.
   * The Sanhedrin's benches keep the west of the chol half; the kodesh half's base is
   * solid and the line is inlaid in the floor.
   */
  buildLishkasHagazis() {
    const e = this.entry('lishkas_hagazis');
    const { w, d, h } = e.geometry;
    const x1 = e.position.x - w / 2;
    const x2 = e.position.x + w / 2;
    const z1 = e.position.z - d / 2;
    const z2 = e.position.z + d / 2;
    const floor = e.position.y;
    const yPav = this.level('cheil') + CHEIL_LIP;
    const under = floor - SLAB;
    const t = ROOM_WALL_T;
    const zDoor = z1 + 5; // -113: the Cheil door, in the west of the chol half beside the benches
    this.group('lishkas_hagazis', () => {
      this.roomA({
        x1, x2, z1, z2, floor, h, wallMat: this.mat.stonePolished, name: 'lishkas_hagazis',
        doors: [
          { face: 'n', at: e.position.z, w: 5, h: 8, frame: this.mat.cedar, doors: 'open', doorMat: this.mat.cedar },
          { face: 'w', at: this.etzDoorX, w: 3, h: 7, frame: this.mat.cedar }, // into Lishkas HaEtz behind (Abba Shaul)
        ],
      });
      this.wallA(-X_IN, x2, z1, z2, GROUND, under, this.mat.stone);
      this.roomA({
        x1, x2: -X_IN, z1, z2, floor: yPav, h: under - yPav, base: GROUND, floorMat: this.mat.floor, wallMat: this.mat.stone, roof: false, name: 'lishkas_hagazis vestibule',
        doors: [{ face: 's', at: zDoor, w: 4, h: 7, frame: this.mat.cedar, name: 'lishkas_hagazis cheil door' }],
      });
      // Flight A runs along the outer wall, so it is 3 wide and needs no wall of its own;
      // landing L1 ends against the chamber's east wall.
      const { well } = this.switchbackA({ x0: -X_IN - t, sx: -1, zFoot: z2 - t - 8, floor: yPav + LIP, top: floor + LIP, ceiling: under + LIP, wA: 3, eWall: false, nWall: false, name: 'lishkas_hagazis' });
      this.floorWithWellA(x1, x2, z1, z2, well, floor + LIP, this.mat.marbleW, 'lishkas_hagazis');
      this.wellParapetA(well, floor + LIP, this.mat.stonePolished, 'lishkas_hagazis well parapet');
      this.decoA(-X_IN - LINE_W / 2, -X_IN + LINE_W / 2, z1 + t, z2 - t, floor + LIP, floor + LIP + LINE_H, this.mat.marbleR);
      // Benches of the Sanhedrin, a reconstruction: three stepped tiers of cedar along the south
      // wall of the chol half (no sitting in the Azarah, Yoma 25a), west of the stair head, facing
      // north into the room; the highest (0.8 m) against the wall, each 1.25 amos deep and half an
      // amah lower toward the room. Sanhedrin 4:3 gives only the seating plan, a half-circle "like
      // half a round threshing floor" so the judges see one another, with no direction and no tiers;
      // the straight tiers stand in for it (three rows sat before the judges, Sanhedrin 4:4). Solid masses (blockA, a LIP
      // over the floor as solidA explains): the top tier is over STEP_HEIGHT, so from the floor it
      // blocks; the lower two are stepped onto, and feet no longer pass through them.
      for (let k = 0; k < 3; k++) this.blockA(x1 + t + k * 1.25, x1 + t + (k + 1) * 1.25, z1 + 3 + k, well.z1 - 2 - k, floor + 2 * LIP, floor + LIP + 0.6 + (2 - k) * 0.5, this.mat.cedar, 'lishkas_hagazis benches');
      // The court wall continues above the chamber.
      this.decoA(-X_OUT, -X_IN, z1, z2, floor + h + 1, WALL_TOP, this.mat.stone);
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
      const steps = 22;
      const rise = (roofY - mad.floor) / steps;
      this.flightA({ axis: 'z', span: wellX, from: wellZ[0], to: wellZ[1], yBase: mad.floor, steps, rise, mat: this.mat.stonePolished, name: 'lishkas_hamadichin stair' });
      // The flight's two long sides inside the room: a stepped parapet 1.5 amos over each
      // tread on the room side (a mass, so it stops the player; the first two treads stay
      // open, they are the foot, entered from the room), and the amah between the flight
      // and the court wall filled to the roof. Without them a walker on the upper treads
      // could step off either side and fall up to 11 amos onto the room floor.
      const tread = (wellZ[1] - wellZ[0]) / steps;
      for (let k = 2; k < steps; k++) {
        const za = wellZ[0] + k * tread;
        // Capped under the roof slab: the roof's own well parapet fences the top treads.
        this.blockA(wellX[0] - 0.5, wellX[0], za + tread, za, mad.floor + LIP, Math.min(mad.floor + (k + 1) * rise + 1.5, roofY - SLAB), this.mat.stonePolished, 'lishkas_hamadichin stair parapet');
      }
      this.wallA(wellX[1], mad.x2, wellZ[1], wellZ[0], mad.floor - SLAB, roofY, this.mat.stone);
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

  /** Golah inside the south wall (Middot 5:4); Etz behind it and the Gazis (Abba Shaul). Palhedrin stood in the Cheil beside the Water Gate until round 6 ({@link buildLishkasPalhedrin}). */
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
  }

  /** x of the door between the Gazis' chol half and Lishkas HaEtz  /** x of the door between the Gazis' chol half and Lishkas HaEtz: the middle of the wall's thickness. */
  get etzDoorX() {
    return -(X_IN + X_OUT) / 2;
  }

  /**
   * Beis Avtinas: an upper storey over a court gate on whichever wall the content puts it
   * (south, over Shaar HaMayim, since round 7 after Yerushalmi Yoma 1:5 and Meiri Yoma
   * 19a; north over Shaar HaKorban in rounds A to 6), reached by a stair tower beside
   * the gate's jamb in the storey's own x band ({@link avtinasTower}): four flights of
   * half-amah steps round the tower's walls (the storey's floor is 21.5 amos over the
   * court: the 20-amah gate, its lintel and the floor slab, so 43 steps in flights of 11,
   * 11, 11 and 10), a door from the court in the tower's end face away from the storey
   * and a door into the storey at the top. The Kohen Gadol's first immersion was on the
   * roof of the Water Gate beside his chamber (Yoma 31a), so the mikveh sits on the
   * south wall top over that gate: against the storey's east wall when the storey is
   * over the gate, over the gate itself otherwise. The wall top is not walkable.
   */
  buildBeisAvtinas() {
    const e = this.entry('beis_avtinas');
    const { h } = e.geometry;
    const { x1, x2, z1, z2, floor } = this.avtinasStorey;
    const tower = this.avtinasTower;
    const { side } = tower; // +1 north wall, -1 south wall
    const [inner, edge] = side > 0 ? [x1, X_IN] : [-X_IN, x2]; // the part overhanging the court
    const t = ROOM_WALL_T;
    // Both doors are in the tower's first x band on the court side (north: x 62.5 .. 65;
    // south: x -65 .. -62.5): the court door in the tower's end face away from the storey,
    // the storey door in the wall the two share (the tower has no wall of its own there).
    const courtEdge = side > 0 ? tower.x1 + t : tower.x2 - t;
    const doorX = courtEdge + side * 1.25;
    const doorW = 2.5;
    const face = side > 0 ? 'e' : 'w';
    const shared = side > 0 ? 'w' : 'e';
    this.group('beis_avtinas', () => {
      this.roomA({
        x1, x2, z1, z2, floor, h, floorMat: this.mat.floor, wallMat: this.mat.stonePolished, roof: 'walk', roofMat: this.mat.stone, name: 'beis_avtinas',
        doors: [{ face, at: doorX, w: doorW, h: 6, frame: this.mat.cedar }],
      });
      // Corbels under the part that overhangs the court, clear of the tower.
      for (const z of [z1 + 1, (z1 + z2) / 2, z2 - 1].filter((zc) => zc + 0.5 <= tower.z1 || zc - 0.5 >= tower.z2)) this.decoA(inner, edge, z - 0.5, z + 0.5, floor - SLAB - 1.5, floor - SLAB, this.mat.stone);
    });
    // The stair tower: from the court floor to the storey, walls to the storey's roof. Its
    // face toward the storey is the storey's own wall (with the door at the top); below
    // the storey a plain wall closes that side.
    this.group('beis_avtinas', () => {
      const yCourt = this.yKohanim;
      const bottom = yCourt - SLAB;
      this.roomA({
        x1: tower.x1, x2: tower.x2, z1: tower.z1, z2: tower.z2, floor: yCourt, h: floor + h - yCourt, base: GROUND, floorMat: this.mat.floor, wallMat: this.mat.stone, name: 'beis_avtinas stair', skip: [shared],
        doors: [{ face, at: doorX, w: doorW, h: 7, frame: this.mat.cedar, name: 'beis_avtinas stair door' }],
      });
      const [sz1, sz2] = side > 0 ? [tower.z1, tower.z1 + t] : [tower.z2 - t, tower.z2];
      this.wallA(tower.x1, tower.x2, sz1, sz2, GROUND, floor - SLAB, this.mat.stone);
      // Four flights along x in four z bands counted from the door end toward the storey,
      // between the near (court-side) and far (wall-side) ends of the interior, landings
      // at alternate ends, all solid to the court floor.
      const ix1 = tower.x1 + t;
      const ix2 = tower.x2 - t;
      const iz1 = tower.z1 + t;
      const iz2 = tower.z2 - t;
      const landing = 2.5;
      const band = (iz2 - iz1) / 4;
      const nearEdge = side > 0 ? ix1 : ix2;
      const farEdge = side > 0 ? ix2 : ix1;
      const near = nearEdge + side * landing;
      const far = farEdge - side * landing;
      const doorEnd = side > 0 ? iz2 : iz1;
      const dz = side > 0 ? -band : band; // toward the storey
      const zBand = (k) => [doorEnd + k * dz, doorEnd + (k + 1) * dz].sort((a, b) => a - b);
      // Half-amah risers throughout (the Cheil steps' profile): the last flight is a step
      // short, so the 43 steps close exactly on the storey's floor.
      const rise = 0.5;
      const total = Math.round((floor - yCourt) / rise); // 43
      const flights = [0, 1, 2, 3].map((k) => Math.ceil((total - k) / 4)); // 11, 11, 11, 10
      let y = yCourt + LIP;
      for (let k = 0; k < 4; k++) {
        const steps = flights[k];
        const [zb, za] = zBand(k);
        const up = k % 2 === 0; // even flights climb toward the wall, odd ones back to the court side
        this.flightA({ axis: 'x', span: [zb, za], from: up ? near : far, to: up ? far : near, yBase: y, bottom, steps, rise, mat: this.mat.stonePolished, name: 'beis_avtinas stair' });
        y += steps * rise;
        // Landing at the flight's top end, shared with the next flight's foot: over this
        // band and the next one toward the storey.
        const next = k < 3 ? zBand(k + 1) : [zb, za];
        const [lx1, lx2] = up ? [far, farEdge] : [near, nearEdge];
        this.blockA(Math.min(lx1, lx2), Math.max(lx1, lx2), Math.min(zb, ...next), Math.max(za, ...next), bottom, y, this.mat.stonePolished, 'beis_avtinas landing');
      }
      // A thin wall between each pair of flights, stopping an amah short of the landing
      // that joins them, so a walker on an upper flight cannot step off its side onto a
      // lower one (a 2 to 10-amah drop inside the tower).
      const bt = 0.25;
      for (let k = 1; k < 4; k++) {
        const zc = doorEnd + k * dz;
        const [xa, xb] = (k - 1) % 2 === 0 ? [nearEdge, far - side] : [near + side, farEdge];
        this.wallA(Math.min(xa, xb), Math.max(xa, xb), zc - bt / 2, zc + bt / 2, yCourt, floor + h, this.mat.stonePolished);
      }
    }, { part: 'stair' });
    // Mikveh on the south wall top over the Water Gate (Yoma 31a), beside the storey when
    // the storey is over that gate (its rim against the storey's east wall, over the
    // gate's east jamb).
    const wg = this.entry('water_gate');
    this.group('azaras_kohanim', () => {
      const ry = WALL_TOP;
      const cx = -(X_IN + X_OUT) / 2;
      const overGate = side < 0 && wg.position.z > z1 && wg.position.z < z2;
      const cz = overGate ? z2 + 2 : wg.position.z;
      this.decoA(cx - 2, cx + 2, cz - 2, cz + 2, ry, ry + 1.5, this.mat.stonePolished);
      this.decoA(cx - 1.6, cx + 1.6, cz - 1.6, cz + 1.6, ry + 1.5, ry + 1.6, this.mat.water);
    }, { part: 'water gate roof' });
  }

  /**
   * Lishkas Palhedrin (round 7): a chamber of its own in the north Cheil west of Shaar
   * HaKorban (Meiri Yoma 19a; Rambam Beis HaBechirah 5:17 makes it the Lishkas HaEtz,
   * which this model keeps south, so the site is a reconstruction), x 73.5 .. 81 (the
   * Cheil lane along the Soreg, x 81 .. 83.5, stays open), z -79 .. -63, the court wall
   * its south face, floor at the Cheil level. The Kohen Gadol's door to the Cheil is in
   * its east wall; inside, the Nitzotz tower's plan ({@link buildNitzotzWicket}): a lower
   * flight of 16 half-amah steps along the Soreg side climbs west from a 3 x 3 entry
   * strip inside the door, a landing crosses the west end, an upper flight along the
   * wall side climbs back east to a landing at the court level that opens through the
   * 3-amah bay in the wall beside the gate's west jamb ({@link palhedrinBay}, cut in
   * buildNorthWall) into the Korban gate passage; a quarter-amah wall between the
   * flights. Size, stair and bay are reconstructions (temple.json: the entry's notes,
   * meta.disputes). Between the Middot 1:9 bath-house (z -52 .. -42) and the Nitzotz
   * tower (z -99 .. -83), touching neither.
   */
  buildLishkasPalhedrin() {
    const e = this.entry('lishkas_palhedrin');
    const { w, d, h } = e.geometry;
    const bay = this.palhedrinBay;
    const t = ROOM_WALL_T;
    const yPav = this.level('cheil') + CHEIL_LIP;
    const F = yPav + LIP;
    const floor = e.position.y; // the Cheil level: 32 half-amah rises close on the court level
    const top = this.yKohanim;
    const steps = 16;
    const rise = (top - floor) / (2 * steps); // 0.5
    const run = steps * rise; // 8
    const x1 = X_OUT; // 73.5
    const x2 = X_OUT + w; // 81
    const z2 = bay.z2 + FRAME_T; // -63: the gate's west edge
    const z1 = z2 - d; // -79
    const roof = floor + h; // 8.5
    const bottom = floor - SLAB;
    const xWall = [x1, x1 + 3]; // the wall-side band: the upper flight and the top landing
    const xSoreg = [x1 + 3.5, x2 - t]; // 77 .. 80: the lower flight and the entry strip
    const zFoot = bay.z1; // -67: the entry strip is z -67 .. -64 inside the Cheil door
    const zTurn = zFoot - run; // -75
    const doorX = (xSoreg[0] + xSoreg[1]) / 2; // 78.5
    this.group('lishkas_palhedrin', () => {
      this.roomA({
        x1, x2, z1, z2, floor: yPav, h: roof - yPav, base: GROUND, floorMat: this.mat.floor, wallMat: this.mat.stonePolished, roofMat: this.mat.stone, skip: ['s'], name: 'lishkas_palhedrin',
        doors: [{ face: 'e', at: doorX, w: 2.5, h: 6, frame: this.mat.cedar, doors: 'open', doorMat: this.mat.cedar, name: 'lishkas_palhedrin cheil door' }],
      });
      this.flightMergedA({ axis: 'z', span: xSoreg, from: zFoot, to: zTurn, yBase: floor, bottom, steps, rise, mat: this.mat.stonePolished, name: 'lishkas_palhedrin stair' });
      this.blockA(x1, x2 - t, zTurn, z1 + t, bottom, floor + run, this.mat.stonePolished, 'lishkas_palhedrin landing');
      this.flightMergedA({ axis: 'z', span: xWall, from: zTurn, to: zFoot, yBase: floor + run, bottom, steps, rise, mat: this.mat.stonePolished, name: 'lishkas_palhedrin stair' });
      this.blockA(xWall[0], xWall[1], zFoot, z2 - t, bottom, top, this.mat.stonePolished, 'lishkas_palhedrin landing');
      // Between the flights, from the turn landing to the east wall.
      this.wallA(xWall[1], xSoreg[0], zTurn, z2 - t, F, roof, this.mat.stonePolished);
    }, { part: 'chamber' });
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
      // The rails along x stop at the rails along z (overlapping ends shared faces and z-fought).
      rail(x - s + 0.15, x + s - 0.15, z - s, z - s + 0.15);
      rail(x - s + 0.15, x + s - 0.15, z + s - 0.15, z + s);
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
