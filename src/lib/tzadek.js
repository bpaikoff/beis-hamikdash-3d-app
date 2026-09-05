/**
 * Client for the tzadek.ai streaming "Ask the poskim" API. Framework-free so it can be unit
 * tested with a mocked `fetch` and a fake `EventSource`.
 *
 * Flow: POST /api/auth/stream-token with the guest passcode (X-Passcode header) -> a
 * single-use token (2 min TTL) -> EventSource /api/ask/stream?token=&question=&language=.
 * Budget and rate-limit errors surface on the token POST (401/403/429 JSON), not on the
 * stream; the stream ends with a `complete` event and the browser then fires `onerror` as it
 * tries to reconnect, which is why `complete` closes the source.
 *
 * Only one stream runs at a time: a second `askStream` call closes the first (its handlers
 * go quiet). Ninety seconds without an event is treated as a dead connection.
 */

export const IDLE_TIMEOUT_MS = 90_000;

/** Rabbis served in quick mode (three eras); omit `quickMode` for all five. */
export const QUICK_RABBIS = ['geonim', 'shulchanAruch', 'contemporary'];

export const env = () => import.meta.env ?? {};

export const baseUrl = () => String(env().VITE_TZADEK_BASE ?? 'https://tzadek.ai').replace(/\/+$/, '');

export const guestPasscode = () => {
  const p = env().VITE_TZADEK_GUEST_PASSCODE;
  return typeof p === 'string' && p.trim() ? p.trim() : null;
};

/** True when a guest passcode was baked into the build; otherwise the HUD only links out. */
export function isAskAvailable() {
  return guestPasscode() !== null;
}

/**
 * The Psak line tzadek.ai appends to halachic answers:
 *   "Psak: permitted|forbidden|dispute|depends" / "פסק: מותר|אסור|מחלוקת|תלוי".
 * Returns `{verdict, label, body}` where `body` is the text without that line, or null.
 */
const PSAK_RE = /^[ \t]*\**(?:Psak|פסק)\**[ \t]*[:：][ \t]*\**([^\n*]+?)\**[ \t]*$/im;
const VERDICTS = [
  ['permitted', /^(permitted|allowed|מותר)/i],
  ['forbidden', /^(forbidden|prohibited|אסור)/i],
  ['dispute', /^(dispute|disputed|מחלוקת)/i],
  ['depends', /^(depends|it depends|תלוי)/i],
];

export function parsePsak(text) {
  if (!text) return null;
  const m = PSAK_RE.exec(text);
  if (!m) return null;
  const label = m[1].trim();
  let verdict = 'depends';
  for (const [v, re] of VERDICTS) {
    if (re.test(label)) {
      verdict = v;
      break;
    }
  }
  const body = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).replace(/\s+$/, '');
  return { verdict, label, body };
}

/** True when the text is mostly Hebrew (drives dir="rtl" in the HUD). */
export function isHebrew(text) {
  if (!text) return false;
  const he = (text.match(/[\u0590-\u05FF]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return he > 0 && he >= latin;
}

const call = (handlers, name, ...args) => {
  const fn = handlers?.[name];
  if (typeof fn === 'function') fn(...args);
};

let current = null;

/** Map a failed token request to an `unavailable` reason the panel can explain. */
export function unavailableFromResponse(status, body) {
  const message = body?.error;
  if (status === 401) return { unavailable: 'auth', message: message ?? 'The guest passcode was rejected.' };
  if (status === 403) return { unavailable: 'forbidden', message: message ?? 'This passcode cannot ask questions.' };
  if (status === 429) {
    if (body?.budgetExceeded) return { unavailable: 'budget', message: message ?? 'The shared budget is exhausted.', ...body };
    if (body?.tokenLimit != null) return { unavailable: 'limit', message: message ?? 'Monthly limit reached.', ...body };
    return { unavailable: 'rate', message: message ?? 'Too many questions, please slow down.' };
  }
  return { unavailable: 'http', status, message: message ?? `tzadek.ai answered ${status}` };
}

/**
 * Ask the poskim. `handlers`: onUnavailable, onStart, onClassified, onRabbiStart,
 * onRabbiChunk, onRabbiComplete, onSources, onSynthesisStart, onSynthesisChunk,
 * onSynthesisComplete, onComplete, onError. Returns `{close}`.
 *
 * `opts` (tests): `fetch`, `EventSource`, `passcode`, `base`, `idleMs`.
 */
export function askStream({ question, language = 'en', quick = true }, handlers = {}, opts = {}) {
  if (current) current.close();

  const fetchFn = opts.fetch ?? globalThis.fetch;
  const ES = opts.EventSource ?? globalThis.EventSource;
  const passcode = opts.passcode ?? guestPasscode();
  const base = opts.base ?? baseUrl();
  const idleMs = opts.idleMs ?? IDLE_TIMEOUT_MS;

  let closed = false;
  let done = false;
  let es = null;
  let timer = null;
  const abort = typeof AbortController === 'function' ? new AbortController() : null;

  const clearIdle = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const close = () => {
    if (closed) return;
    closed = true;
    clearIdle();
    abort?.abort();
    if (es) {
      try {
        es.close();
      } catch {
        /* already closed */
      }
      es = null;
    }
    if (current === handle) current = null;
  };
  const handle = { close };
  current = handle;

  const fail = (message) => {
    if (closed || done) return;
    done = true;
    close();
    call(handlers, 'onError', { message });
  };
  const armIdle = () => {
    clearIdle();
    if (idleMs > 0) timer = setTimeout(() => fail('No answer arrived for 90 seconds; the connection was dropped.'), idleMs);
  };

  const q = String(question ?? '').trim();
  if (!q) {
    queueMicrotask(() => fail('Empty question.'));
    return handle;
  }
  if (!passcode) {
    queueMicrotask(() => {
      if (closed) return;
      done = true;
      close();
      call(handlers, 'onUnavailable', { unavailable: 'nopasscode', message: 'Live answers are not configured in this build.' });
    });
    return handle;
  }
  if (typeof fetchFn !== 'function' || typeof ES !== 'function') {
    queueMicrotask(() => {
      if (closed) return;
      done = true;
      close();
      call(handlers, 'onUnavailable', { unavailable: 'unsupported', message: 'This browser cannot stream answers.' });
    });
    return handle;
  }

  const dispatch = (evt) => {
    switch (evt.type) {
      case 'start':
        call(handlers, 'onStart', evt);
        break;
      case 'classified':
        call(handlers, 'onClassified', evt);
        break;
      case 'rabbi_start':
        call(handlers, 'onRabbiStart', evt.rabbi ?? {});
        break;
      case 'tool_call':
        if (evt.tool === 'sources_found') call(handlers, 'onSources', { rabbiKey: evt.rabbiKey, ...(evt.input ?? {}) });
        break;
      case 'rabbi_chunk':
        call(handlers, 'onRabbiChunk', { rabbiKey: evt.rabbiKey, text: evt.text ?? '' });
        break;
      case 'rabbi_complete':
        call(handlers, 'onRabbiComplete', evt);
        break;
      case 'synthesis_start':
        call(handlers, 'onSynthesisStart', evt);
        break;
      case 'synthesis_chunk':
        call(handlers, 'onSynthesisChunk', { text: evt.text ?? '' });
        break;
      case 'synthesis_complete':
        call(handlers, 'onSynthesisComplete', evt);
        break;
      case 'complete':
        done = true;
        close();
        call(handlers, 'onComplete', evt);
        break;
      case 'error':
        fail(evt.message ?? 'The poskim could not answer.');
        break;
      default:
        break; // other tool calls, keep-alives
    }
  };

  const open = (token) => {
    if (closed) return;
    const params = new URLSearchParams({ token, question: q, language: language === 'he' ? 'he' : 'en' });
    if (quick) params.set('quickMode', 'true');
    es = new ES(`${base}/api/ask/stream?${params.toString()}`);
    armIdle();
    es.onmessage = (e) => {
      if (closed) return;
      armIdle();
      let evt;
      try {
        evt = JSON.parse(e.data);
      } catch {
        return; // keep-alive or malformed line
      }
      if (evt && typeof evt === 'object') dispatch(evt);
    };
    es.onerror = () => {
      if (closed || done) return; // the reconnect attempt after `complete` is normal
      fail('The connection to tzadek.ai was lost.');
    };
  };

  (async () => {
    let res;
    try {
      res = await fetchFn(`${base}/api/auth/stream-token`, {
        method: 'POST',
        headers: { 'X-Passcode': passcode, 'Content-Type': 'application/json' },
        body: '{}',
        signal: abort?.signal,
      });
    } catch (e) {
      if (closed) return;
      done = true;
      close();
      call(handlers, 'onUnavailable', { unavailable: 'network', message: e?.message ?? 'tzadek.ai is unreachable.' });
      return;
    }
    if (closed) return;
    const body = await res.json().catch(() => null);
    if (closed) return;
    if (!res.ok || !body?.token) {
      done = true;
      close();
      call(handlers, 'onUnavailable', res.ok ? { unavailable: 'http', status: res.status, message: 'No token in the reply.' } : unavailableFromResponse(res.status, body));
      return;
    }
    open(body.token);
  })().catch((e) => fail(e?.message ?? 'Unexpected failure.'));

  return handle;
}

/** For tests and the panel's cleanup: close whatever stream is running. */
export function closeCurrentStream() {
  current?.close();
}
