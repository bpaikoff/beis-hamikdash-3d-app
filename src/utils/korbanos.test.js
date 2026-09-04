import { describe, it, expect } from 'vitest';
import { HDate, months } from '@hebcal/core';
import { HebrewCalendar } from './HebrewCalendar.js';
import { Korbanos, KORBAN_TYPES } from './Korbanos.js';

const { NISAN, SIVAN, TISHREI, CHESHVAN, KISLEV, ADAR_I } = months;
const VALID_TYPES = Object.values(KORBAN_TYPES);

const daily = (d, m, y) => Korbanos.getDaily(HebrewCalendar.getDate(new HDate(d, m, y)));
const names = (list) => list.map((k) => k.en);

function expectWellFormed(list) {
  expect(list.length).toBeGreaterThanOrEqual(5);
  for (const k of list) {
    expect(k).toEqual(expect.objectContaining({ name: expect.any(String), en: expect.any(String), desc: expect.any(String), type: expect.any(String), source: expect.any(String) }));
    expect(VALID_TYPES).toContain(k.type);
    expect(k.source).toMatch(/^(Numbers|Leviticus|Exodus|Mishnah) /);
  }
  expect(list[0].en).toBe('Morning Tamid');
  expect(names(list).slice(1, 3)).toEqual(['Morning Ketores', "Chavitin of the Kohen Gadol"]);
  expect(Array.isArray(list.notes)).toBe(true);
}

/** The afternoon Tamid must be after every musaf; only the ketores (and Korban Pesach) may follow it. */
function expectAfternoonTamidLast(list, allowedAfter = ['Afternoon Ketores']) {
  const idx = list.findIndex((k) => k.en === 'Afternoon Tamid');
  expect(idx).toBeGreaterThan(-1);
  expect(names(list).slice(idx + 1)).toEqual(allowedAfter);
  for (const k of list.slice(0, idx)) expect(k.en).not.toBe('Afternoon Tamid');
}

describe('Korbanos.getDaily', () => {
  it('a plain weekday: exactly the five daily items, Tamid first and last', () => {
    const list = daily(4, CHESHVAN, 5787);
    expectWellFormed(list);
    expect(names(list)).toEqual(['Morning Tamid', 'Morning Ketores', "Chavitin of the Kohen Gadol", 'Afternoon Tamid', 'Afternoon Ketores']);
    expect(list.length).toBe(5);
    expect(list[0].type).toBe('תמיד');
    expect(list.at(-2).type).toBe('תמיד');
    expectAfternoonTamidLast(list);
    expect(list.notes).toEqual([]);
  });

  it('a plain Shabbos adds the Shabbos musaf and Lechem HaPanim', () => {
    const list = daily(6, CHESHVAN, 5787);
    expectWellFormed(list);
    expect(list.length).toBe(7);
    expect(names(list)).toContain('Shabbos Musaf');
    expect(list.find((k) => k.en === 'Shabbos Musaf').source).toBe('Numbers 28:9-10');
    expect(names(list)).toContain('Lechem HaPanim and the bowls of frankincense');
    expectAfternoonTamidLast(list);
  });

  it('1 Cheshvan 5787: Rosh Chodesh musaf with the se’ir chatas', () => {
    const list = daily(1, CHESHVAN, 5787);
    expectWellFormed(list);
    expect(list.length).toBe(6);
    const rc = list.find((k) => k.en === 'Rosh Chodesh Musaf');
    expect(rc.source).toBe('Numbers 28:11-15');
    expect(rc.desc).toMatch(/Two bulls, one ram and seven yearling lambs/);
    expect(rc.desc).toMatch(/one goat as a chatas/);
    expectAfternoonTamidLast(list);
  });

  it('1 Tishrei 5787 (Shabbos): Shabbos, Rosh Chodesh, then Rosh Hashanah musaf, with the two-day note', () => {
    const list = daily(1, TISHREI, 5787);
    expectWellFormed(list);
    expect(list.length).toBe(9);
    const n = names(list);
    expect(n.indexOf('Shabbos Musaf')).toBeLessThan(n.indexOf('Rosh Chodesh Musaf'));
    expect(n.indexOf('Rosh Chodesh Musaf')).toBeLessThan(n.indexOf('Rosh Hashanah Musaf'));
    expect(list.find((k) => k.en === 'Rosh Hashanah Musaf').source).toBe('Numbers 29:1-6');
    expect(list.notes.join(' ')).toMatch(/Second day of Rosh Hashanah/);
    expectAfternoonTamidLast(list);
  });

  it('2 Tishrei 5787 has no fixed Rosh Hashanah musaf in the Mikdash, only the note', () => {
    const list = daily(2, TISHREI, 5787);
    expect(list.length).toBe(5);
    expect(list.notes.join(' ')).toMatch(/Second day of Rosh Hashanah/);
  });

  it('10 Tishrei 5787 (Yom Kippur): musaf plus the Kohen Gadol’s service, in Rambam’s order', () => {
    const list = daily(10, TISHREI, 5787);
    expectWellFormed(list);
    expect(list.length).toBe(12);
    expect(names(list)).toEqual([
      'Morning Tamid',
      'Morning Ketores',
      "Chavitin of the Kohen Gadol",
      'Yom Kippur Musaf: bull and seven lambs',
      "Kohen Gadol's bull chatas",
      'Ketores in the Kodesh HaKodashim',
      'Goat for Hashem',
      'Goat sent to Azazel',
      "Kohen Gadol's ram and the people's ram",
      'Outer goat chatas of the Musaf',
      'Afternoon Tamid',
      'Afternoon Ketores',
    ]);
    expect(list.find((k) => k.en === 'Goat sent to Azazel').source).toMatch(/^Leviticus 16:10/);
    expect(list.find((k) => k.en === 'Outer goat chatas of the Musaf').source).toBe('Numbers 29:11');
    expect(list.filter((k) => k.type === 'קטורת').length).toBe(3);
    expectAfternoonTamidLast(list);
  });

  it('Sukkos: 17 Tishrei 5787 has 11 bulls, Nisuch HaMayim and the aravah/hallel notes', () => {
    const list = daily(17, TISHREI, 5787);
    expectWellFormed(list);
    expect(list.length).toBe(7);
    const musaf = list.find((k) => k.type === 'מוסף');
    expect(musaf.parim).toBe(11);
    expect(musaf.desc).toMatch(/^11 bulls, two rams and fourteen yearling lambs/);
    expect(musaf.source).toBe('Numbers 29:20-22');
    expect(names(list)).toContain('Nisuch HaMayim');
    expect(list.notes.join(' ')).toMatch(/Aravah/);
    expect(list.notes.join(' ')).toMatch(/Hallel/);
    expectAfternoonTamidLast(list);
    // 13 bulls on the first day, 7 on the seventh; 70 in total.
    const bulls = [];
    for (let d = 15; d <= 21; d++) bulls.push(daily(d, TISHREI, 5787).find((k) => k.type === 'מוסף' && k.parim).parim);
    expect(bulls).toEqual([13, 12, 11, 10, 9, 8, 7]);
    expect(bulls.reduce((a, b) => a + b, 0)).toBe(70);
  });

  it('22 Tishrei 5787 (Shabbos): Shemini Atzeres musaf, no Nisuch HaMayim', () => {
    const list = daily(22, TISHREI, 5787);
    expectWellFormed(list);
    expect(list.length).toBe(8);
    expect(list.find((k) => k.en === 'Shemini Atzeres Musaf').source).toBe('Numbers 29:35-38');
    expect(names(list)).not.toContain('Nisuch HaMayim');
    expect(names(list)).toContain('Shabbos Musaf');
    expectAfternoonTamidLast(list);
  });

  it('14 Nissan 5786: Korban Pesach after the afternoon Tamid and ketores', () => {
    const list = daily(14, NISAN, 5786);
    expectWellFormed(list);
    expect(list.length).toBe(6);
    expect(list.at(-1).en).toBe('Korban Pesach');
    expect(list.at(-1).mishnah).toBe('Mishnah Pesachim 5:1');
    expectAfternoonTamidLast(list, ['Afternoon Ketores', 'Korban Pesach']);
  });

  it('16 Nissan 5786: Pesach musaf and the Omer', () => {
    const list = daily(16, NISAN, 5786);
    expectWellFormed(list);
    expect(list.length).toBe(7);
    const n = names(list);
    expect(n.indexOf('Pesach Musaf')).toBeLessThan(n.indexOf('The Omer'));
    expect(list.find((k) => k.en === 'The Omer').source).toBe('Leviticus 23:10-13');
    expect(list.find((k) => k.en === 'Pesach Musaf').source).toBe('Numbers 28:19-24');
    expectAfternoonTamidLast(list);
    // The Omer is only on the 16th; 15 and 21 Nissan get the musaf alone; 22 Nissan is plain.
    expect(names(daily(15, NISAN, 5786))).not.toContain('The Omer');
    expect(names(daily(21, NISAN, 5786))).toContain('Pesach Musaf');
    expect(names(daily(22, NISAN, 5786))).not.toContain('Pesach Musaf');
  });

  it('6 Sivan 5786: Shavuos musaf and Shtei HaLechem with its two shelamim lambs', () => {
    const list = daily(6, SIVAN, 5786);
    expectWellFormed(list);
    expect(list.length).toBe(7);
    const shtei = list.find((k) => k.en.startsWith('Shtei HaLechem'));
    expect(shtei.desc).toMatch(/two yearling lambs as shelamim/);
    expect(shtei.source).toBe('Leviticus 23:17-20');
    expect(list.find((k) => k.en === 'Shavuos Musaf').source).toBe('Numbers 28:26-31');
    expect(names(daily(7, SIVAN, 5786))).not.toContain('Shavuos Musaf');
    expectAfternoonTamidLast(list);
  });

  it('Chanukah and Purim add no korbanos but carry a note', () => {
    const chanukah = daily(25, KISLEV, 5786);
    expect(chanukah.length).toBe(5);
    expect(chanukah.notes.join(' ')).toMatch(/Chanukah adds no korban/);
    expect(daily(2, months.TEVET, 5786).notes.join(' ')).toMatch(/Chanukah/);
    const purim = daily(14, ADAR_I, 5786);
    expect(purim.length).toBe(5);
    expect(purim.notes.join(' ')).toMatch(/Purim adds no korban/);
    expect(daily(15, ADAR_I, 5786).notes.join(' ')).toMatch(/15 Adar/);
    expect(daily(14, months.ADAR_II, 5787).notes.join(' ')).toMatch(/Purim/);
    expect(daily(14, ADAR_I, 5787).notes).toEqual([]);
  });

  it('Pesach Sheni (14 Iyar) carries a note but no communal korban', () => {
    const list = daily(14, months.IYYAR, 5786);
    expect(list.length).toBe(5);
    expect(list.notes.join(' ')).toMatch(/Pesach Sheni/);
  });
});
