import { useEffect, useReducer, useRef, useState } from 'react';
import { store, useStore, closeAsk, openAsk } from '../store.js';
import { askStream, isAskAvailable, parsePsak, isHebrew } from '../lib/tzadek.js';
import { tzadekUrl, sourceUrl } from './links.js';

const UI = {
  en: {
    title: 'Ask the poskim',
    close: 'Close',
    consulting: 'Consulting the poskim…',
    sources: 'Sources',
    synthesis: 'Synthesis',
    consensus: 'Consensus',
    continueOn: 'Continue on tzadek.ai',
    askAnother: 'Ask another question',
    placeholder: 'Ask the poskim…',
    send: 'Ask',
    retry: 'Try again',
    errorTitle: 'The poskim could not answer',
    poweredBy: 'Answers stream from tzadek.ai and are AI-generated; consult a rav for practical halacha.',
    unavailable: {
      nopasscode: 'Live answers are not enabled in this build. Ask on tzadek.ai instead.',
      auth: 'The visitor passcode was not accepted. Ask on tzadek.ai instead.',
      forbidden: 'The visitor passcode was not accepted. Ask on tzadek.ai instead.',
      limit: "This month's shared question budget is used up. Ask on tzadek.ai instead.",
      budget: 'The shared question budget is used up for now. Ask on tzadek.ai instead.',
      rate: 'Too many questions right now. Wait a minute, or ask on tzadek.ai.',
      network: 'tzadek.ai could not be reached. Ask there directly instead.',
      http: 'tzadek.ai could not answer right now. Ask there directly instead.',
      unsupported: 'This browser cannot stream answers. Ask on tzadek.ai instead.',
    },
    psak: { permitted: 'Permitted', forbidden: 'Forbidden', dispute: 'Dispute', depends: 'Depends' },
    consensusLevel: { unanimous: 'Unanimous', strong: 'Strong', majority: 'Majority', moderate: 'Moderate', split: 'Split', weak: 'Weak', dispute: 'Dispute', none: 'No consensus' },
  },
  he: {
    title: 'שאל את הפוסקים',
    close: 'סגור',
    consulting: 'הפוסקים מעיינים…',
    sources: 'מקורות',
    synthesis: 'סיכום',
    consensus: 'הסכמה',
    continueOn: 'המשך ב-tzadek.ai',
    askAnother: 'שאלה נוספת',
    placeholder: 'שאל את הפוסקים…',
    send: 'שאל',
    retry: 'נסה שוב',
    errorTitle: 'הפוסקים לא הצליחו לענות',
    poweredBy: 'התשובות מגיעות מ-tzadek.ai ונוצרות בבינה מלאכותית; להלכה למעשה יש לשאול רב.',
    unavailable: {
      nopasscode: 'מענה חי אינו זמין בגרסה זו. שאלו באתר tzadek.ai.',
      auth: 'קוד האורח לא התקבל. שאלו באתר tzadek.ai.',
      forbidden: 'קוד האורח לא התקבל. שאלו באתר tzadek.ai.',
      limit: 'תקציב השאלות המשותף לחודש זה נוצל. שאלו באתר tzadek.ai.',
      budget: 'תקציב השאלות המשותף נוצל לעת עתה. שאלו באתר tzadek.ai.',
      rate: 'יותר מדי שאלות כרגע. המתינו דקה או שאלו באתר tzadek.ai.',
      network: 'לא ניתן להתחבר ל-tzadek.ai. שאלו שם ישירות.',
      http: 'tzadek.ai לא הצליח לענות כעת. שאלו שם ישירות.',
      unsupported: 'הדפדפן אינו תומך בהזרמת תשובות. שאלו באתר tzadek.ai.',
    },
    psak: { permitted: 'מותר', forbidden: 'אסור', dispute: 'מחלוקת', depends: 'תלוי' },
    consensusLevel: { unanimous: 'פה אחד', strong: 'חזקה', majority: 'רוב', moderate: 'בינונית', split: 'חלוקה', weak: 'חלשה', dispute: 'מחלוקת', none: 'אין הסכמה' },
  },
};

const CONSENSUS_TONE = {
  unanimous: 'good',
  strong: 'good',
  majority: 'mid',
  moderate: 'mid',
  split: 'warn',
  weak: 'warn',
  dispute: 'warn',
  none: 'warn',
};

const initialState = () => ({
  status: 'idle', // idle | loading | streaming | complete | unavailable | error
  rabbis: [], // in rabbi_start order: {key, name, nameEn, era, emoji, text, sources, done, psak}
  synthesis: null, // {consensus, type, text, done}
  unavailable: null, // {unavailable, message}
  error: null, // message
});

function updateRabbi(state, key, fn) {
  const i = state.rabbis.findIndex((r) => r.key === key);
  if (i < 0) return state;
  const rabbis = state.rabbis.slice();
  rabbis[i] = fn(rabbis[i]);
  return { ...state, rabbis };
}

function reducer(state, a) {
  switch (a.type) {
    case 'reset':
      return { ...initialState(), status: 'loading' };
    case 'unavailable':
      return { ...initialState(), status: 'unavailable', unavailable: a.info };
    case 'rabbi_start':
      if (state.rabbis.some((r) => r.key === a.rabbi.key)) return state;
      return {
        ...state,
        status: 'streaming',
        rabbis: [...state.rabbis, { ...a.rabbi, text: '', sources: [], done: false, psak: null }],
      };
    case 'rabbi_chunk':
      return updateRabbi(state, a.rabbiKey, (r) => (r.done ? r : { ...r, text: r.text + a.text }));
    case 'sources':
      return updateRabbi(state, a.rabbiKey, (r) => (r.done ? r : { ...r, sources: (a.refs ?? []).map((ref) => ({ ref })) }));
    case 'rabbi_complete': {
      const answer = typeof a.answer === 'string' && a.answer ? a.answer : null;
      return updateRabbi(state, a.rabbiKey, (r) => {
        const text = answer ?? r.text;
        const psak = parsePsak(text);
        return {
          ...r,
          text: psak ? psak.body : text,
          psak,
          sources: Array.isArray(a.sources) && a.sources.length ? a.sources : r.sources,
          done: true,
        };
      });
    }
    case 'synthesis_start':
      return { ...state, status: 'streaming', synthesis: { consensus: a.consensus ?? null, type: a.synthesisType ?? null, text: '', done: false } };
    case 'synthesis_chunk':
      return state.synthesis && !state.synthesis.done ? { ...state, synthesis: { ...state.synthesis, text: state.synthesis.text + a.text } } : state;
    case 'synthesis_complete': {
      const text = typeof a.synthesis === 'string' && a.synthesis ? a.synthesis : state.synthesis?.text ?? '';
      const psak = parsePsak(text);
      return { ...state, synthesis: { ...(state.synthesis ?? {}), text: psak ? psak.body : text, psak, type: a.synthesisType ?? state.synthesis?.type ?? null, done: true } };
    }
    case 'complete':
      return {
        ...state,
        status: 'complete',
        rabbis: state.rabbis.map((r) => (r.done ? r : { ...r, done: true, psak: parsePsak(r.text), text: parsePsak(r.text)?.body ?? r.text })),
        synthesis: state.synthesis ? { ...state.synthesis, done: true } : null,
      };
    case 'error':
      return { ...state, status: 'error', error: a.message };
    default:
      return state;
  }
}

/** Strip a trailing, still-arriving "Psak:" line so it does not flash before the pill appears. */
const hideTrailingPsak = (text) => text.replace(/\n[ \t]*\**(?:Psak|פסק)\**[^\n]*$/i, '');

/** Paragraphs, single line breaks and **bold**; nothing else from the answer's markdown. */
function Rich({ text }) {
  const paras = String(text ?? '').split(/\n{2,}/).filter((p) => p.trim());
  return paras.map((p, i) => (
    <p key={i}>
      {p.split(/(\*\*[^*]+\*\*)/).map((seg, j) => {
        if (seg.startsWith('**') && seg.endsWith('**')) return <strong key={j}>{seg.slice(2, -2)}</strong>;
        return seg.split('\n').map((line, k, arr) => (
          <span key={`${j}-${k}`}>
            {line}
            {k < arr.length - 1 && <br />}
          </span>
        ));
      })}
    </p>
  ));
}

function Skeleton({ lines = 3 }) {
  return (
    <div className="ask-skeleton" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}

function PsakPill({ psak, t }) {
  if (!psak) return null;
  const label = t.psak[psak.verdict] ?? psak.label;
  return (
    <span className={`psak-pill psak-${psak.verdict}`} title={psak.label}>
      {label}
    </span>
  );
}

function Sources({ sources, lang, t }) {
  if (!sources?.length) return null;
  return (
    <div className="ask-sources" dir="ltr">
      <span className="ask-sources-label">{t.sources}</span>
      {sources.map((s, i) => {
        const href = sourceUrl(s);
        const label = lang === 'he' && s.heRef ? s.heRef : s.ref ?? s.work ?? '';
        if (!href) return null;
        return (
          <a className="source-chip" key={`${s.ref ?? i}-${i}`} href={href} target="_blank" rel="noopener noreferrer" lang={lang === 'he' && s.heRef ? 'he' : 'en'} title={s.work ?? s.ref}>
            {label}
          </a>
        );
      })}
    </div>
  );
}

function RabbiCard({ r, lang, t }) {
  const name = lang === 'he' ? r.name ?? r.nameEn : r.nameEn ?? r.name;
  const shown = r.done ? r.text : hideTrailingPsak(r.text);
  const rtl = lang === 'he' || isHebrew(shown);
  return (
    <article className={`ask-rabbi${r.done ? ' done' : ''}`}>
      <header className="ask-rabbi-head">
        <span className="ask-rabbi-emoji" aria-hidden="true">{r.emoji ?? '📜'}</span>
        <div className="ask-rabbi-titles">
          <div className="ask-rabbi-name" lang={lang === 'he' && r.name ? 'he' : 'en'} dir={lang === 'he' && r.name ? 'rtl' : 'ltr'}>{name ?? r.key}</div>
          {r.era && <div className="ask-rabbi-era" lang="en" dir="ltr">{r.era}</div>}
        </div>
        <PsakPill psak={r.psak} t={t} />
      </header>
      <div className={`ask-text${r.done ? '' : ' streaming'}`} lang={rtl ? 'he' : 'en'} dir={rtl ? 'rtl' : 'ltr'}>
        {shown ? <Rich text={shown} /> : <Skeleton lines={3} />}
      </div>
      <Sources sources={r.sources} lang={lang} t={t} />
    </article>
  );
}

function SynthesisBlock({ s, lang, t }) {
  if (!s) return null;
  const level = s.consensus?.level ? String(s.consensus.level).toLowerCase() : null;
  const tone = level ? CONSENSUS_TONE[level] ?? 'mid' : null;
  const shown = s.done ? s.text : hideTrailingPsak(s.text);
  const rtl = lang === 'he' || isHebrew(shown);
  return (
    <section className="ask-synthesis">
      <header className="ask-rabbi-head">
        <span className="ask-rabbi-emoji" aria-hidden="true">⚖️</span>
        <div className="ask-rabbi-titles">
          <div className="ask-rabbi-name">{t.synthesis}</div>
        </div>
        {level && (
          <span className={`consensus-pill consensus-${tone}`} title={`${t.consensus}: ${level}`}>
            {t.consensus}: {t.consensusLevel[level] ?? level}
          </span>
        )}
        <PsakPill psak={s.psak} t={t} />
      </header>
      <div className={`ask-text${s.done ? '' : ' streaming'}`} lang={rtl ? 'he' : 'en'} dir={rtl ? 'rtl' : 'ltr'}>
        {shown ? <Rich text={shown} /> : <Skeleton lines={2} />}
      </div>
    </section>
  );
}

/**
 * Streams a question to the tzadek.ai poskim. Opens from a hotspot-card question or the
 * free-text box at its foot (`store.askOpen`, `store.askQuestion`, `store.askSeq`). One
 * stream at a time; the language follows `store.lang` at the moment of asking. Opening
 * releases the pointer so the panel can be read and clicked; Escape closes it (captured
 * before the card's own Escape handler so the card stays open underneath).
 */
export function AskPanel() {
  const open = useStore((s) => s.askOpen);
  const question = useStore((s) => s.askQuestion);
  const seq = useStore((s) => s.askSeq);
  const lang = useStore((s) => s.lang);
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [draft, setDraft] = useState('');
  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const stickRef = useRef(true);
  const streamRef = useRef(null);
  const t = UI[lang] ?? UI.en;

  // Start (or restart) the stream whenever a question is asked.
  useEffect(() => {
    if (!open || !question) return;
    if (!isAskAvailable()) {
      dispatch({ type: 'unavailable', info: { unavailable: 'nopasscode' } });
      return;
    }
    dispatch({ type: 'reset' });
    stickRef.current = true;
    const language = store.getState().lang;
    const s = askStream(
      { question, language, quick: true },
      {
        onUnavailable: (info) => dispatch({ type: 'unavailable', info }),
        onRabbiStart: (rabbi) => dispatch({ type: 'rabbi_start', rabbi }),
        onRabbiChunk: ({ rabbiKey, text }) => dispatch({ type: 'rabbi_chunk', rabbiKey, text }),
        onSources: ({ rabbiKey, refs }) => dispatch({ type: 'sources', rabbiKey, refs }),
        onRabbiComplete: (evt) => dispatch({ type: 'rabbi_complete', ...evt }),
        onSynthesisStart: (evt) => dispatch({ type: 'synthesis_start', ...evt }),
        onSynthesisChunk: ({ text }) => dispatch({ type: 'synthesis_chunk', text }),
        onSynthesisComplete: (evt) => dispatch({ type: 'synthesis_complete', ...evt }),
        onComplete: () => dispatch({ type: 'complete' }),
        onError: ({ message }) => dispatch({ type: 'error', message }),
      }
    );
    streamRef.current = s;
    return () => {
      s.close();
      if (streamRef.current === s) streamRef.current = null;
    };
  }, [open, question, seq]);

  // Pointer, focus and Escape while open.
  useEffect(() => {
    if (!open) return;
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {
        /* not locked */
      }
    }
    const panel = panelRef.current;
    const prev = document.activeElement;
    const canvasHost = panel?.closest('.game-container') ?? null;
    panel?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation(); // the hotspot card listens on document too; keep it open
      closeAsk();
    };
    document.addEventListener('keydown', onKey, true);
    // The game container locks the pointer on any native click; clicks inside the panel
    // (input, links, buttons) must not. React's stopPropagation runs too late for that.
    const swallowClick = (e) => e.stopPropagation();
    panel?.addEventListener('click', swallowClick);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      panel?.removeEventListener('click', swallowClick);
      const target = prev && prev.isConnected && prev !== document.body && !panel?.contains(prev) ? prev : canvasHost;
      if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });
    };
  }, [open]);

  // Keep the newest text in view while streaming unless the visitor scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickRef.current) return;
    if (state.status === 'loading' || state.status === 'streaming') el.scrollTop = el.scrollHeight;
  }, [state]);

  if (!open) return null;

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  // Keys typed in the box must not reach the game's WASD/Space handlers on `document`.
  const swallow = (e) => e.stopPropagation();
  const submit = (e) => {
    e.preventDefault();
    const q = draft.trim();
    if (!q) return;
    setDraft('');
    openAsk(q);
  };

  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const qRtl = lang === 'he' || isHebrew(question);
  const busy = state.status === 'loading' || state.status === 'streaming';
  const unavailableMsg = state.unavailable ? t.unavailable[state.unavailable.unavailable] ?? t.unavailable.http : null;

  return (
    <aside
      className={`panel ask-panel ask-${state.status}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="ask-panel-title"
      aria-busy={busy}
      tabIndex={-1}
      ref={panelRef}
      lang={lang}
      dir={dir}
    >
      <div className="card-toolbar" dir="ltr">
        <span className="ask-title" id="ask-panel-title" lang={lang} dir={dir}>{t.title}</span>
        <button type="button" className="card-close" aria-label={t.close} title={t.close} onClick={closeAsk}>
          ×
        </button>
      </div>

      <div className="ask-scroll" ref={scrollRef} onScroll={onScroll}>
        <blockquote className="ask-question" lang={qRtl ? 'he' : 'en'} dir={qRtl ? 'rtl' : 'ltr'}>
          {question}
        </blockquote>

        {state.status === 'unavailable' && (
          <div className="ask-notice ask-unavailable" role="status">
            <p>{unavailableMsg}</p>
            {state.unavailable?.message && state.unavailable.unavailable !== 'nopasscode' && (
              <p className="ask-notice-detail" lang="en" dir="ltr">{state.unavailable.message}</p>
            )}
            <a className="ask-continue" href={tzadekUrl(question)} target="_blank" rel="noopener noreferrer">
              {t.continueOn} <span aria-hidden="true">↗</span>
            </a>
          </div>
        )}

        {state.status === 'error' && (
          <div className="ask-notice ask-error" role="alert">
            <p><strong>{t.errorTitle}</strong></p>
            {state.error && <p className="ask-notice-detail" lang="en" dir="ltr">{state.error}</p>}
            <div className="ask-notice-actions">
              <button type="button" className="ask-retry" onClick={() => openAsk(question)}>{t.retry}</button>
              <a className="ask-continue" href={tzadekUrl(question)} target="_blank" rel="noopener noreferrer">
                {t.continueOn} <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        )}

        {state.status === 'loading' && (
          <div className="ask-loading" role="status">
            <div className="ask-consulting">{t.consulting}</div>
            {[0, 1, 2].map((i) => (
              <article className="ask-rabbi ask-rabbi-placeholder" key={i} aria-hidden="true">
                <Skeleton lines={3} />
              </article>
            ))}
          </div>
        )}

        {state.rabbis.map((r) => (
          <RabbiCard r={r} lang={lang} t={t} key={r.key} />
        ))}

        {(state.status === 'streaming' || state.status === 'complete' || state.status === 'error') && (
          <SynthesisBlock s={state.synthesis} lang={lang} t={t} />
        )}

        {state.status !== 'unavailable' && state.status !== 'error' && (
          <div className="ask-footer-links">
            <a className="ask-continue" href={tzadekUrl(question)} target="_blank" rel="noopener noreferrer">
              {t.continueOn} <span aria-hidden="true">↗</span>
            </a>
          </div>
        )}
      </div>

      <form className="ask-form" onSubmit={submit}>
        <label className="ask-form-label" htmlFor="ask-input">{t.askAnother}</label>
        <div className="ask-form-row">
          <input
            id="ask-input"
            type="text"
            className="ask-input"
            value={draft}
            placeholder={t.placeholder}
            autoComplete="off"
            maxLength={500}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={swallow}
            onKeyUp={swallow}
            dir={isHebrew(draft) ? 'rtl' : dir}
          />
          <button type="submit" className="ask-send" disabled={!draft.trim()}>{t.send}</button>
        </div>
        <p className="ask-powered">{t.poweredBy}</p>
      </form>
    </aside>
  );
}
