/**
 * Time of day: the sun's place in the sky and the colours that follow from it.
 *
 * Pure maths, no three.js, so the store and the tests can import it. Directions are in
 * the scene frame: +y up, east is +z, west is -z, south is -x and north is +x (the camera
 * spawns on Har HaBayis facing west, toward -z). Bearings are compass degrees from north.
 *
 * `skyRadiance` is a CPU port of three's examples/jsm/objects/Sky.js (the Preetham model as
 * Simon Wallner and Martin Upitis implemented it) so the fog and the hemisphere light can be
 * read off the same sky the dome draws.
 */

export const TIMES_OF_DAY = ['dawn', 'morning', 'afternoon', 'dusk'];
export const DEFAULT_TIME = 'morning';

/**
 * The sun for each time, over Yerushalayim (31.8 N) around the equinox: it rises a little
 * south of east, culminates in the south and sets a little north of west in summer.
 * turbidity / rayleigh / mie tune the dome (Sky.js uniforms): a clear morning is thin
 * and blue; dawn and dusk carry more haze so the horizon reddens. `exposure` scales the
 * dome's radiance before tone mapping (Preetham with a high sun is near white under the
 * scene's ACES exposure of 0.85; 0.18 leaves a mid blue zenith and a pale horizon) and
 * `saturation` pulls the model's grey-blue day sky toward the deep blue of a dry morning.
 */
export const SUN = {
  dawn: { elevation: 5, bearing: 98, turbidity: 2.5, rayleigh: 2, mieCoefficient: 0.005, mieDirectionalG: 0.82, exposure: 0.3, saturation: 1.25 },
  morning: { elevation: 38, bearing: 125, turbidity: 2, rayleigh: 2.5, mieCoefficient: 0.004, mieDirectionalG: 0.8, exposure: 0.18, saturation: 1.5 },
  afternoon: { elevation: 42, bearing: 232, turbidity: 2.5, rayleigh: 2.5, mieCoefficient: 0.005, mieDirectionalG: 0.8, exposure: 0.18, saturation: 1.5 },
  dusk: { elevation: 4, bearing: 276, turbidity: 2.5, rayleigh: 2, mieCoefficient: 0.006, mieDirectionalG: 0.84, exposure: 0.3, saturation: 1.25 },
};

/** Scale a linear colour's chroma about its luminance (1 = unchanged), as the dome shader does. */
export function saturate([r, g, b], s = 1) {
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [r, g, b].map((c) => Math.max(0, lum + (c - lum) * s));
}

/** `?time=dusk` -> 'dusk'; anything else -> the default. */
export function parseTimeOfDay(search = '') {
  const t = new URLSearchParams(search).get('time');
  return TIMES_OF_DAY.includes(t) ? t : DEFAULT_TIME;
}

const DEG = Math.PI / 180;

/**
 * Unit vector from the scene origin toward the sun for `time` (or an `{elevation, bearing}`).
 * @returns {{x: number, y: number, z: number}}
 */
export function sunDirection(time) {
  const s = typeof time === 'string' ? SUN[time] ?? SUN[DEFAULT_TIME] : time;
  const el = s.elevation * DEG;
  const br = s.bearing * DEG;
  return { x: Math.cos(br) * Math.cos(el), y: Math.sin(el), z: Math.sin(br) * Math.cos(el) };
}

// --- Sky.js port ------------------------------------------------------------------------

const TOTAL_RAYLEIGH = [5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5];
const MIE_CONST = [1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14];
const CUTOFF_ANGLE = 1.6110731556870734; // pi / 1.95
const STEEPNESS = 1.5;
const EE = 1000;
const RAYLEIGH_ZENITH_LENGTH = 8.4e3;
const MIE_ZENITH_LENGTH = 1.25e3;
const THREE_OVER_SIXTEENPI = 0.05968310365946075;
const ONE_OVER_FOURPI = 0.07957747154594767;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const norm = (v) => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};

function sunIntensity(zenithAngleCos) {
  const c = clamp(zenithAngleCos, -1, 1);
  return EE * Math.max(0, 1 - Math.exp(-((CUTOFF_ANGLE - Math.acos(c)) / STEEPNESS)));
}

/** Per-sun constants the vertex shader computes (betaR, betaM, sunE, sunfade). */
export function skyConstants(sunDir, { turbidity = 2, rayleigh = 1, mieCoefficient = 0.005 } = {}) {
  const sun = norm(sunDir);
  const sunE = sunIntensity(sun.y);
  const sunfade = 1 - clamp(1 - Math.exp(sunDir.y / 450000), 0, 1);
  const rayleighCoefficient = rayleigh - 1 * (1 - sunfade);
  const betaR = TOTAL_RAYLEIGH.map((r) => r * rayleighCoefficient);
  const c = 0.2 * turbidity * 10e-18;
  const betaM = MIE_CONST.map((m) => 0.434 * c * m * mieCoefficient);
  return { sun, sunE, sunfade, betaR, betaM };
}

/**
 * Linear (pre-tone-mapping) radiance the dome shows in unit direction `dir`, without the
 * solar disc. Same numbers as Sky.js's fragment shader before tonemapping_fragment.
 * @returns {number[]} [r, g, b]
 */
export function skyRadiance(dir, sunDir, params = {}) {
  const { sun, sunE, sunfade, betaR, betaM } = skyConstants(sunDir, params);
  const g = params.mieDirectionalG ?? 0.8;
  const d = norm(dir);
  const zenithAngle = Math.acos(Math.max(0, d.y));
  const inverse = 1 / (Math.cos(zenithAngle) + 0.15 * Math.pow(93.885 - (zenithAngle * 180) / Math.PI, -1.253));
  const sR = RAYLEIGH_ZENITH_LENGTH * inverse;
  const sM = MIE_ZENITH_LENGTH * inverse;
  const cosTheta = d.x * sun.x + d.y * sun.y + d.z * sun.z;
  const rPhase = THREE_OVER_SIXTEENPI * (1 + Math.pow(cosTheta * 0.5 + 0.5, 2));
  const g2 = g * g;
  const mPhase = ONE_OVER_FOURPI * ((1 - g2) / Math.pow(1 - 2 * g * cosTheta + g2, 1.5));
  const horizonMix = clamp(Math.pow(1 - sun.y, 5), 0, 1);
  const gamma = 1 / (1.2 + 1.2 * sunfade);
  const out = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const fex = Math.exp(-(betaR[i] * sR + betaM[i] * sM));
    const scatter = (sunE * (betaR[i] * rPhase + betaM[i] * mPhase)) / (betaR[i] + betaM[i]);
    let lin = Math.pow(Math.max(0, scatter * (1 - fex)), 1.5);
    lin *= 1 + (Math.sqrt(Math.max(0, scatter * fex)) - 1) * horizonMix;
    const l0 = 0.1 * fex;
    const tex = (lin + l0) * 0.04 + [0, 0.0003, 0.00075][i];
    out[i] = Math.pow(Math.max(0, tex), gamma);
  }
  return out;
}

/** Atmospheric transmittance toward the sun (the colour sunlight arrives with), each channel 0..1. */
export function sunTransmittance(sunDir, params = {}) {
  const { sun, betaR, betaM } = skyConstants(sunDir, params);
  const zenithAngle = Math.acos(Math.max(0, sun.y));
  const inverse = 1 / (Math.cos(zenithAngle) + 0.15 * Math.pow(93.885 - (zenithAngle * 180) / Math.PI, -1.253));
  return betaR.map((r, i) => Math.exp(-(r * RAYLEIGH_ZENITH_LENGTH * inverse + betaM[i] * MIE_ZENITH_LENGTH * inverse)));
}

/** Mean sky radiance around the compass at `elevation` degrees (linear rgb). */
export function skyBand(sunDir, params = {}, elevation = 2, samples = 12) {
  const acc = [0, 0, 0];
  const el = elevation * DEG;
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    const c = skyRadiance({ x: Math.cos(a) * Math.cos(el), y: Math.sin(el), z: Math.sin(a) * Math.cos(el) }, sunDir, params);
    for (let k = 0; k < 3; k++) acc[k] += c[k] / samples;
  }
  return acc;
}

/** three's ACESFilmicToneMapping (linear in, linear display value out, 0..1). */
export function acesFilmic([r, g, b], exposure = 1) {
  const e = exposure / 0.6;
  r *= e;
  g *= e;
  b *= e;
  const x = 0.59719 * r + 0.35458 * g + 0.04823 * b;
  const y = 0.076 * r + 0.90834 * g + 0.01566 * b;
  const z = 0.0284 * r + 0.13383 * g + 0.83777 * b;
  const fit = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
  const fx = fit(x);
  const fy = fit(y);
  const fz = fit(z);
  return [
    clamp(1.60475 * fx - 0.53108 * fy - 0.07367 * fz, 0, 1),
    clamp(-0.10208 * fx + 1.10813 * fy - 0.00605 * fz, 0, 1),
    clamp(-0.00327 * fx - 0.07276 * fy + 1.07602 * fz, 0, 1),
  ];
}

/**
 * Everything the scene needs for `time`: the sun direction, the sun light's colour and
 * intensity, the hemisphere sky colour, and the fog colour (a display value, since three
 * mixes fog in after tone mapping), plus the Sky.js uniforms.
 */
export function daylight(time, { exposure = 0.85, sunIntensity: full = 1.6 } = {}) {
  if (!SUN[time]) time = DEFAULT_TIME;
  const spec = SUN[time];
  const dir = sunDirection(spec);
  const tr = sunTransmittance(dir, spec);
  const trMax = Math.max(...tr, 1e-6);
  // Transmittance normalised so noon sunlight stays white; a soft power keeps dawn golden
  // rather than blood red.
  const sunColor = tr.map((t) => Math.pow(t / trMax, 0.6));
  const elevationFactor = clamp(dir.y / Math.sin(35 * DEG), 0.25, 1);
  const sky = skyBand(dir, spec, 45);
  const shade = (c) => saturate(c, spec.saturation ?? 1).map((v) => v * (spec.exposure ?? 1));
  const horizon = shade(skyBand(dir, spec, 1.5));
  const skyShaded = saturate(sky, spec.saturation ?? 1);
  const skyShadedMax = Math.max(...skyShaded, 1e-6);
  return {
    time,
    spec,
    direction: dir,
    sunColor,
    sunIntensity: full * elevationFactor,
    hemisphereColor: skyShaded.map((c) => c / skyShadedMax),
    hemisphereIntensity: 0.35 * (0.6 + 0.4 * elevationFactor),
    fogColor: acesFilmic(horizon, exposure),
  };
}
