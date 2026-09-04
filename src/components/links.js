/** Outgoing links used by the hotspot card. Kept free of React so they can be unit tested. */

const SEFARIA = 'https://www.sefaria.org/';
const TZADEK = 'https://tzadek.ai/app';

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
