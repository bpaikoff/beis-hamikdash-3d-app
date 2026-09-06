import { AMAH, NICANOR_Z } from '../../src/content/units.js';

const at = (id, o = {}) => ({ id, ...o });
/** A point given in amos in the azarah frame (+x north, -z west), with the expected floor level. */
const p = (x, z, level, o = {}) => ({ x: x * AMAH, z: NICANOR_Z + z * AMAH, level, ...o });

const K = 'azaras_kohanim';
/** A wall, a parapet or a mass: the leg must end against it (result "stuck"), never over or through it. */
const blocked = { expect: 'blocked', reach: 0.3 };
/** Hug point: reached within 0.3 m. */
const h = (x, z, level, o = {}) => p(x, z, level, { reach: 0.3, ...o });
/** A stand on a low mass `up` metres over the level (walk.mjs: feet >= level + minY - 0.5 m). */
const on = (x, z, up) => p(x, z, K, { reach: 0.3, minY: up });

/**
 * Round 4 (September 2026) furniture round: the furniture a visitor bumps into.
 *
 * - Lishkas HaGazis' benches are solid tiers now (AzaraBuilder.buildLishkasHagazis):
 *   the top tier (0.8 m) against the south wall at x -76.5 .. -75.25, then 0.55 m at
 *   x -75.25 .. -74, then 0.3 m at x -74 .. -72.75, all z -115 .. -99 (each lower tier
 *   an amah shorter at both ends). From the well parapet (x -71, z -97.5 .. -92) west
 *   along the top tier's x the visitor is stopped at its east end, at floor level; along
 *   the low tier's x they step up, and up the tiers to the top, and drop off its end.
 * - The kiyor's cistern rim (radius 1.275 m round x -24, z -65, 0.12 m high) is a
 *   walkable step: the visitor stands on it against the laver's body (its solid stops
 *   the centre 1.1 m out) on the north and the south, and steps off again.
 */
export const routes = {
  r4_gazis_benches: [
    p(-45, -103, K),
    p(-56, -103, K),
    at('lishkas_hagazis', { level: K }),
    p(-72, -100, K),
    h(-72.5, -96, K), // beside the well parapet's south face (x -71)
    h(-75.9, -96, K), // in line with the top tier, east of its end (z -99)
    p(-75.9, -108, K, { ...blocked, minY: 0 }), // west into the top tier: 0.8 m, over STEP_HEIGHT
    h(-75.9, -96, K),
    h(-73.4, -96, K),
    on(-73.4, -108, 0.3), // west onto the low tier (its end at z -101)
    on(-75.9, -108, 0.8), // up the middle tier to the top
    p(-75.9, -94, K, { reach: 0.4 }), // east along the top tier and off its end (z -99), 0.8 m down to the floor
    p(-72, -100, K),
    at('lishkas_hagazis', { level: K }),
    p(-56, -103, K),
    p(-45, -103, K),
  ],

  r4_kiyor_rim: [
    p(-30, -58, K),
    h(-21.2, -58, K),
    h(-21.2, -65, K), // the lane between the body and the Ulam steps' south end (the rim's edge is at x -21.45)
    on(-22.2, -65, 0.12), // onto the rim from the north, up against the body (the centre stops at x -21.8)
    h(-21.2, -65, K), // and off
    h(-21.2, -70, K),
    h(-24, -70, K),
    on(-24, -66.8, 0.12), // onto the rim from the south (the body stops the centre at z -67.2; the rim's edge is at -67.55)
    h(-24, -70, K), // and off
    h(-21.2, -70, K),
    h(-21.2, -58, K),
    p(-30, -58, K),
  ],
};
