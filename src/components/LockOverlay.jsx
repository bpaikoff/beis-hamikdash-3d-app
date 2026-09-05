import { useMemo } from 'react';
import { useStore } from '../store.js';
import { isTouchDevice } from '../game/TouchControls.js';

/**
 * "Click to look around" prompt shown while the game runs without pointer lock (after the
 * browser released it on Escape, or before the first click). It does not intercept clicks:
 * the container underneath requests the lock. Hidden while a hotspot card is open, so the
 * card can be read and clicked, while the Ask panel is open, during a guided tour (which
 * runs without the pointer), and on touch devices, which never lock the pointer.
 */
export function LockOverlay() {
  const locked = useStore((s) => s.locked);
  const selected = useStore((s) => s.selected);
  const askOpen = useStore((s) => s.askOpen);
  const tour = useStore((s) => s.tour);
  const touch = useMemo(() => isTouchDevice(), []);
  if (locked || selected || askOpen || tour || touch) return null;
  return (
    <div className="lock-overlay" aria-hidden="true">
      <div className="lock-overlay-inner">
        <div className="lock-overlay-title">Click to look around</div>
        <div className="lock-overlay-sub"><kbd>Esc</kbd> releases the mouse</div>
      </div>
    </div>
  );
}
