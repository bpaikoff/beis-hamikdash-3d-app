// ============================================================================
// KORBANOS (Daily Sacrifices)
// ============================================================================
export const Korbanos = {
  getDaily(hd) {
    const list = [
      { name: 'תמיד של שחר', en: 'Morning Tamid', desc: 'כבש בן שנתו עולה', type: 'עולה' },
      { name: 'קטורת הבוקר', en: 'Morning Ketores', desc: 'על מזבח הזהב', type: 'קטורת' },
      { name: 'תמיד של בין הערביים', en: 'Afternoon Tamid', desc: 'כבש בן שנתו עולה', type: 'עולה' },
      { name: 'קטורת בין הערביים', en: 'Afternoon Ketores', desc: 'על מזבח הזהב', type: 'קטורת' }
    ];

    if (hd.isShabbos) {
      list.push({ name: 'מוסף שבת', en: 'Shabbos Musaf', desc: 'ב׳ כבשים בני שנה', type: 'עולה' });
    }

    if (hd.isRoshChodesh) {
      list.push({ name: 'מוסף ראש חודש', en: 'Rosh Chodesh Musaf', desc: 'ב׳ פרים, איל, ז׳ כבשים', type: 'עולה' });
    }

    if (hd.special === 'יום הכיפורים') {
      list.push({ name: 'פר כהן גדול', en: "Kohen Gadol's Bull", desc: 'חטאת לכפרה', type: 'חטאת' });
      list.push({ name: 'שעיר לה׳', en: 'Goat for Hashem', desc: 'הגורל עלה לה׳', type: 'חטאת' });
    }

    return list;
  }
};
