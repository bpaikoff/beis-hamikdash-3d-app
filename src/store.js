/**
 * App state shared between the imperative TempleGame and the React HUD.
 *
 * Two kinds of state live here:
 *  - ordinary state (loading, location, nearbyKli, selected, focused, debug, locked, period,
 *    lang) read with
 *    `useStore(selector)`; components re-render only when their slice changes;
 *  - `frame` (player position / heading), written every animation frame. Never select it
 *    from a component: subscribe with `store.subscribe(s => s.frame, fn)` and write to a
 *    ref or the DOM, so nothing in React re-renders at 60 fps.
 */
import { createStore } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';
import { useStore as useZustandStore } from 'zustand';

export const initialFrame = { x: 0, y: 0, z: 62, yaw: 0, elev: 0 };

export const store = createStore(
  subscribeWithSelector(() => ({
    loading: null, // string while the scene builds, null when ready
    error: null, // string when WebGL or the build failed
    location: null, // content entry of type 'area' the player is in
    nearbyKli: null, // nearest hotspot entry within reach, or null
    selected: null, // id of the hotspot whose card is open, or null
    focused: null, // id of the hotspot the player is looking at (label highlighted), or null
    debug: false, // ghost mode + telemetry
    locked: false, // pointer lock held
    period: 'bayis_sheni', // 'bayis_sheni' | 'bayis_rishon'
    lang: 'en', // HUD language for descriptions
    frame: initialFrame,
  }))
);

export const useStore = (selector) => useZustandStore(store, selector);
