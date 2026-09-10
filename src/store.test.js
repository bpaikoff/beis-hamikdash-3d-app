import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The audio-prefs subscription must not write localStorage on every store write (the
// game writes `frame` each animation frame): a shallow-compared selector guards it.
describe('store audio prefs', () => {
  let setItem;
  beforeEach(() => {
    setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: () => null, setItem });
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('saves only when sound or volume change', async () => {
    const { store } = await import('./store.js');
    const before = setItem.mock.calls.length;
    for (let i = 0; i < 100; i++) store.setState({ frame: i });
    expect(setItem.mock.calls.length - before).toBe(0);
    store.setState({ volume: 0.25 });
    expect(setItem.mock.calls.length - before).toBe(1);
    store.setState({ volume: 0.25 });
    expect(setItem.mock.calls.length - before).toBe(1);
  });
});
