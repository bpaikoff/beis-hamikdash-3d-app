import React from 'react';

// ============================================================================
// MINIMAP COMPONENT
// ============================================================================
export const Minimap = ({ pos, rot }) => {
  const sc = 1.2;
  const cx = 95;
  const cy = 105;
  const px = cx + (pos?.x || 0) * sc * 0.55;
  const py = cy + (pos?.z || 100) * sc * 0.4;
  const r = ((rot || 0) * 57.3 + 180) % 360;

  return (
    <div className="minimap">
      <svg viewBox="0 0 190 190">
        <defs>
          <linearGradient id="goldG" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD700"/>
            <stop offset="100%" stopColor="#DAA520"/>
          </linearGradient>
        </defs>
        {/* Ground */}
        <rect x="5" y="5" width="180" height="180" fill="#B8A080" rx="4"/>
        {/* Har HaBayis */}
        <rect x="15" y="40" width="160" height="110" fill="#C9B896"/>
        {/* Ezras Nashim */}
        <rect x="40" y="80" width="110" height="50" fill="#DED0B8"/>
        {/* Azara */}
        <rect x="40" y="55" width="110" height="25" fill="#E8DCC8"/>
        {/* Azara inner */}
        <rect x="75" y="62" width="40" height="12" fill="#6B5A4A"/>
        {/* Heichal */}
        <rect x="70" y="30" width="50" height="25" fill="url(#goldG)"/>
        {/* Kodesh HaKodashim */}
        <rect x="78" y="15" width="34" height="15" fill="#FFD700"/>
        {/* Player marker */}
        <g transform={`translate(${px},${py}) rotate(${-r})`}>
          <polygon points="0,-9 6,6 -6,6" className="player-marker"/>
        </g>
      </svg>
    </div>
  );
};
