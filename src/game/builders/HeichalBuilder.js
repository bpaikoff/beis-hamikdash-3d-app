import * as THREE from 'three';
import { BaseBuilder } from './BaseBuilder.js';
import { instance, instancePositions } from '../instanced.js';
import { AMAH } from '../../content/units.js';
import { byId, worldPos, levelWorldY } from '../../content/index.js';
import { outcropGeometry } from './outcrop.js';

// ============================================================================
// HEICHAL BUILDER - the 12 Ulam steps, the Ulam, the Heichal, the ta'im, the
// Amah Traksin with its two parochos, the Kodesh HaKodashim and the roof, plus
// the Ezras Kohanim floor west of the altar (z -54 .. -187).
//
// Every number in this file is in amos in the azarah frame (see docs/content.md)
// and converted to metres only through worldPos()/levelWorldY()/AMAH.
// Sources: Mishnah Middot 3:6-8 (steps, Ulam facade), 4:1-7 (Heichal, ta'im,
// section), Yoma 5:1 and 51b (parochos), Yoma 5:2 (Even HaShtiya).
// ============================================================================

export const A = AMAH;
/** Thickness of a BaseBuilder.addFloor slab, in metres and in amos. */
export const FLOOR_T = 0.4;
const FT = FLOOR_T / A;

/** Scene y (metres) of a height given in amos above the Azarah floor. */
export const yAmos = (ya) => levelWorldY('azaras_yisrael') + ya * A;

/**
 * x/z converters (amos in the azarah frame -> scene metres) anchored on one entry's
 * worldPos, so builders never hard-code the frame origin.
 */
export function frameOf(entry) {
  const [px, , pz] = worldPos(entry);
  const p = entry.position;
  return { x: (xa) => px + (xa - p.x) * A, z: (za) => pz + (za - p.z) * A };
}

/** Tag a group with the content entry it renders (HUD lookup and period toggle). */
export function tagEntry(group, entry, extra = {}) {
  group.name = entry.id;
  group.userData = {
    entryId: entry.id,
    period: entry.period ? [...entry.period] : ['bayis_rishon', 'bayis_sheni'],
    ...extra,
  };
  return group;
}

/** Group for an entry; Bayis Rishon-only entries start hidden until TempleGame toggles them. */
export function periodGroup(entry) {
  const g = tagEntry(new THREE.Group(), entry);
  g.visible = !entry.period || entry.period.includes('bayis_sheni');
  return g;
}

/** Levels (amos above the Azarah floor) shared with KeilimBuilder. */
export const LEVEL = {
  K: byId.azaras_kohanim.position.y, // 2.5, Ezras Kohanim
  U: byId.ulam.position.y, // 8.5, Ulam / Heichal / Kodesh HaKodashim
};

/** Section constants from meta.zLayout / xLayout (Middot 4:7), amos. */
const SECTION = {
  wallT: 6, // Heichal walls
  xBuilding: 35, // building 70 wide
  xOuterWall: 30, // outer wall 5 thick
  xTaWall: 27, // ta wall 5 thick
  xTaOut: 22, // ta band x +-16 .. +-22
  zWestTa: [-165, -171], // western ta 6
  zBack: -176, // its wall 5
  ulamEndWallT: 5, // assumed equal to the front wall (not given in Middot); inside the 100 (Middot 4:7: 70 + 15 + 15)
};

/**
 * The Kodesh HaKodashim's light: how much of the sky's image-based light its floor and
 * gold panels keep (the Heichal's materials use 1) and the tint that puts them in shade
 * (the point lights do not cast shadows, so the Heichal's light would otherwise reach
 * through the parochos undimmed), and the one warm lamp LightingBuilder
 * hangs east of the stone: candela (physical units, inverse-square), its height above
 * the floor and its distance east of the stone toward the parochos, both in amos.
 */
export const KHK_LIGHT = {
  floorEnv: 0.3, floorTint: 0xb4b0a8, // the white marble in shade
  goldEnv: 0.08, goldTint: 0xa89a68, goldRoughness: 2.4, // deep gold in shade, a broad soft lamp reflection
  color: 0xffd090, candela: 12, height: 2.4, eastOfStone: 6,
};

export class HeichalBuilder extends BaseBuilder {
  build() {
    this.F = frameOf(byId.heichal);
    this.buildWestCourtFloor();
    this.buildMaalosUlam();
    this.buildUlam();
    this.buildHeichal();
    this.buildTaim();
    this.buildParoches();
    this.buildKodeshHaKodashim();
    this.buildRoof();
    this.buildYachinBoaz();
  }

  // --------------------------------------------------------------------------
  // helpers
  // --------------------------------------------------------------------------

  /**
   * Axis-aligned box from amos bounds {x: [a, b], y: [a, b], z: [a, b]} (y above the
   * Azarah floor). `floor` registers a walkable top, `wall` a collider; both use the
   * BaseBuilder userData contract. Added to `g` (or the scene).
   */
  block(g, b, mat, { floor = false, wall = false, name, shadow = true } = {}) {
    const w = Math.abs(b.x[1] - b.x[0]) * A;
    const h = Math.abs(b.y[1] - b.y[0]) * A;
    const d = Math.abs(b.z[1] - b.z[0]) * A;
    const m = new THREE.Mesh(this.box(w, h, d, mat), mat);
    m.position.set(this.F.x((b.x[0] + b.x[1]) / 2), yAmos((b.y[0] + b.y[1]) / 2), this.F.z((b.z[0] + b.z[1]) / 2));
    m.castShadow = shadow;
    m.receiveShadow = true;
    if (name) m.name = name;
    if (floor) {
      m.userData = { isFloor: true, name };
      this.floors.push(m);
    } else if (wall) {
      m.userData = { isWall: true, name };
      this.walls.push(m);
    }
    (g ?? this.scene).add(m);
    return m;
  }

  /** Walkable slab whose top face is exactly at `level` (amos), via addFloor. */
  floorAt(g, level, xs, zs, mat, name) {
    const m = this.addFloor(
      this.F.x((xs[0] + xs[1]) / 2),
      yAmos(level) - FLOOR_T / 2,
      this.F.z((zs[0] + zs[1]) / 2),
      Math.abs(xs[1] - xs[0]) * A,
      Math.abs(zs[1] - zs[0]) * A,
      mat,
      name
    );
    m.name = name;
    g.add(m); // reparent from the scene root into the entry group (world transform unchanged)
    return m;
  }

  /** Instanced copies of a unit box, each scaled to amos bounds (one draw call). */
  blocksInstanced(g, boundsList, mat, opts = {}) {
    const geo = this.box(1, 1, 1, mat);
    const placements = boundsList.map((b) => ({
      position: [this.F.x((b.x[0] + b.x[1]) / 2), yAmos((b.y[0] + b.y[1]) / 2), this.F.z((b.z[0] + b.z[1]) / 2)],
      scale: [Math.abs(b.x[1] - b.x[0]) * A, Math.abs(b.y[1] - b.y[0]) * A, Math.abs(b.z[1] - b.z[0]) * A],
    }));
    const mesh = instance(geo, mat, placements, opts);
    g.add(mesh);
    return mesh;
  }

  // --------------------------------------------------------------------------
  // Ezras Kohanim floor west of the altar: z -54 .. -187, x +-67.5, level 2.5,
  // minus the footprint of the steps, the Ulam (x +-50) and the building (x +-35).
  // GEO-B's Kohanim floor ends at z -54; this one starts there.
  // --------------------------------------------------------------------------
  buildWestCourtFloor() {
    const area = byId.azaras_kohanim;
    const g = tagEntry(new THREE.Group(), area, { part: 'west' });
    const { K } = LEVEL;
    const b = area.bounds; // x -67.5 .. 67.5, z -187 .. -11
    const zEast = byId.mizbeach.position.z - byId.mizbeach.geometry.d / 2; // -54, altar west face
    const ulam = byId.ulam.bounds; // x -50..50, z -92..-76
    const halfSteps = byId.maalos_ulam.geometry.w / 2; // 20
    const xUlam = ulam.maxX; // 50, the outer face of the Ulam's end walls
    const floor = this.mat.floor;
    const slabs = [
      { x: [b.minX, -halfSteps], z: [zEast, ulam.maxZ] },
      { x: [halfSteps, b.maxX], z: [zEast, ulam.maxZ] },
      { x: [b.minX, -xUlam], z: [ulam.maxZ, ulam.minZ] },
      { x: [xUlam, b.maxX], z: [ulam.maxZ, ulam.minZ] },
      { x: [b.minX, -SECTION.xBuilding], z: [ulam.minZ, SECTION.zBack] },
      { x: [SECTION.xBuilding, b.maxX], z: [ulam.minZ, SECTION.zBack] },
      { x: [b.minX, b.maxX], z: [SECTION.zBack, b.minZ] },
    ];
    slabs.forEach((s, i) => this.floorAt(g, K, s.x, s.z, floor, `azaras-kohanim-west-${i}`));
    // Fill from the Har HaBayis ground up to the underside of the slabs.
    const ground = byId.har_habayis.position.y;
    this.block(g, { x: [b.minX, b.maxX], y: [ground, K - FT], z: [zEast, b.minZ] }, this.mat.stone, {
      name: 'azaras-kohanim-west-fill',
      shadow: false,
    });
    this.scene.add(g);
  }

  // --------------------------------------------------------------------------
  // Middot 3:6: twelve steps, rise 1/2, tread 1, between the altar (z -54) and the
  // Ulam wall (z -76): four steps then a rovad of 3, four and a rovad of 3, four and
  // the upper rovad of 4 against the Ulam wall. 12 + 3 + 3 + 4 = 22 (temple.json
  // maalos_ulam.geometry.notes). Each step is a solid block down to the court floor
  // so the flight reads as stone.
  // --------------------------------------------------------------------------
  buildMaalosUlam() {
    /** How far each riser's facing stands proud of the step's face (amos: 1 cm). */
    const RISER_PROUD = 0.02;
    const e = byId.maalos_ulam;
    const g = tagEntry(new THREE.Group(), e);
    const { K } = LEVEL;
    const rise = e.dimensions.find((d) => d.label === 'rise per step').value; // 0.5
    const tread = e.dimensions.find((d) => d.label === 'tread per step').value; // 1
    const half = e.geometry.w / 2; // 20
    const zStart = byId.mizbeach.position.z - byId.mizbeach.geometry.d / 2; // -54
    const landings = [3, 3, 4];
    const perGroup = 4;
    // Material: Middot 3:6 gives the steps' count and sizes, not their stone, so this is
    // a reconstruction: dressed limestone (stoneFine, as the altar and the gate frames),
    // not the white marble of the Ulam floor (itself unsourced; Sukkah 51b and Bava Basra
    // 4a give Herod's building stones as shaisha and marmara, blue-grey and white marble,
    // in staggered plastered courses, which describes the walls, not floors or flights).
    // The Marble021 colour map is a near-uniform
    // white (mean 243, deviation 6, flat normals), so twelve 0.25 m steps in it rendered
    // as one grey slope in every view; the travertine has a visible grain and takes the
    // light. Each riser carries a shaded facing (one instanced draw, 1 cm proud, not a
    // collider) so the treads' edges read from the court.
    const mat = this.mat.stoneFine;
    let z = zStart;
    let y = K;
    let n = 0;
    const risers = [];
    for (let group = 0; group < landings.length; group++) {
      for (let s = 0; s < perGroup; s++) {
        risers.push([this.F.x(0), yAmos(y + rise / 2), this.F.z(z + RISER_PROUD / 2)]);
        y += rise;
        n++;
        const step = this.block(g, { x: [-half, half], y: [K - FT, y], z: [z, z - tread] }, mat, {
          floor: true,
          name: `maalos-ulam-${n}`,
        });
        step.userData.isStep = true;
        z -= tread;
      }
      const d = landings[group];
      this.block(g, { x: [-half, half], y: [K - FT, y], z: [z, z - d] }, mat, {
        floor: true,
        name: `maalos-ulam-rovad-${group + 1}`,
      });
      z -= d;
    }
    const riserGeo = this.box(2 * half * A, rise * A, RISER_PROUD * A, this.mat.stoneRiser);
    g.add(instancePositions(riserGeo, this.mat.stoneRiser, risers, { name: 'maalos-ulam-risers' }));
    g.userData.steps = n;
    g.userData.topZ = z; // -76
    this.scene.add(g);
  }

  // --------------------------------------------------------------------------
  // Ulam: 100 x 11 interior, 100 tall (Middot 4:6-7), east wall 5 thick with a
  // doorless 20 x 40 opening (Middot 3:7), five oak melatra'os above it, cedar
  // beams tying it to the Heichal wall (Middot 3:8).
  // --------------------------------------------------------------------------
  buildUlam() {
    const e = byId.ulam;
    const g = tagEntry(new THREE.Group(), e);
    const { K, U } = LEVEL;
    const dim = (label) => e.dimensions.find((d) => d.label === label).value;
    const H = dim('height'); // 100
    const b = e.bounds; // x -50..50, z -92..-76
    const wallT = dim('wall thickness'); // 5
    const doorW = dim('entrance width'); // 20
    const doorH = dim('entrance height'); // 40
    const zFront = b.maxZ; // -76
    const zIn = zFront - wallT; // -81
    const zBack = b.minZ; // -92
    // Middot 4:7: the Ulam is 100 north-south, 15 beyond the 70-wide building on each
    // side, so its end walls lie inside x +-50 (the court strips beside the building
    // and the Beis HaMoked-side lishkos start at x +-51.5).
    const xEnd = b.maxX; // 50, outer face of the end walls
    const xIn = xEnd - SECTION.ulamEndWallT; // 45, interior
    const base = U - FT;

    // Foundation of the whole building from the court floor up to the floor slabs
    // (Middot 4:6 counts a 6-amah foundation, which is exactly the 6-amah rise): the
    // Ulam's footprint including its wings (x +-50) and, behind it, the 70-wide
    // building (x +-35) so the court strips beside it stay clear.
    // Both collide: the walls above start at the Ulam floor, so at court level the
    // foundation is what keeps the player out of the building's footprint.
    this.block(g, { x: [-xEnd, xEnd], y: [K - FT, base], z: [zFront, zBack] }, this.mat.stone, {
      wall: true,
      name: 'building-foundation',
      shadow: false,
    });
    this.block(g, { x: [-SECTION.xBuilding, SECTION.xBuilding], y: [K - FT, base], z: [zBack, SECTION.zBack] }, this.mat.stone, {
      wall: true,
      name: 'building-foundation-w',
      shadow: false,
    });

    // Floor (0.1 into the walls so no slab edge is coplanar with a wall face)
    // Adjoining slabs overlap by 0.1 amah so a ray on a seam always hits one of them.
    this.floorAt(g, U, [-xIn - 0.1, xIn + 0.1], [zIn + 0.1, zBack + 0.1], this.mat.marbleW, 'ulam');
    this.floorAt(g, U, [-doorW / 2 - 0.1, doorW / 2 + 0.1], [zFront + 0.1, zIn - 0.1], this.mat.marbleW, 'ulam-threshold');

    // Front wall with the opening; the lintel above it does not collide.
    const facade = this.mat.stonePolished;
    this.block(g, { x: [-xEnd, -doorW / 2], y: [base, U + H], z: [zFront, zIn] }, facade, { wall: true, name: 'ulam-front-s' });
    this.block(g, { x: [doorW / 2, xEnd], y: [base, U + H], z: [zFront, zIn] }, facade, { wall: true, name: 'ulam-front-n' });
    this.block(g, { x: [-doorW / 2, doorW / 2], y: [U + doorH, U + H], z: [zFront, zIn] }, facade, { name: 'ulam-lintel' });
    // End walls
    this.block(g, { x: [-xEnd, -xIn], y: [base, U + H], z: [zFront, zBack] }, facade, { wall: true, name: 'ulam-end-s' });
    this.block(g, { x: [xIn, xEnd], y: [base, U + H], z: [zFront, zBack] }, facade, { wall: true, name: 'ulam-end-n' });

    // Middot 3:7: five oak beams above the opening, the lowest one amah wider than
    // the opening on each side, each one above a further amah wider, a course of
    // stones between each; they project from the facade.
    // Five distinct widths, so five meshes with correctly tiled cedar (they are on the facade).
    // The lowest beam's underside is the lintel's soffit: it hangs 0.01 amah (5 mm) below
    // it so the two faces are not drawn over each other (round 7, WoodCoplanar.test.js).
    for (let i = 0; i < 5; i++) {
      const w = doorW + 2 * (i + 1);
      const y0 = U + doorH + 2 * i;
      this.block(g, { x: [-w / 2, w / 2], y: [i === 0 ? y0 - 0.01 : y0, y0 + 1], z: [zFront + 1, zFront - 1] }, this.mat.cedar, { name: `ulam-melatra-${i + 1}` });
    }

    // Middot 3:8: cedar beams from the Ulam wall to the Heichal wall so the front
    // wall does not lean. Nine identical 1 x 1 beams across the width, one draw call.
    const tieGeo = this.box(A, A, Math.abs(zBack - zIn) * A, this.mat.cedar);
    const ties = [];
    for (let x = -40; x <= 40; x += 10) ties.push([this.F.x(x), yAmos(U + doorH + 12.5), this.F.z((zIn + zBack) / 2)]);
    g.add(instancePositions(tieGeo, this.mat.cedar, ties, { name: 'ulam-tie-beams' }));

    // Ceiling at the top of the 100-amah hall (also spans the Heichal east wall), 0.01 amah
    // (5 mm) inside the walls' outer faces and top so its cedar rim is never flush with
    // the stone (a flush rim z-fought along the top of the facade; round 7).
    const I = 0.01;
    this.block(g, { x: [-xEnd + I, xEnd - I], y: [U + H - 1 + I, U + H - I], z: [zFront - I, zBack - SECTION.wallT + I] }, this.mat.cedar, {
      name: 'ulam-ceiling',
    });

    this.scene.add(g);
  }

  // --------------------------------------------------------------------------
  // Heichal: 20 x 40 interior, walls 6 thick, ceiling at 40 with the aliyah above
  // to 100 (Middot 4:6-7); entrance 10 x 20 with two pairs of gold doors (4:1).
  // --------------------------------------------------------------------------
  buildHeichal() {
    const e = byId.heichal;
    const g = tagEntry(new THREE.Group(), e);
    const { U } = LEVEL;
    const H = e.dimensions.find((d) => d.label === 'height').value; // 100
    const ceilH = e.geometry.h; // 40
    const b = e.bounds; // x -10..10, z -138..-98
    const { wallT } = SECTION;
    const khk = byId.kodesh_hakodashim.bounds; // z -159..-139
    const xEnd = byId.ulam.bounds.maxX; // 50, the Ulam wings share the east wall
    const base = U - FT;
    const zEastOut = byId.ulam.bounds.minZ; // -92
    const zEastIn = b.maxZ; // -98
    const zWestIn = khk.minZ; // -159
    const zWestOut = zWestIn - wallT; // -165
    const stone = this.mat.stonePolished;

    // Floor: Heichal to the parochos (-139), oversized 0.1 into the walls
    this.floorAt(g, U, [b.minX - 0.1, b.maxX + 0.1], [zEastIn + 0.1, khk.maxZ - 0.1], this.mat.mosaic, 'heichal');

    // East wall with the doorway (pesach_haheichal)
    const door = byId.pesach_haheichal;
    const dg = tagEntry(new THREE.Group(), door);
    const dw = door.geometry.w / 2; // 5
    const dh = door.geometry.h; // 20
    this.floorAt(dg, U, [-dw - 0.1, dw + 0.1], [zEastOut + 0.1, zEastIn - 0.1], this.mat.mosaic, 'heichal-threshold');
    this.block(dg, { x: [-xEnd, -dw], y: [base, U + H], z: [zEastOut, zEastIn] }, stone, { wall: true, name: 'heichal-east-s' });
    this.block(dg, { x: [dw, xEnd], y: [base, U + H], z: [zEastOut, zEastIn] }, stone, { wall: true, name: 'heichal-east-n' });
    this.block(dg, { x: [-dw, dw], y: [U + dh, U + H], z: [zEastOut, zEastIn] }, stone, { name: 'heichal-east-lintel' });
    // Middot 4:1: four gold doors, 5 wide x 20 tall; the outer pair folds back into
    // the reveal, the inner pair against the inside face of the wall.
    const leaf = this.box(dw * A, dh * A, 0.2 * A, this.mat.gold);
    const yLeaf = yAmos(U + dh / 2);
    const doors = instance(
      leaf,
      this.mat.gold,
      [
        { position: [this.F.x(-dw + 0.15), yLeaf, this.F.z(zEastOut - 0.1 - dw / 2)], rotation: [0, Math.PI / 2, 0] },
        { position: [this.F.x(dw - 0.15), yLeaf, this.F.z(zEastOut - 0.1 - dw / 2)], rotation: [0, Math.PI / 2, 0] },
        { position: [this.F.x(-dw - dw / 2), yLeaf, this.F.z(zEastIn - 0.15)] },
        { position: [this.F.x(dw + dw / 2), yLeaf, this.F.z(zEastIn - 0.15)] },
      ],
      { name: 'heichal-doors' }
    );
    dg.add(doors);
    this.scene.add(dg);

    // Side walls: x +-10 .. +-16 from the east wall to the west wall, 100 tall; they
    // rise above the lower side buildings as the aliyah.
    this.block(g, { x: [b.minX - wallT, b.minX], y: [base, U + H], z: [zEastIn, zWestOut] }, stone, { wall: true, name: 'heichal-wall-s' });
    this.block(g, { x: [b.maxX, b.maxX + wallT], y: [base, U + H], z: [zEastIn, zWestOut] }, stone, { wall: true, name: 'heichal-wall-n' });

    // Gold-covered interior faces (I Kings 6:21-22; Middot 3:8's golden vine hung here)
    const gold = this.mat.goldEng;
    const t = 0.15;
    const panel = (name, bounds) => this.block(g, bounds, gold, { name, shadow: false });
    // The side panels stop at the parochos; the Kodesh HaKodashim carries its own (dimmer) pair.
    panel('heichal-panel-s', { x: [b.minX, b.minX + t], y: [U, U + ceilH], z: [zEastIn, khk.maxZ] });
    panel('heichal-panel-n', { x: [b.maxX - t, b.maxX], y: [U, U + ceilH], z: [zEastIn, khk.maxZ] });
    panel('heichal-panel-e-s', { x: [b.minX, -dw], y: [U, U + ceilH], z: [zEastIn, zEastIn - t] });
    panel('heichal-panel-e-n', { x: [dw, b.maxX], y: [U, U + ceilH], z: [zEastIn, zEastIn - t] });
    panel('heichal-panel-e-top', { x: [-dw, dw], y: [U + dh, U + ceilH], z: [zEastIn, zEastIn - t] });

    // Ceiling (Middot 4:6: the decorated ceiling at 40; the aliyah above it)
    this.block(g, { x: [b.minX, b.maxX], y: [U + ceilH, U + ceilH + 1], z: [zEastIn, zWestIn] }, this.mat.cedar, {
      name: 'heichal-ceiling',
    });

    this.scene.add(g);
  }

  // --------------------------------------------------------------------------
  // Ta'im: 38 side chambers in three storeys (Middot 4:3-4), 15 north, 15 south,
  // 8 west (3, 3, 2), inside the lower side buildings: ta wall 5 (x +-22..27),
  // mesibah / water channel 3, outer wall 5 to x +-35 (Middot 4:7).
  // --------------------------------------------------------------------------
  buildTaim() {
    const e = byId.taim;
    const g = tagEntry(new THREE.Group(), e);
    const { U } = LEVEL;
    const base = U - FT;
    const dim = (label) => e.dimensions.find((d) => d.label === label).value;
    const storeys = dim('storeys'); // 3
    const widths = [dim('width lower storey'), dim('width middle storey'), dim('width upper storey')]; // 5, 6, 7
    const perSide = dim('north') / storeys; // 5 per storey
    const westCounts = [3, 3, 2]; // 8 = 3 + 3 + 2
    const zEast = byId.ulam.bounds.minZ; // -92
    const { xTaOut, xTaWall, xOuterWall, xBuilding, zWestTa, zBack } = SECTION;
    const sideH = 45; // roof of the lower side buildings (reconstruction: the ta'im reach the Heichal ceiling, Middot 4:5)
    const storeyH = e.geometry.h - 1; // storey 15 (temple.json) = 14 of room + a 1-amah floor; 3 x 15 = 45 reaches the side roof
    const stone = this.mat.stone;

    // Outer walls and back wall (collide), ta walls (interior, no collision)
    this.block(g, { x: [-xBuilding, -xOuterWall], y: [base, U + sideH], z: [zEast, zBack] }, stone, { wall: true, name: 'ta-outer-s' });
    this.block(g, { x: [xOuterWall, xBuilding], y: [base, U + sideH], z: [zEast, zBack] }, stone, { wall: true, name: 'ta-outer-n' });
    this.block(g, { x: [-xOuterWall, xOuterWall], y: [base, U + sideH], z: [zWestTa[1], zBack] }, stone, { wall: true, name: 'ta-back' });
    this.block(g, { x: [-xTaWall, -xTaOut], y: [base, U + sideH - 3], z: [zEast, zWestTa[1]] }, this.mat.stonePolished, { name: 'ta-wall-s' });
    this.block(g, { x: [xTaOut, xTaWall], y: [base, U + sideH - 3], z: [zEast, zWestTa[1]] }, this.mat.stonePolished, { name: 'ta-wall-n' });

    // Cells
    const cells = [];
    const zSpan = zEast - zWestTa[0]; // 73
    const cellLen = (zSpan - (perSide - 1)) / perSide; // 1-amah partitions
    for (let s = 0; s < storeys; s++) {
      const y0 = U + s * (storeyH + 1);
      const y1 = y0 + storeyH;
      const w = widths[s];
      for (let k = 0; k < perSide; k++) {
        const z0 = zEast - k * (cellLen + 1);
        const z1 = z0 - cellLen;
        cells.push({ x: [-xTaOut, -xTaOut + w], y: [y0, y1], z: [z0, z1] }); // south
        cells.push({ x: [xTaOut - w, xTaOut], y: [y0, y1], z: [z0, z1] }); // north
      }
      const n = westCounts[s];
      const wl = (2 * xTaOut - (n - 1)) / n;
      for (let k = 0; k < n; k++) {
        const x0 = -xTaOut + k * (wl + 1);
        cells.push({ x: [x0, x0 + wl], y: [y0, y1], z: [zWestTa[0], zWestTa[1]] });
      }
    }
    const mesh = this.blocksInstanced(g, cells, this.mat.stonePolished, { name: 'taim-cells' });
    g.userData.count = mesh.count;
    mesh.userData.lodDistance = 120; // inside the side buildings: unseen from farther (game/lod.js)

    // Roofs of the lower side buildings
    const xIn = byId.heichal.bounds.maxX + SECTION.wallT; // 16
    this.block(g, { x: [-xBuilding, -xIn], y: [U + sideH - 1, U + sideH], z: [zEast, zBack] }, stone, { name: 'ta-roof-s' });
    this.block(g, { x: [xIn, xBuilding], y: [U + sideH - 1, U + sideH], z: [zEast, zBack] }, stone, { name: 'ta-roof-n' });
    this.block(g, { x: [-xIn, xIn], y: [U + sideH - 1, U + sideH], z: [zWestTa[0], zBack] }, stone, { name: 'ta-roof-w' });

    this.scene.add(g);
  }

  // --------------------------------------------------------------------------
  // Amah Traksin (z -138 .. -139): in the Second Temple two curtains 20 x 40, the
  // outer at z -138 and the inner at z -139 (Yoma 51b, Mishnah Yoma 5:1); in the
  // First Temple a one-amah wall (period group, hidden until toggled).
  // --------------------------------------------------------------------------
  buildParoches() {
    const p = byId.paroches;
    const pg = tagEntry(new THREE.Group(), p);
    const { U } = LEVEL;
    const w = p.geometry.w; // 20
    const h = p.geometry.h; // 40
    const geo = new THREE.PlaneGeometry(w * A, h * A);
    const zs = [p.position.z, p.position.z - 1]; // -138 outer, -139 inner
    zs.forEach((z, i) => {
      const m = new THREE.Mesh(geo, this.mat.paroches);
      m.position.set(this.F.x(0), yAmos(U + h / 2), this.F.z(z));
      m.receiveShadow = true;
      m.name = i === 0 ? 'paroches-outer' : 'paroches-inner';
      pg.add(m);
    });
    this.scene.add(pg);

    const t = byId.amah_traksin;
    const tg = tagEntry(new THREE.Group(), t);
    // Only the Bayis Rishon wall is geometry here (the Bayis Sheni curtains are `paroches`).
    tg.userData.period = ['bayis_rishon'];
    tg.visible = false;
    this.block(tg, { x: [-w / 2, w / 2], y: [U, U + h], z: [t.position.z + 0.5, t.position.z - 0.5] }, this.mat.stonePolished, {
      name: 'amah-traksin-wall',
    });
    this.scene.add(tg);
  }

  // --------------------------------------------------------------------------
  // Kodesh HaKodashim 20 x 20 (Middot 4:7), west wall 6 thick, Even HaShtiya three
  // etzbaos above the floor at its centre (Mishnah Yoma 5:2).
  //
  // A windowless room behind two curtains (Yoma 5:1): its floor and gold panels are
  // the Heichal's materials with most of the sky's image-based light taken away, so
  // the room reads dim and still beside the Heichal, and one warm lamp between the
  // parochos and the stone stands for what light reached it from the east.
  // --------------------------------------------------------------------------
  buildKodeshHaKodashim() {
    const e = byId.kodesh_hakodashim;
    const g = tagEntry(new THREE.Group(), e);
    const { U } = LEVEL;
    const b = e.bounds; // x -10..10, z -159..-139
    const H = byId.heichal.dimensions.find((d) => d.label === 'height').value; // 100
    const ceilH = e.geometry.h; // 40
    const { wallT } = SECTION;
    const base = U - FT;
    const dim = (m, envMapIntensity, tint) => Object.assign(m.clone(), { envMapIntensity, color: new THREE.Color(tint) });
    const floor = dim(this.mat.marbleW, KHK_LIGHT.floorEnv, KHK_LIGHT.floorTint);
    const gold = dim(this.mat.goldEng, KHK_LIGHT.goldEnv, KHK_LIGHT.goldTint);
    gold.roughness = KHK_LIGHT.goldRoughness;
    this.floorAt(g, U, [b.minX - 0.1, b.maxX + 0.1], [b.maxZ + 0.1, b.minZ + 0.1], floor, 'kodesh-hakodashim');
    this.block(g, { x: [b.minX - wallT, b.maxX + wallT], y: [base, U + H], z: [b.minZ, b.minZ - wallT] }, this.mat.stonePolished, {
      wall: true,
      name: 'heichal-west-wall',
    });
    const t = 0.15;
    const panel = (name, bounds) => this.block(g, bounds, gold, { name, shadow: false });
    panel('khk-panel-w', { x: [b.minX, b.maxX], y: [U, U + ceilH], z: [b.minZ, b.minZ + t] });
    panel('khk-panel-s', { x: [b.minX, b.minX + t], y: [U, U + ceilH], z: [b.maxZ, b.minZ] });
    panel('khk-panel-n', { x: [b.maxX - t, b.maxX], y: [U, U + ceilH], z: [b.maxZ, b.minZ] });
    this.scene.add(g); // the lamp is LightingBuilder's (`khkLamp`, KHK_LIGHT)

    // The stone: an outcrop of the bedrock, not masonry (Yoma 54b: the floor of the
    // world). One seeded mesh (outcrop.js) with an irregular outline, a rounded edge and
    // a low noised top; its centre vertex is exactly geometry.h above the floor and the
    // mesh is the walkable surface, so a probe at the centre reads the content height.
    const s = byId.even_hashtiya;
    const sg = tagEntry(new THREE.Group(), s);
    const stone = this.mat.bedrock;
    const geo = outcropGeometry({
      radius: (s.geometry.w / 2) * A,
      height: s.geometry.h * A,
      seed: 0x5e7a,
      tileMetres: this.tileMetresFor(stone),
    });
    const m = new THREE.Mesh(geo, stone);
    m.position.set(this.F.x(s.position.x), yAmos(U), this.F.z(s.position.z));
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'even-hashtiya';
    m.userData = { isFloor: true, name: 'even-hashtiya' };
    this.floors.push(m);
    sg.add(m);
    this.scene.add(sg);
  }

  // --------------------------------------------------------------------------
  // Roof of the Heichal block (x +-16, z -92 .. -165) at 100 with the 3-amah
  // parapet (Middot 4:6 maakeh); the Ulam ceiling doubles as its roof.
  // --------------------------------------------------------------------------
  buildRoof() {
    const g = tagEntry(new THREE.Group(), byId.heichal, { part: 'roof' });
    const { U } = LEVEL;
    const H = byId.heichal.dimensions.find((d) => d.label === 'height').value; // 100
    const xIn = byId.heichal.bounds.maxX + SECTION.wallT; // 16
    const zEast = byId.ulam.bounds.minZ; // -92
    const zWest = byId.kodesh_hakodashim.bounds.minZ - SECTION.wallT; // -165
    const xUlam = byId.ulam.bounds.maxX; // 50
    const zFront = byId.ulam.bounds.maxZ; // -76
    this.block(g, { x: [-xIn, xIn], y: [U + H - 1, U + H], z: [zEast, zWest] }, this.mat.stone, { name: 'heichal-roof' });
    const p = 3;
    this.blocksInstanced(
      g,
      [
        { x: [-xIn, -xIn + 1], y: [U + H, U + H + p], z: [zEast, zWest] },
        { x: [xIn - 1, xIn], y: [U + H, U + H + p], z: [zEast, zWest] },
        { x: [-xIn, xIn], y: [U + H, U + H + p], z: [zWest + 1, zWest] },
        { x: [-xUlam, -xUlam + 1], y: [U + H, U + H + p], z: [zFront, zEast] },
        { x: [xUlam - 1, xUlam], y: [U + H, U + H + p], z: [zFront, zEast] },
        { x: [-xUlam, xUlam], y: [U + H, U + H + p], z: [zFront, zFront - 1] },
      ],
      this.mat.stone,
      { name: 'roof-parapet' }
    );
    this.scene.add(g);
  }

  // --------------------------------------------------------------------------
  // Yachin and Boaz (I Kings 7:15-21): bronze columns 18 tall, circumference 12,
  // 5-amah capitals; Bayis Rishon only, hidden until toggled. Placed where the JSON
  // puts them: in front of the Ulam wall (z -76) on the top rovad of the steps,
  // z -74 (II Chronicles 3:15, 3:17), so the shaft stands free of the facade.
  // --------------------------------------------------------------------------
  buildYachinBoaz() {
    const { U } = LEVEL;
    for (const id of ['yachin', 'boaz']) {
      const e = byId[id];
      const g = periodGroup(e);
      const dim = (label) => e.dimensions.find((d) => d.label === label).value;
      const r = (dim('circumference') / (2 * Math.PI)) * A;
      const h = dim('height') * A;
      const capH = dim('capital height') * A;
      const [x, , z] = worldPos(e);
      g.position.set(x, yAmos(U), z);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), this.mat.copper);
      shaft.position.y = h / 2;
      const capital = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.35, r, capH, 24), this.mat.copperP);
      capital.position.y = h + capH / 2;
      g.add(shaft, capital);
      g.traverse((c) => {
        if (c.isMesh) c.castShadow = true;
      });
      this.scene.add(g);
    }
  }
}
