import * as THREE from 'three';
import { mulberry32 } from '../random.js';

/**
 * A low bedrock outcrop for the Even HaShtiya: one indexed mesh whose top is a polar
 * grid (a centre vertex, `rings` rings of `spokes` vertices) over a skirt that drops
 * below the floor, so the stone has an irregular outline, a rounded edge and a noised
 * top instead of a box. Local origin at the base centre, +y up, metres.
 *
 * The centre vertex sits at exactly `height` and the surface noise is masked to zero
 * there, so a downward raycast at the stone's centre reads the content height
 * (HeichalKeilim.test.js asserts it). Every other number is a fraction of `radius` or
 * `height`, all seeded, so the same seed builds the same stone on every load.
 *
 * @param {{radius: number, height: number, seed?: number, spokes?: number, rings?: number,
 *   outline?: number, relief?: number, skirt?: number, tileMetres?: number}} p
 *   radius   mean radius of the top (m)      height  top at the centre (m)
 *   outline  radial wobble of the outline as a fraction of radius (0.16)
 *   relief   peak surface noise as a fraction of height (0.55)
 *   skirt    how far the base drops below y = 0 (m) to hide the joint with the floor
 *   tileMetres  planar UV tile size (m)
 * @returns {THREE.BufferGeometry} position, normal, uv; indexed
 */
export function outcropGeometry({
  radius,
  height,
  seed = 1,
  spokes = 64,
  rings = 8,
  outline = 0.16,
  relief = 0.55,
  skirt = 0.03,
  tileMetres = 1,
}) {
  const rand = mulberry32(seed);
  const TAU = Math.PI * 2;
  // The outline: a few low harmonics with seeded phases (periodic in the angle, so no seam).
  const harmonics = [2, 3, 5, 7].map((m, i) => ({ m, a: outline * [0.6, 0.45, 0.25, 0.15][i], p: rand() * TAU }));
  const rim = (theta) => {
    let s = 1;
    for (const h of harmonics) s += h.a * Math.sin(h.m * theta + h.p);
    return radius * s;
  };
  const noise = valueNoise2(rand, 8);
  // Relief in metres at (x, z), masked away at the centre (the flat spot the machtah stood on).
  const bump = (x, z, t) => {
    const mask = smooth(0.1, 0.45, t) * (1 - 0.5 * smooth(0.85, 1, t));
    const n = noise(x / radius * 2.2, z / radius * 2.2) * 0.7 + noise(x / radius * 5.1 + 3, z / radius * 5.1 + 7) * 0.3;
    return (n * 2 - 1) * relief * height * mask;
  };
  // Top profile: a low dome, flat at the centre, then a quarter-ellipse down to 0.35 h at the rim.
  const profile = (t) => (t < 0.3 ? 1 : 0.35 + 0.65 * Math.sqrt(Math.max(0, 1 - ((t - 0.3) / 0.7) ** 2)));

  const pos = [0, height, 0];
  const uv = [0.5, 0.5];
  const ringDefs = [];
  for (let i = 1; i <= rings; i++) ringDefs.push({ t: i / rings, rScale: i / rings, y: null });
  ringDefs.push({ t: 1, rScale: 1.02, y: 0.18 * height, noiseScale: 0.5 });
  ringDefs.push({ t: 1, rScale: 1.03, y: 0, noiseScale: 0 });
  ringDefs.push({ t: 1, rScale: 1.03, y: -skirt, noiseScale: 0 });
  for (const d of ringDefs) {
    for (let j = 0; j < spokes; j++) {
      const theta = (j / spokes) * TAU;
      const r = rim(theta) * d.rScale;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      let y;
      if (d.y === null) y = height * profile(d.t) + bump(x, z, d.t);
      else y = d.y + (d.noiseScale ? bump(x, z, 1) * d.noiseScale : 0);
      pos.push(x, y, z);
      uv.push(x / tileMetres + 0.5, z / tileMetres + 0.5);
    }
  }
  const index = [];
  const at = (ring, j) => 1 + ring * spokes + (j % spokes);
  for (let j = 0; j < spokes; j++) index.push(0, at(0, j + 1), at(0, j));
  for (let i = 0; i < ringDefs.length - 1; i++) {
    for (let j = 0; j < spokes; j++) {
      index.push(at(i, j), at(i + 1, j + 1), at(i + 1, j));
      index.push(at(i, j), at(i, j + 1), at(i + 1, j + 1));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/** smoothstep */
function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Seeded 2-D value noise on a `period` x `period` lattice (wraps, so the same lattice
 * serves a whole stone), bicubic-smoothed, in [0, 1].
 */
function valueNoise2(rand, period) {
  const lattice = new Float32Array(period * period);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
  const L = (x, y) => lattice[(((y % period) + period) % period) * period + (((x % period) + period) % period)];
  return (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = smooth(0, 1, x - x0), fy = smooth(0, 1, y - y0);
    const a = L(x0, y0) + (L(x0 + 1, y0) - L(x0, y0)) * fx;
    const b = L(x0, y0 + 1) + (L(x0 + 1, y0 + 1) - L(x0, y0 + 1)) * fx;
    return a + (b - a) * fy;
  };
}
