import React, { useEffect, useRef, useState, useMemo } from 'react';

// Import utilities
import { HebrewCalendar } from './utils/HebrewCalendar.js';
import { Korbanos } from './utils/Korbanos.js';

// Import game
import { TempleGame } from './game/TempleGame.js';

// Import components
import { Minimap } from './components/Minimap.jsx';

// Import styles
import { styles } from './styles.js';

// ============================================================================
// MAIN REACT COMPONENT
// ============================================================================
export default function BeisHamikdash3D() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(null);
  const [location, setLocation] = useState(null);
  const [nearbyKli, setNearbyKli] = useState(null);
  const [playerState, setPlayerState] = useState({ position: { x: 0, z: 62 }, rotation: 0, elevation: '0' });
  const [showKorbanos, setShowKorbanos] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  const hebrewDate = useMemo(() => HebrewCalendar.getDate(), []);
  const korbanos = useMemo(() => Korbanos.getDaily(hebrewDate), [hebrewDate]);

  useEffect(() => {
    if (!started || !containerRef.current || gameRef.current) return;

    gameRef.current = new TempleGame(containerRef.current, {
      onLoc: setLocation,
      onKli: kli => {
        setNearbyKli(kli);
        setShowKorbanos(kli?.id === 'mizbeiach');
      },
      onUpd: setPlayerState,
      onLoad: setLoading,
      onDebug: setDebugMode
    });

    return () => {
      if (gameRef.current) {
        gameRef.current.dispose();
        gameRef.current = null;
      }
    };
  }, [started]);

  const getCompass = () => {
    const deg = ((playerState.rotation * 57.3) + 180) % 360;
    if (deg >= 315 || deg < 45) return 'צפון • N';
    if (deg >= 45 && deg < 135) return 'מערב • W';
    if (deg >= 135 && deg < 225) return 'דרום • S';
    return 'מזרח • E';
  };

  return (
    <>
      <style>{styles}</style>
      <div className="game-container" ref={containerRef}>
        {/* Game HUD - shown when game is running */}
        {started && !loading && (
          <div className="overlay">
            {/* Crosshair */}
            <div className="crosshair">
              <div className="crosshair-dot"></div>
            </div>

            {/* Top HUD */}
            <div className="hud-top">
              {/* Date Panel */}
              <div className="panel date-panel">
                <div className="date-hebrew">{hebrewDate.formatted}</div>
                <div className="date-day">{hebrewDate.dayName}</div>
                {hebrewDate.special && <div className="date-special">{hebrewDate.special}</div>}
                {hebrewDate.isRoshChodesh && !hebrewDate.special && <div className="date-special">ראש חודש</div>}
              </div>

              {/* Compass */}
              <div className="compass">{getCompass()}</div>

              {/* Debug Mode Indicator */}
              {debugMode && <div className="debug-indicator">GHOST MODE</div>}

              {/* Minimap */}
              <Minimap pos={playerState.position} rot={playerState.rotation} />
            </div>

            {/* Kli (Vessel) Info Panel */}
            {nearbyKli && (
              <div className="panel kli-panel">
                <div className="icon">{nearbyKli.icon}</div>
                <div className="name-heb">{nearbyKli.name}</div>
                <div className="name-en">{nearbyKli.nameEn}</div>
                <div className="desc">{nearbyKli.desc}</div>
              </div>
            )}

            {/* Korbanos Panel (shown near Mizbeiach) */}
            {showKorbanos && (
              <div className="panel korbanos-panel">
                <h3>קרבנות היום</h3>
                {korbanos.map((k, i) => (
                  <div key={i} className="korban-item">
                    <div className="korban-name">{k.name}</div>
                    <div className="korban-name-en">{k.en}</div>
                    <div className="korban-desc">{k.desc}</div>
                    <span className="korban-type">{k.type}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom HUD */}
            <div className="hud-bottom">
              {/* Location Panel */}
              <div className="panel location-panel">
                {location && (
                  <>
                    <div className="location-hebrew">{location.name}</div>
                    <div className="location-english">{location.nameEn}</div>
                    <div className="location-desc">{location.desc}</div>
                    <div className="elevation-display">Elevation: {playerState.elevation}m above ground</div>
                  </>
                )}
              </div>

              {/* Controls Hint */}
              <div className="controls-hint">
                <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move •{' '}
                <kbd>Space</kbd> Jump •{' '}
                <kbd>Shift</kbd> Run •{' '}
                <kbd>G</kbd> Ghost •{' '}
                <kbd>Mouse</kbd> Look
              </div>
            </div>
          </div>
        )}

        {/* Loading Screen */}
        {started && loading && (
          <div className="start-screen">
            <div>
              <div className="loading">{loading}</div>
              <div className="loading-bar">
                <div className="loading-bar-inner"></div>
              </div>
            </div>
          </div>
        )}

        {/* Start Screen */}
        {!started && (
          <div className="start-screen">
            <div className="start-panel">
              <h1>בית המקדש</h1>
              <h2>Beis Hamikdash Explorer</h2>
              <p>
                Experience the Holy Temple with unprecedented detail. Walk through
                historically accurate architecture from the Chuldah Gates to the
                Kodesh HaKodashim.
              </p>

              <div className="features">
                <div className="feature">🏛️ 30+ Realistic Textures</div>
                <div className="feature">👳 Animated Kohanim & Kohen Gadol</div>
                <div className="feature">🐑 Sheep, Goats, Bulls & Doves</div>
                <div className="feature">🔥 Dynamic Fire & Smoke</div>
                <div className="feature">📜 Daily Korbanos Display</div>
                <div className="feature">🗓️ Hebrew Calendar Integration</div>
              </div>

              <div className="date-info">
                <div className="heb">{hebrewDate.formatted}</div>
                <div className="day">{hebrewDate.dayName}</div>
                {hebrewDate.special && (
                  <div className="heb" style={{ marginTop: '8px' }}>{hebrewDate.special}</div>
                )}
              </div>

              <button className="start-btn" onClick={() => setStarted(true)}>
                Enter the Temple
              </button>

              <div className="footer">
                Based on Maseches Middos, Rambam Hilchos Beis HaBechirah & Mishna Yoma
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
