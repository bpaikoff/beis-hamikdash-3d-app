import { useEffect, useMemo, useRef, useState } from 'react';

import { HebrewCalendar } from './utils/HebrewCalendar.js';
import { Korbanos } from './utils/Korbanos.js';
import { TempleGame } from './game/TempleGame.js';
import { Minimap } from './components/Minimap.jsx';
import { Compass } from './components/Compass.jsx';
import { Telemetry } from './components/Telemetry.jsx';
import { HotspotCard } from './components/HotspotCard.jsx';
import { LockOverlay } from './components/LockOverlay.jsx';
import { StartScreen } from './components/StartScreen.jsx';
import { store, useStore } from './store.js';
import { byId } from './content/index.js';

const hasWebGL2 = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
};

const autostart = () => new URLSearchParams(window.location.search).has('cam') ||
  new URLSearchParams(window.location.search).has('at') ||
  new URLSearchParams(window.location.search).get('autostart') === '1';

// ============================================================================
// MAIN REACT COMPONENT
// ============================================================================
export default function BeisHamikdash3D() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const [started, setStarted] = useState(autostart);
  const webgl = useMemo(() => hasWebGL2(), []);

  const loading = useStore((s) => s.loading);
  const error = useStore((s) => s.error);
  const location = useStore((s) => s.location);
  const nearbyKli = useStore((s) => s.nearbyKli);
  const selected = useStore((s) => s.selected);
  const focused = useStore((s) => s.focused);
  const debug = useStore((s) => s.debug);
  const lang = useStore((s) => s.lang);

  const hebrewDate = useMemo(() => HebrewCalendar.getDate(), []);
  const korbanos = useMemo(() => Korbanos.getDaily(hebrewDate), [hebrewDate]);
  const selected = useStore((s) => s.selected);
  const showKorbanos = !selected && (nearbyKli?.legacyId === 'mizbeiach' || nearbyKli?.id === 'mizbeach');

  useEffect(() => {
    if (!started || !containerRef.current || !webgl) return;
    store.setState({ loading: 'Starting...', error: null });
    const game = new TempleGame(containerRef.current, store);
    gameRef.current = game;
    // `?at=<id>`: the game spawns beside the item; open its card once the first frame is in.
    const at = new URLSearchParams(window.location.search).get('at');
    if (at && byId[at]) {
      game.ready.then(() => {
        if (!game.disposed && !store.getState().error) store.setState({ selected: at });
      });
    }
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, [started, webgl]);

  const t = (obj) => (obj ? obj[lang] ?? obj.en : '');

  // Start and take the pointer in the same user gesture; the game syncs the lock state once
  // its controls exist. Browsers without pointer lock (touch) just start.
  const enter = () => {
    setStarted(true);
    const el = containerRef.current;
    try {
      el?.requestPointerLock?.()?.catch?.(() => {});
    } catch {
      /* unsupported */
    }
  };

  return (
    <>
      <div className="game-container" ref={containerRef} tabIndex={-1}>
        {started && !loading && !error && (
          <div className="overlay">
            <div className="crosshair" aria-hidden="true"><div className="crosshair-dot"></div></div>

            <div className="hud-top">
              <div className="panel date-panel" dir="rtl" lang="he">
                <div className="date-hebrew">{hebrewDate.formatted}</div>
                <div className="date-day">{hebrewDate.dayName}</div>
                {hebrewDate.special && <div className="date-special">{hebrewDate.special}</div>}
                {hebrewDate.isRoshChodesh && !hebrewDate.special && <div className="date-special">ראש חודש</div>}
              </div>
              <Compass />
              {debug && <div className="debug-indicator">GHOST MODE</div>}
              <Minimap />
            </div>

            {focused && !selected && (
              <div className="interact-hint"><kbd>E</kbd>Inspect</div>
            )}

            <HotspotCard />
            <LockOverlay />

            {showKorbanos && (
              <div className="panel korbanos-panel">
                <h3 dir="rtl" lang="he">קרבנות היום</h3>
                {korbanos.map((k, i) => (
                  <div key={i} className="korban-item">
                    <div className="korban-name" dir="rtl" lang="he">{k.name}</div>
                    <div className="korban-name-en" lang="en">{k.en}</div>
                    <div className="korban-desc" lang="en">{k.desc}</div>
                    <span className="korban-type" lang="en">{k.type}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="hud-bottom">
              <div className="panel location-panel" aria-live="polite" aria-atomic="true">
                {location && (
                  <>
                    <div className="location-hebrew" dir="rtl" lang="he">{location.name.he}</div>
                    <div className="location-english" lang="en">{location.name.en}</div>
                    <div className="location-desc" dir={lang === 'he' ? 'rtl' : 'ltr'} lang={location.desc?.[lang] ? lang : 'en'}>{t(location.desc)}</div>
                    {debug && <Telemetry />}
                  </>
                )}
              </div>
              <div className="controls-hint" lang="en">
                <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move •{' '}
                <kbd>Space</kbd> Jump •{' '}
                <kbd>Shift</kbd> Run •{' '}
                <kbd>Mouse</kbd> Look •{' '}
                <kbd>Esc</kbd> Release
              </div>
            </div>
          </div>
        )}

        {started && error && (
          <div className="start-screen">
            <div className="start-panel">
              <h2>Could not start</h2>
              <p style={{ direction: 'ltr' }}>{error}</p>
              <button className="start-btn" onClick={() => window.location.reload()}>Reload</button>
            </div>
          </div>
        )}

        {started && loading && !error && (
          <div className="start-screen" aria-live="polite">
            <div>
              <div className="loading">{loading}</div>
              <div className="loading-bar"><div className="loading-bar-inner"></div></div>
            </div>
          </div>
        )}

        {!started && <StartScreen hebrewDate={hebrewDate} webgl={webgl} onEnter={enter} />}
      </div>
    </>
  );
}
