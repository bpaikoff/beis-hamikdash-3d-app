// ============================================================================
// HEBREW CALENDAR
// ============================================================================
export const HebrewCalendar = {
  months: ['ניסן','אייר','סיון','תמוז','אב','אלול','תשרי','חשון','כסלו','טבת','שבט','אדר'],
  monthsLeap: ['ניסן','אייר','סיון','תמוז','אב','אלול','תשרי','חשון','כסלו','טבת','שבט','אדר א׳','אדר ב׳'],
  days: ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'],

  toHebrew(n) {
    const o = ['', 'א','ב','ג','ד','ה','ו','ז','ח','ט'];
    const t = ['', 'י','כ','ל','מ','נ','ס','ע','פ','צ'];
    if (n < 10) return o[n];
    if (n === 15) return 'ט״ו';
    if (n === 16) return 'ט״ז';
    return t[Math.floor(n/10)] + (n%10 ? '״' + o[n%10] : '');
  },

  isLeapYear(y) {
    return (y % 19 === 0 || y % 19 === 3 || y % 19 === 6 || y % 19 === 8 || y % 19 === 11 || y % 19 === 14 || y % 19 === 17);
  },

  getMonthLengths(year) {
    // Correct month lengths: Nissan(30), Iyar(29), Sivan(30), Tammuz(29), Av(30), Elul(29),
    // Tishrei(30), Cheshvan(29), Kislev(30), Teves(29), Shevat(30), Adar(29)
    const isLeap = this.isLeapYear(year);
    let ml = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];
    if (isLeap) {
      // Adar I(30), Adar II(29)
      ml = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 30, 29];
    }
    return ml;
  },

  getDate(date = new Date()) {
    const ref = new Date(2023, 8, 16); // September 16, 2023 = Tishrei 1, 5784
    let y = 5784, m = 7, d = 1 + Math.floor((date - ref) / 86400000);
    let ml = this.getMonthLengths(y);

    // Handle dates in the future
    while (d > ml[m-1]) {
      d -= ml[m-1];
      m++;
      if (m > ml.length) {
        m = 1;
        y++;
        ml = this.getMonthLengths(y);
      }
    }

    // Handle dates before reference
    while (d < 1) {
      m--;
      if (m < 1) {
        y--;
        ml = this.getMonthLengths(y);
        m = ml.length;
      }
      d += ml[m-1];
    }

    const dow = date.getDay();
    let special = null;
    const isLeap = this.isLeapYear(y);
    const monthName = isLeap ? this.monthsLeap[m-1] : this.months[m-1];

    // Check for special days
    if (m===7 && d<=2) special = 'ראש השנה';
    else if (m===7 && d===10) special = 'יום הכיפורים';
    else if (m===7 && d>=15 && d<=21) special = 'סוכות';
    else if (m===7 && d===22) special = 'שמיני עצרת';
    else if (m===9 && d>=25) special = 'חנוכה';
    else if (m===10 && d<=2) special = 'חנוכה';
    else if (m===1 && d>=15 && d<=22) special = 'פסח';
    else if (m===3 && (d===6||d===7)) special = 'שבועות';
    else if (m===5 && d===9) special = 'תשעה באב';

    return {
      year: y,
      month: m,
      day: d,
      monthName,
      dayName: 'יום ' + this.days[dow],
      isShabbos: dow === 6,
      isRoshChodesh: d === 1 || d === 30,
      formatted: this.toHebrew(d) + ' ' + monthName + ' ' + y,
      special
    };
  }
};
