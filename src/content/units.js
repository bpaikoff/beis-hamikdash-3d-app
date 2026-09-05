/**
 * World units and the content coordinate frame.
 *
 * Content (src/content/temple.json) is authored in amos in the "azarah" frame:
 *   origin  = the threshold of the Nicanor Gate, at the Azarah (Ezras Yisrael) floor
 *   +x      = north, -x = south
 *   -z      = west (toward the Heichal), +z = east (toward the Ezras Nashim)
 *   +y      = up
 * The scene is in metres. One amah is 0.5 m here (the usual 48-60 cm range; 0.5 keeps
 * the numbers readable), and the Azarah floor sits at AZARAH_FLOOR_Y metres because the
 * existing builders were written with Har HaBayis at 1.8 m and the courts stepping up.
 */
export const AMAH = 0.5;
export const AZARAH_FLOOR_Y = 6.8;
export const NICANOR_Z = 8; // where the Nicanor threshold sits in the legacy builders

export const amosToMetres = (a) => a * AMAH;
export const metresToAmos = (m) => m / AMAH;

/** Content position {x,y,z} in amos -> [x, y, z] in scene metres. */
export function toWorld(p) {
  return [p.x * AMAH, AZARAH_FLOOR_Y + p.y * AMAH, NICANOR_Z + p.z * AMAH];
}

/** Scene metres -> content amos (used by the migration script and debug overlay). */
export function toAmos(x, y, z) {
  return { x: x / AMAH, y: (y - AZARAH_FLOOR_Y) / AMAH, z: (z - NICANOR_Z) / AMAH };
}

/** "32 amos (16 m)" */
export function formatLength(value, unit = 'amah', lang = 'en') {
  if (unit !== 'amah') return `${value} ${unit}`;
  const m = amosToMetres(value);
  const mStr = Number.isInteger(m) ? `${m}` : m.toFixed(1);
  return lang === 'he' ? `${value} אמות (${mStr} מ׳)` : `${value} amos (${mStr} m)`;
}
