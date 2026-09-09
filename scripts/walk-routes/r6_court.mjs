import { AMAH, NICANOR_Z } from '../../src/content/units.js';

const at = (id, o = {}) => ({ id, ...o });
/** A point given in amos in the azarah frame (+x north, -z west), with the expected floor level. */
const p = (x, z, level, o = {}) => ({ x: x * AMAH, z: NICANOR_Z + z * AMAH, level, ...o });
/** Offsets in amos for `at`. */
const amos = (dx, dz) => ({ dx: dx * AMAH, dz: dz * AMAH });

const Y = 'azaras_yisrael';
const D = 'duchan';
const K = 'azaras_kohanim';
const U = 'ulam';
/** A mass or a wall: the leg must end against it (result "stuck"), never through it. */
const blocked = { expect: 'blocked', reach: 0.3 };
/** A tread or rovad of the Ulam flight, `up` metres over the court (walk.mjs: feet >= level + minY - 0.5 m). */
const tread = (x, z, up) => p(x, z, K, { reach: 0.4, minY: up });

/**
 * Round 6 (September 2026) court walker: what a visitor does among the round's
 * characters and the moved muchni.
 *
 * - The two Levites pace the Duchan platform (CharacterSystem.templePlacements: the
 *   strip 0.35 m west of the duchan's z, x -40 .. 40 amos, the southern one starting at
 *   x -36 and the northern at x 24); the platform is a one-amah step up from the Ezras
 *   Yisrael (level `duchan`, y 1) with three half-amah steps to the Kohanim court.
 * - The flock waits at the rings (x 24 .. 48, z -26 .. -50): sheep west of the centre,
 *   the goats at x 38 .. 46, z -33 .. -27, the bull at (28, -28). Figures are not
 *   colliders, so the loop and the crossing walk straight through them.
 * - The muchni post stands at x -26.05 amos on the laver's south side (its solid the
 *   post's own 0.12 m), so (-27, -65) is walkable and the post still stops a walker.
 * - The Ulam flight (z -54 .. -76): four steps, a rovad of 3, four, a rovad of 3, four
 *   and the top rovad of 4 at the Ulam level; 0.25 m a step, so 1.0 m up at z -60 and
 *   2.0 m at z -66.
 */
export const routes = {
  // From the Nicanor gateway across the Ezras Yisrael, up onto the Duchan platform,
  // along it to where each Levite walks, up its three steps to the Kohanim court at
  // both ends, and back down to the gate.
  r6_court_nicanor_duchan_levites: [
    at('nicanor_gate', { ...amos(0, 3), level: Y }),
    p(0, -5, Y),
    p(0, -11.8, D, { reach: 0.4 }),
    p(-36, -11.8, D, { reach: 0.4 }), // the southern Levite's start
    p(-36, -16, K), // up the three steps
    p(-36, -11.8, D, { reach: 0.4 }),
    p(24, -11.8, D, { reach: 0.4 }), // the northern Levite's start
    p(24, -16, K),
    p(24, -5, Y), // down the steps and the platform
    p(0, -5, Y),
    at('nicanor_gate', { ...amos(0, 3), level: Y }),
  ],

  // Round the flock at the rings: east of it beside the Duchan steps, the north side
  // under Beis HaMoked's corner, the west side before the Ulam's north wing, the south
  // side along the altar's lane, then straight through the goats and the bull.
  r6_court_flock_at_the_rings: [
    p(36, -20, K),
    p(50, -24, K),
    p(50, -52, K),
    p(36, -54, K),
    p(22, -52, K),
    p(22, -26, K),
    p(36, -20, K),
    p(42, -30, K), // among the goats
    p(28, -28, K), // the bull
    p(30, -44, K), // among the sheep
    p(36, -20, K),
  ],

  // From the court south of the laver past the muchni post (into it once), round the
  // laver's south and east sides, along the lane to the flight's south-east corner, up
  // the twelve steps on the axis to the top rovad at the Ulam level, and back down.
  r6_court_kiyor_muchni_to_ulam: [
    p(-30, -58, K),
    p(-30, -65, K, { reach: 0.4 }),
    p(-27, -65, K, { reach: 0.3 }), // a body's width south of the post
    p(-26.05, -65, K, blocked), // into the post
    p(-27, -65, K, { reach: 0.3 }),
    p(-27, -70, K),
    p(-21.2, -70, K, { reach: 0.3 }),
    p(-21.2, -58, K, { reach: 0.3 }), // the lane between the laver and the flight's south end
    p(-22, -54.2, K, { reach: 0.4 }), // the court at the flight's corner
    p(0, -54.4, K, { reach: 0.4 }), // the first tread, on the axis
    tread(0, -60, 0.9), // the first rovad
    tread(0, -66, 1.9), // the second rovad
    p(0, -74, U), // the top rovad, against the Ulam wall
    tread(0, -66, 1.9),
    tread(0, -60, 0.9),
    p(0, -54.4, K, { reach: 0.4 }),
    p(-22, -54.2, K, { reach: 0.4 }),
    p(-21.2, -58, K, { reach: 0.3 }),
    p(-30, -58, K),
  ],

  // From the `?at=ulam_facade` standing point north-east of the flight (29.1, -48.2)
  // down to its north end, up to the top rovad, along it to the south end, and down to
  // the court beside the laver.
  r6_court_ulam_facade_to_steps: [
    p(29.1, -48.2, K),
    p(24, -52, K),
    p(15, -54.4, K, { reach: 0.4 }),
    tread(15, -60, 0.9),
    p(15, -74, U),
    p(0, -74, U),
    p(-15, -74, U),
    tread(-15, -60, 0.9),
    p(-15, -54.4, K, { reach: 0.4 }),
    p(-22, -54.2, K, { reach: 0.4 }),
    p(-22, -48, K),
  ],
};
