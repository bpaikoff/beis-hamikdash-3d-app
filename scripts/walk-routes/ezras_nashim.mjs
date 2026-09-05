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
    at('ezras_nashim_balcony', { dz: 1, ...BALCONY }), // the hotspot is on the parapet line
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
  // Azarah east wall. temple.json puts the rooms at x +-30, so their doors open inside the
  // lepers' chamber and the chamber of oils (x +-27.5 .. 67.5), not on the open court:
  // the way in is through those chambers' doors.
  lishkos_klei_shir: [
    at('ezras_nashim', EN),
    amos(25, 26, EN),
    amos(31, 26, EN), // into the lepers' chamber
    amos(30, 12, EN),
    amos(30, 3, EN), // in the doorway (the wall is z 0 .. 6)
    at('lishkos_klei_shir', { dz: -4, ...EN }),
    amos(30, 3, EN),
    amos(30, 12, EN),
    amos(31, 26, EN),
    amos(25, 26, EN),
    amos(-25, 26, EN),
    amos(-31, 26, EN), // into the chamber of oils
    amos(-30, 12, EN),
    amos(-30, 3, EN),
    amos(-30, -5, EN),
    amos(-30, 3, EN),
    amos(-30, 12, EN),
    amos(-31, 26, EN),
    amos(-25, 26, EN),
  ],

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
