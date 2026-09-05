import * as THREE from 'three';
import { BaseBuilder } from './BaseBuilder.js';
import { instance, instancePositions } from '../instanced.js';
import { byId, worldPos } from '../../content/index.js';
import { A, LEVEL, yAmos, periodGroup } from './HeichalBuilder.js';

// ============================================================================
// KEILIM BUILDER - the Mizbeach with its kevesh and the two small ramps, the
// Kiyor, and inside the Heichal the Menorah, Shulchan and golden altar; in the
// Kodesh HaKodashim the Aron and Shlomo's keruvim (Bayis Rishon only).
//
// Each vessel is one THREE.Group positioned at worldPos(entry) with its parts in
// metres relative to that point; every dimension is taken from temple.json in
// amos. Repeated parts (horns, spouts, lamps, loaves) are InstancedMesh.
// ============================================================================

/** A unit cylinder along +y stretched from `from` to `to` (metres, group-local). */
function segment(from, to, radius) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dy, dz);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize());
  return new THREE.Matrix4().compose(
    new THREE.Vector3((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2),
    q,
    new THREE.Vector3(radius, len, radius)
  );
}

/** Material of the invisible collision boxes (never rendered). */
const SOLID_MAT = new THREE.MeshBasicMaterial({ visible: false });

export class KeilimBuilder extends BaseBuilder {
  build() {
    this.redLine = new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.8 });
    this.ash = new THREE.MeshStandardMaterial({ color: 0x6e6a66, roughness: 1 });
    this.ember = new THREE.MeshBasicMaterial({ color: 0xff6a1a, toneMapped: false });
    this.bread = new THREE.MeshStandardMaterial({ color: 0xd4a862, roughness: 0.85 });
    this.levonah = new THREE.MeshStandardMaterial({ color: 0xfffff0, roughness: 0.9 });

    this.buildMizbeach();
    this.buildKevesh();
    this.buildKevashimKetanim();
    this.buildKiyor();
    this.buildMenorah();
    this.buildShulchan();
    this.buildMizbeachHazahav();
    this.buildAron();
    this.buildKeruvim();
  }

  /** Group at the entry's world position, tagged for the HUD and the period toggle. */
  groupFor(entry) {
    const g = periodGroup(entry);
    g.position.set(...worldPos(entry));
    return g;
  }

  /** Solid box from group-local amos bounds {x, y, z} (y from the group's base). */
  local(g, b, mat, { floor = false, name } = {}) {
    const w = Math.abs(b.x[1] - b.x[0]) * A;
    const h = Math.abs(b.y[1] - b.y[0]) * A;
    const d = Math.abs(b.z[1] - b.z[0]) * A;
    const m = new THREE.Mesh(this.box(w, h, d, mat), mat);
    m.position.set(((b.x[0] + b.x[1]) / 2) * A, ((b.y[0] + b.y[1]) / 2) * A, ((b.z[0] + b.z[1]) / 2) * A);
    m.castShadow = true;
    m.receiveShadow = true;
    if (name) m.name = name;
    if (floor) {
      m.userData = { isFloor: true, name };
      this.floors.push(m);
    }
    g.add(m);
    return m;
  }

  /**
   * Invisible collision box (metres, group-local, y from the group's base) so a vessel
   * blocks the player without its many small parts each becoming a wall box.
   */
  solid(g, { x = 0, z = 0, w, h, d, name }) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), SOLID_MAT);
    m.position.set(x, h / 2, z);
    m.visible = false;
    m.userData = { isWall: true, name: name ?? `${g.name}-solid` };
    g.add(m);
    this.walls.push(m);
    return m;
  }

  // --------------------------------------------------------------------------
  // Mizbeach (Middot 3:1): 32 x 32 at the base; up 1 and in 1 = the yesod, up 5 and
  // in 1 = the sovev, up 3 and in 1 = the keranos and the Kohanim's walkway. The
  // yesod runs along the whole north and west and one amah onto the south and east
  // faces at the corners; there is none at the south-east corner. Red line at 5.
  // --------------------------------------------------------------------------
  buildMizbeach() {
    const e = byId.mizbeach;
    const g = this.groupFor(e);
    const dim = (label) => e.dimensions.find((d) => d.label === label).value;
    const half = e.geometry.w / 2; // 16
    const yesodH = dim('yesod height'); // 1
    const sovevH = dim('sovev height above the floor'); // 6
    const topH = dim("ma'aracha height above the floor"); // 9
    const H = dim('height'); // 10
    const lineH = dim('chut hasikra height'); // 5
    const stone = (this.mat.stoneFine ?? this.mat.stonePolished);

    // Yesod: an L along the west (z = -16) and north (x = +16) faces. The west strip
    // runs the full width, so its south end is the one amah onto the south face.
    this.local(g, { x: [-half, half], y: [0, yesodH], z: [-half, -half + 1] }, stone, { floor: true, name: 'yesod-west' });
    this.local(g, { x: [half - 1, half], y: [0, yesodH], z: [-half + 1, half] }, stone, { floor: true, name: 'yesod-north' });
    // Sovev tier: 30 x 30 from the floor to 6 (its top is the ledge)
    this.local(g, { x: [-half + 1, half - 1], y: [0, sovevH], z: [-half + 1, half - 1] }, stone, { floor: true, name: 'sovev' });
    // Ma'aracha tier: 28 x 28 to 9
    this.local(g, { x: [-half + 2, half - 2], y: [sovevH, topH], z: [-half + 2, half - 2] }, stone, { floor: true, name: 'maaracha' });
    // Four keranos 1 x 1 x 1 at the corners
    const c = half - 2.5;
    const keranos = instancePositions(
      this.box(A, A, A, stone),
      stone,
      [
        [-c, topH + 0.5, -c],
        [c, topH + 0.5, -c],
        [-c, topH + 0.5, c],
        [c, topH + 0.5, c],
      ].map((p) => p.map((v) => v * A)),
      { name: 'keranos' }
    );
    g.add(keranos);
    // Chut hasikra: the red line around the middle of the altar (Middot 3:1)
    const line = new THREE.Mesh(new THREE.BoxGeometry((2 * half - 2 + 0.1) * A, 0.15 * A, (2 * half - 2 + 0.1) * A), this.redLine);
    line.position.y = lineH * A;
    line.name = 'chut-hasikra';
    g.add(line);
    // Tapuach: the ash heap in the middle of the ma'aracha (Tamid 2:2)
    const tapuach = new THREE.Mesh(new THREE.SphereGeometry(2.5 * A, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), this.ash);
    tapuach.position.y = topH * A;
    tapuach.scale.y = 0.4;
    tapuach.name = 'tapuach';
    g.add(tapuach);
    g.userData.topY = yAmos(LEVEL.K + topH);
    g.userData.height = H;
    g.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    this.scene.add(g);
  }

  // --------------------------------------------------------------------------
  // Kevesh (Middot 3:3, Zevachim 62b): a smooth ramp 32 long x 16 wide on the south
  // of the altar, rising 9 from the court floor at x -46 to the ma'aracha at the
  // altar's south face; kevesh + altar = 62 (Middot 5:1), so 30 lie on the ground
  // and the top two overhang the (absent) yesod and the sovev. One sloped slab is
  // the walkable surface (slope 0.28 < STEP_HEIGHT), a wedge is the body.
  // --------------------------------------------------------------------------
  buildKevesh() {
    const e = byId.kevesh;
    const g = this.groupFor(e);
    const dim = (label) => e.dimensions.find((d) => d.label === label).value;
    const len = dim('length'); // 32
    const width = dim('width'); // 16
    const rise = dim('rise'); // 9
    const altarHalf = byId.mizbeach.geometry.w / 2; // 16
    const inset = 2; // the ma'aracha face is 2 in from the altar's base edge
    // group-local x (amos): the altar's south face is at (altar.x - 16) - kevesh.x
    const xFace = byId.mizbeach.position.x - altarHalf - e.position.x; // 15
    const xTop = xFace + inset; // 17
    const xFoot = xTop - len; // -15
    const angle = Math.atan2(rise, len);
    const hyp = Math.hypot(len, rise) * A;
    const slabT = 0.4;

    const slab = new THREE.Mesh(this.box(hyp, slabT, width * A, this.mat.stone), this.mat.stone);
    // Centre of the top face, then half a thickness down the face normal.
    slab.position.set(((xFoot + xTop) / 2) * A + (slabT / 2) * Math.sin(angle), (rise / 2) * A - (slabT / 2) * Math.cos(angle), 0);
    slab.rotation.z = angle;
    slab.userData = { isFloor: true, isRamp: true, name: 'kevesh' };
    slab.name = 'kevesh-slab';
    g.add(slab);
    this.floors.push(slab);

    // Body: a right triangle in x-y extruded along z, stopping at the sovev face so
    // the sovev ledge stays continuous beneath the overhang.
    const tri = new THREE.Shape();
    tri.moveTo(xFoot * A, -0.2);
    tri.lineTo((xFace + 1) * A, -0.2);
    tri.lineTo((xFace + 1) * A, (rise * (xFace + 1 - xFoot)) / len * A - slabT / 2);
    tri.closePath();
    const wedge = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: width * A, bevelEnabled: false }), this.mat.stone);
    wedge.position.z = (-width / 2) * A;
    wedge.name = 'kevesh-body';
    // In the floor collider too: a probe that starts inside the wedge meets its underside
    // (a back face) and the controller treats the ramp's flanks as solid.
    wedge.userData = { isFloor: true, name: 'kevesh-body' };
    g.add(wedge);
    this.floors.push(wedge);

    g.userData.footX = e.position.x + xFoot;
    g.userData.topX = e.position.x + xTop;
    g.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    this.scene.add(g);
  }

  // --------------------------------------------------------------------------
  // Zevachim 62b: two small ramps leave the kevesh, one east of it to the sovev
  // (height 6) and one west of it to the yesod (height 1). Each is a level walkway
  // along the edge of the kevesh from the point where the kevesh reaches that height
  // to the altar's south face; the western one continues along the south face to
  // the yesod at the south-west corner. Widths and courses are a reconstruction.
  // --------------------------------------------------------------------------
  buildKevashimKetanim() {
    const kevesh = byId.kevesh;
    const altar = byId.mizbeach;
    const altarHalf = altar.geometry.w / 2; // 16
    const len = kevesh.geometry.d; // 32
    const rise = kevesh.geometry.h; // 9
    const xFoot = altar.position.x - altarHalf - (len - 2); // -46 (world amos)
    const xFace = altar.position.x - altarHalf; // -16
    const width = 2;
    const stone = (this.mat.stoneFine ?? this.mat.stonePolished);

    for (const id of ['kevesh_katan_east', 'kevesh_katan_west']) {
      const e = byId[id];
      const g = this.groupFor(e);
      const target = e.dimensions.find((d) => d.label === 'height at the altar').value; // 6 (sovev) or 1 (yesod)
      const xStart = xFoot + (target / rise) * len; // where the kevesh is `target` high
      const xEnd = id === 'kevesh_katan_east' ? xFace + 1 : xFace; // sovev face is 1 in from the base edge
      const b = {
        x: [xStart - e.position.x, xEnd - e.position.x],
        y: [target - 0.8, target],
        z: [-width / 2, width / 2],
      };
      this.local(g, b, stone, { floor: true, name: `${id}-walkway` });
      if (id === 'kevesh_katan_west') {
        // along the south face to the south-west corner of the yesod (z -54)
        const zCorner = altar.position.z - altarHalf; // -54
        this.local(
          g,
          { x: [xFace - width - e.position.x, xFace - e.position.x], y: [target - 0.8, target], z: [-width / 2, zCorner - e.position.z] },
          stone,
          { floor: true, name: `${id}-corner` }
        );
      }
      this.scene.add(g);
    }
  }

  // --------------------------------------------------------------------------
  // Kiyor (Exodus 30:18, Middot 3:6, Yoma 3:10): bronze laver on a base, Ben Katin's
  // twelve spouts and the muchni, a wheel that lowered it into a cistern overnight.
  // Size is not given; the JSON hint is 3 x 3 x 2 amos.
  // --------------------------------------------------------------------------
  buildKiyor() {
    const e = byId.kiyor;
    const g = this.groupFor(e);
    const r = (e.geometry.w / 2) * A; // 0.75 m
    const h = e.geometry.h * A; // 1 m
    // Cistern rim flush with the floor (the muchni's shaft)
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.4, r * 1.4, 0.12, 24), this.mat.stone);
    rim.position.y = 0.06;
    g.add(rim);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.6, h * 0.5, 16), this.mat.copper);
    stand.position.y = 0.12 + h * 0.25;
    g.add(stand);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.7, h * 0.5, 24), this.mat.copperP);
    basin.position.y = 0.12 + h * 0.75;
    g.add(basin);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.92, 0.04, 24), this.mat.water);
    water.position.y = 0.12 + h * 0.97;
    water.castShadow = false;
    g.add(water);
    // Twelve spouts around the basin
    const n = e.dimensions.find((d) => d.label === 'spouts').value;
    const spoutGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8);
    const spouts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      spouts.push({
        position: [Math.cos(a) * r, 0.12 + h * 0.62, Math.sin(a) * r],
        rotation: [0, -a, Math.PI / 2],
      });
    }
    g.add(instance(spoutGeo, this.mat.copper, spouts, { name: 'kiyor-spouts' }));
    // Muchni: a cedar wheel on a post beside the laver, on its south side (the laver
    // stands against the south end of the Ulam steps, x -20, which would swallow it).
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, h * 1.2, 0.12), this.mat.cedar);
    post.position.set(-r * 1.7, h * 0.6, 0);
    g.add(post);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(h * 0.45, 0.05, 8, 24), this.mat.cedar);
    wheel.position.set(-r * 1.7 - 0.1, h * 1.05, 0);
    wheel.rotation.y = Math.PI / 2;
    wheel.name = 'muchni';
    g.add(wheel);
    // The laver and the muchni post are solid
    this.solid(g, { w: 2 * r + 0.1, h: 0.12 + h, d: 2 * r + 0.1, name: 'kiyor-solid' });
    this.solid(g, { x: -r * 1.7, w: 0.16, h: h * 1.2, d: 0.16, name: 'muchni-solid' });
    g.traverse((m) => {
      if (m.isMesh && m !== water) m.castShadow = true;
    });
    this.scene.add(g);
  }

  // --------------------------------------------------------------------------
  // Menorah (Exodus 25:31-39, Menachos 28b): 18 tefachim tall, seven branches with
  // cups, knobs and flowers; the lamps level in a row. A stone with three steps
  // stands before it on the east (Tamid 3:9). The flames are lit by ParticleSystem.
  // --------------------------------------------------------------------------
  buildMenorah() {
    const e = byId.menorah;
    const g = this.groupFor(e);
    const gold = this.mat.gold;
    const H = e.geometry.h * A; // 1.5 m
    const branches = e.dimensions.find((d) => d.label === 'branches').value; // 7
    const cupY = H - 0.1;
    const stemTop = H * 0.62;
    const rStem = 0.035;

    // Three feet
    const feet = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      feet.push({ position: [Math.cos(a) * 0.1, 0.02, Math.sin(a) * 0.1], rotation: [0, -a, 0] });
    }
    g.add(instance(new THREE.BoxGeometry(0.06, 0.04, 0.24), gold, feet, { name: 'menorah-feet' }));
    // Central stem
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(rStem, rStem * 1.3, stemTop, 12), gold);
    stem.position.y = stemTop / 2;
    g.add(stem);
    // Cups, knobs and flowers up the stem
    const knobs = [];
    const flowers = [];
    const cups = [];
    for (let i = 0; i < 4; i++) {
      const y = 0.12 + i * 0.13;
      knobs.push([0, y, 0]);
      flowers.push([0, y + 0.06, 0]);
      cups.push([0, y + 0.1, 0]);
    }
    g.add(instancePositions(new THREE.SphereGeometry(0.05, 10, 8), gold, knobs, { name: 'menorah-knobs' }));
    g.add(instancePositions(new THREE.SphereGeometry(0.035, 8, 6), this.mat.goldEng, flowers, { name: 'menorah-flowers' }));
    g.add(instancePositions(new THREE.CylinderGeometry(0.045, 0.02, 0.05, 8), gold, cups, { name: 'menorah-cups' }));
    // Branches: three pairs leave the stem and rise to the lamp row; the unit
    // cylinder is stretched per segment.
    const unit = new THREE.CylinderGeometry(1, 1, 1, 10);
    const arms = [];
    const verts = [];
    const lamps = [[0, cupY, 0]];
    const flames = [[0, cupY + 0.08, 0]];
    const pairs = (branches - 1) / 2;
    for (let i = 1; i <= pairs; i++) {
      const bx = i * 0.16;
      const ya = stemTop - i * 0.14;
      const yb = ya + bx;
      for (const s of [-1, 1]) {
        arms.push(segment([0, ya, 0], [s * bx, yb, 0], rStem * 0.8));
        verts.push(segment([s * bx, yb - 0.02, 0], [s * bx, cupY - 0.03, 0], rStem * 0.8));
        lamps.push([s * bx, cupY, 0]);
        flames.push([s * bx, cupY + 0.08, 0]);
      }
    }
    verts.push(segment([0, stemTop - 0.01, 0], [0, cupY - 0.03, 0], rStem * 0.8));
    g.add(instance(unit, gold, arms, { name: 'menorah-arms' }));
    g.add(instance(unit, gold, verts, { name: 'menorah-branches' }));
    g.add(instancePositions(new THREE.CylinderGeometry(0.055, 0.035, 0.07, 10), gold, lamps, { name: 'menorah-lamps' }));
    // The lamp flames are shader billboards (ParticleSystem.createCandle) hung on these
    // anchors after the build, so they toggle with the Menorah's period group.
    for (const [x, y, z] of flames) {
      const wick = new THREE.Object3D();
      wick.name = 'menorah-flame';
      wick.position.set(x, y - 0.045, z); // the lamp cup's rim
      g.add(wick);
    }
    // Tamid 3:9: the stone with three steps before it, on the east
    // Three treads, half an amah each, rising toward the Menorah from one amah east of it.
    const steps = [];
    for (let i = 0; i < 3; i++) {
      const top = 0.5 * (i + 1) * A;
      const zc = (1 + (2 - i) * 0.5 + 0.25) * A;
      steps.push({ position: [0, top / 2, zc], scale: [1.5 * A, top, 0.5 * A] });
    }
    g.add(instance(this.box(1, 1, 1, (this.mat.stoneFine ?? this.mat.stonePolished)), (this.mat.stoneFine ?? this.mat.stonePolished), steps, { name: 'menorah-stone' }));
    // Solid: the menorah's spread (its arms lie north-south) and the stone before it
    const spread = e.geometry.w * A; // 0.75
    this.solid(g, { w: spread, h: H, d: spread, name: 'menorah-solid' });
    this.solid(g, { z: (1 + 0.75) * A, w: 1.5 * A, h: 1.5 * A, d: 1.5 * A, name: 'menorah-stone-solid' }); // treads z 0.5 .. 1.25 m
    g.traverse((m) => {
      if (m.isMesh) m.castShadow = true;
    });
    this.scene.add(g);
  }

  // --------------------------------------------------------------------------
  // Shulchan (Exodus 25:23-30, Menachos 11:5-6): 2 long (east-west) x 1 wide x 1.5
  // high, gold-covered, with two stacks of six loaves, the 28 rods that separate
  // them, the four uprights and the two bowls of levonah.
  // --------------------------------------------------------------------------
  buildShulchan() {
    const e = byId.shulchan;
    const g = this.groupFor(e);
    const gold = this.mat.gold;
    const w = e.geometry.w * A; // 0.5 m (north-south)
    const d = e.geometry.d * A; // 1 m (east-west)
    const h = e.geometry.h * A; // 0.75 m
    const topT = 0.06;
    const top = new THREE.Mesh(this.box(w, topT, d, gold), gold);
    top.position.y = h - topT / 2;
    g.add(top);
    const rim = new THREE.Mesh(this.box(w + 0.04, 0.03, d + 0.04, this.mat.goldEng), this.mat.goldEng);
    rim.position.y = h + 0.015;
    g.add(rim);
    const legs = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) legs.push([sx * (w / 2 - 0.04), (h - topT) / 2, sz * (d / 2 - 0.04)]);
    g.add(instancePositions(new THREE.BoxGeometry(0.06, h - topT, 0.06), gold, legs, { name: 'shulchan-legs' }));
    // Two stacks of six loaves, each loaf across the table's width
    const loafT = 0.035;
    const gap = 0.03;
    const loaves = [];
    const rods = [];
    const stackZ = [-d / 4, d / 4];
    for (const z of stackZ) {
      for (let i = 0; i < 6; i++) {
        const y = h + 0.03 + i * (loafT + gap) + loafT / 2;
        loaves.push([0, y, z]);
        if (i < 5) {
          const count = i === 4 ? 2 : 3; // Menachos 11:6: two rods over the top loaf, three between the others
          for (let k = 0; k < count; k++) {
            const dz = (k - (count - 1) / 2) * 0.09;
            rods.push({ position: [0, y + loafT / 2 + gap / 2, z + dz], rotation: [0, 0, Math.PI / 2] });
          }
        }
      }
    }
    g.add(instancePositions(new THREE.BoxGeometry(w + 0.2, loafT, d / 4), this.bread, loaves, { name: 'shulchan-loaves' }));
    g.add(instance(new THREE.CylinderGeometry(0.008, 0.008, w + 0.16, 6), gold, rods, { name: 'shulchan-rods' }));
    // Uprights (snifim) at the ends of each stack
    const uprights = [];
    const stackH = 6 * (loafT + gap) + 0.05;
    for (const z of stackZ) for (const sx of [-1, 1]) uprights.push([sx * (w / 2 + 0.06), h + stackH / 2, z]);
    g.add(instancePositions(new THREE.BoxGeometry(0.03, stackH, 0.03), gold, uprights, { name: 'shulchan-uprights' }));
    // Bowls of levonah on top of each stack
    const bowlY = h + 0.03 + 6 * (loafT + gap) + 0.03;
    g.add(instancePositions(new THREE.CylinderGeometry(0.05, 0.035, 0.05, 10), gold, stackZ.map((z) => [0, bowlY, z]), { name: 'shulchan-bowls' }));
    g.add(
      instancePositions(new THREE.SphereGeometry(0.03, 8, 6), this.levonah, stackZ.map((z) => [0, bowlY + 0.03, z]), { name: 'shulchan-levonah' })
    );
    this.solid(g, { w: w + 0.16, h: h + stackH, d: d + 0.08, name: 'shulchan-solid' });
    g.traverse((m) => {
      if (m.isMesh) m.castShadow = true;
    });
    this.scene.add(g);
  }

  // --------------------------------------------------------------------------
  // Mizbeach HaZahav (Exodus 30:1-5): 1 x 1 x 2 amos, gold-covered, four horns and
  // two rings; on the axis between the Menorah and the Shulchan, drawn a little
  // outward (Yoma 33b). Coals glow on top; the ketores smoke rises from them.
  // --------------------------------------------------------------------------
  buildMizbeachHazahav() {
    const e = byId.mizbeach_hazahav;
    const g = this.groupFor(e);
    const gold = this.mat.gold;
    const w = e.geometry.w * A; // 0.5
    const h = e.geometry.h * A; // 1
    const body = new THREE.Mesh(this.box(w, h, w, gold), gold);
    body.position.y = h / 2;
    body.userData = { isWall: true, name: 'mizbeach-hazahav' };
    g.add(body);
    this.walls.push(body);
    const rim = new THREE.Mesh(this.box(w + 0.06, 0.04, w + 0.06, this.mat.goldEng), this.mat.goldEng);
    rim.position.y = h + 0.02;
    g.add(rim);
    const c = w / 2 - 0.05;
    g.add(
      instancePositions(
        new THREE.ConeGeometry(0.04, 0.16, 6),
        gold,
        [
          [-c, h + 0.1, -c],
          [c, h + 0.1, -c],
          [-c, h + 0.1, c],
          [c, h + 0.1, c],
        ],
        { name: 'golden-altar-horns' }
      )
    );
    g.add(
      instance(
        new THREE.TorusGeometry(0.06, 0.012, 8, 16),
        gold,
        [
          { position: [-w / 2 - 0.01, h * 0.7, 0], rotation: [0, Math.PI / 2, 0] },
          { position: [w / 2 + 0.01, h * 0.7, 0], rotation: [0, Math.PI / 2, 0] },
        ],
        { name: 'golden-altar-rings' }
      )
    );
    // ParticleSystem.createCoals hangs the glow and the incense smoke on this mesh by name.
    const coals = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.3, w * 0.3, 0.02, 12), this.ember);
    coals.name = 'golden-altar-coals';
    coals.position.y = h + 0.05;
    coals.castShadow = false;
    g.add(coals);
    g.traverse((m) => {
      if (m.isMesh && m !== coals) m.castShadow = true;
    });
    this.scene.add(g);
  }

  // --------------------------------------------------------------------------
  // Aron (Exodus 25:10-22): 2.5 long x 1.5 x 1.5, gold, lying north-south across
  // the width of the house (Menachot 98a), with the kapores and two small keruvim
  // facing each other at its north and south ends, and its two poles running
  // east-west (Yoma 54a). Bayis Rishon only; built hidden.
  // --------------------------------------------------------------------------
  buildAron() {
    const e = byId.aron;
    const g = this.groupFor(e);
    const gold = this.mat.gold;
    const w = e.geometry.w * A; // 1.25 (north-south, the long side)
    const d = e.geometry.d * A; // 0.75 (east-west)
    const h = e.geometry.h * A; // 0.75
    const chest = new THREE.Mesh(this.box(w, h, d, gold), gold);
    chest.position.y = h / 2;
    g.add(chest);
    const kapores = new THREE.Mesh(this.box(w + 0.04, 0.05, d + 0.04, this.mat.goldEng), this.mat.goldEng);
    kapores.position.y = h + 0.025;
    g.add(kapores);
    const xk = w / 2 - 0.2; // the keruvim at the two ends of the long side (Exodus 25:19)
    const bodies = [];
    const heads = [];
    const wings = [];
    for (const s of [-1, 1]) {
      bodies.push({ position: [s * xk, h + 0.05 + 0.12, 0], scale: [0.09, 0.12, 0.09] });
      heads.push([s * xk, h + 0.05 + 0.3, 0]);
      for (const side of [-1, 1]) {
        wings.push({ position: [s * xk - s * 0.08, h + 0.05 + 0.32, side * 0.12], rotation: [side * 0.6, 0, -s * 0.35] });
      }
    }
    g.add(instance(new THREE.SphereGeometry(1, 10, 8), gold, bodies, { name: 'aron-keruvim-bodies' }));
    g.add(instancePositions(new THREE.SphereGeometry(0.06, 10, 8), gold, heads, { name: 'aron-keruvim-heads' }));
    g.add(instance(new THREE.BoxGeometry(0.015, 0.2, 0.22), gold, wings, { name: 'aron-keruvim-wings' }));
    g.add(
      instance(
        new THREE.CylinderGeometry(0.03, 0.03, d + 0.8, 8),
        gold,
        [-1, 1].map((s) => ({ position: [s * (w / 2 + 0.04), h * 0.35, 0], rotation: [Math.PI / 2, 0, 0] })),
        { name: 'aron-badim' }
      )
    );
    g.traverse((m) => {
      if (m.isMesh) m.castShadow = true;
    });
    this.scene.add(g);
  }

  // --------------------------------------------------------------------------
  // Shlomo's keruvim (I Kings 6:23-28): two gold-covered figures 10 tall at x -5 and
  // x 5, each with two 5-amah wings, one touching the wall and one touching the
  // other's wing over the Aron. Bayis Rishon only; built hidden.
  // --------------------------------------------------------------------------
  buildKeruvim() {
    const e = byId.keruvim;
    const g = this.groupFor(e);
    const gold = this.mat.gold;
    const H = e.dimensions.find((d) => d.label === 'height').value * A; // 5 m
    const wing = (e.dimensions.find((d) => d.label === 'wing span each').value / 2) * A; // 2.5 m
    const xs = [-5, 5].map((v) => v * A); // the figures stand at x -5 and x 5 amos
    const bodyH = H * 0.72;
    const bodies = [];
    const heads = [];
    const wings = [];
    for (const x of xs) {
      const s = Math.sign(x);
      bodies.push({ position: [x, bodyH / 2, 0] });
      heads.push([x, bodyH + H * 0.1, 0]);
      // inner wing toward the axis, outer wing toward the wall, at shoulder height
      wings.push({ position: [x - s * wing * 0.5, bodyH * 0.9, 0], rotation: [0, 0, s * 0.12] });
      wings.push({ position: [x + s * wing * 0.5, bodyH * 0.9, 0], rotation: [0, 0, -s * 0.12] });
    }
    g.add(instance(new THREE.CylinderGeometry(H * 0.07, H * 0.1, bodyH, 12), gold, bodies, { name: 'keruvim-bodies' }));
    g.add(instancePositions(new THREE.SphereGeometry(H * 0.09, 12, 10), gold, heads, { name: 'keruvim-heads' }));
    g.add(instance(new THREE.BoxGeometry(wing, H * 0.14, 0.12), gold, wings, { name: 'keruvim-wings' }));
    g.traverse((m) => {
      if (m.isMesh) m.castShadow = true;
    });
    this.scene.add(g);
  }
}
