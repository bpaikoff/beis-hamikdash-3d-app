import { toWorld } from '../../src/content/units.js';

const at = (id, o = {}) => ({ id, ...o });
/** A waypoint at (x, z) amos in the azarah frame (see docs/content.md), optional level name. */
const amos = (x, z, o = {}) => {
  const [wx, , wz] = toWorld({ x, y: 0, z });
  return { x: Number(wx.toFixed(2)), z: Number(wz.toFixed(2)), ...o };
};

const EN = { level: 'ezras_nashim' };
const EY = { level: 'azaras_yisrael' };
/** The balcony is 10 amos over the Ezras Nashim floor, y 2.5: the same height as the Ezras Kohanim. */
const BALCONY = { level: 'azaras_kohanim' };

/**
 * One side of the gallery (s = 1 north, -1 south): up the flight, then against every
 * edge in turn. The flight's foot is against the chamber wall, so it is entered from
 * the court over its two lowest treads.
 */
function parapetSide(s) {
  const B = { expect: 'blocked' };
  return [
    amos(s * 26.5, 125, EN),
    amos(s * 26.5, 135, EN), // foot of the flight
    amos(s * 17.5, 135), // mid-flight
    amos(s * 17.5, 128, B), // balustrade on the court side
    amos(s * 17.5, 135),
    amos(s * 17.5, 142, B), // balustrade on the gate side, under the gallery's parapet
    amos(s * 17.5, 135),
    amos(s * 8, 135, BALCONY), // top tread
    amos(s * 5.5, 135, BALCONY), // landing
    amos(s * 5.5, 128, B), // its court edge
    amos(s * 5.5, 135, BALCONY),
    amos(0, 135, B), // its edge toward the axis
    amos(s * 5.5, 135, BALCONY),
    amos(s * 5.5, 139, BALCONY),
    amos(0, 139, BALCONY),
    amos(0, 130, B), // parapet over the gate
    amos(s * 15, 139, BALCONY),
    amos(s * 15, 130, B), // parapet over the flight
    amos(s * 25.5, 139, BALCONY),
    amos(s * 25.5, 120, BALCONY),
    amos(s * 18, 120, B), // parapet along the eastern chamber's court wall
    amos(s * 25.5, 99, BALCONY),
    amos(s * 45, 99, BALCONY),
    amos(s * 45, 90, B), // parapet along its west wall
    amos(s * 65.5, 99, BALCONY),
    amos(s * 65.5, 70, BALCONY),
    amos(s * 58, 70, B), // parapet of the wall run
    amos(s * 65.5, 48, BALCONY),
    amos(s * 65.5, 40, B), // the run's end against the western chamber's wall
  ];
}

// dx/dz are METRES in the scene frame (+x north, +z east); amos(x, z) takes amos. Walks are
// straight lines between waypoints, so route through doors and openings explicitly.
// The corner chambers open toward the court through their x-facing wall (x = +-27.5).
export const routes = {
  // The four corner chambers through their doors and back out (Middot 2:5).
  ezras_nashim: [
    at('ezras_nashim', EN),
    amos(-25, 26, EN), // outside the door of the chamber of oils (x -27.5)
    amos(-31, 26, EN), // inside
    at('chamber_oils', EN),
    amos(-31, 26, EN),
    amos(-25, 26, EN),
    amos(25, 26, EN), // lepers' chamber: the mikveh fills the middle, so stop short of the centre
    amos(31, 26, EN),
    at('chamber_lepers', { dx: -3.5, ...EN }),
    amos(31, 26, EN),
    amos(25, 26, EN),
    amos(-25, 121, EN), // Nazirites
    amos(-31, 121, EN),
    at('chamber_nazirites', { dx: 1.5, dz: -1, ...EN }),
    amos(-31, 121, EN),
    amos(-25, 121, EN),
    amos(25, 121, EN), // wood store (the logs are stacked against the north wall)
    amos(31, 121, EN),
    at('chamber_wood', { dx: -1.5, ...EN }),
    amos(31, 121, EN),
    amos(25, 121, EN),
    at('ezras_nashim', EN),
  ],

  // The east gate from the Cheil and back: through the Soreg opening, up the twelve steps,
  // into the court, and out again down to the plaza.
  ezras_nashim_gate: [
    amos(0, 165, { level: 'har_habayis' }),
    at('cheil', { level: 'cheil' }),
    at('ezras_nashim_gate', EN),
    amos(0, 128, EN),
    at('ezras_nashim_gate', EN),
    amos(0, 157, { level: 'cheil' }), // the landing's east edge: nearer the steps the player is still skipping down them in the air
    amos(0, 165, { level: 'har_habayis' }),
  ],

  // The fifteen semicircular steps (Middot 2:5) up to Nicanor from the axis, from both
  // edges of the arc and diagonally, and down again.
  maalos_shir: [
    amos(0, 30, EN),
    amos(0, 8, EY), // top step, level with the threshold
    amos(0, 3, EY), // Nicanor threshold
    amos(0, -5, EY),
    amos(0, 3, EY),
    amos(0, 8, EY),
    amos(-15, 24, EN), // down diagonally
    amos(19.7, 9.5, EN), // north edge of the arc, at the wall
    amos(7, 7.5), // climbing along the wall face
    amos(0, 8, EY),
    amos(-7, 7.5),
    amos(-19.7, 9.5, EN), // south edge
    amos(-15, 24, EN),
    amos(12, 30, EN),
    amos(0, 8, EY), // straight up at 30 degrees off the axis
    amos(0, 3, EY),
    amos(0, -5, EY),
  ],

  // Up the north flight to the gallery, round its whole U (east wall, in front of the
  // corner chambers, north and south walls) and down the south flight.
  ezras_nashim_balcony: [
    amos(26.5, 125, EN),
    amos(26.5, 135, EN), // foot of the north flight (against the wood store's wall)
    amos(8, 135, BALCONY), // top step
    amos(5.5, 135, BALCONY), // landing
    amos(5.5, 139, BALCONY), // gallery over the gate
    at('ezras_nashim_balcony', BALCONY), // the hotspot is on the gallery floor over the gate
    amos(25.5, 139, BALCONY),
    amos(25.5, 99, BALCONY), // along the wood store's court wall
    amos(45, 99, BALCONY), // along its west wall
    amos(65.5, 99, BALCONY),
    amos(65.5, 60, BALCONY), // north wall run, to the lepers' chamber
    amos(65.5, 99, BALCONY),
    amos(25.5, 99, BALCONY),
    amos(25.5, 139, BALCONY),
    amos(-25.5, 139, BALCONY),
    amos(-25.5, 99, BALCONY),
    amos(-45, 99, BALCONY),
    amos(-65.5, 99, BALCONY),
    amos(-65.5, 60, BALCONY), // south wall run, to the chamber of oils
    amos(-65.5, 99, BALCONY),
    amos(-25.5, 99, BALCONY),
    amos(-25.5, 139, BALCONY),
    amos(-5.5, 139, BALCONY),
    amos(-5.5, 135, BALCONY), // south landing
    amos(-8, 135, BALCONY), // top step
    amos(-26.5, 135, { minY: 0, ...EN }), // foot of the south flight (reached on the lowest steps: level checked as a minimum)
    amos(-26.5, 125, EN),
  ],

  // The Lishkos Klei Shir under the Ezras Yisrael (Middot 2:6), through their doors in the
  // Azarah east wall at x +-20: on the open court between the fifteen steps (outer radius
  // 12.5) and the corner chambers (x +-27.5).
  lishkos_klei_shir: [
    at('ezras_nashim', EN),
    amos(20, 20, EN),
    amos(20, 3, EN), // in the doorway (the wall is z 0 .. 6)
    at('lishkos_klei_shir', { dz: -4, ...EN }),
    amos(20, 3, EN),
    amos(20, 20, EN),
    amos(-20, 20, EN),
    amos(-20, 3, EN),
    amos(-20, -5, EN),
    amos(-20, 3, EN),
    amos(-20, 20, EN),
    at('ezras_nashim', EN),
  ],

  // The court's inside faces hugged 0.8 amos off, all four sides: the corner chambers'
  // court-facing walls with a dip into every door, the north and south walls between the
  // chambers under the gallery, and the east wall under the gallery over the gate
  // (dipping into the gate), between the flights' feet and the wall.
  // The walker counts a waypoint reached 1.2 m short, so a dip returns to a point well
  // clear of the reveal before the next run along the face, and at a convex corner the
  // turn is made at a waypoint 1.5 amos past the face just left (reach 0.3), where the
  // body clears the corner before it moves along the next face.
  ezras_nashim_walls: [
    amos(-26.7, 6.8, EN), // where the chamber of oils meets the Azarah wall
    amos(-26.7, 20, EN),
    amos(-26.7, 26, EN),
    amos(-30, 26, EN), // in its door
    amos(-24, 26, EN),
    amos(-26.7, 32, EN),
    amos(-26.7, 47.5, { ...EN, reach: 0.3 }), // round its north-east corner
    amos(-66.7, 46.8, EN), // along its east wall to the south wall
    amos(-66.7, 100.2, EN), // the south wall, under the gallery
    amos(-26, 100.2, { ...EN, reach: 0.3 }), // round the Nazirites' north-west corner
    amos(-26.7, 115, EN),
    amos(-26.7, 121, EN),
    amos(-30, 121, EN), // the Nazirites' door
    amos(-24, 121, EN),
    amos(-26.7, 127, EN),
    amos(-26.7, 140.2, EN),
    amos(0, 140.2, EN), // the east wall, under the gallery
    amos(0, 144, EN), // in the gate
    amos(0, 137.5, EN), // out, between the flights' landings
    amos(26.7, 140.2, EN),
    amos(26.7, 127, EN),
    amos(26.7, 121, EN),
    amos(30, 121, EN), // the wood store's door
    amos(24, 121, EN),
    amos(26.7, 115, EN),
    amos(26.7, 99.5, { ...EN, reach: 0.3 }), // round its south-west corner
    amos(66.7, 100.2, EN),
    amos(66.7, 46.8, EN), // the north wall, under the gallery
    amos(26, 46.8, { ...EN, reach: 0.3 }), // round the lepers' south-east corner
    amos(26.7, 32, EN),
    amos(26.7, 26, EN),
    amos(30, 26, EN), // the lepers' door
    amos(24, 26, EN),
    amos(26.7, 20, EN),
    amos(26.7, 6.8, EN),
  ],

  // The ends of the fifteen steps, where they meet the Azarah wall (Middot 2:5): along
  // the wall face from the north, up the treads' ends to the Nicanor threshold, through
  // the gate and down the southern ends. The top tread is 5.5 amos in radius and the foot
  // 12.5, so those waypoints take a tight reach for the level check to land on them.
  maalos_shir_ends: [
    amos(26.7, 6.8, EN),
    amos(14, 6.8, { ...EN, reach: 0.3 }), // foot of the arc at the wall
    amos(4, 6.8, { ...EY, reach: 0.3 }), // top tread, level with the threshold
    amos(0, 3, EY),
    amos(-4, 6.8, { ...EY, reach: 0.3 }),
    amos(-14, 6.8, { ...EN, reach: 0.3 }),
    amos(-26.7, 6.8, EN),
  ],

  // Inside the two Lishkos Klei Shir (Middot 2:6): through the door and round the walls.
  klei_shir_walls: [
    amos(20, 12, EN),
    amos(20, 3, EN),
    amos(20, -3, EN),
    amos(16.8, -3, EN), // south wall
    amos(16.8, -8.2, EN), // west (back) wall
    amos(23.2, -8.2, EN),
    amos(23.2, -3, EN), // north wall
    amos(20, -3, EN),
    amos(20, 3, EN),
    amos(20, 12, EN),
    amos(-20, 12, EN),
    amos(-20, 3, EN),
    amos(-20, -3, EN),
    amos(-16.8, -3, EN),
    amos(-16.8, -8.2, EN),
    amos(-23.2, -8.2, EN),
    amos(-23.2, -3, EN),
    amos(-20, -3, EN),
    amos(-20, 3, EN),
    amos(-20, 12, EN),
  ],

  // The gallery's edges: every parapet, the flights' balustrades and the landings' edges
  // must stop the player (expect: 'blocked'), one route per side.
  ezras_nashim_parapets_north: parapetSide(1),
  ezras_nashim_parapets_south: parapetSide(-1),

  // The two chambers beside Nicanor (Middot 1:4) from the Ezras Yisrael through their doors.
  nicanor_chambers: [
    amos(0, -5, EY),
    amos(12, -4, EY),
    at('lishkas_pinchas_hamalbish', { dz: 1.5, ...EY }),
    amos(12, -4, EY),
    amos(-12, -4, EY),
    at('lishkas_osei_chavitin', { dz: 1.5, ...EY }),
    amos(-12, -4, EY),
    amos(0, -5, EY),
  ],
};
