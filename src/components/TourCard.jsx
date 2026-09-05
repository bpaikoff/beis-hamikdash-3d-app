import { useEffect, useRef } from 'react';
import { store, useStore, openAsk } from '../store.js';
import { byTourId } from '../content/tours/index.js';
import { sefariaUrl } from './links.js';

const UI = {
  en: {
    tour: 'Guided tour',
    stop: 'Stop',
    of: 'of',
    prev: 'Previous stop',
    next: 'Next stop',
    pause: 'Pause',
    play: 'Continue automatically',
    exit: 'Exit the tour',
    sources: 'Sources',
    ask: 'Ask the poskim',
    ended: 'End of the tour',
    travelling: 'Walking…',
    lang: 'עברית',
    keys: '← → stops · Space pause · Esc exit',
  },
  he: {
    tour: 'סיור מודרך',
    stop: 'תחנה',
    of: 'מתוך',
    prev: 'התחנה הקודמת',
    next: 'התחנה הבאה',
    pause: 'השהה',
    play: 'המשך אוטומטית',
    exit: 'צא מהסיור',
    sources: 'מקורות',
    ask: 'שאל את הפוסקים',
    ended: 'סוף הסיור',
    travelling: 'בדרך…',
    lang: 'English',
    keys: '← → תחנות · רווח השהיה · Esc יציאה',
  },
};

const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

/**
 * The guided-tour card (bottom centre, under the top HUD): stop counter and progress
 * dots, the stop's title and text in `store.lang`, its sources as Sefaria chips, its
 * questions (they open the Ask panel), prev / play-pause / next / exit, and the dwell
 * countdown bar. Hovering or focusing the card holds the countdown, as does the Ask
 * panel while it is open. Keys: arrows for the stops (mirrored in Hebrew), Space to
 * pause or resume, Escape to exit; the game's own key handler stands down while a tour
 * runs (TempleGame.setupControls).
 */
export function TourCard() {
  const tourId = useStore((s) => s.tour);
  const index = useStore((s) => s.tourStop);
  const playing = useStore((s) => s.tourPlaying);
  const dwell = useStore((s) => s.tourDwell);
  const dwellLeft = useStore((s) => s.tourDwellLeft);
  const ended = useStore((s) => s.tourEnded);
  const ctl = useStore((s) => s.tourCtl);
  const askOpen = useStore((s) => s.askOpen);
  const lang = useStore((s) => s.lang);
  const ref = useRef(null);
  const tour = tourId ? byTourId[tourId] : null;
  const stop = tour?.stops[index] ?? null;

  // Keys while the tour runs.
  useEffect(() => {
    if (!tour || !ctl) return;
    const rtl = store.getState().lang === 'he';
    const onKey = (e) => {
      if (isTyping(e.target)) return;
      if (e.key === 'Escape') {
        // The Ask panel captures Escape first (and stops it); a hotspot card closes itself.
        if (store.getState().selected) return;
        e.preventDefault();
        ctl.stop();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const forward = (e.key === 'ArrowRight') !== rtl;
        if (forward) ctl.next();
        else ctl.prev();
        return;
      }
      if (e.key === ' ' && !(e.target && e.target.tagName === 'BUTTON')) {
        e.preventDefault();
        ctl.toggle();
      }
    };
    document.addEventListener('keydown', onKey);
    const card = ref.current;
    // The container locks the pointer on any native click; clicks in the card must not.
    const swallow = (e) => e.stopPropagation();
    card?.addEventListener('click', swallow);
    return () => {
      document.removeEventListener('keydown', onKey);
      card?.removeEventListener('click', swallow);
    };
  }, [tour, ctl, lang]);

  // The Ask panel holds the countdown while it is open.
  useEffect(() => {
    if (!ctl) return;
    if (askOpen) ctl.setHold(true);
    else ctl.setHold(ref.current?.matches(':hover, :focus-within') ?? false);
  }, [ctl, askOpen]);

  if (!tour || !stop || !ctl) return null;

  const t = UI[lang] ?? UI.en;
  const other = lang === 'he' ? 'en' : 'he';
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const pick = (o) => (o ? (o[lang] ?? o.en) : '');
  const n = tour.stops.length;
  const travelling = playing === 'travel';
  const paused = playing === 'paused';
  const pct = dwell > 0 && !travelling ? Math.max(0, Math.min(100, (dwellLeft / dwell) * 100)) : 0;
  const hold = (on) => () => {
    if (!store.getState().askOpen) ctl.setHold(on);
  };

  return (
    <div
      className={`panel tour-card${travelling ? ' travelling' : ''}`}
      role="region"
      aria-label={`${t.tour}: ${pick(tour.title)}`}
      lang={lang}
      dir={dir}
      ref={ref}
      onMouseEnter={hold(true)}
      onMouseLeave={hold(false)}
      onFocus={hold(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) hold(false)();
      }}
    >
      <div className="tour-head" dir={dir}>
        <div className="tour-head-titles">
          <span className="tour-kicker">{pick(tour.title)}</span>
          <span className="tour-counter" lang="en" dir="ltr">
            {index + 1} / {n}
          </span>
        </div>
        <div className="tour-head-actions" dir="ltr">
          <button type="button" className="lang-btn" onClick={() => store.setState({ lang: other })} lang={other}>
            {t.lang}
          </button>
          <button type="button" className="card-close" aria-label={t.exit} title={t.exit} onClick={() => ctl.stop()}>
            ×
          </button>
        </div>
      </div>

      <ol className="tour-dots" dir="ltr" aria-label={t.stop}>
        {tour.stops.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className={`tour-dot${i === index ? ' current' : ''}${i < index ? ' seen' : ''}`}
              aria-label={`${t.stop} ${i + 1}: ${pick(s.title)}`}
              aria-current={i === index ? 'step' : undefined}
              title={pick(s.title)}
              onClick={() => ctl.goTo(i)}
            />
          </li>
        ))}
      </ol>

      <div className="tour-body" key={stop.id}>
        <h3 className="tour-title" lang={lang} dir={dir}>{pick(stop.title)}</h3>
        <p className="tour-text" lang={lang} dir={dir}>{pick(stop.text)}</p>

        {stop.sources?.length > 0 && (
          <div className="tour-sources">
            <span className="tour-label">{t.sources}</span>
            <span className="chips" dir="ltr">
              {stop.sources.map((s) => (
                <a className="source-chip" key={s} href={sefariaUrl(s)} target="_blank" rel="noopener noreferrer" lang="en">
                  {s}
                </a>
              ))}
            </span>
          </div>
        )}

        {stop.questions?.length > 0 && (
          <div className="tour-questions">
            <span className="tour-label">{t.ask}</span>
            <ul>
              {stop.questions.map((q, i) => {
                const text = q[lang] ?? q.en;
                const qLang = q[lang] ? lang : 'en';
                return (
                  <li key={i}>
                    <button type="button" className="question-btn" lang={qLang} dir={qLang === 'he' ? 'rtl' : 'ltr'} onClick={() => openAsk(text)}>
                      {text}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="tour-controls" dir="ltr">
        <button type="button" className="tour-btn" aria-label={t.prev} title={t.prev} onClick={() => ctl.prev()} disabled={index <= 0}>
          {lang === 'he' ? '›' : '‹'}
        </button>
        {paused ? (
          <button type="button" className="tour-btn tour-btn-play" aria-label={t.play} title={t.play} onClick={() => ctl.resume()}>
            ▶
          </button>
        ) : (
          <button type="button" className="tour-btn tour-btn-play" aria-label={t.pause} title={t.pause} onClick={() => ctl.pause()}>
            ❚❚
          </button>
        )}
        <button type="button" className="tour-btn" aria-label={t.next} title={t.next} onClick={() => ctl.next()} disabled={index >= n - 1}>
          {lang === 'he' ? '‹' : '›'}
        </button>
        <span className="tour-status" lang={lang} dir={dir} aria-live="polite">
          {travelling ? t.travelling : ended ? t.ended : paused ? t.pause : `${Math.ceil(dwellLeft)} s`}
        </span>
        <span className="tour-keys" lang={lang} dir={dir}>{t.keys}</span>
        <button type="button" className="tour-btn tour-btn-exit" onClick={() => ctl.stop()} lang={lang}>
          {t.exit}
        </button>
      </div>
      <div className="tour-bar" aria-hidden="true">
        <div className="tour-bar-inner" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
