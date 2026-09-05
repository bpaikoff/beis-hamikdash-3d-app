import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CourtBuilder, GROUND, LIP, SLAB, WALL_T } from './CourtBuilder.js';
import { instance } from '../instanced.js';
import { AMAH } from '../../content/units.js';

// ============================================================================
// EZRAS NASHIM BUILDER - the 135 x 135 women's court (Middot 2:5), its four corner
// chambers, the balcony, the east gate, the fifteen semicircular steps and the
// Nicanor Gate with its two side chambers. Amos in the azarah frame (temple.json).
// ============================================================================

const X_IN = 67.5;
const X_OUT = X_IN + WALL_T;
/** Wall top, amos above the Azarah floor (22.5 above the court; not given in Middot). */
const WALL_TOP = 15;
/** Gallery parapet height, amos: taller than CONFIG.STEP_HEIGHT so the player cannot step over it. */
const PARAPET_H = 1.2;
/**
 * Balustrade height over each tread of the gallery flights, amos. From a tread the
 * segment beside the tread below tops out BALUSTRADE_H - 0.5 higher than the feet, and
 * it must exceed a step (1 amah) so the stair cannot be climbed sideways out of.
 */
const BALUSTRADE_H = 2.5;

export class EzrasNashimBuilder extends CourtBuilder {
  build() {
    this.y = this.level('ezras_nashim');
    this.area = this.entry('ezras_nashim');
    this.buildCourt();
    this.buildWalls();
    this.buildCornerChambers();
    this.buildBalcony();
    this.buildKleiShir();
    this.buildMaalosShir();
    this.buildNicanor();
  }

  buildCourt() {
    const b = this.area.bounds;
    this.group('ezras_nashim', () => {
      this.floorA(b.minX, b.maxX, b.minZ, b.maxZ, this.y, this.mat.mosaic, 'ezras_nashim');
    });
  }

  /** North and south walls, and the east wall with the gate the Cheil steps climb to. */
  buildWalls() {
    const b = this.area.bounds;
    const gate = this.entry('ezras_nashim_gate');
    const zOut = b.maxZ + WALL_T;
    this.group('ezras_nashim', () => {
      for (const [a1, a2] of [[-X_OUT, -X_IN], [X_IN, X_OUT]]) {
        this.wallRunA({ along: 'z', across: [a1, a2], from: b.minZ, to: zOut, y1: GROUND, y2: WALL_TOP, mat: this.mat.stone });
      }
      this.wallRunA({
        along: 'x', across: [b.maxZ, zOut], from: -X_OUT, to: X_OUT, y1: GROUND, y2: WALL_TOP, mat: this.mat.stone,
        openings: [{
          at: gate.position.x, w: gate.geometry.w, h: gate.geometry.h, floor: gate.position.y, entry: 'ezras_nashim_gate', name: 'ezras_nashim_gate',
          frame: this.mat.gold, doors: 'open', doorMat: this.mat.goldEng, threshold: true,
        }],
      });
    }, { part: 'walls' });
  }

  /**
   * Four unroofed 40 x 40 chambers in the corners (Middot 2:5), each with a door toward
   * the court. The gallery (buildBalcony) runs along their walls two amos below the wall
   * tops, and the player's collision sphere is at head height, so an invisible collider
   * carries each wall on up past head height above the gallery: otherwise a visitor on
   * the gallery would walk over the wall top and drop into the chamber.
   */
  buildCornerChambers() {
    const b = this.area.bounds;
    const guardTop = this.entry('ezras_nashim_balcony').position.y + 4;
    const ids = ['chamber_oils', 'chamber_lepers', 'chamber_nazirites', 'chamber_wood'];
    for (const id of ids) {
      const e = this.entry(id);
      const { w, d, h } = e.geometry;
      const x1 = e.position.x - w / 2;
      const x2 = e.position.x + w / 2;
      const z1 = e.position.z - d / 2;
      const z2 = e.position.z + d / 2;
      const north = e.position.x > 0;
      const east = e.position.z > (b.minZ + b.maxZ) / 2;
      const skip = [north ? 'n' : 's', east ? 'e' : 'w'];
      const doorFace = north ? 's' : 'n';
      this.group(id, () => {
        this.roomA({
          x1, x2, z1, z2, floor: this.y, h, floorMat: this.mat.marbleW, wallMat: this.mat.stonePolished, roof: false, skip, name: id,
          doors: [{ face: doorFace, at: e.position.z, w: 4, h: 8, frame: this.mat.stonePolished }],
        });
        for (const f of ['n', 's', 'e', 'w']) {
          if (skip.includes(f) || this.y + h >= guardTop) continue;
          const face = { n: [x2 - 1, x2, z1, z2], s: [x1, x1 + 1, z1, z2], e: [x1, x2, z2 - 1, z2], w: [x1, x2, z1, z1 + 1] }[f];
          this.colliderA(...face, this.y + h, guardTop);
        }
        this.furnish(id, x1, x2, z1, z2, north, east);
      });
    }
  }

  /** Props per chamber: oil jars, the lepers' mikveh, the Nazirites' hearth, the wood store. */
  furnish(id, x1, x2, z1, z2, north, east) {
    const y = this.y + LIP;
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    // The wall faces shared with the court walls are the back of each chamber.
    const backX = north ? x2 - 1 : x1 + 1;
    const dirX = north ? -1 : 1;
    const backZ = east ? z2 - 1 : z1 + 1;
    const dirZ = east ? -1 : 1;
    if (id === 'chamber_oils') {
      const jar = new THREE.CylinderGeometry(0.45 * AMAH, 0.3 * AMAH, 1.4 * AMAH, 12);
      const items = [];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) items.push({ position: this.pt(backX + dirX * (1 + i * 1.3), y + 0.7, backZ + dirZ * (2 + j * 1.5)) });
      this.scene.add(instance(jar, this.mat.marbleR, items, { name: 'oil jars' }));
      for (let i = 0; i < 3; i++) this.decoA(cx - 6 + i * 5, cx - 5 + i * 5, cz - 3, cz + 3, y, y + 0.9 + i * 0.3, this.mat.cedar);
    } else if (id === 'chamber_lepers') {
      // The immersion pool (Middot 2:5), a stone tank with steps up to its rim.
      const s = 4;
      for (const [ax, bx, az, bz] of [[cx - s, cx - s + 0.6, cz - s, cz + s], [cx + s - 0.6, cx + s, cz - s, cz + s], [cx - s, cx + s, cz - s, cz - s + 0.6], [cx - s, cx + s, cz + s - 0.6, cz + s]]) {
        this.wallA(ax, bx, az, bz, y, y + 1.5, this.mat.stonePolished);
      }
      this.decoA(cx - s + 0.6, cx + s - 0.6, cz - s + 0.6, cz + s - 0.6, y + 1.1, y + 1.2, this.mat.water);
      this.flightA({ axis: 'z', span: [cx - 2, cx + 2], from: cz + s + 3, to: cz + s, yBase: y, steps: 3, rise: 0.5, mat: this.mat.stonePolished, name: 'mikveh steps' });
    } else if (id === 'chamber_nazirites') {
      // Hearth for cooking the shelamim (Middot 2:5) and a pot over it.
      const hearth = new THREE.Mesh(new THREE.CylinderGeometry(1.6 * AMAH, 1.8 * AMAH, 0.8 * AMAH, 16), this.mat.stone);
      hearth.position.set(...this.pt(cx, y + 0.4, cz));
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.9 * AMAH, 0.7 * AMAH, 1 * AMAH, 16), this.mat.copper);
      pot.position.set(...this.pt(cx, y + 1.3, cz));
      for (const m of [hearth, pot]) {
        m.castShadow = true;
        this.scene.add(m);
      }
      const log = new THREE.CylinderGeometry(0.2 * AMAH, 0.2 * AMAH, 2 * AMAH, 8);
      const items = [];
      for (let i = 0; i < 6; i++) items.push({ position: this.pt(backX + dirX * 1.5, y + 0.2 + (i % 2) * 0.4, backZ + dirZ * (3 + i * 0.5)), rotation: [0, 0, Math.PI / 2] });
      this.scene.add(instance(log, this.mat.cedar, items, { name: 'hearth logs' }));
      for (let i = 0; i < 4; i++) this.decoA(cx - 8 + i * 5, cx - 7 + i * 5, cz + 6, cz + 9, y, y + 0.8, this.mat.cedar);
    } else if (id === 'chamber_wood') {
      // Stacked logs for the pyre, sorted by the blemished Kohanim (Middot 2:5).
      const log = new THREE.CylinderGeometry(0.25 * AMAH, 0.25 * AMAH, 4 * AMAH, 8);
      const items = [];
      for (let row = 0; row < 6; row++) {
        for (let k = 0; k < 8; k++) items.push({ position: this.pt(backX + dirX * (2 + k * 0.6), y + 0.25 + row * 0.45, backZ + dirZ * (3 + row * 5)), rotation: [Math.PI / 2, 0, 0] });
      }
      this.scene.add(instance(log, this.mat.cedar, items, { name: 'wood store' }));
      this.colliderA(backX, backX + dirX * 7, backZ, backZ + dirZ * 30, y, y + 3);
    }
  }

  /**
   * Gallery 10 amos up (Middot 2:5; Sukkah 51b) along the inside of the court: a
   * continuous U of 4-amah runs on the south and north walls between the corner
   * chambers, along the court-facing walls of the two eastern chambers, and across the
   * east wall over the gate. Two flights of twenty half-amah steps rise to it along the
   * east wall on either side of the gate; the sources give no stair, so the flights,
   * like the gallery's depth and height, are a reconstruction. Walkable, with a
   * parapet on the inner edge except where the flights land.
   */
  buildBalcony() {
    const e = this.entry('ezras_nashim_balcony');
    const depth = e.geometry.w;
    const b = this.area.bounds;
    const y = e.position.y;
    const rise = 0.5;
    const steps = Math.round((y - this.y) / rise);
    const zA = b.minZ + 40; // the western chambers end here
    const zB = b.maxZ - 40; // the eastern chambers begin here
    const xA = X_IN - 40; // the eastern chambers' court-facing walls
    const zE = b.maxZ - depth; // inner edge of the east run
    const flightLen = 20; // 20 steps of one amah tread
    const landing = 4;
    const xTop = xA - flightLen; // 7.5: the flights' top step
    const xLand = xTop - landing; // 3.5
    const P = 0.5; // parapet thickness
    const runs = [];
    const parapets = [];
    for (const s of [-1, 1]) {
      // Wall run, then along the eastern chamber's west and court-facing walls, in amos on the side's own sign.
      const wallRun = { x1: X_IN - depth, x2: X_IN, z1: zA, z2: zB, along: 'z' };
      const westRun = { x1: xA - depth, x2: X_IN - depth, z1: zB - depth, z2: zB, along: 'x' };
      const courtRun = { x1: xA - depth, x2: xA, z1: zB, z2: zE, along: 'z' };
      for (const r of [wallRun, westRun, courtRun]) runs.push({ ...r, x1: s * r.x1, x2: s * r.x2 });
      parapets.push([s * (X_IN - depth), s * (X_IN - depth + P), zA, zB - depth + P]);
      parapets.push([s * (xA - depth), s * (X_IN - depth + P), zB - depth, zB - depth + P]);
      parapets.push([s * (xA - depth), s * (xA - depth + P), zB - depth, zE + P]);
      // The east run's parapet over the flight is part of the flight's balustrade (below).
    }
    runs.push({ x1: -xA, x2: xA, z1: zE, z2: b.maxZ, along: 'x' }); // east wall, over the gate
    parapets.push([-xLand, xLand, zE, zE + P]);
    this.group('ezras_nashim_balcony', () => {
      const corbels = [];
      for (const r of runs) {
        const x1 = Math.min(r.x1, r.x2);
        const x2 = Math.max(r.x1, r.x2);
        this.floorA(x1, x2, r.z1, r.z2, y, this.mat.stonePolished, 'ezras_nashim_balcony');
        const len = r.along === 'x' ? x2 - x1 : r.z2 - r.z1;
        const n = Math.floor(len / 8);
        for (let i = 0; i <= n; i++) {
          const t = i === n ? len - 1 : 1 + i * 8;
          if (r.along === 'x') corbels.push({ position: this.pt(x1 + t, y - SLAB - 0.6, (r.z1 + r.z2) / 2), rotation: [0, Math.PI / 2, 0] });
          else corbels.push({ position: this.pt((x1 + x2) / 2, y - SLAB - 0.6, r.z1 + t) });
        }
      }
      // Solid masses, not walls: the player's collision sphere sits at head height, so a
      // knee-high wall would never touch it; a mass taller than a step blocks the way.
      for (const [x1, x2, z1, z2] of parapets) this.blockA(Math.min(x1, x2), Math.max(x1, x2), z1, z2, y, y + PARAPET_H, this.mat.stonePolished, 'ezras_nashim_balcony parapet');
      this.scene.add(instance(this.box(depth * AMAH, 1.2 * AMAH, 1 * AMAH, this.mat.stone), this.mat.stone, corbels, { name: 'balcony corbels' }));
      // The flights: from the eastern chambers' walls toward the gate, landing beside it.
      for (const s of [-1, 1]) {
        this.flightA({ axis: 'x', span: [zE - depth, zE], from: s * xA, to: s * xTop, yBase: this.y, steps, rise, mat: this.mat.stonePolished, name: 'ezras_nashim_balcony stair' });
        this.blockA(s * xLand, s * xTop, zE - depth, zE, this.y - SLAB, y, this.mat.stonePolished, 'ezras_nashim_balcony landing');
        this.buildFlightBalustrade(s, { xA, xTop, xLand, zE, depth, steps, rise, y, P });
      }
    });
  }

  /**
   * Balustrades on both long sides of a flight and across the landing's edge toward the
   * axis: without them every tread is an open drop of up to ten amos to the court on
   * either side (the sources give no stair, so this is part of the same reconstruction).
   * Solid from the court floor so the probe reads "inside" from the court as well as from
   * the treads; on the court side a stepped wall BALUSTRADE_H over each tread (taller
   * than a step even from the tread above, so it cannot be climbed), on the gate side a
   * wall up to the parapet over the east run. The two lowest treads stay open on both
   * sides: the flight's foot is against the chamber wall, so that is the way onto it.
   */
  buildFlightBalustrade(s, { xA, xTop, xLand, zE, depth, steps, rise, y, P }) {
    const H = BALUSTRADE_H;
    const open = 2;
    const zIn = zE - depth; // court side of the flight
    const base = this.y - SLAB;
    const mat = this.mat.stonePolished;
    const parts = [];
    const cheek = (x1, x2, z1, z2, top) => parts.push(this.frameBox(Math.min(s * x1, s * x2), Math.max(s * x1, s * x2), z1, z2, base, top, mat));
    for (let k = open; k < steps; k++) {
      const a = xA - k;
      const top = this.y + (k + 1) * rise + H;
      cheek(a, a - 1, zIn - P, zIn, top);
      if (a - 1 >= xA - depth) cheek(a, a - 1, zE, zE + P, top); // the treads under the gallery's corner, before the tall wall begins
    }
    cheek(xA - depth, xTop + 1, zE, zE + P, y + PARAPET_H); // gate side: up to the parapet, which it carries
    cheek(xTop, xLand - P, zIn - P, zIn, y + PARAPET_H); // beside the landing
    cheek(xLand, xLand - P, zIn - P, zE + P, y + PARAPET_H); // the landing's edge toward the axis, closing on the parapet over the gate
    const geo = BufferGeometryUtils.mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData = { isFloor: true, isStep: true, name: 'ezras_nashim_balcony balustrade' };
    this.scene.add(m);
    this.floors.push(m);
    return m;
  }

  /** Two vaulted rooms under the Ezras Yisrael floor, opening east through the Azarah wall. */
  buildKleiShir() {
    const e = this.entry('lishkos_klei_shir');
    const { w, d } = e.geometry;
    const ey = this.entry('azaras_yisrael');
    const ceiling = ey.position.y - SLAB; // underside of the Ezras Yisrael floor slab
    this.group('lishkos_klei_shir', () => {
      for (const s of [1, -1]) {
        const x1 = s * e.position.x - w / 2;
        const x2 = s * e.position.x + w / 2;
        this.roomA({ x1, x2, z1: -d, z2: 0, floor: this.y, h: ceiling - this.y, floorMat: this.mat.floor, roof: false, skip: ['e'], name: 'lishkos_klei_shir' });
        // Threshold through the Azarah east wall (the opening and frame are AzaraBuilder's).
        this.floorA(s * e.position.x - 2, s * e.position.x + 2, 0, WALL_T, this.y, this.mat.stonePolished, 'lishkos_klei_shir');
        // Instruments hung on the back wall.
        this.decoA(x1 + 1.5, x2 - 1.5, -d + 1, -d + 1.3, this.y + 2, this.y + 4, this.mat.cedar);
      }
    });
  }

  /**
   * Fifteen semicircular steps (Middot 2:5) concentric on the Nicanor Gate: solid
   * half-cylinders of decreasing radius, each 0.5 higher, merged into one mesh; the
   * innermost (radius 5.5) tops out level with the Nicanor threshold.
   */
  buildMaalosShir() {
    const e = this.entry('maalos_shir');
    const steps = e.dimensions.find((x) => x.label === 'steps')?.value ?? 15;
    const rise = e.geometry.h / steps;
    const rIn = e.geometry.d - e.geometry.h; // 5: the gate's half-width
    const rOut = e.geometry.d; // 12.5
    const tread = (rOut - rIn) / steps;
    const cz = WALL_T; // concentric on the gate at the wall's east face (temple.json: centred on x 0, z 6)
    const base = this.y - SLAB;
    const parts = [];
    for (let i = 0; i < steps; i++) {
      const r = rOut - i * tread;
      const top = this.y + (i + 1) * rise;
      const g = new THREE.CylinderGeometry(r * AMAH, r * AMAH, (top - base) * AMAH, 64, 1, false, -Math.PI / 2, Math.PI);
      g.translate(...this.pt(e.position.x, (top + base) / 2, cz));
      parts.push(g);
    }
    const geo = BufferGeometryUtils.mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    this.group('maalos_shir', () => {
      const m = new THREE.Mesh(geo, this.mat.marbleW);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData = { isFloor: true, isStep: true, name: 'maalos_shir' };
      this.scene.add(m);
      this.floors.push(m);
    });
  }

  /** The Nicanor Gate (bronze doors, Middot 2:3) and the chambers on either side (Middot 1:4). */
  buildNicanor() {
    const gate = this.entry('nicanor_gate');
    const y = gate.position.y;
    this.group('nicanor_gate', () => {
      this.gateA({
        along: 'x', across: [0, WALL_T], at: gate.position.x, w: gate.geometry.w, floor: y, h: gate.geometry.h,
        frame: this.mat.copper, doors: 'open', doorMat: this.mat.copper, threshold: true, thresholdMat: this.mat.marbleW, name: 'nicanor_gate',
      });
    });
    for (const id of ['lishkas_pinchas_hamalbish', 'lishkas_osei_chavitin']) {
      const c = this.entry(id);
      const { w, d, h } = c.geometry;
      const x1 = c.position.x - w / 2;
      const x2 = c.position.x + w / 2;
      this.group(id, () => {
        this.roomA({
          x1, x2, z1: 0, z2: d, floor: y, h, floorMat: this.mat.marbleW, wallMat: this.mat.stonePolished, roof: false, name: id,
          doors: [
            { face: 'w', at: c.position.x, w: 3, h: 6, frame: this.mat.cedar },
            { face: 'e', at: c.position.x, w: 2, h: 4, frame: this.mat.cedar, doors: 'closed', doorMat: this.mat.copper, name: `${id} wicket` },
          ],
        });
      });
    }
  }
}
