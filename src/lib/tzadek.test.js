import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { askStream, closeCurrentStream, isAskAvailable, parsePsak, isHebrew, unavailableFromResponse, guestPasscode } from './tzadek.js';

/** Minimal EventSource stand-in: the test pushes events with `emit`. */
class FakeEventSource {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.closed = false;
    this.onmessage = null;
    this.onerror = null;
    FakeEventSource.instances.push(this);
  }
  emit(obj) {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }
  raw(data) {
    this.onmessage?.({ data });
  }
  fail() {
    this.onerror?.(new Event('error'));
  }
  close() {
    this.closed = true;
  }
}

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const tokenOk = () => vi.fn(async () => jsonResponse(200, { token: 'tok-1', expiresIn: 120 }));

const flush = () => new Promise((r) => setTimeout(r, 0));

const handlerSet = () => ({
  onUnavailable: vi.fn(),
  onStart: vi.fn(),
  onClassified: vi.fn(),
  onRabbiStart: vi.fn(),
  onRabbiChunk: vi.fn(),
  onRabbiComplete: vi.fn(),
  onSources: vi.fn(),
  onSynthesisStart: vi.fn(),
  onSynthesisChunk: vi.fn(),
  onSynthesisComplete: vi.fn(),
  onComplete: vi.fn(),
  onError: vi.fn(),
});

const opts = (extra = {}) => ({ passcode: 'GUEST', base: 'https://tz.test', EventSource: FakeEventSource, ...extra });

beforeEach(() => {
  FakeEventSource.instances = [];
});
afterEach(() => {
  closeCurrentStream();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('isAskAvailable', () => {
  it('follows VITE_TZADEK_GUEST_PASSCODE', () => {
    vi.stubEnv('VITE_TZADEK_GUEST_PASSCODE', '');
    expect(isAskAvailable()).toBe(false);
    expect(guestPasscode()).toBe(null);
    vi.stubEnv('VITE_TZADEK_GUEST_PASSCODE', ' MK-1 ');
    expect(isAskAvailable()).toBe(true);
    expect(guestPasscode()).toBe('MK-1');
  });
});

describe('askStream', () => {
  it('fetches a token, opens the stream and dispatches a full event sequence', async () => {
    const fetch = tokenOk();
    const h = handlerSet();
    const s = askStream({ question: 'Why a ramp?', language: 'he', quick: true }, h, opts({ fetch }));
    await flush();

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://tz.test/api/auth/stream-token');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Passcode']).toBe('GUEST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{}');
    expect(init.credentials).toBeUndefined();

    expect(FakeEventSource.instances).toHaveLength(1);
    const es = FakeEventSource.instances[0];
    const u = new URL(es.url);
    expect(u.origin + u.pathname).toBe('https://tz.test/api/ask/stream');
    expect(u.searchParams.get('token')).toBe('tok-1');
    expect(u.searchParams.get('question')).toBe('Why a ramp?');
    expect(u.searchParams.get('language')).toBe('he');
    expect(u.searchParams.get('quickMode')).toBe('true');

    es.emit({ type: 'start', rabbis: ['geonim'], backend: 'x', quickMode: true });
    es.emit({ type: 'classified', mode: 'halachic', queryType: 'q', halachicArea: 'kodashim' });
    es.emit({ type: 'rabbi_start', rabbi: { key: 'geonim', name: 'גאונים', nameEn: 'Geonim', era: '600-1000', emoji: '📜' } });
    es.emit({ type: 'tool_call', rabbiKey: 'geonim', tool: 'search', input: { q: 'x' } });
    es.emit({ type: 'tool_call', rabbiKey: 'geonim', tool: 'sources_found', input: { count: 2, refs: ['Zevachim 62b', 'Middot 3:3'] } });
    es.raw(': keep-alive');
    es.emit({ type: 'rabbi_chunk', rabbiKey: 'geonim', text: 'Because ' });
    es.emit({ type: 'rabbi_chunk', rabbiKey: 'geonim', text: 'of the steps.\nPsak: permitted' });
    es.emit({
      type: 'rabbi_complete',
      rabbiKey: 'geonim',
      answer: 'Because of the steps.\nPsak: permitted',
      sources: [{ ref: 'Zevachim 62b', heRef: 'זבחים סב ב', work: 'Talmud', url: 'https://www.sefaria.org/Zevachim.62b' }],
      mode: 'halachic',
      isHalachic: true,
    });
    es.emit({ type: 'synthesis_start', consensus: { level: 'unanimous' }, synthesisType: 'psak' });
    es.emit({ type: 'synthesis_chunk', text: 'All agree.' });
    es.emit({ type: 'synthesis_complete', synthesis: 'All agree.', synthesisType: 'psak' });
    es.emit({ type: 'complete' });
    es.fail(); // the browser's reconnect attempt after `complete`

    expect(h.onStart).toHaveBeenCalledWith(expect.objectContaining({ quickMode: true }));
    expect(h.onClassified).toHaveBeenCalledWith(expect.objectContaining({ mode: 'halachic' }));
    expect(h.onRabbiStart).toHaveBeenCalledWith(expect.objectContaining({ key: 'geonim', nameEn: 'Geonim' }));
    expect(h.onSources).toHaveBeenCalledTimes(1);
    expect(h.onSources).toHaveBeenCalledWith({ rabbiKey: 'geonim', count: 2, refs: ['Zevachim 62b', 'Middot 3:3'] });
    expect(h.onRabbiChunk.mock.calls.map((c) => c[0].text).join('')).toBe('Because of the steps.\nPsak: permitted');
    expect(h.onRabbiComplete).toHaveBeenCalledWith(expect.objectContaining({ rabbiKey: 'geonim', isHalachic: true }));
    expect(h.onSynthesisStart).toHaveBeenCalledWith(expect.objectContaining({ consensus: { level: 'unanimous' } }));
    expect(h.onSynthesisChunk).toHaveBeenCalledWith({ text: 'All agree.' });
    expect(h.onSynthesisComplete).toHaveBeenCalledWith(expect.objectContaining({ synthesis: 'All agree.' }));
    expect(h.onComplete).toHaveBeenCalledTimes(1);
    expect(h.onError).not.toHaveBeenCalled();
    expect(h.onUnavailable).not.toHaveBeenCalled();
    expect(es.closed).toBe(true); // closed on `complete`, before the reconnect error
    s.close(); // idempotent
  });

  it('omits quickMode when quick is false and defaults language to en', async () => {
    askStream({ question: 'q', language: 'fr', quick: false }, handlerSet(), opts({ fetch: tokenOk() }));
    await flush();
    const u = new URL(FakeEventSource.instances[0].url);
    expect(u.searchParams.has('quickMode')).toBe(false);
    expect(u.searchParams.get('language')).toBe('en');
  });

  it('maps a 429 token reply to unavailable without opening a stream', async () => {
    const fetch = vi.fn(async () => jsonResponse(429, { error: 'Monthly token limit exceeded', tokensUsed: 2000100, tokenLimit: 2000000 }));
    const h = handlerSet();
    askStream({ question: 'q' }, h, opts({ fetch }));
    await flush();
    expect(h.onUnavailable).toHaveBeenCalledTimes(1);
    expect(h.onUnavailable.mock.calls[0][0]).toMatchObject({ unavailable: 'limit', message: 'Monthly token limit exceeded', tokenLimit: 2000000 });
    expect(FakeEventSource.instances).toHaveLength(0);
    expect(h.onError).not.toHaveBeenCalled();
    expect(h.onComplete).not.toHaveBeenCalled();
  });

  it('maps 401, 403, the other 429 shapes and other statuses', () => {
    expect(unavailableFromResponse(401, { error: 'Invalid passcode', needsAuth: true }).unavailable).toBe('auth');
    expect(unavailableFromResponse(403, { error: 'This passcode can only ask questions' }).unavailable).toBe('forbidden');
    expect(unavailableFromResponse(429, { error: 'Too many questions, please slow down.' }).unavailable).toBe('rate');
    expect(unavailableFromResponse(429, { error: 'Budget gone', budgetExceeded: true }).unavailable).toBe('budget');
    expect(unavailableFromResponse(503, null)).toMatchObject({ unavailable: 'http', status: 503 });
  });

  it('reports a network failure on the token request as unavailable', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const h = handlerSet();
    askStream({ question: 'q' }, h, opts({ fetch }));
    await flush();
    expect(h.onUnavailable).toHaveBeenCalledWith(expect.objectContaining({ unavailable: 'network', message: 'Failed to fetch' }));
  });

  it('reports the missing passcode without touching the network', async () => {
    const fetch = tokenOk();
    const h = handlerSet();
    askStream({ question: 'q' }, h, opts({ fetch, passcode: null }));
    await flush();
    expect(fetch).not.toHaveBeenCalled();
    expect(h.onUnavailable).toHaveBeenCalledWith(expect.objectContaining({ unavailable: 'nopasscode' }));
  });

  it('turns an error event into onError and closes the source', async () => {
    const h = handlerSet();
    askStream({ question: 'q' }, h, opts({ fetch: tokenOk() }));
    await flush();
    const es = FakeEventSource.instances[0];
    es.emit({ type: 'rabbi_start', rabbi: { key: 'geonim' } });
    es.emit({ type: 'error', message: 'Backend down' });
    es.emit({ type: 'rabbi_chunk', rabbiKey: 'geonim', text: 'late' });
    expect(h.onError).toHaveBeenCalledTimes(1);
    expect(h.onError).toHaveBeenCalledWith({ message: 'Backend down' });
    expect(h.onRabbiChunk).not.toHaveBeenCalled();
    expect(es.closed).toBe(true);
  });

  it('treats a transport error before complete as an error', async () => {
    const h = handlerSet();
    askStream({ question: 'q' }, h, opts({ fetch: tokenOk() }));
    await flush();
    FakeEventSource.instances[0].fail();
    expect(h.onError).toHaveBeenCalledTimes(1);
    expect(h.onComplete).not.toHaveBeenCalled();
  });

  it('close() silences the handlers and closes the source; a token that arrives later is ignored', async () => {
    let resolveToken;
    const fetch = vi.fn(() => new Promise((r) => (resolveToken = r)));
    const h = handlerSet();
    const s = askStream({ question: 'q' }, h, opts({ fetch }));
    await flush();
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(false);
    s.close();
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
    resolveToken(jsonResponse(200, { token: 'late' }));
    await flush();
    expect(FakeEventSource.instances).toHaveLength(0);

    const h2 = handlerSet();
    const s2 = askStream({ question: 'q2' }, h2, opts({ fetch: tokenOk() }));
    await flush();
    const es = FakeEventSource.instances[0];
    s2.close();
    expect(es.closed).toBe(true);
    es.emit({ type: 'rabbi_start', rabbi: { key: 'geonim' } });
    es.emit({ type: 'complete' });
    expect(h2.onRabbiStart).not.toHaveBeenCalled();
    expect(h2.onComplete).not.toHaveBeenCalled();
  });

  it('runs one stream at a time: a second call closes the first', async () => {
    const h1 = handlerSet();
    askStream({ question: 'first' }, h1, opts({ fetch: tokenOk() }));
    await flush();
    const es1 = FakeEventSource.instances[0];
    const h2 = handlerSet();
    askStream({ question: 'second' }, h2, opts({ fetch: tokenOk() }));
    await flush();
    expect(es1.closed).toBe(true);
    es1.emit({ type: 'complete' });
    expect(h1.onComplete).not.toHaveBeenCalled();
    const es2 = FakeEventSource.instances[1];
    es2.emit({ type: 'complete' });
    expect(h2.onComplete).toHaveBeenCalledTimes(1);
  });

  it('drops a stream that goes quiet for the idle timeout', async () => {
    vi.useFakeTimers();
    const h = handlerSet();
    askStream({ question: 'q' }, h, opts({ fetch: tokenOk(), idleMs: 1000 }));
    await vi.advanceTimersByTimeAsync(0);
    const es = FakeEventSource.instances[0];
    await vi.advanceTimersByTimeAsync(800);
    es.emit({ type: 'rabbi_chunk', rabbiKey: 'geonim', text: 'a' }); // resets the timer
    await vi.advanceTimersByTimeAsync(800);
    expect(h.onError).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(h.onError).toHaveBeenCalledTimes(1);
    expect(h.onError.mock.calls[0][0].message).toMatch(/90 seconds/);
    expect(es.closed).toBe(true);
  });

  it('rejects an empty question', async () => {
    const fetch = tokenOk();
    const h = handlerSet();
    askStream({ question: '   ' }, h, opts({ fetch }));
    await flush();
    expect(fetch).not.toHaveBeenCalled();
    expect(h.onError).toHaveBeenCalledWith({ message: 'Empty question.' });
  });
});

describe('parsePsak', () => {
  it('extracts the English and Hebrew verdict lines', () => {
    expect(parsePsak('Body text.\n\nPsak: permitted')).toEqual({ verdict: 'permitted', label: 'permitted', body: 'Body text.' });
    expect(parsePsak('גוף.\nפסק: אסור')).toEqual({ verdict: 'forbidden', label: 'אסור', body: 'גוף.' });
    expect(parsePsak('x\n**Psak:** dispute\n')).toMatchObject({ verdict: 'dispute', body: 'x' });
    expect(parsePsak('x\nפסק: תלוי בנסיבות')).toMatchObject({ verdict: 'depends', label: 'תלוי בנסיבות' });
    expect(parsePsak('x\nPsak: Forbidden (mid-de-rabbanan)')).toMatchObject({ verdict: 'forbidden' });
  });
  it('returns null when there is no psak line', () => {
    expect(parsePsak('The psak: nothing here on one line is not a marker')).toBe(null);
    expect(parsePsak('')).toBe(null);
  });
});

describe('isHebrew', () => {
  it('detects mostly-Hebrew text', () => {
    expect(isHebrew('למה כבש ולא מדרגות?')).toBe(true);
    expect(isHebrew('Why a ramp (כבש) and not steps?')).toBe(false);
    expect(isHebrew('')).toBe(false);
  });
});
