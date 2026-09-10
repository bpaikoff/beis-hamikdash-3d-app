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
const on = (x, z, y) => p(x, z, C, { reach: 0.3, minY: up(y) }); // reached within 0.3 m: at most one half-amah tread short of the target's height
/** A blocked leg from such a surface: the feet must stay up there. */
const wall = (x, z, y) => p(x, z, C, { ...blocked, minY: up(y) });

/**
 * Round 6 (AzaraBuilder.buildTevilahPassage / buildNitzotzWicket): the winding passage
 * of Middot 1:9 from Beis HaMoked's north-west chamber to the bath-house, and Shaar
 * HaNitzotz's opening to the Cheil (Middot 1:5). Reconstructions, see meta.disputes.
 *
 * Tevilah stair (flights along x in three 2-amah bands under the chamber, quarter-amah
 * walls between): the well x 74 .. 78.5, z -22.75 .. -20.75 in the chamber floor, with a
 * parapet on its room side (z -20.75 .. -20.25, the collider inside it keeps the body off
 * z -20.65) and across its foot end beside the door (x 73.5 .. 74); flight C ten rises down (nine treads; the first is the slab's edge)
 * west to landing L2 (x 71.5 .. 74, z -22.75 .. -18.5, top -2.45); flight B 11 steps
 * east in z -20.5 .. -18.5 to L1 (x 79.5 .. 81.5, z -20.5 .. -16.25, top -7.95); flight A
 * 11 steps west in z -18.25 .. -16.25 to the vestibule floor at x 74 (-13.41). From A's
 * foot a pocket and a lane (x 68.5 .. 71.25) lead round L2 to a 2-amah strip along the
 * vestibule's west wall and its door at x 73.5 .. 76.5 (z -26 .. -25); the passage (x
 * 73.5 .. 76.5) runs west on the Cheil pavement to z -42, its last two amos four steps up
 * to the bath-house floor (-11.41; the room x 73.5 .. 81.5, z -52 .. -42, door z -43 ..
 * -42 at x 73.5 .. 76.5). The pool x 76.5 .. 80.5, z -50 .. -46: three treads at its east
 * end (z -47.5 .. -46) down to the pavement, a kerb 1.5 high on its south and west sides.
 *
 * Nitzotz tower (x 73.5 .. 81, z -99 .. -83, the court wall its south face): the wicket
 * (2 x 4) in its east wall at x 77.5 .. 79.5, an entry strip z -87 .. -84 in the Soreg-
 * side band (x 77 .. 80), the lower flight of 16 west to a landing across the west end
 * (z -98 .. -95, top -5.5), the upper flight east in the wall-side band (x 73.5 .. 76.5)
 * to the top landing (z -87 .. -84, 2.5) and the 3-amah bay through the wall (z -87 ..
 * -84) into the court. The Cheil lane along the Soreg (x 81 / 81.5 .. 83.5) passes both.
 */
export const routes = {
  // The kohen's way (Tamid 1:1): from the hall into the chamber, down the three flights,
  // round the landing, out of the bay's west door, along the passage, up into the
  // bath-house, down into the pool, and back the same way to the hall.
  r6_tevilah_passage: [
    p(56, -14, K),
    p(66.5, -14, K),
    p(66.5, -19.5, K),
    p(72, -19.5, K, { reach: 0.4 }), // the chamber door, on its east side
    p(75.8, -19.5, K, { reach: 0.4 }), // beside the parapet
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
    p(70, -17.25, C, { reach: 0.4 }), // the pocket at A's foot, into the lane
    p(70, -24, C, { reach: 0.4 }), // the lane, to the strip along the west wall
    p(75, -24, C, { reach: 0.4 }),
    p(75, -28, C), // through the door into the passage
    p(75, -38, C),
    on(75, -41.25, -11.91), // the steps up to the bath-house
    on(75, -44.5, -11.41), // inside
    on(78.5, -44.5, -11.41), // the east lane before the pool's steps
    on(78.5, -46.25, -11.91), // down into the pool
    on(78.5, -47.25, -12.91),
    on(78.5, -49, -13.41), // standing in the water, on the pavement
    on(78.5, -47.25, -12.91),
    on(78.5, -46.25, -11.91),
    on(78.5, -44.5, -11.41),
    on(75, -44.5, -11.41),
    on(75, -41.25, -11.91),
    p(75, -38, C),
    p(75, -28, C),
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
    p(75.8, -19.5, K, { reach: 0.4 }),
    p(72, -19.5, K, { reach: 0.4 }),
    p(66.5, -19.5, K),
    p(66.5, -14, K),
    p(56, -14, K),
  ],

  // Every open side of the Tevilah stair is fenced: the well's parapet from the room, the
  // chamber wall and the band wall from inside the well, every landing's and flight's
  // walls, the landing's end wall from the lane, the passage's wall, the pool's kerb.
  r6_tevilah_rails: [
    p(66.5, -19.5, K),
    p(72, -19.5, K, { reach: 0.4 }),
    p(75.8, -19.5, K, { reach: 0.4 }),
    p(75.8, -23, K, { ...blocked, minY: 0 }), // the parapet on the well's room side
    p(75.8, -19.5, K, { reach: 0.4 }),
    p(78.8, -19.5, K, { reach: 0.4 }),
    p(78.8, -21.75, K, { reach: 0.4 }),
    on(76.25, -21.75, 0.05),
    wall(76.25, -24, 0.05), // the chamber's west wall from the fourth tread down
    wall(76.25, -18, 0.05), // the band wall's collider on the parapet side
    on(76.25, -21.75, 0.05),
    on(75.25, -21.75, -0.95),
    on(72.75, -21.75, -2.45),
    wall(72.75, -25, -2.45), // L2's west wall
    on(72.75, -19.5, -2.45),
    wall(72.75, -16.5, -2.45), // L2's wall toward A
    on(72.75, -19.5, -2.45),
    on(76.75, -19.5, -4.95),
    wall(76.75, -22.5, -4.95), // from B into the wall on C's side
    wall(76.75, -16.5, -4.95), // and on A's side
    on(76.75, -19.5, -4.95),
    on(79.25, -19.5, -7.45),
    on(80.5, -19.5, -7.95),
    on(80.5, -17.25, -7.95),
    wall(80.5, -14.5, -7.95), // L1's outer wall
    on(80.5, -17.25, -7.95),
    on(76.25, -17.25, -10.95),
    wall(76.25, -14.5, -10.95), // A's outer wall
    wall(76.25, -20, -10.95), // the wall between A and B
    on(76.25, -17.25, -10.95),
    on(74.25, -17.25, -12.95),
    p(70, -17.25, C, { reach: 0.4 }),
    p(70, -20.5, C, { reach: 0.4 }),
    p(73, -20.5, C, { ...blocked, minY: 0 }), // L2's end wall from the lane
    p(70, -20.5, C, { reach: 0.4 }),
    p(70, -24, C, { reach: 0.4 }),
    p(75, -24, C, { reach: 0.4 }),
    p(75, -33, C),
    p(79, -33, C, { ...blocked, minY: 0 }), // the passage's Cheil-side wall
    p(75, -33, C),
    p(75, -38, C),
    on(75, -41.25, -11.91),
    on(75, -44.5, -11.41),
    on(75, -48, -11.41),
    wall(79, -48, -11.41), // the pool's kerb
    on(75, -44.5, -11.41),
  ],

  // From the court through the bay beside Shaar HaNitzotz onto the tower's top landing,
  // down both flights, out of the wicket onto the Cheil and through the Soreg opening
  // opposite the gate; back the same way; then the gate's own closed doors from the court.
  r6_nitzotz_wicket: [
    p(61, -85.5, K),
    p(70.5, -85.5, K, { reach: 0.4 }), // the bay through the wall (z -87 .. -84)
    on(75, -85.5, 2.5), // the tower's top landing
    on(75, -88.25, 1.5), // the upper flight down
    on(75, -92.25, -2.5),
    on(75, -96.5, -5.5), // the turn landing
    on(78.5, -96.5, -5.5),
    on(78.5, -92.25, -8), // the lower flight down
    on(78.5, -88.25, -12),
    p(78.5, -85.5, C, { reach: 0.4 }), // the entry strip inside the wicket
    p(78.5, -81.5, C, { reach: 0.4 }), // out through the wicket onto the Cheil
    p(82.4, -80.5, C, { reach: 0.4 }), // to the lane along the Soreg (Lishkas Palhedrin, round 7, fills x 73.5 .. 81 at z -79 .. -63)
    p(82.4, -78, C, { reach: 0.4 }),
    p(90, -78, HB), // out opposite Shaar HaNitzotz
    p(82.4, -78, C, { reach: 0.4 }),
    p(82.4, -80.5, C, { reach: 0.4 }),
    p(78.5, -81.5, C, { reach: 0.4 }),
    p(78.5, -85.5, C, { reach: 0.4 }),
    on(78.5, -88.25, -12),
    on(78.5, -92.25, -8),
    on(78.5, -96.5, -5.5),
    on(75, -96.5, -5.5),
    on(75, -92.25, -2.5),
    on(75, -88.25, 1.5),
    on(75, -85.5, 2.5),
    p(70.5, -85.5, K, { reach: 0.4 }),
    p(61, -85.5, K),
    p(61, -78, K),
    p(69, -78, K, { reach: 0.6 }),
    p(73, -78, K, blocked), // the gate's own doors stay closed
  ],

  // The Cheil's north strip past the round-6 structures: the lane along the Soreg beside
  // the passage's vault, the bath-house and the Nitzotz tower, with the Soreg openings
  // opposite Shaar HaKorban and Shaar HaNashim.
  r6_cheil_north_lane: [
    p(78.5, -30, C),
    p(82.4, -30, C, { reach: 0.4 }),
    p(82.4, -56, C, { reach: 0.4 }), // past the bath-house (x to 81.5, z -52 .. -42)
    p(78.5, -58, C), // opposite Shaar HaKorban
    p(90, -58, HB),
    p(78.5, -58, C),
    p(82.4, -60, C, { reach: 0.4 }),
    p(82.4, -104, C, { reach: 0.4 }), // past Lishkas Palhedrin (round 7: x to 81, z -79 .. -63) and the tower (x to 81, z -99 .. -83)
    p(78.5, -106, C),
    p(82.4, -104, C, { reach: 0.4 }),
    p(82.4, -60, C, { reach: 0.4 }),
    p(78.5, -58, C),
    p(82.4, -56, C, { reach: 0.4 }),
    p(82.4, -38, C, { reach: 0.4 }),
    p(78.5, -36, C), // opposite Shaar HaNashim, beside the passage's vault (x to 77)
    p(90, -36, HB),
  ],
};
