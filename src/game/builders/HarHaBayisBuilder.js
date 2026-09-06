import { CHEIL_LIP, CourtBuilder, GROUND, SLAB, WALL_T } from './CourtBuilder.js';
import { instance } from '../instanced.js';
import { AMAH } from '../../content/units.js';

// ============================================================================
// HAR HABAYIS BUILDER - the 500 x 500 mount (Middot 2:1), its wall with the five
// gates (Middot 1:3), the Soreg, the Cheil and the twelve steps up to the Ezras
// Nashim gate (Middot 2:3). Amos in the azarah frame (temple.json).
// ============================================================================

/** Wall tops, amos above the Azarah floor; the mount is at -13.5. Heights are not given in Middot. */
const WALL_TOP = 11.5;
/** The east wall is lower (Middot 2:4) so the Kohen on Har HaMishcha sees the Heichal entrance. */
const EAST_WALL_TOP = 8.5;
/** Merlon pitch along the wall tops, amos. */
const MERLON_PITCH = 4;
/** Soreg post pitch, amos. */
const POST_PITCH = 1;
/** How far Tadi's leaning stones stand out of each face of the wall, amos. */
const TADI_STONE_PROUD = 0.5;
/** Thickness of each of Tadi's two leaning stones, amos: a slab, not a plank (not given in Middot). */
const TADI_STONE_T = 1;
/**
 * Rise of Tadi's gable, amos: the stones' undersides climb from the opening's top corners
 * (y 6.5, the gate being 20 high on the mount at -13.5) to a ridge 3.1 higher, a slope of
 * atan(3.1 / 5) = 31.8 deg over the 10-wide opening. Their tops peak 1 / cos(31.8 deg) = 1.18
 * above that, at 10.78, which keeps the whole gable 0.72 under WALL_TOP (11.5) and clear
 * of the merlons. Middot 2:3 gives the two stones, not their pitch.
 */
const TADI_GABLE_RISE = 3.1;
/** Cheek walls beside the twelve steps: thickness and height over the top tread, amos. */
const CHEEK_T = 0.5;
const CHEEK_H = 1.2;

export class HarHaBayisBuilder extends CourtBuilder {
  build() {
    this.y = this.level('har_habayis');
    this.area = this.entry('har_habayis');
    this.buildPlaza();
    this.buildOuterWall();
    this.buildCheil();
    this.buildSoreg();
    this.buildCheilSteps();
  }

  buildPlaza() {
    const b = this.area.bounds;
    this.group('har_habayis', () => {
      this.floorA(b.minX, b.maxX, b.minZ, b.maxZ, this.y, this.mat.stone, 'har_habayis');
    });
  }

  gate(id, along) {
    const e = this.entry(id);
    return {
      at: along === 'x' ? e.position.x : e.position.z, w: e.geometry.w, h: e.geometry.h, floor: e.position.y, entry: id, name: id,
      frame: this.mat.gold, doors: 'open', doorMat: this.mat.goldEng, threshold: true,
    };
  }

  /**
   * Shaar Tadi has no lintel: two stones lean one on the other over the opening (Middot
   * 2:3). wallRunA's `gable` builds them as slabs from the jamb tops meeting at the ridge,
   * the wall's thickness plus TADI_STONE_PROUD beyond each face, under a notched wall.
   */
  tadiGate() {
    return { ...this.gate('shaar_tadi', 'z'), gable: { rise: TADI_GABLE_RISE, t: TADI_STONE_T, proud: TADI_STONE_PROUD } };
  }

  /** The wall around the mount, 6 thick outside the 500 x 500, with merlons along its top. */
  buildOuterWall() {
    const b = this.area.bounds;
    const x1 = b.minX - WALL_T;
    const x2 = b.maxX + WALL_T;
    const z1 = b.minZ - WALL_T;
    const z2 = b.maxZ + WALL_T;
    const m = this.mat.stone;
    this.group('har_habayis', () => {
      // South (two Chuldah gates), north (Tadi), west (Kiponus), east (Shushan, lower).
      this.wallRunA({ along: 'z', across: [x1, b.minX], from: z1, to: z2, y1: GROUND, y2: WALL_TOP, mat: m, openings: [this.gate('chuldah_gate_west', 'z'), this.gate('chuldah_gate_east', 'z')] });
      this.wallRunA({ along: 'z', across: [b.maxX, x2], from: z1, to: z2, y1: GROUND, y2: WALL_TOP, mat: m, openings: [this.tadiGate()] });
      this.wallRunA({ along: 'x', across: [z1, b.minZ], from: b.minX, to: b.maxX, y1: GROUND, y2: WALL_TOP, mat: m, openings: [this.gate('shaar_kiponus', 'x')] });
      this.wallRunA({ along: 'x', across: [b.maxZ, z2], from: b.minX, to: b.maxX, y1: GROUND, y2: EAST_WALL_TOP, mat: m, openings: [this.gate('shaar_shushan', 'x')] });
      this.buildMerlons(x1, x2, z1, z2, b);
    }, { part: 'wall' });
  }

  buildMerlons(x1, x2, z1, z2, b) {
    const items = [];
    const geo = this.box(MERLON_PITCH / 2 * AMAH, 2 * AMAH, WALL_T * AMAH, this.mat.stone);
    const runZ = (x, top) => {
      for (let z = z1 + MERLON_PITCH / 2; z < z2; z += MERLON_PITCH) items.push({ position: this.pt(x, top + 1, z), rotation: [0, Math.PI / 2, 0] });
    };
    const runX = (z, top) => {
      for (let x = b.minX + MERLON_PITCH * 1.5; x < b.maxX - MERLON_PITCH; x += MERLON_PITCH) items.push({ position: this.pt(x, top + 1, z) });
    };
    runZ((x1 + b.minX) / 2, WALL_TOP);
    runZ((b.maxX + x2) / 2, WALL_TOP);
    runX((z1 + b.minZ) / 2, WALL_TOP);
    runX((b.maxZ + z2) / 2, EAST_WALL_TOP);
    const merlons = instance(geo, this.mat.stone, items, { name: 'merlons' });
    merlons.userData.lodDistance = 220; // a 2-amah merlon is a few pixels beyond this (game/lod.js)
    this.scene.add(merlons);
  }

  /** Extents of the Soreg ring (10 amos outside the court walls). */
  get ring() {
    const s = this.entry('soreg');
    const c = this.entry('cheil');
    const xOut = 67.5 + WALL_T + c.geometry.w; // 83.5
    const azarahWest = -187 - WALL_T - c.geometry.w; // -203
    return { x1: -xOut, x2: xOut, z1: azarahWest, z2: s.position.z, xIn: 67.5 + WALL_T, zIn1: -187 - WALL_T, zIn2: 141 + WALL_T };
  }

  /** The Cheil: a 10-amah pavement ring between the Soreg and the court walls. */
  buildCheil() {
    const r = this.ring;
    const y = this.y + CHEIL_LIP;
    const m = this.mat.stonePolished;
    this.group('cheil', () => {
      this.floorA(r.x1, -r.xIn, r.z1, r.z2, y, m, 'cheil');
      this.floorA(r.xIn, r.x2, r.z1, r.z2, y, m, 'cheil');
      this.floorA(-r.xIn, r.xIn, r.z1, r.zIn1, y, m, 'cheil');
      this.floorA(-r.xIn, r.xIn, r.zIn2, r.z2, y, m, 'cheil');
    });
  }

  /**
   * The Soreg (Middot 2:3): a lattice 10 tefachim high around the Cheil, with an
   * opening opposite every gate. Posts are one InstancedMesh; each straight run has
   * two rails and an invisible collider.
   */
  buildSoreg() {
    const s = this.entry('soreg');
    const h = s.geometry.h;
    const r = this.ring;
    const gateZ = (id) => this.entry(id).position.z;
    const gateX = (id) => this.entry(id).position.x;
    const gapsSouth = ['water_gate', 'bechoros_gate', 'delek_gate', 'shaar_elyon'].map(gateZ);
    const gapsNorth = ['nitzotz_gate', 'korban_gate', 'shaar_hanashim', 'beis_hamoked_gate'].map(gateZ);
    const gapsWest = ['shaar_maaravi_north', 'shaar_maaravi_south'].map(gateX);
    const gapsEast = [gateX('ezras_nashim_gate')];
    const posts = [];
    const y = this.y;
    const run = (along, at, from, to, gaps) => {
      const edges = [from, ...gaps.flatMap((g) => [g - 5, g + 5]).sort((a, b) => a - b), to];
      for (let i = 0; i < edges.length; i += 2) {
        const a = edges[i];
        const b = edges[i + 1];
        if (b - a < POST_PITCH) continue;
        const rect = along === 'x' ? [a, b, at - 0.15, at + 0.15] : [at - 0.15, at + 0.15, a, b];
        for (const ry of [h - 0.25, h / 2]) this.decoA(...rect, y + ry, y + ry + 0.15, this.mat.cedar);
        this.colliderA(...rect, y, y + h);
        for (let t = a + POST_PITCH / 2; t < b; t += POST_PITCH) posts.push({ position: along === 'x' ? this.pt(t, y + h / 2, at) : this.pt(at, y + h / 2, t) });
      }
    };
    this.group('soreg', () => {
      run('z', r.x1, r.z1, r.z2, gapsSouth);
      run('z', r.x2, r.z1, r.z2, gapsNorth);
      run('x', r.z1, r.x1, r.x2, gapsWest);
      run('x', r.z2, r.x1, r.x2, gapsEast);
      const postMesh = instance(this.box(0.2 * AMAH, h * AMAH, 0.2 * AMAH, this.mat.cedar), this.mat.cedar, posts, { name: 'soreg posts', castShadow: false });
      postMesh.userData.lodDistance = 160; // the rails carry the line; the posts are detail (game/lod.js)
      this.scene.add(postMesh);
    });
  }

  /** Twelve half-amah steps from the Cheil up to the Ezras Nashim gate (Middot 2:3). */
  buildCheilSteps() {
    const e = this.entry('cheil_steps');
    const steps = e.dimensions.find((x) => x.label === 'steps')?.value ?? 12;
    const zTop = e.position.z - e.geometry.d / 2; // 147
    const zBottom = e.position.z + e.geometry.d / 2; // 153
    const half = e.geometry.w / 2;
    this.group('cheil_steps', () => {
      this.flightA({ axis: 'z', span: [-half, half], from: zBottom, to: zTop, yBase: this.y, bottom: this.y - SLAB, steps, rise: e.geometry.h / steps, mat: this.mat.marbleW, name: 'cheil_steps' });
      // Cheek walls: the flight is twice the gate's width, so beside the gate its top
      // treads stand 6 amos over the Cheil with nothing at their ends. A solid mass from
      // the Cheil to CHEEK_H over the threshold blocks from every tread (not given in Middot).
      for (const s of [-1, 1]) this.blockA(s * half, s * (half + CHEEK_T), zTop, zBottom, this.y - SLAB, this.y + e.geometry.h + CHEEK_H, this.mat.marbleW, 'cheil_steps cheek');
    });
  }
}
