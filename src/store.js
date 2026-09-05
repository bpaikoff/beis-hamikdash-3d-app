/**
 * App state shared between the imperative TempleGame and the React HUD.
 *
 * Two kinds of state live here:
 *  - ordinary state (loading, location, nearbyKli, selected, focused, debug, locked, period,
 *    timeOfDay, lang, askOpen, askQuestion, askSeq) read with
 *    `useStore(selector)`; components re-render only when their slice changes;
 *  - `frame` (player position / heading), written every animation frame. Never select it
 *    from a component: subscribe with `store.subscribe(s => s.frame, fn)` and write to a
 *    ref or the DOM, so nothing in React re-renders at 60 fps.
 */
import { createStore } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';
import { useStore as useZustandStore } from 'zustand';
import { parseTimeOfDay } from './game/sun.js';

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
    // 'dawn' | 'morning' | 'afternoon' | 'dusk': where the sun stands (game/sun.js); `?time=dusk` presets it
    timeOfDay: parseTimeOfDay(typeof window !== 'undefined' ? window.location.search : ''),
    lang: 'en', // HUD language for descriptions
    askOpen: false, // the "Ask the poskim" panel is open
    askQuestion: null, // question the panel is streaming (or showing)
    askSeq: 0, // bumps on every ask so the same question can be re-sent
    tour: null, // id of the running guided tour (src/content/tours), or null
    tourStop: -1, // index of the current stop
    tourPlaying: 'idle', // 'idle' | 'travel' | 'dwell' | 'paused' (see game/Tour.js)
    tourDwell: 0, // seconds the current stop dwells
    tourDwellLeft: 0, // countdown, written at 10 Hz while dwelling
    tourEnded: false, // the last stop's dwell ran out
    tourCtl: null, // the Tour instance while one exists (next/prev/pause/resume/stop)
    frame: initialFrame,
  }))
);

/** Open the Ask panel on `question` (a card question or free text) and start a new answer. */
export const openAsk = (question) =>
  store.setState((s) => ({ askOpen: true, askQuestion: String(question ?? '').trim(), askSeq: s.askSeq + 1 }));

export const closeAsk = () => store.setState({ askOpen: false });

export const useStore = (selector) => useZustandStore(store, selector);
