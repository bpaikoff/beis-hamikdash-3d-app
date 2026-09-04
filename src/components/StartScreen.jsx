import { store, useStore } from '../store.js';

const PERIODS = [
  { id: 'bayis_sheni', he: 'בית שני', en: 'Bayis Sheni' },
  { id: 'bayis_rishon', he: 'בית ראשון', en: 'Bayis Rishon' },
];

/**
 * Landing panel: Hebrew date, a one-paragraph description, the period toggle (writes
 * store.period; TempleGame rebuilds its hotspot list on change) and the Enter button.
 * `onEnter` runs inside the click so it can also request pointer lock.
 */
export function StartScreen({ hebrewDate, webgl, onEnter }) {
  const period = useStore((s) => s.period);
  return (
    <div className="start-screen">
      <div className="start-panel" role="region" aria-labelledby="start-title">
        <h1 id="start-title" lang="he" dir="rtl">בית המקדש</h1>
        <h2 lang="en">Beis Hamikdash Explorer</h2>
        <p lang="en">
          Walk through the Temple in Yerushalayim as the Mishnah in Maseches Middos and the Rambam
          describe it: up from the Chuldah Gates across Har HaBayis, through the Ezras Nashim and
          the Azarah past the Mizbeach, into the Ulam and the Heichal, to the Kodesh HaKodashim.
          Every vessel and courtyard carries its measurements in amos, its sources, and the
          disputes about it.
        </p>

        <div className="date-info" lang="he" dir="rtl">
          <div className="heb">{hebrewDate.formatted}</div>
          <div className="day">{hebrewDate.dayName}</div>
          {hebrewDate.special && <div className="heb" style={{ marginTop: '8px' }}>{hebrewDate.special}</div>}
          {hebrewDate.isRoshChodesh && !hebrewDate.special && <div className="heb" style={{ marginTop: '8px' }}>ראש חודש</div>}
        </div>

        <fieldset className="period-toggle">
          <legend lang="en">Period</legend>
          {PERIODS.map((p) => (
            <label key={p.id} className={period === p.id ? 'active' : ''}>
              <input
                type="radio"
                name="period"
                value={p.id}
                checked={period === p.id}
                onChange={() => store.setState({ period: p.id })}
              />
              <span lang="he" dir="rtl">{p.he}</span>
              <span lang="en">{p.en}</span>
            </label>
          ))}
        </fieldset>

        {webgl ? (
          <button type="button" className="start-btn" onClick={onEnter}>Enter the Temple</button>
        ) : (
          <p className="footer">This walkthrough needs WebGL 2, which this browser does not provide.</p>
        )}

        <div className="footer" lang="en">
          Sources: Mishnah Middos, Mishnah Yoma, Mishnah Tamid, Rambam Hilchos Beis HaBechirah,
          Melachim I 6-7 and Divrei HaYamim II 3-4 for Bayis Rishon. Texts link to Sefaria;
          questions go to{' '}
          <a href="https://tzadek.ai" target="_blank" rel="noopener noreferrer">tzadek.ai</a>.
        </div>
      </div>
    </div>
  );
}
