import { useEffect, useRef } from 'react';
import { store, useStore, toggleSound } from '../store.js';

/**
 * The ambience's speaker button (store.sound; `M` does the same) with a volume slider
 * while it is on (store.volume). The click is the gesture that lets TempleGame start the
 * AudioContext (game/Audio.js), so the toggle must stay a real button.
 */
export function SoundToggle() {
  const sound = useStore((s) => s.sound);
  const volume = useStore((s) => s.volume);
  const ref = useRef(null);
  // The game container locks the pointer on any native click and React's delegated handler
  // runs after it (see AskPanel), so the toggle swallows its clicks natively and toggles there.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const swallow = (e) => e.stopPropagation();
    const onButton = (e) => { e.stopPropagation(); toggleSound(); };
    const btn = el.querySelector('button');
    el.addEventListener('click', swallow);
    btn?.addEventListener('click', onButton);
    return () => { el.removeEventListener('click', swallow); btn?.removeEventListener('click', onButton); };
  }, []);
  return (
    <div ref={ref} className={`panel sound-toggle${sound ? ' on' : ''}`} lang="en">
      <button
        type="button"
        aria-pressed={sound}
        aria-label={sound ? 'Mute the ambience' : 'Play the ambience'}
        title={sound ? 'Sound on (M)' : 'Sound off (M)'}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" />
          {sound ? (
            <>
              <path d="M15.5 9.2a3.6 3.6 0 0 1 0 5.6" />
              <path d="M18 6.8a7 7 0 0 1 0 10.4" />
            </>
          ) : (
            <path d="M16 9.5l4.5 5M20.5 9.5l-4.5 5" />
          )}
        </svg>
        <span>{sound ? 'Sound' : 'Muted'}</span>
      </button>
      {sound && (
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          aria-label="Ambience volume"
          onChange={(e) => store.setState({ volume: Number(e.target.value) })}
        />
      )}
    </div>
  );
}
