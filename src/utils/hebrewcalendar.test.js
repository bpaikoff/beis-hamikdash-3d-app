import { describe, it, expect } from 'vitest';
import { HDate, months } from '@hebcal/core';
import { HebrewCalendar } from './HebrewCalendar.js';

const { NISAN, SIVAN, TISHREI, CHESHVAN, KISLEV, ADAR_I, ADAR_II } = months;

describe('HebrewCalendar.getDate from HDate fixtures', () => {
  it('1 Tishrei 5787 is Rosh Hashanah on Shabbos', () => {
    const d = HebrewCalendar.getDate(new HDate(1, TISHREI, 5787));
    expect(d).toMatchObject({ year: 5787, month: TISHREI, day: 1, isShabbos: true, isRoshChodesh: true });
    expect(d.monthName).toBe('תשרי');
    expect(d.dayName).toBe('שבת קודש');
    expect(d.formatted).toBe('א׳ תשרי תשפ״ז');
    expect(d.special).toBe('ראש השנה');
    expect(d.omerDay).toBeNull();
  });

  it('10 Tishrei 5787 is Yom Kippur', () => {
    const d = HebrewCalendar.getDate(new HDate(10, TISHREI, 5787));
    expect(d.special).toBe('יום כיפור');
    expect(d.dayName).toBe('יום שני');
    expect(d.isShabbos).toBe(false);
    expect(d.isRoshChodesh).toBe(false);
  });

  it('17 Tishrei 5787 is Chol HaMoed Sukkos', () => {
    const d = HebrewCalendar.getDate(new HDate(17, TISHREI, 5787));
    expect(d.special).toContain('סוכות');
    expect(d.special).toContain('חוה״מ');
    expect(d.formatted).toBe('י״ז תשרי תשפ״ז');
  });

  it('22 Tishrei 5787 is Shemini Atzeres (Israel: no separate Simchas Torah)', () => {
    const d = HebrewCalendar.getDate(new HDate(22, TISHREI, 5787));
    expect(d.special).toBe('שמיני עצרת');
    expect(d.isShabbos).toBe(true);
  });

  it('23 Tishrei 5787 is a plain day in Israel (no second-day yom tov)', () => {
    const d = HebrewCalendar.getDate(new HDate(23, TISHREI, 5787));
    expect(d.special).toBeNull();
  });

  it('14 Nissan 5786 is Erev Pesach, 16 Nissan is Chol HaMoed with omer day 1', () => {
    const erev = HebrewCalendar.getDate(new HDate(14, NISAN, 5786));
    expect(erev.special).toBe('ערב פסח');
    expect(erev.omerDay).toBeNull();
    const d16 = HebrewCalendar.getDate(new HDate(16, NISAN, 5786));
    expect(d16.special).toContain('פסח');
    expect(d16.omerDay).toBe(1);
    expect(d16.formatted).toBe('ט״ז ניסן תשפ״ו');
    expect(HebrewCalendar.getDate(new HDate(22, NISAN, 5786)).special).toBeNull();
  });

  it('6 Sivan 5786 is Shavuos with omer complete the day before', () => {
    const d = HebrewCalendar.getDate(new HDate(6, SIVAN, 5786));
    expect(d.special).toBe('שבועות');
    expect(d.omerDay).toBeNull();
    expect(HebrewCalendar.getDate(new HDate(5, SIVAN, 5786)).omerDay).toBe(49);
    expect(HebrewCalendar.getDate(new HDate(7, SIVAN, 5786)).special).toBeNull();
  });

  it('1 Cheshvan 5787 is Rosh Chodesh with no special', () => {
    const d = HebrewCalendar.getDate(new HDate(1, CHESHVAN, 5787));
    expect(d.isRoshChodesh).toBe(true);
    expect(d.special).toBeNull();
    expect(d.monthName).toBe('חשון');
    expect(d.holidays).toEqual(['ראש חודש חשון']);
  });

  it('a plain Shabbos and a plain weekday', () => {
    const shabbos = HebrewCalendar.getDate(new HDate(6, CHESHVAN, 5787));
    expect(shabbos.isShabbos).toBe(true);
    expect(shabbos.dayName).toBe('שבת קודש');
    expect(shabbos.special).toBeNull();
    const weekday = HebrewCalendar.getDate(new HDate(4, CHESHVAN, 5787));
    expect(weekday.isShabbos).toBe(false);
    expect(weekday.dayName).toBe('יום חמישי');
    expect(weekday.special).toBeNull();
    expect(weekday.flags).toBe(0);
  });

  it('Leil Selichot (Shabbos before Rosh Hashanah) is not a special day', () => {
    const d = HebrewCalendar.getDate(new HDate(23, months.ELUL, 5786));
    expect(d.isShabbos).toBe(true);
    expect(d.holidays).toEqual(['סליחות']);
    expect(d.special).toBeNull();
  });

  it('Chanukah and leap-year Adar render as expected', () => {
    expect(HebrewCalendar.getDate(new HDate(25, KISLEV, 5786)).special).toContain('חנוכה');
    const adar2 = HebrewCalendar.getDate(new HDate(14, ADAR_II, 5787));
    expect(adar2.isLeapYear).toBe(true);
    expect(adar2.special).toBe('פורים');
    expect(adar2.formatted).toBe('י״ד אדר ב׳ תשפ״ז');
    expect(HebrewCalendar.getDate(new HDate(14, ADAR_I, 5786)).formatted).toBe('י״ד אדר תשפ״ו');
  });
});

describe('HebrewCalendar.getDate from a Gregorian instant (Jerusalem sunset roll-over)', () => {
  it('noon in Jerusalem on 2026-09-12 (09:00 UTC) is 1 Tishrei 5787', () => {
    // A machine-local `new Date(2026, 8, 12, 12)` is timezone dependent: in the
    // Americas that instant is already after sunset in Jerusalem (2 Tishrei).
    const d = HebrewCalendar.getDate(new Date(Date.UTC(2026, 8, 12, 9)));
    expect(d).toMatchObject({ year: 5787, month: TISHREI, day: 1 });
    expect(d.formatted).toBe('א׳ תשרי תשפ״ז');
  });

  it('after sunset in Jerusalem on 2026-09-11 it is already 1 Tishrei 5787', () => {
    const sunset = HebrewCalendar.sunsetJerusalem(new Date(Date.UTC(2026, 8, 11, 12)));
    // Jerusalem sunset that evening is about 18:50 local = 15:50 UTC.
    expect(sunset.toISOString()).toMatch(/^2026-09-11T15:5/);
    const before = HebrewCalendar.getDate(new Date(sunset.getTime() - 60 * 60 * 1000));
    expect(before).toMatchObject({ year: 5786, month: months.ELUL, day: 29 });
    const after = HebrewCalendar.getDate(new Date(sunset.getTime() + 60 * 60 * 1000));
    expect(after).toMatchObject({ year: 5787, month: TISHREI, day: 1 });
  });

  it('uses the Jerusalem civil date, not the machine-local one', () => {
    // 23:30 UTC on 11 Sep is 02:30 on 12 Sep in Jerusalem: before sunset of the 12th,
    // so still 1 Tishrei (it rolled over at sunset on the 11th).
    const d = HebrewCalendar.getDate(new Date(Date.UTC(2026, 8, 11, 23, 30)));
    expect(d).toMatchObject({ year: 5787, month: TISHREI, day: 1 });
  });

  it('exposes the HDate and helper conversions', () => {
    const d = HebrewCalendar.getDate(new Date(Date.UTC(2026, 8, 12, 9)));
    expect(d.hdate).toBeInstanceOf(HDate);
    expect(HebrewCalendar.toHebrew(15)).toBe('ט״ו');
    expect(HebrewCalendar.toHebrew(5787)).toBe('תשפ״ז');
    expect(HebrewCalendar.isLeapYear(5787)).toBe(true);
    expect(HebrewCalendar.isLeapYear(5786)).toBe(false);
  });
});
