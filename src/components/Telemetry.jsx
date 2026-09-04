import React, { useEffect, useRef } from 'react';
import { store } from '../store.js';
import { toAmos } from '../content/units.js';

/** Debug-only position readout; writes to the DOM from the transient frame slice. */
export function Telemetry() {
  const el = useRef(null);
  useEffect(() => {
    const apply = (f) => {
      if (!el.current) return;
      const a = toAmos(f.x, f.y, f.z);
      el.current.textContent =
        `x=${f.x.toFixed(1)} y=${f.y.toFixed(1)} z=${f.z.toFixed(1)} m` +
        `  |  ${a.x.toFixed(0)}, ${a.y.toFixed(0)}, ${a.z.toFixed(0)} amos  |  floor ${f.elev.toFixed(1)} m`;
    };
    apply(store.getState().frame);
    return store.subscribe((s) => s.frame, apply);
  }, []);
  return <div className="coords-display" ref={el} />;
}
