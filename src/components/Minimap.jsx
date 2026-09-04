import React, { useEffect, useRef } from 'react';
import { store } from '../store.js';
import { areas, worldBounds } from '../content/index.js';

// Map a 240 x 240 m world window (x: -70..70, z: -95..145) onto the 190 x 190 viewBox.
const WORLD = { minX: -70, maxX: 70, minZ: -95, maxZ: 145 };
const SIZE = 190;
const sx = (x) => ((x - WORLD.minX) / (WORLD.maxX - WORLD.minX)) * SIZE;
const sz = (z) => ((z - WORLD.minZ) / (WORLD.maxZ - WORLD.minZ)) * SIZE;

const FILL = {
  outside: 'none',
  har_habayis: '#C9B896',
  ezras_nashim: '#DED0B8',
  azaras_yisrael: '#E8DCC8',
  azaras_kohanim: '#E8DCC8',
  heichal: 'url(#goldG)',
  kodesh_hakodashim: '#FFD700',
};

// The map is drawn in the world's own axes: x (north) across, z (east) down, so the
// Heichal (west, -z) is at the top and the Ezras Nashim (east, +z) at the bottom.
const rects = areas
  .filter((a) => a.id !== 'outside')
  .map((a) => {
    const b = worldBounds(a);
    return { id: a.id, x: sx(b.minX), y: sz(b.minZ), w: sx(b.maxX) - sx(b.minX), h: sz(b.maxZ) - sz(b.minZ) };
  });

/**
 * Player marker follows the transient `frame` slice without re-rendering React:
 * the subscription writes the SVG transform directly.
 */
export const Minimap = React.memo(function Minimap() {
  const marker = useRef(null);
  useEffect(() => {
    const apply = (f) => {
      if (!marker.current) return;
      const deg = (f.yaw * 57.3 + 180) % 360;
      marker.current.setAttribute('transform', `translate(${sx(f.x).toFixed(1)},${sz(f.z).toFixed(1)}) rotate(${-deg})`);
    };
    apply(store.getState().frame);
    return store.subscribe((s) => s.frame, apply);
  }, []);

  return (
    <div className="minimap" aria-hidden="true">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <defs>
          <linearGradient id="goldG" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="100%" stopColor="#DAA520" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={SIZE} height={SIZE} fill="#B8A080" rx="4" />
        {rects.map((r) => (
          <rect key={r.id} x={r.x} y={r.y} width={r.w} height={r.h} fill={FILL[r.id] ?? '#D8CDB8'} />
        ))}
        <g ref={marker}>
          <polygon points="0,-7 5,5 -5,5" className="player-marker" />
        </g>
      </svg>
    </div>
  );
});
