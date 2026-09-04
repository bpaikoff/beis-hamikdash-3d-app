// ============================================================================
// HEBREW CALENDAR  (backed by @hebcal/core)
// ----------------------------------------------------------------------------
// The Hebrew day begins at sunset, so `getDate(instant)` first works out the
// civil date in Jerusalem for that instant, computes sunset there with
// `Zmanim`, and rolls to the next Hebrew day once the sun has set.  Holidays
// are resolved with the Israel calendar (`il = true`): no second-day yom tov.
// ============================================================================
import {
  HDate,
  HebrewCalendar as Hebcal,
  Location,
  Locale,
  Zmanim,
  flags,
  gematriya,
  months,
} from '@hebcal/core';

const JERUSALEM_TZ = 'Asia/Jerusalem';
const jerusalem = Location.lookup('Jerusalem');

const DAY_NAMES = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת קודש'];

// Events that should never be shown as the day's `special` label: they are
// not the day's identity (Rosh Chodesh has its own field; the rest are
// diaspora-only, modern, or purely calendrical markers).
const SPECIAL_EXCLUDE =
  flags.ROSH_CHODESH |
  flags.SHABBAT_MEVARCHIM |
  flags.SPECIAL_SHABBAT |
  flags.PARSHA_HASHAVUA |
  flags.MODERN_HOLIDAY |
  flags.MOLAD |
  flags.YOM_KIPPUR_KATAN |
  flags.CHUL_ONLY |
  flags.DAF_YOMI |
  flags.MISHNA_YOMI |
  flags.NACH_YOMI |
  flags.YERUSHALMI_YOMI |
  flags.DAILY_LEARNING |
  flags.HEBREW_DATE |
  flags.USER_EVENT |
  flags.OMER_COUNT;

// Ordered by how strongly the event defines the day; the first match wins.
const SPECIAL_PRIORITY = [
  flags.CHAG,
  flags.CHOL_HAMOED,
  flags.MAJOR_FAST,
  flags.EREV,
  flags.CHANUKAH_CANDLES,
  flags.MINOR_HOLIDAY,
  flags.MINOR_FAST,
];

const civilPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: JERUSALEM_TZ,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

/** The Jerusalem civil date (y, m, d) of an instant, as a machine-local Date at midnight. */
function jerusalemCivilDate(instant) {
  const parts = {};
  for (const p of civilPartsFormatter.formatToParts(instant)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  // HDate and Zmanim read only the local Y/M/D components of the Date they
  // are given, so a local-midnight Date carrying Jerusalem's civil date is
  // exactly what they need.
  return new Date(parts.year, parts.month - 1, parts.day);
}

/** Strip the year that hebcal appends to a few names ("ראש השנה 5787"). */
function cleanHebrewName(str) {
  return str.replace(/\s+\d{4}\s*$/, '').trim();
}

// Customs that hebcal reports as minor holidays but that do not change the
// day's identity in the Mikdash.
const SPECIAL_EXCLUDE_DESC = new Set(['Leil Selichot']);

function pickSpecial(events) {
  const candidates = events.filter(
    (ev) => !(ev.getFlags() & SPECIAL_EXCLUDE) && !SPECIAL_EXCLUDE_DESC.has(ev.getDesc())
  );
  for (const mask of SPECIAL_PRIORITY) {
    const ev = candidates.find((e) => e.getFlags() & mask);
    if (ev) return ev;
  }
  return candidates[0] || null;
}

function omerDayOf(hd) {
  const diff = hd.abs() - new HDate(15, months.NISAN, hd.getFullYear()).abs();
  return diff >= 1 && diff <= 49 ? diff : null;
}

export const HebrewCalendar = {
  /** hebcal month numbering: Nissan = 1 ... Adar I = 12, Adar II = 13. */
  months,
  days: DAY_NAMES,

  /** Hebrew numeral with geresh/gershayim, e.g. 15 -> ט״ו, 5787 -> תשפ״ז. */
  toHebrew(n) {
    return gematriya(n);
  },

  isLeapYear(y) {
    return HDate.isLeapYear(y);
  },

  /** Sunset in Jerusalem (a Date) for the Jerusalem civil day containing `instant`. */
  sunsetJerusalem(instant = new Date()) {
    return new Zmanim(jerusalem, jerusalemCivilDate(instant), false).sunset();
  },

  /**
   * The Hebrew date in Jerusalem for an instant.  After sunset in Jerusalem
   * the date rolls to the next Hebrew day.  An `HDate` may be passed directly
   * (no sunset roll-over), which is what the tests and Korbanos use.
   */
  getDate(date = new Date()) {
    if (date instanceof HDate) return this.fromHDate(date);
    const civil = jerusalemCivilDate(date);
    const sunset = this.sunsetJerusalem(date);
    let hd = new HDate(civil);
    if (!Number.isNaN(sunset.getTime()) && date.getTime() >= sunset.getTime()) {
      hd = hd.next();
    }
    return this.fromHDate(hd);
  },

  /** Build the HUD's date record from an HDate, using the Israel calendar. */
  fromHDate(hd) {
    const events = Hebcal.getHolidaysOnDate(hd, true) || [];
    const specialEv = pickSpecial(events);
    const dow = hd.getDay();
    const day = hd.getDate();
    const month = hd.getMonth();
    const year = hd.getFullYear();
    const holidays = events.map((ev) => cleanHebrewName(ev.render('he-x-NoNikud')));

    return {
      year,
      month,
      day,
      monthName: Locale.gettext(hd.getMonthName(), 'he-x-NoNikud'),
      dayName: DAY_NAMES[dow],
      isShabbos: dow === 6,
      isRoshChodesh: day === 1 || day === 30,
      formatted: hd.renderGematriya(true),
      special: specialEv ? cleanHebrewName(specialEv.render('he-x-NoNikud')) : null,
      holidays,
      omerDay: omerDayOf(hd),
      flags: events.reduce((acc, ev) => acc | ev.getFlags(), 0),
      isLeapYear: HDate.isLeapYear(year),
      hdate: hd,
    };
  },
};
