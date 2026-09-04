import { describe, it, expect } from 'vitest';
import { sefariaUrl, tzadekUrl } from './links.js';
import { entries } from '../content/index.js';

describe('sefariaUrl', () => {
  it('replaces spaces with underscores and keeps the section reference', () => {
    expect(sefariaUrl('Mishnah Middot 3:1')).toBe('https://www.sefaria.org/Mishnah_Middot_3:1');
    expect(sefariaUrl('Mishneh Torah, The Chosen Temple 2:5')).toBe(
      'https://www.sefaria.org/Mishneh_Torah,_The_Chosen_Temple_2:5'
    );
    expect(sefariaUrl(' Zevachim 54a ')).toBe('https://www.sefaria.org/Zevachim_54a');
  });

  it('produces a URL without whitespace for every content source and dimension', () => {
    for (const e of entries) {
      for (const ref of e.sources ?? []) expect(sefariaUrl(ref)).not.toMatch(/\s/);
      for (const d of e.dimensions ?? []) if (d.source) expect(sefariaUrl(d.source)).not.toMatch(/\s/);
    }
  });
});

describe('tzadekUrl', () => {
  it('encodes Hebrew and punctuation into ?q=', () => {
    const url = tzadekUrl('למה כבש ולא מדרגות?');
    expect(url.startsWith('https://tzadek.ai/app?q=')).toBe(true);
    expect(new URL(url).searchParams.get('q')).toBe('למה כבש ולא מדרגות?');
  });
});
