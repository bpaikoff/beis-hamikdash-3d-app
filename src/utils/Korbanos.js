// ============================================================================
// KORBANOS - the communal offerings of a given day, in service order
// ----------------------------------------------------------------------------
// Sources: Bamidbar 28-29 (temidin u'musafin), Vayikra 16 and 23, Shemos 30,
// Mishnah Tamid, Yoma, Sukkah 4, Pesachim 5, and Abaye's seder ha'ma'aracha
// (Yoma 33a) for the order within the day.  Day counts follow the Mikdash /
// Eretz Yisrael calendar: no second-day yom tov (Pesach 15-21, Shavuos 6,
// Sukkos 15-21, Shemini Atzeres 22).
//
// `getDaily(hd)` takes the record returned by `HebrewCalendar.getDate()` and
// returns an array of items {name, en, desc, type, source[, mishnah]}.  The
// array also carries a `notes` property (string[]) with explanations that
// are not offerings themselves (Chanukah/Purim, disputes, aravah, hallel).
// ============================================================================
import { HDate, months } from '@hebcal/core';

const { NISAN, IYYAR, SIVAN, TISHREI, KISLEV, TEVET, ADAR_I, ADAR_II } = months;

export const KORBAN_TYPES = Object.freeze({
  TAMID: 'תמיד',
  MUSAF: 'מוסף',
  KETORES: 'קטורת',
  CHOVAS_HAYOM: 'חובת היום',
  MINCHAH: 'מנחה',
});

const { TAMID, MUSAF, KETORES, CHOVAS_HAYOM, MINCHAH } = KORBAN_TYPES;

// ---------------------------------------------------------------------------
// Fixed daily service
// ---------------------------------------------------------------------------
const MORNING = [
  {
    name: 'תמיד של שחר',
    en: 'Morning Tamid',
    desc: 'One yearling lamb as an olah, with its minchah of a tenth-ephah of fine flour mixed in a quarter-hin of oil and its nesech of a quarter-hin of wine.',
    type: TAMID,
    source: 'Numbers 28:3-8',
    mishnah: 'Mishnah Tamid 4:1',
  },
  {
    name: 'קטורת של שחר',
    en: 'Morning Ketores',
    desc: 'The morning incense burned on the golden altar in the Heichal, after the blood of the Tamid and before its limbs go up (Yoma 33a).',
    type: KETORES,
    source: 'Exodus 30:7',
    mishnah: 'Mishnah Tamid 6:3',
  },
  {
    name: 'חביתי כהן גדול',
    en: "Chavitin of the Kohen Gadol",
    desc: 'The Kohen Gadol’s daily pan-baked minchah of one tenth-ephah, half offered in the morning and half in the afternoon.',
    type: MINCHAH,
    source: 'Leviticus 6:12-16',
    mishnah: 'Mishnah Menachot 4:5',
  },
];

const AFTERNOON = [
  {
    name: 'תמיד של בין הערבים',
    en: 'Afternoon Tamid',
    desc: 'One yearling lamb as an olah, with its minchah and nesech, offered at eight and a half hours (Pesachim 5:1) and after which no other offering is brought (Pesachim 58b).',
    type: TAMID,
    source: 'Numbers 28:4-8',
    mishnah: 'Mishnah Pesachim 5:1',
  },
  {
    name: 'קטורת של בין הערבים',
    en: 'Afternoon Ketores',
    desc: 'The afternoon incense on the golden altar, burned when the lamps are kindled, one of the few services permitted after the afternoon Tamid.',
    type: KETORES,
    source: 'Exodus 30:8',
    mishnah: 'Mishnah Yoma 3:5',
  },
];

// ---------------------------------------------------------------------------
// Occasional offerings
// ---------------------------------------------------------------------------
const SHABBOS = [
  {
    name: 'מוסף שבת',
    en: 'Shabbos Musaf',
    desc: 'Two yearling lambs as an olah with a minchah of two tenth-ephahs and their nesech, in addition to the Tamid.',
    type: MUSAF,
    source: 'Numbers 28:9-10',
  },
  {
    name: 'לחם הפנים ובזיכי הלבונה',
    en: 'Lechem HaPanim and the bowls of frankincense',
    desc: 'The twelve loaves are replaced on the Shulchan and the two bowls of frankincense from the previous week are burned on the altar.',
    type: MINCHAH,
    source: 'Leviticus 24:5-9',
    mishnah: 'Mishnah Menachot 11:7',
  },
];

const ROSH_CHODESH = {
  name: 'מוסף ראש חודש',
  en: 'Rosh Chodesh Musaf',
  desc: 'Two bulls, one ram and seven yearling lambs as an olah with their menachos and nesachim, and one goat as a chatas.',
  type: MUSAF,
  source: 'Numbers 28:11-15',
};

const PESACH = {
  name: 'מוסף פסח',
  en: 'Pesach Musaf',
  desc: 'Two bulls, one ram and seven yearling lambs as an olah with their menachos and nesachim, and one goat as a chatas, on each of the seven days.',
  type: MUSAF,
  source: 'Numbers 28:19-24',
};

const OMER = {
  name: 'קרבן העומר',
  en: 'The Omer',
  desc: 'The omer of barley waved before Hashem, with one unblemished yearling lamb as an olah and its minchah of two tenth-ephahs and a quarter-hin of wine.',
  type: CHOVAS_HAYOM,
  source: 'Leviticus 23:10-13',
  mishnah: 'Mishnah Menachot 10:3',
};

const SHAVUOS = {
  name: 'מוסף שבועות',
  en: 'Shavuos Musaf',
  desc: 'Two bulls, one ram and seven yearling lambs as an olah with their menachos and nesachim, and one goat as a chatas.',
  type: MUSAF,
  source: 'Numbers 28:26-31',
};

const SHTEI_HALECHEM = {
  name: 'שתי הלחם וכבשי עצרת',
  en: 'Shtei HaLechem and its offerings',
  desc: 'Two leavened wheat loaves waved with two yearling lambs as shelamim, accompanied by seven lambs, one bull and two rams as an olah and one goat as a chatas.',
  type: CHOVAS_HAYOM,
  source: 'Leviticus 23:17-20',
  mishnah: 'Mishnah Menachot 5:6',
};

const ROSH_HASHANAH = {
  name: 'מוסף ראש השנה',
  en: 'Rosh Hashanah Musaf',
  desc: 'One bull, one ram and seven yearling lambs as an olah with their menachos and nesachim, and one goat as a chatas, besides the Rosh Chodesh musaf.',
  type: MUSAF,
  source: 'Numbers 29:1-6',
};

// Yom Kippur in the order of Rambam, Avodas Yom HaKippurim 4:1-2 (Yoma 70a
// per R. Akiva): the musaf bull and seven lambs go up right after the morning
// Tamid; the day's inner service follows; the two rams and the outer goat
// close the day before the afternoon Tamid.
const YOM_KIPPUR_MUSAF_OLOS = {
  name: 'מוסף יום הכיפורים - פר ושבעה כבשים',
  en: 'Yom Kippur Musaf: bull and seven lambs',
  desc: 'One bull and seven yearling lambs as an olah with their menachos and nesachim, offered by the Kohen Gadol in golden garments right after the morning Tamid.',
  type: MUSAF,
  source: 'Numbers 29:8-10',
  mishnah: 'Mishnah Yoma 7:3',
};

const YOM_KIPPUR_AVODAH = [
  {
    name: 'פר החטאת של כהן גדול',
    en: "Kohen Gadol's bull chatas",
    desc: 'One bull from the Kohen Gadol’s own funds as a chatas, over which he confesses twice before slaughtering it and receiving its blood.',
    type: CHOVAS_HAYOM,
    source: 'Leviticus 16:3-6',
    mishnah: 'Mishnah Yoma 3:8',
  },
  {
    name: 'קטורת לפני ולפנים',
    en: 'Ketores in the Kodesh HaKodashim',
    desc: 'A full pan of coals and two handfuls of fine incense carried into the Holy of Holies, where the smoke covers the Kapores.',
    type: KETORES,
    source: 'Leviticus 16:12-13',
    mishnah: 'Mishnah Yoma 5:1',
  },
  {
    name: "שעיר לה'",
    en: "Goat for Hashem",
    desc: 'The goat on which the lot “for Hashem” fell, one goat as a chatas whose blood is sprinkled inside and whose body is burned outside the camp.',
    type: CHOVAS_HAYOM,
    source: 'Leviticus 16:7-9, 16:15',
    mishnah: 'Mishnah Yoma 4:1',
  },
  {
    name: 'שעיר המשתלח לעזאזל',
    en: 'Goat sent to Azazel',
    desc: 'The second goat, on which the Kohen Gadol confesses the sins of Israel, is led by a designated man to the cliff in the desert.',
    type: CHOVAS_HAYOM,
    source: 'Leviticus 16:10, 16:20-22',
    mishnah: 'Mishnah Yoma 6:2',
  },
  {
    name: 'איל כהן גדול ואיל העם',
    en: "Kohen Gadol's ram and the people's ram",
    desc: 'Two rams as an olah, one from the Kohen Gadol and one for the people (the ram of the musaf), offered after the inner service.',
    type: CHOVAS_HAYOM,
    source: 'Leviticus 16:3, 16:5, 16:24',
    mishnah: 'Mishnah Yoma 7:3',
  },
  {
    name: 'שעיר חטאת החיצון',
    en: 'Outer goat chatas of the Musaf',
    desc: 'One goat as a chatas offered on the outer altar, the chatas of the Yom Kippur musaf, besides the inner goat of atonement.',
    type: MUSAF,
    source: 'Numbers 29:11',
    mishnah: 'Mishnah Yoma 7:3',
  },
];

// Sukkos verse ranges per day, 15-21 Tishrei.
const SUKKOS_REFS = ['29:12-16', '29:17-19', '29:20-22', '29:23-25', '29:26-28', '29:29-31', '29:32-34'];

function sukkosMusaf(day) {
  const idx = day - 15;
  const parim = 13 - idx;
  return {
    name: 'מוסף סוכות - יום ' + ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳'][idx],
    en: `Sukkos Musaf, day ${idx + 1}`,
    desc: `${parim} bulls, two rams and fourteen yearling lambs as an olah with their menachos and nesachim, and one goat as a chatas.`,
    type: MUSAF,
    source: `Numbers ${SUKKOS_REFS[idx]}`,
    parim,
  };
}

const NISUCH_HAMAYIM = {
  name: 'ניסוך המים',
  en: 'Nisuch HaMayim',
  desc: 'Three log of water drawn from the Shiloach and poured into the bowl at the south-west corner of the altar together with the wine of the morning Tamid.',
  type: CHOVAS_HAYOM,
  source: 'Mishnah Sukkah 4:9',
  mishnah: 'Mishnah Sukkah 4:9',
};

const SHEMINI_ATZERES = {
  name: 'מוסף שמיני עצרת',
  en: 'Shemini Atzeres Musaf',
  desc: 'One bull, one ram and seven yearling lambs as an olah with their menachos and nesachim, and one goat as a chatas.',
  type: MUSAF,
  source: 'Numbers 29:35-38',
};

const KORBAN_PESACH = {
  name: 'קרבן פסח',
  en: 'Korban Pesach',
  desc: 'Each chaburah brings one lamb or kid in its first year, slaughtered in three shifts after the afternoon Tamid and the afternoon ketores (Rambam, Korban Pesach 1:4).',
  type: CHOVAS_HAYOM,
  source: 'Exodus 12:3-6',
  mishnah: 'Mishnah Pesachim 5:1',
};

// ---------------------------------------------------------------------------
// Notes for days that change the service without adding an offering
// ---------------------------------------------------------------------------
const NOTE_RH_DAY_2 =
  'Second day of Rosh Hashanah: in the Mikdash the second day was kept only when the witnesses arrived after the afternoon Tamid (Rosh Hashanah 4:4, Beitzah 5a), so no fixed musaf is listed here; 1 Tishrei carries the Rosh Hashanah musaf.';
const NOTE_CHANUKAH =
  'Chanukah adds no korban: the days were fixed for Hallel and thanksgiving (Shabbos 21b); the Menorah in the Heichal is kindled every evening as always.';
const NOTE_PURIM =
  'Purim adds no korban: the day is marked by reading the Megillah, gifts and the festive meal; Jerusalem, a walled city, keeps it on 15 Adar (Mishnah Megillah 1:1). The Tamid service is unchanged.';
const NOTE_PESACH_SHENI =
  'Pesach Sheni: whoever was tamei or far away on 14 Nissan brings the Korban Pesach today after the afternoon Tamid (Numbers 9:10-11; Mishnah Pesachim 9:1); it is an individual offering, not a communal one.';
const NOTE_CHAGIGAH =
  'Individuals also bring their olas re’iyah and shalmei chagigah, and shalmei simchah, on the festival (Mishnah Chagigah 1:1-2).';
const NOTE_SUKKOS_ARAVAH =
  'Aravah: tall willow branches are stood against the sides of the altar and the Kohanim circle it once (seven times on Hoshana Rabbah, 21 Tishrei), with the shofar sounding (Mishnah Sukkah 4:5).';
const NOTE_SUKKOS_HALLEL =
  'Hallel is completed on each day of Sukkos, and the lulav is taken in the Mikdash all seven days (Mishnah Sukkah 3:12).';
const NOTE_YK_INNER =
  'On Yom Kippur the Kohen Gadol alone performs the whole service, changing five times between golden and white garments and immersing five times (Mishnah Yoma 3:3).';

/** Chanukah runs eight days from 25 Kislev, ending on 2 or 3 Teves depending on the length of Kislev. */
function isChanukahDay(hd) {
  if (hd.month === KISLEV) return hd.day >= 25;
  if (hd.month === TEVET) {
    const kislevLen = new HDate(1, KISLEV, hd.year).daysInMonth();
    return hd.day <= (kislevLen === 30 ? 2 : 3);
  }
  return false;
}

/** 14 Adar (Purim) and 15 Adar (Shushan Purim, kept in Jerusalem); Adar II in a leap year. */
function isPurim(hd) {
  if (hd.day !== 14 && hd.day !== 15) return false;
  if (hd.isLeapYear) return hd.month === ADAR_II;
  return hd.month === ADAR_I;
}

export const Korbanos = {
  types: KORBAN_TYPES,

  /**
   * The communal offerings of the day, in the order they are brought.
   * `hd` is the record from HebrewCalendar.getDate()/fromHDate().
   * Returns an array of items; `list.notes` holds the day's remarks.
   */
  getDaily(hd) {
    const list = [];
    const notes = [];
    const { month, day } = hd;

    const isSukkos = month === TISHREI && day >= 15 && day <= 21;
    const isPesach = month === NISAN && day >= 15 && day <= 21;
    const isYomKippur = month === TISHREI && day === 10;

    // --- Morning: Tamid, ketores, chavitin (Yoma 33a) -----------------------
    list.push(...MORNING);

    // Nisuch HaMayim accompanies the nesech of the morning Tamid, which in
    // Abaye's order comes after the chavitin and before the musafim.
    if (isSukkos) list.push(NISUCH_HAMAYIM);

    // --- Musafim, most frequent first (Zevachim 89a, Rambam Temidin 9:2) ----
    if (hd.isShabbos) list.push(...SHABBOS);
    if (hd.isRoshChodesh) list.push(ROSH_CHODESH);

    if (isPesach) {
      list.push(PESACH);
      if (day === 16) list.push(OMER);
      if (day === 15) notes.push(NOTE_CHAGIGAH);
    } else if (month === SIVAN && day === 6) {
      list.push(SHAVUOS, SHTEI_HALECHEM);
      notes.push(NOTE_CHAGIGAH);
    } else if (month === TISHREI && day === 1) {
      list.push(ROSH_HASHANAH);
      notes.push(NOTE_RH_DAY_2);
    } else if (month === TISHREI && day === 2) {
      notes.push(NOTE_RH_DAY_2);
    } else if (isYomKippur) {
      list.push(YOM_KIPPUR_MUSAF_OLOS, ...YOM_KIPPUR_AVODAH);
      notes.push(NOTE_YK_INNER);
    } else if (isSukkos) {
      list.push(sukkosMusaf(day));
      if (day === 15) notes.push(NOTE_CHAGIGAH);
      notes.push(NOTE_SUKKOS_ARAVAH, NOTE_SUKKOS_HALLEL);
    } else if (month === TISHREI && day === 22) {
      list.push(SHEMINI_ATZERES);
      notes.push(NOTE_CHAGIGAH);
    }

    // --- Afternoon: Tamid, then ketores; nothing else follows (Pesachim 58b)
    // except the Korban Pesach on 14 Nissan (Pesachim 5:1; Rambam KP 1:4).
    list.push(...AFTERNOON);
    if (month === NISAN && day === 14) list.push(KORBAN_PESACH);

    // --- Days that add no korban ------------------------------------------
    if (isChanukahDay(hd)) notes.push(NOTE_CHANUKAH);
    if (isPurim(hd)) notes.push(NOTE_PURIM);
    if (month === IYYAR && day === 14) notes.push(NOTE_PESACH_SHENI);

    list.notes = notes;
    return list;
  },

  /** The day's notes without the list (same strings as `getDaily(hd).notes`). */
  getNotes(hd) {
    return this.getDaily(hd).notes;
  },
};
