import { AMAH, NICANOR_Z } from '../../src/content/units.js';

const at = (id, o = {}) => ({ id, ...o });
/** A point given in amos in the azarah frame (+x north, -z west), with the expected floor level. */
const p = (x, z, level, o = {}) => ({ x: x * AMAH, z: NICANOR_Z + z * AMAH, level, ...o });

const K = 'azaras_kohanim';
const C = 'cheil';
const HB = 'har_habayis';
/** A balustrade or parapet: the leg must end against it (result "stuck"), never over or through it. */
const blocked = { expect: 'blocked', reach: 0.3 };
/** A tread or landing of a flight, `up` metres above the Cheil (walk.mjs: feet >= level + minY - 0.5). */
const step = (x, z, up) => p(x, z, C, { reach: 0.4, minY: up });

/**
 * The stairs from the Cheil up into the two chambers that straddle a court wall with
 * their floors 16 amos over the Cheil (Beis HaMoked on the north, Lishkas HaGazis on
 * the south; reconstructions, see meta.disputes in temple.json). Each has a vestibule
 * at the Cheil level under its chol half, entered through a door in the outer wall,
 * and a switchback of 32 half-amah steps in three flights along z in three 2-amah
 * bands parted by half-amah walls (CourtBuilder.switchbackA): flight A in the outer
 * band climbs +z, landing L1, flight B back -z, landing L2, flight C beside the kodesh
 * partition up through a well in the chamber floor, which has a parapet on three sides.
 *
 * Beis HaMoked: partition x 67.5 .. 68.5; C x 68.5 .. 70.5, B 71 .. 73, A 73.5 .. 75.5,
 * A's outer wall x 75.5 .. 75.75; foot z -13.5, L1 z -8 .. -5.5, L2 z -16 .. -13.5,
 * the well z -13.5 .. -8.5. Vestibule door in the north wall (x 81.5 .. 82.5), z -16.5
 * .. -11.5, opposite the Soreg opening (z -19 .. -9) that faces the hall's Cheil gate.
 * Lishkas HaGazis: partition x -68.5 .. -67.5; C x -70.5 .. -68.5, B -73 .. -71, A
 * -76.5 .. -73.5 (against the outer wall); foot z -97, L1 z -91.5 .. -89, L2 z -99.5
 * .. -97, the well z -97 .. -92. Vestibule door in the south wall (x -77.5 .. -76.5),
 * z -115 .. -111, on the Cheil strip beside the chol half (x -83.5 .. -77.5).
 */
export const routes = {
  // From the plaza through the Soreg opening opposite the hall's Cheil gate, through the
  // vestibule door, up the three flights into the hall, out of its Azarah gate into the
  // court, and back the same way down to the plaza.
  beis_hamoked_stair: [
    p(90, -14, HB),
    p(83, -14, C, { reach: 0.5 }),
    p(80, -14, C),
    p(74.5, -15, C),
    step(74.5, -9, 2.5), // flight A, tenth tread
    step(74.5, -7, 2.75), // landing L1
    step(72, -6.75, 2.75),
    step(72, -13, 5.5), // flight B, top tread
    step(70, -15, 5.5), // landing L2
    p(69.5, -9, K, { reach: 0.4 }), // flight C, arriving in the well
    p(69.5, -6, K, { reach: 0.4 }),
    p(66, -6, K),
    p(66, -14, K),
    p(56, -14, K), // the Azarah gate
    p(46, -14, K),
    p(56, -14, K),
    p(66, -14, K),
    p(66, -6, K),
    p(69.5, -6, K, { reach: 0.4 }), // in line with the well before turning into it
    step(69.5, -13, 5.5), // down flight C
    step(70, -15, 5.5),
    step(72, -13, 5.5),
    step(72, -8.5, 2.75), // down flight B to its foot
    step(72, -6.75, 2.75),
    step(74.5, -7, 2.75),
    step(74.5, -9, 2.5),
    p(74.5, -15, C), // down flight A to the vestibule floor
    p(78, -15, C), // clear of the end of A's outer wall (z -13.5)
    p(80, -14, C),
    p(83, -14, C, { reach: 0.5 }),
    p(90, -14, HB),
  ],

  // The balustrades of the Beis HaMoked stair: into the outer wall from flight A, into
  // the wall between B and C from flight B, and into the well's parapet from the hall
  // floor on its kodesh side and from its -z end.
  beis_hamoked_stair_rails: [
    p(80, -14, C),
    p(74.5, -15, C),
    step(74.5, -11, 1.5),
    p(77, -11, C, { ...blocked, minY: 1.5 }),
    step(74.5, -7, 2.75),
    step(72, -6.75, 2.75),
    step(72, -11, 4.5),
    p(69, -11, C, { ...blocked, minY: 4.5 }),
    step(72, -13, 5.5),
    step(70, -15, 5.5),
    p(69.5, -9, K, { reach: 0.4 }),
    p(69.5, -6, K, { reach: 0.4 }),
    p(66, -6, K),
    p(66, -11, K),
    p(69.5, -11, K, blocked),
    p(66, -11, K),
    p(66, -16, K),
    p(69.5, -16, K, { reach: 0.4 }),
    p(69.5, -11, K, blocked),
    p(69.5, -16, K),
    p(66, -16, K),
    p(66, -14, K),
    p(56, -14, K),
  ],

  // From the plaza through the Soreg opening opposite Shaar HaDelek, along the Cheil
  // strip beside the Gazis' chol half to the vestibule door, up the three flights into
  // the chamber, through its court door into the court, and back down to the plaza.
  gazis_stair: [
    p(-90, -78, HB),
    p(-78.5, -78, C),
    p(-80.5, -90, C),
    p(-80.5, -113, C),
    p(-75, -113, C),
    p(-75, -101, C),
    step(-75, -92.5, 2.5), // flight A, tenth tread
    step(-75, -90.25, 2.75), // landing L1
    step(-72, -90.25, 2.75),
    step(-72, -96.5, 5.5), // flight B, top tread
    step(-70.5, -98.5, 5.5), // landing L2
    p(-69.5, -92.5, K, { reach: 0.4 }), // flight C, arriving in the well
    p(-69.5, -90.5, K, { reach: 0.4 }),
    p(-66, -90.5, K),
    at('lishkas_hagazis', { level: K }),
    p(-56, -103, K), // the court door
    p(-45, -103, K),
    p(-56, -103, K),
    at('lishkas_hagazis', { level: K }),
    p(-66, -90.5, K),
    p(-69.5, -90.5, K, { reach: 0.4 }), // in line with the well before turning into it
    step(-69.5, -96.5, 5.5), // down flight C
    step(-70.5, -98.5, 5.5),
    step(-72, -96.5, 5.5),
    step(-72, -92, 2.75), // down flight B to its foot
    step(-72, -90.25, 2.75),
    step(-75, -90.25, 2.75),
    step(-75, -92.5, 2.5),
    p(-75, -101, C), // down flight A to the vestibule floor
    p(-75, -113, C),
    p(-80.5, -113, C),
    p(-80.5, -90, C),
    p(-78.5, -78, C),
    p(-90, -78, HB),
  ],

  // The balustrades of the Gazis stair: into the wall between A and B from flight A,
  // into the wall between B and C from flight B, and into the well's parapet from the
  // chamber floor on its kodesh side and from its -z end.
  gazis_stair_rails: [
    p(-75, -113, C),
    p(-75, -101, C),
    step(-75, -94.5, 1.5),
    p(-72, -94.5, C, { ...blocked, minY: 1.5 }),
    step(-75, -90.25, 2.75),
    step(-72, -90.25, 2.75),
    step(-72, -94.5, 4.5),
    p(-69.5, -94.5, C, { ...blocked, minY: 4.5 }),
    step(-72, -96.5, 5.5),
    step(-70.5, -98.5, 5.5),
    p(-69.5, -92.5, K, { reach: 0.4 }),
    p(-69.5, -90.5, K, { reach: 0.4 }),
    p(-66, -90.5, K),
    p(-66, -94.5, K),
    p(-69.5, -94.5, K, blocked),
    p(-66, -94.5, K),
    p(-66, -100, K),
    p(-69.5, -100, K, { reach: 0.4 }),
    p(-69.5, -94.5, K, blocked),
    p(-69.5, -100, K),
    p(-66, -100, K),
    at('lishkas_hagazis', { level: K }),
    p(-56, -103, K),
  ],
};
