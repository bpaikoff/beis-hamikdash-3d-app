import { useEffect, useRef } from 'react';
import { store } from '../store.js';

// The scene's +x is north and -z is west. The camera faces -z at yaw 0; a positive yaw
// (rotation.y) turns it toward -x, south, so the quadrants run W, S, E, N.
const POINTS = [
  { he: 'מערב', en: 'W' },
  { he: 'דרום', en: 'S' },
  { he: 'מזרח', en: 'E' },
  { he: 'צפון', en: 'N' },
];

export function Compass() {
  const el = useRef(null);
  useEffect(() => {
    let last = -1;
    const apply = (f) => {
      const idx = Math.round((((f.yaw * 57.3) % 360) + 360) % 360 / 90) % 4;
      if (idx === last || !el.current) return;
      last = idx;
      const p = POINTS[idx];
      // Bidi isolates keep "צפון • N" from reordering around the bullet.
      el.current.textContent = `⁧${p.he}⁩ • ⁦${p.en}⁩`;
    };
    apply(store.getState().frame);
    return store.subscribe((s) => s.frame, apply);
  }, []);
  return <div className="compass" ref={el} />;
}
