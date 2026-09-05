import { useEffect, useRef } from 'react';
import { store, useStore, openAsk } from '../store.js';
import { byId } from '../content/index.js';
import { formatLength } from '../content/units.js';
import { sefariaUrl, tzadekUrl } from './links.js';

const UI = {
  en: {
    close: 'Close',
    dimensions: 'Dimensions',
    sources: 'Sources',
    disputes: 'Disputes',
    ask: 'Ask the poskim',
    questions: 'Questions',
    bayisRishon: 'Bayis Rishon',
    bayisRishonOnly: 'First Temple only',
    openExternal: 'Open on tzadek.ai',
    lang: 'עברית',
  },
  he: {
    close: 'סגור',
    dimensions: 'מידות',
    sources: 'מקורות',
    disputes: 'מחלוקות',
    ask: 'שאל את הפוסקים',
    questions: 'שאלות',
    bayisRishon: 'בית ראשון',
    bayisRishonOnly: 'בבית ראשון בלבד',
    openExternal: 'פתח ב-tzadek.ai',
    lang: 'English',
  },
};

const isRishonOnly = (entry) => entry.period?.includes('bayis_rishon') && !entry.period.includes('bayis_sheni');

const close = () => store.setState({ selected: null });

/**
 * The expanded card for `store.selected`. Escape closes it only while the pointer is not
 * locked: with the pointer locked the browser swallows Escape to release the lock, and the
 * card must survive that so the visitor can then read and click it.
 */
export function HotspotCard() {
  const selected = useStore((s) => s.selected);
  const lang = useStore((s) => s.lang);
  const entry = selected ? byId[selected] : null;
  const ref = useRef(null);
  const restoreFocus = useRef(null);

  useEffect(() => {
    if (!entry) return;
    restoreFocus.current = document.activeElement;
    const card = ref.current;
    const canvasHost = card?.closest('.game-container') ?? null;
    card?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key !== 'Escape' || document.pointerLockElement) return;
      e.preventDefault();
      close();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Focus goes back where it came from, or to the game container (the canvas host,
      // tabIndex -1) so keyboard movement and Escape keep reaching the game.
      const prev = restoreFocus.current;
      const target = prev && prev.isConnected && prev !== document.body && !card?.contains(prev) ? prev : canvasHost;
      if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });
    };
  }, [entry]);

  if (!entry) return null;

  const t = UI[lang] ?? UI.en;
  const other = lang === 'he' ? 'en' : 'he';
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const pick = (obj) => (obj ? obj[lang] ?? obj.en : '');
  const dims = entry.dimensions ?? [];
  const sources = entry.sources ?? [];
  const disputes = entry.disputes ?? [];
  const questions = entry.questions ?? [];

  return (
    <div
      className="panel kli-panel hotspot-card"
      role="dialog"
      aria-modal="false"
      aria-labelledby="hotspot-card-title"
      tabIndex={-1}
      ref={ref}
      lang={lang}
      dir={dir}
      key={entry.id}
    >
      <div className="card-toolbar" dir="ltr">
        <button type="button" className="lang-btn" onClick={() => store.setState({ lang: other })} lang={other}>
          {t.lang}
        </button>
        <button type="button" className="card-close" aria-label={t.close} title={t.close} onClick={close}>
          ×
        </button>
      </div>

      <div className="card-head">
        <div className="icon" aria-hidden="true">{entry.icon}</div>
        <div className="card-titles">
          <div className="name-heb" id="hotspot-card-title" lang="he" dir="rtl">{entry.name.he}</div>
          <div className="name-en" lang="en" dir="ltr">{entry.name.en}</div>
          {isRishonOnly(entry) && (
            <span className="period-badge" title={t.bayisRishonOnly}>{t.bayisRishon}</span>
          )}
        </div>
      </div>

      <p className="desc" lang={lang} dir={dir}>{pick(entry.desc)}</p>

      {dims.length > 0 && (
        <section className="card-section">
          <h4>{t.dimensions}</h4>
          <dl className="dims">
            {dims.map((d, i) => (
              <div className="dim" key={i}>
                <dt lang="en" dir="ltr">{d.label}</dt>
                <dd>
                  <span className="dim-value">{formatLength(d.value, d.unit, lang)}</span>
                  {d.source && (
                    <a className="source-chip" href={sefariaUrl(d.source)} target="_blank" rel="noopener noreferrer" lang="en" dir="ltr">
                      {d.source}
                    </a>
                  )}
                  {d.note && <span className="dim-note" lang="en" dir="ltr">{d.note}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {sources.length > 0 && (
        <section className="card-section">
          <h4>{t.sources}</h4>
          <div className="chips" dir="ltr">
            {sources.map((s) => (
              <a className="source-chip" key={s} href={sefariaUrl(s)} target="_blank" rel="noopener noreferrer" lang="en">
                {s}
              </a>
            ))}
          </div>
        </section>
      )}

      {disputes.length > 0 && (
        <details className="card-section disputes">
          <summary>{t.disputes} ({disputes.length})</summary>
          <ul lang="en" dir="ltr">
            {disputes.map((d, i) => (
              <li key={i}>
                <strong>{d.issue}</strong>
                {d.views?.length > 0 && (
                  <ul>
                    {d.views.map((v, j) => <li key={j}>{v}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {questions.length > 0 && (
        <section className="card-section questions">
          <h4>{t.ask}</h4>
          <ul>
            {questions.map((q, i) => {
              const text = q[lang] ?? q.en;
              const qLang = q[lang] ? lang : 'en';
              return (
                <li key={i}>
                  {/* The button streams the answer into the Ask panel; the small link is the
                      same question on tzadek.ai itself (and the only path when the panel
                      cannot stream, e.g. no guest passcode in this build). */}
                  <button type="button" className="question-btn" lang={qLang} dir={qLang === 'he' ? 'rtl' : 'ltr'} onClick={() => openAsk(text)}>
                    {text}
                  </button>
                  <a
                    className="question-ext"
                    href={tzadekUrl(text)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t.openExternal}
                    title={t.openExternal}
                    lang="en"
                    dir="ltr"
                  >
                    ↗
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
