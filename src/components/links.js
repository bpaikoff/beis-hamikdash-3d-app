/** Outgoing links used by the hotspot card. Kept free of React so they can be unit tested. */

const SEFARIA = 'https://www.sefaria.org/';
/** tzadek.ai origin; `VITE_TZADEK_BASE` points a dev build at a staging server. */
export const TZADEK_BASE = String(import.meta.env?.VITE_TZADEK_BASE || 'https://tzadek.ai').replace(/\/+$/, '');
const TZADEK = `${TZADEK_BASE}/app`;

/**
 * "Mishnah Middot 3:1" -> "https://www.sefaria.org/Mishnah_Middot_3:1"
 * Sefaria refs use underscores for spaces; colons, commas and dots are left as they are.
 */
export function sefariaUrl(ref) {
  return SEFARIA + String(ref).trim().replace(/\s+/g, '_');
}

/** A visitor question sent to the tzadek.ai poskim, prefilled in the question box. */
export function tzadekUrl(question) {
  return `${TZADEK}?q=${encodeURIComponent(question)}`;
}

/**
 * Link for a source returned by tzadek.ai: its own `url` when present, else the Sefaria
 * page for `ref`.
 */
export function sourceUrl(source) {
  if (!source) return null;
  if (typeof source === 'string') return sefariaUrl(source);
  if (source.url && /^https?:\/\//.test(source.url)) return source.url;
  return source.ref ? sefariaUrl(source.ref) : null;
}
