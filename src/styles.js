// ============================================================================
// CSS STYLES
// ============================================================================
export const styles = `
@import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700&family=Cormorant+Garamond:wght@400;500;600&display=swap');

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  overflow: hidden;
  font-family: 'Cormorant Garamond', serif;
  background: #000;
}

.game-container {
  width: 100vw;
  height: 100vh;
  position: relative;
}

canvas {
  display: block;
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

/* Crosshair */
.crosshair {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.crosshair::before,
.crosshair::after {
  content: '';
  position: absolute;
  background: rgba(255, 255, 255, 0.6);
}

.crosshair::before {
  width: 2px;
  height: 24px;
  left: 11px;
  top: 0;
}

.crosshair::after {
  width: 24px;
  height: 2px;
  top: 11px;
  left: 0;
}

.crosshair-dot {
  position: absolute;
  width: 4px;
  height: 4px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  top: 10px;
  left: 10px;
}

/* HUD Layout */
.hud-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px;
}

.hud-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 20px;
}

/* Panel base style */
.panel {
  background: linear-gradient(135deg, rgba(20, 35, 60, 0.93), rgba(40, 30, 55, 0.9));
  backdrop-filter: blur(12px);
  border: 1px solid rgba(218, 165, 32, 0.35);
  border-radius: 14px;
  color: #F5E6C8;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

/* Date Panel */
.date-panel {
  padding: 18px 26px;
  min-width: 220px;
}

.date-hebrew {
  font-family: 'Frank Ruhl Libre', serif;
  font-size: 1.6rem;
  color: #FFD700;
  text-shadow: 0 2px 15px rgba(218, 165, 32, 0.5);
}

.date-day {
  font-size: 1rem;
  opacity: 0.85;
  margin-top: 3px;
}

.date-special {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(218, 165, 32, 0.25);
  color: #FFD700;
  font-weight: 600;
  font-size: 1.15rem;
}

/* Compass */
.compass {
  background: rgba(0, 0, 0, 0.8);
  padding: 12px 30px;
  border-radius: 30px;
  color: #DAA520;
  font-size: 1rem;
  letter-spacing: 0.15em;
  border: 1px solid rgba(218, 165, 32, 0.35);
}

/* Debug Indicator */
.debug-indicator {
  background: rgba(255, 50, 50, 0.9);
  padding: 10px 20px;
  border-radius: 20px;
  color: #fff;
  font-size: 0.9rem;
  font-weight: bold;
  letter-spacing: 0.1em;
  animation: pulse 1s infinite;
}

/* Minimap */
.minimap {
  width: 190px;
  height: 190px;
  background: rgba(0, 0, 0, 0.85);
  border-radius: 14px;
  border: 1px solid rgba(218, 165, 32, 0.35);
  padding: 14px;
}

.minimap svg {
  width: 100%;
  height: 100%;
}

.player-marker {
  fill: #FFD700;
  filter: drop-shadow(0 0 8px #FFD700);
}

/* Location Panel */
.location-panel {
  padding: 22px 30px;
  max-width: 480px;
}

.location-hebrew {
  font-family: 'Frank Ruhl Libre', serif;
  font-size: 2.4rem;
  font-weight: 700;
  color: #FFD700;
  text-shadow: 0 3px 25px rgba(218, 165, 32, 0.5);
  line-height: 1.2;
}

.location-english {
  font-size: 1.05rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  opacity: 0.85;
  margin: 8px 0 14px;
}

.location-desc {
  font-size: 1.1rem;
  line-height: 1.65;
  opacity: 0.9;
}

.elevation-display {
  font-size: 0.9rem;
  opacity: 0.7;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

/* Controls Hint */
.controls-hint {
  background: rgba(0, 0, 0, 0.85);
  padding: 16px 22px;
  border-radius: 12px;
  color: #aaa;
  font-size: 0.9rem;
}

.controls-hint kbd {
  background: #333;
  padding: 5px 12px;
  border-radius: 6px;
  margin: 0 5px;
  border: 1px solid #555;
  font-family: monospace;
  color: #ddd;
}

/* Kli Panel */
.kli-panel {
  position: absolute;
  top: 110px;
  right: 20px;
  padding: 24px;
  max-width: 360px;
  animation: slideIn 0.35s ease;
  pointer-events: auto;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(35px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.kli-panel .icon {
  font-size: 3.5rem;
  margin-bottom: 12px;
}

.kli-panel .name-heb {
  font-family: 'Frank Ruhl Libre', serif;
  font-size: 2rem;
  color: #FFD700;
}

.kli-panel .name-en {
  font-size: 1rem;
  opacity: 0.75;
  margin-bottom: 14px;
}

.kli-panel .desc {
  font-size: 1.05rem;
  line-height: 1.65;
}

/* Korbanos Panel */
.korbanos-panel {
  position: absolute;
  bottom: 110px;
  right: 20px;
  padding: 24px;
  max-width: 420px;
  max-height: 450px;
  overflow-y: auto;
  background: linear-gradient(135deg, rgba(65, 30, 20, 0.95), rgba(45, 20, 15, 0.93));
  animation: slideIn 0.35s ease;
  pointer-events: auto;
}

.korbanos-panel h3 {
  font-family: 'Frank Ruhl Libre', serif;
  font-size: 1.5rem;
  color: #FFD700;
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(218, 165, 32, 0.3);
}

.korban-item {
  padding: 14px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.korban-item:last-child {
  border-bottom: none;
}

.korban-name {
  font-family: 'Frank Ruhl Libre', serif;
  font-size: 1.2rem;
  color: #FFD700;
}

.korban-name-en {
  font-size: 0.9rem;
  opacity: 0.65;
}

.korban-desc {
  font-size: 0.95rem;
  margin-top: 7px;
  opacity: 0.85;
}

.korban-type {
  display: inline-block;
  background: rgba(218, 165, 32, 0.2);
  padding: 4px 12px;
  border-radius: 14px;
  font-size: 0.85rem;
  margin-top: 10px;
}

/* Start Screen */
.start-screen {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #0a0f1a 0%, #151525 50%, #080810 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.start-panel {
  background: linear-gradient(145deg, rgba(25, 45, 80, 0.96), rgba(55, 40, 85, 0.92));
  padding: 60px 80px;
  border-radius: 28px;
  border: 2px solid rgba(218, 165, 32, 0.45);
  text-align: center;
  max-width: 750px;
  box-shadow: 0 50px 120px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.start-panel h1 {
  font-family: 'Frank Ruhl Libre', serif;
  font-size: 5rem;
  color: #FFD700;
  text-shadow: 0 5px 50px rgba(218, 165, 32, 0.6);
  margin-bottom: 10px;
}

.start-panel h2 {
  font-size: 1.6rem;
  color: #E8DCC8;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  margin-bottom: 35px;
  font-weight: 400;
}

.start-panel p {
  color: #C4B8A8;
  font-size: 1.25rem;
  line-height: 1.85;
  margin-bottom: 20px;
}

.start-panel .features {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin: 30px 0;
  text-align: left;
}

.start-panel .feature {
  background: rgba(218, 165, 32, 0.1);
  padding: 12px 18px;
  border-radius: 10px;
  border: 1px solid rgba(218, 165, 32, 0.2);
  font-size: 1.05rem;
  color: #E8DCC8;
}

.start-panel .date-info {
  background: rgba(218, 165, 32, 0.12);
  padding: 22px 30px;
  border-radius: 14px;
  margin: 30px 0;
  border: 1px solid rgba(218, 165, 32, 0.25);
}

.start-panel .date-info .heb {
  font-family: 'Frank Ruhl Libre', serif;
  font-size: 1.8rem;
  color: #FFD700;
}

.start-panel .date-info .day {
  color: #E8DCC8;
  font-size: 1.1rem;
  margin-top: 5px;
}

.start-btn {
  background: linear-gradient(135deg, #DAA520 0%, #B8860B 100%);
  border: none;
  color: #fff;
  padding: 22px 65px;
  font-size: 1.45rem;
  font-family: 'Cormorant Garamond', serif;
  border-radius: 14px;
  cursor: pointer;
  margin-top: 35px;
  transition: all 0.3s;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-weight: 600;
  box-shadow: 0 10px 35px rgba(218, 165, 32, 0.4);
}

.start-btn:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 18px 55px rgba(218, 165, 32, 0.55);
}

.start-panel .footer {
  margin-top: 35px;
  font-size: 1rem;
  color: #8A8070;
}

/* Loading */
.loading {
  color: #FFD700;
  font-size: 1.6rem;
  text-align: center;
}

.loading-bar {
  width: 300px;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  margin-top: 20px;
  overflow: hidden;
}

.loading-bar-inner {
  height: 100%;
  background: linear-gradient(90deg, #DAA520, #FFD700);
  animation: loadPulse 1.5s ease infinite;
}

@keyframes loadPulse {
  0%, 100% { width: 20%; }
  50% { width: 80%; }
}
`;
