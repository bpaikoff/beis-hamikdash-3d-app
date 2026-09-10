import { AMAH, NICANOR_Z } from '../../src/content/units.js';

/** A point given in amos in the azarah frame (+x north, -z west), with the expected floor level. */
const p = (x, z, level, o = {}) => ({ x: x * AMAH, z: NICANOR_Z + z * AMAH, level, ...o });

const K = 'azaras_kohanim';
const C = 'cheil';
const HB = 'har_habayis';
/** A wall, a parapet or a mass: the leg must end against it (result "stuck"), never over or through it. */
const blocked = { expect: 'blocked', reach: 0.3 };
const CHEIL_Y = -13.5;
/** Metres over the Cheil level of a height `y` amos over the Azarah floor (walk.mjs minY: feet >= level + minY - 0.5 m). */
const up = (y) => (y - CHEIL_Y) * AMAH;
/** A tread, a landing or a raised floor whose top is `y` amos over the Azarah floor. */
const on = (x, z, y) => p(x, z, C, { reach: 0.3, minY: up(y) });
/** A blocked leg from such a surface: the feet must stay up there. */
const wall = (x, z, y) => p(x, z, C, { ...blocked, minY: up(y) });
/** A blocked leg from the court level (the hall, the chamber, the tower's top landing): the feet stay on it. */
const wallK = (x, z) => p(x, z, K, { ...blocked, minY: 0 });

/**
 * Round 6, the north walker: what a visitor does with the Middot 1:9 passage
 * (AzaraBuilder.buildTevilahPassage) and Shaar HaNitzotz's stair tower
 * (buildNitzotzWicket). Coordinates as in r6_moked.mjs: the well x 74 .. 78.5, z -22.75
 * .. -20.75 in the north-west chamber's floor (2.55), flights C / B / A down to the
 * vestibule's west bay (-13.41), the door at x 73.5 .. 76.5 in its west wall (z -26 ..
 * -25), the vaulted passage west to z -42, four steps up to the bath-house (floor
 * -11.41, x 73.5 .. 81.5, z -52 .. -42), the pool x 76.5 .. 80.5, z -50 .. -46 with its
 * treads at the east end; the tower x 73.5 .. 81, z -99 .. -83 with the wicket at x 77.5
 * .. 79.5 in its east face and the bay z -87 .. -84 through the wall at the court level.
 */
export const routes = {
  // A visitor in from Tadi (Middot 1:3, x 197.5, z -20): over the plaza to the Soreg opening
  // opposite Shaar HaNitzotz, along the Cheil to the wicket, up the tower's two flights to
  // the landing at the court level and through the bay into the court beside the gate.
  r6n_tadi_to_nitzotz: [
    p(197.5, -20, HB),
    p(180, -25, HB),
    p(90, -78, HB),
    p(82.4, -78, C, { reach: 0.4 }), // in through the Soreg opening onto the lane (Lishkas Palhedrin, round 7, fills x 73.5 .. 81 at z -79 .. -63)
    p(82.4, -80.5, C, { reach: 0.4 }),
    p(78.5, -81.5, C, { reach: 0.4 }), // the wicket, in the tower's east face
    p(78.5, -85.5, C, { reach: 0.4 }), // the entry strip
    on(78.5, -88.25, -12), // the lower flight up
    on(78.5, -92.25, -8),
    on(78.5, -96.5, -5.5), // the turn landing
    on(75, -96.5, -5.5),
    on(75, -92.25, -2.5), // the upper flight up
    on(75, -88.25, 1.5),
    on(75, -85.5, 2.5), // the top landing
    p(70.5, -85.5, K, { reach: 0.4 }), // the bay through the wall
    p(61, -85.5, K),
    p(61, -78, K), // in front of the gate's closed doors, on the court side
    p(40, -65, K), // toward the altar's north-west
  ],

  // The same way out: from the court through the bay, down the tower, out of the wicket,
  // along the Cheil and over the plaza to Tadi.
  r6n_nitzotz_to_tadi: [
    p(40, -65, K),
    p(61, -85.5, K),
    p(70.5, -85.5, K, { reach: 0.4 }),
    on(75, -85.5, 2.5),
    on(75, -88.25, 1.5),
    on(75, -92.25, -2.5),
    on(75, -96.5, -5.5),
    on(78.5, -96.5, -5.5),
    on(78.5, -92.25, -8),
    on(78.5, -88.25, -12),
    p(78.5, -85.5, C, { reach: 0.4 }),
    p(78.5, -81.5, C, { reach: 0.4 }),
    p(78.5, -78, C),
    p(90, -78, HB),
    p(180, -25, HB),
    p(197.5, -20, HB),
  ],

  // The kohen's night (Tamid 1:1, Middot 1:9): from the Azarah gate through the hall to the
  // north-west chamber, into the well, down the three flights, out of the bay's door and
  // along the lit passage, up into the bath-house, down the treads into the water and out
  // again, and back up the same way into the hall and out to the court.
  r6n_moked_pool_and_back: [
    p(46, -14, K),
    p(56, -14, K), // the Azarah gate
    p(66.5, -14, K),
    p(66.5, -19.5, K),
    p(72, -19.5, K, { reach: 0.4 }), // the chamber door
    p(75.8, -19.5, K, { reach: 0.4 }),
    p(78.8, -19.5, K, { reach: 0.4 }),
    p(78.8, -21.75, K, { reach: 0.4 }), // the step-off floor at the well's open end
    on(77.25, -21.75, 1.05), // flight C down
    on(75.25, -21.75, -0.95),
    on(72.75, -21.75, -2.45), // landing L2
    on(72.75, -19.5, -2.45),
    on(76.75, -19.5, -4.95), // flight B down
    on(79.25, -19.5, -7.45),
    on(80.5, -19.5, -7.95), // landing L1
    on(80.5, -17.25, -7.95),
    on(76.25, -17.25, -10.95), // flight A down
    on(74.25, -17.25, -12.95),
    p(70, -17.25, C, { reach: 0.4 }), // the pocket at A's foot
    p(70, -24, C, { reach: 0.4 }), // the lane to the strip along the west wall
    p(75, -24, C, { reach: 0.4 }),
    p(75, -30, C), // through the door into the passage
    p(75, -38, C),
    on(75, -41.25, -11.91), // up the four steps
    on(75, -44.5, -11.41), // in the bath-house
    on(78.5, -44.5, -11.41),
    on(78.5, -46.25, -11.91), // down the treads
    on(78.5, -47.25, -12.91),
    on(78.5, -49, -13.41), // in the water, on the pavement
    on(79.5, -49.5, -13.41),
    on(78.5, -47.25, -12.91), // and out
    on(78.5, -46.25, -11.91),
    on(78.5, -44.5, -11.41),
    on(75, -45, -11.41), // round the kerb's west side
    p(74.5, -49.5, C, { reach: 0.5, minY: up(-11.41) }), // to warm at the fire in the south-west corner (the hearth stops the body at z -49.05)
    on(75, -44.5, -11.41),
    on(75, -41.25, -11.91),
    p(75, -38, C),
    p(75, -30, C),
    p(75, -24, C, { reach: 0.4 }),
    p(70, -24, C, { reach: 0.4 }),
    p(70, -17.25, C, { reach: 0.4 }),
    on(74.25, -17.25, -12.95), // flight A up
    on(76.25, -17.25, -10.95),
    on(80.5, -17.25, -7.95),
    on(80.5, -19.5, -7.95),
    on(79.25, -19.5, -7.45), // flight B up
    on(76.75, -19.5, -4.95),
    on(72.75, -19.5, -2.45),
    on(72.75, -21.75, -2.45),
    on(75.25, -21.75, -0.95), // flight C up
    on(77.25, -21.75, 1.05),
    p(78.8, -21.75, K, { reach: 0.4 }),
    p(78.8, -19.5, K, { reach: 0.4 }),
    p(72, -19.5, K, { reach: 0.4 }),
    p(66.5, -19.5, K),
    p(66.5, -14, K),
    p(56, -14, K),
    p(46, -14, K),
  ],

  // The tamei kohen's way out (Tamid 1:1: he comes up, dries, warms himself at the fire
  // and sits with his fellow kohanim until the gates open; shaar_tadi's note: he leaves by
  // Tadi): from the pool back along the passage and up the three flights into the hall,
  // down the GEO-D switchback to the vestibule (the passage's bay is sealed from its foot),
  // out of the Cheil door, through the Soreg opening and over the plaza to Tadi.
  r6n_pool_to_tadi: [
    on(78.5, -49, -13.41),
    on(78.5, -47.25, -12.91),
    on(78.5, -46.25, -11.91),
    on(78.5, -44.5, -11.41),
    on(75, -44.5, -11.41),
    on(75, -41.25, -11.91),
    p(75, -38, C),
    p(75, -30, C),
    p(75, -24, C, { reach: 0.4 }), // the strip along the vestibule's west wall
    p(70, -24, C, { reach: 0.4 }),
    p(70, -17.25, C, { reach: 0.4 }),
    on(74.25, -17.25, -12.95), // flight A up
    on(76.25, -17.25, -10.95),
    on(80.5, -17.25, -7.95),
    on(80.5, -19.5, -7.95),
    on(79.25, -19.5, -7.45), // flight B up
    on(76.75, -19.5, -4.95),
    on(72.75, -19.5, -2.45),
    on(72.75, -21.75, -2.45),
    on(75.25, -21.75, -0.95), // flight C up
    on(77.25, -21.75, 1.05),
    p(78.8, -21.75, K, { reach: 0.4 }),
    p(78.8, -19.5, K, { reach: 0.4 }),
    p(72, -19.5, K, { reach: 0.4 }), // out of the chamber
    p(66.5, -19.5, K),
    p(66, -6, K), // across the hall to the switchback's well
    p(69.5, -6, K, { reach: 0.4 }),
    p(69.5, -13, C, { reach: 0.4, minY: 5.5 }), // down flight C
    p(70, -15, C, { reach: 0.4, minY: 5.5 }),
    p(72, -13, C, { reach: 0.4, minY: 5.5 }),
    p(72, -8.5, C, { reach: 0.4, minY: 2.75 }), // down flight B
    p(72, -6.75, C, { reach: 0.4, minY: 2.75 }),
    p(74.5, -7, C, { reach: 0.4, minY: 2.75 }),
    p(74.5, -9, C, { reach: 0.4, minY: 2.5 }),
    p(74.5, -15, C), // down flight A to the vestibule floor
    p(78, -15, C),
    p(80, -14, C),
    p(83, -14, C, { reach: 0.5 }), // the vestibule's Cheil door
    p(90, -14, HB), // the Soreg opening opposite it
    p(180, -18, HB),
    p(197.5, -20, HB), // Tadi
  ],

  // The Cheil's north strip as a visitor walks it: from Shaar HaNashim's front west along
  // the lane beside the Soreg past the bath-house, past Shaar HaKorban's front and the
  // Nitzotz tower to the Cheil beyond it, back east the same way to the passage's vault
  // and the Beis HaMoked's west wall, then out to the plaza and round to the hall's Cheil
  // door into the vestibule.
  r6n_cheil_nashim_to_moked_door: [
    p(90, -36, HB),
    p(78.5, -36, C), // Shaar HaNashim's front, beside the passage's vault (x to 77)
    p(80, -40, C, { reach: 0.4 }),
    p(82.4, -41, C, { reach: 0.4 }), // the lane past the bath-house (x to 81.5)
    p(82.4, -53.5, C, { reach: 0.4 }),
    p(78.5, -58, C), // Shaar HaKorban's front
    p(82.4, -60, C, { reach: 0.4 }), // the lane past Lishkas Palhedrin (round 7: x to 81, z -79 .. -63)
    p(82.4, -82, C, { reach: 0.4 }), // and past the tower (x to 81)
    p(82.4, -100.5, C, { reach: 0.4 }),
    p(78.5, -104, C),
    p(76, -110, C), // the Cheil beyond the tower, against the wall
    p(78.5, -104, C),
    p(82.4, -100.5, C, { reach: 0.4 }),
    p(82.4, -82, C, { reach: 0.4 }),
    p(82.4, -60, C, { reach: 0.4 }),
    p(78.5, -58, C),
    p(82.4, -53.5, C, { reach: 0.4 }),
    p(82.4, -41, C, { reach: 0.4 }),
    p(80, -40, C, { reach: 0.4 }),
    p(79.5, -27.5, C, { reach: 0.4 }), // the Beis HaMoked's west wall, at the vault's end
    p(79.5, -36, C),
    p(90, -36, HB), // out, and round the hall over the plaza
    p(90, -14, HB),
    p(83, -14, C, { reach: 0.5 }), // the hall's Cheil door
    p(79, -14, C),
    p(78, -15, C), // inside the vestibule, at the switchback's foot (the passage's bay beyond z -16 is sealed from here)
  ],

  // What stops a visitor in the hall: the well's parapet from the chamber floor (room
  // side and foot end), the chamber wall and the parapet from the second tread.
  r6n_well_blocked: [
    p(66.5, -19.5, K),
    p(72, -19.5, K, { reach: 0.4 }),
    p(76, -19.5, K, { reach: 0.4 }),
    wallK(76, -23), // the parapet on the well's room side
    p(76, -19.5, K, { reach: 0.4 }),
    p(73.9, -19.5, K, { reach: 0.4 }),
    wallK(73.9, -23), // the parapet across the well's foot end
    p(73.9, -19.5, K, { reach: 0.4 }),
    p(78.8, -19.5, K, { reach: 0.4 }),
    p(78.8, -21.75, K, { reach: 0.4 }),
    on(77.75, -21.75, 1.55),
    wall(77.75, -25, 1.55), // the chamber's west wall from the second tread
    wall(77.75, -18, 1.55), // the parapet from the second tread
    on(77.75, -21.75, 1.55),
    p(78.8, -21.75, K, { reach: 0.4 }),
    p(78.8, -19.5, K, { reach: 0.4 }),
    p(72, -19.5, K, { reach: 0.4 }),
    p(66.5, -19.5, K),
  ],

  // What stops him in the bath-house: the pool's kerb from the floor (west side and the
  // return beside the treads), its walls from the water, and the passage's Cheil-side
  // wall from inside.
  r6n_bath_blocked: [
    p(75, -24, C),
    p(75, -30, C),
    p(79, -30, C, { ...blocked, minY: 0 }), // the passage's Cheil-side wall from inside
    p(75, -30, C),
    p(75, -38, C),
    on(75, -41.25, -11.91),
    on(75, -46, -11.41),
    wall(79, -46, -11.41), // the pool's west kerb
    on(75, -46, -11.41),
    on(75.5, -45.8, -11.41),
    wall(79, -45.8, -11.41), // the kerb's north end beside the treads (it ends at z -45.5; on that line the browser walker slid along its face)
    on(75.5, -45.8, -11.41),
    on(75, -50, -11.41), // the south-west corner by the hearth (the floor south of the pool is a half-amah sliver behind the kerb, not walked)
    on(75, -44.5, -11.41),
    on(78.5, -44.5, -11.41),
    on(78.5, -46.25, -11.91),
    on(78.5, -47.25, -12.91),
    on(77, -49, -13.41),
    wall(73, -49, -13.41), // the pool's west wall from the water
    wall(77, -53, -13.41), // its south wall
    wall(82, -49, -13.41), // the bath-house's north wall
    on(78.5, -47.25, -12.91),
    on(78.5, -46.25, -11.91),
    on(78.5, -44.5, -11.41),
    on(75, -44.5, -11.41),
    on(75, -41.25, -11.91),
    p(75, -38, C),
    p(75, -30, C),
  ],

  // What stops him on the Cheil: the passage's wall from Shaar HaNashim's front, the
  // bath-house's three free walls, the tower's east face beside the wicket, the wall under
  // its top landing from the entry strip, its north wall from the lane and its west wall.
  r6n_cheil_blocked: [
    p(90, -36, HB),
    p(78.5, -36, C),
    p(78.5, -30, C),
    p(75, -30, C, { ...blocked, minY: 0 }), // the passage's wall from Shaar HaNashim's front
    p(78.5, -36, C),
    p(78.5, -43, C, { ...blocked, minY: 0 }), // the bath-house's east wall from the Cheil
    p(80, -40, C, { reach: 0.4 }),
    p(82.4, -41, C, { reach: 0.4 }),
    p(82.4, -47, C, { reach: 0.4 }),
    p(78, -47, C, { ...blocked, minY: 0 }), // its north wall from the lane
    p(82.4, -47, C, { reach: 0.4 }),
    p(82.4, -53.5, C, { reach: 0.4 }),
    p(78.5, -56, C),
    p(78.5, -49, C, { ...blocked, minY: 0 }), // its west wall from Shaar HaKorban's front
    p(75.5, -58, C),
    p(75.5, -65, C, { ...blocked, minY: 0 }), // Lishkas Palhedrin's east wall beside its door (round 7)
    p(78.5, -58, C),
    p(82.4, -60, C, { reach: 0.4 }),
    p(82.4, -70, C, { reach: 0.4 }),
    p(78, -70, C, { ...blocked, minY: 0 }), // Palhedrin's north wall from the lane
    p(82.4, -70, C, { reach: 0.4 }),
    p(82.4, -80.5, C, { reach: 0.4 }),
    p(76, -80.5, C, { reach: 0.4 }),
    p(76, -78, C, { ...blocked, minY: 0 }), // Palhedrin's west wall from the gap
    p(76, -80.5, C, { reach: 0.4 }),
    p(76, -85, C, { ...blocked, minY: 0 }), // the tower's east face beside the wicket
    p(78.5, -80.5, C, { reach: 0.4 }),
    p(78.5, -85.5, C, { reach: 0.4 }), // in at the wicket
    p(74, -85.5, C, { ...blocked, minY: 0 }), // the wall under the top landing, from the entry strip
    p(78.5, -85.5, C, { reach: 0.4 }),
    p(78.5, -80.5, C, { reach: 0.4 }),
    p(82.4, -82, C, { reach: 0.4 }),
    p(82.4, -92, C, { reach: 0.4 }),
    p(78, -92, C, { ...blocked, minY: 0 }), // the tower's north wall from the lane
    p(82.4, -92, C, { reach: 0.4 }),
    p(82.4, -100.5, C, { reach: 0.4 }),
    p(78.5, -104, C),
    p(78.5, -97, C, { ...blocked, minY: 0 }), // its west wall from the Cheil beyond
    p(78.5, -104, C),
    p(82.4, -100.5, C, { reach: 0.4 }),
    p(82.4, -82, C, { reach: 0.4 }),
    p(82.4, -78, C, { reach: 0.4 }),
    p(90, -78, HB),
  ],
};
