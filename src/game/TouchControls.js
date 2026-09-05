/**
 * Virtual controls for touch screens (and browsers without pointer lock).
 *
 * Left half: a joystick that writes a normalized move vector into `player.moveVec`
 * ({x: strafe right, y: forward}, each in -1..1). Right half: drag to look, forwarded to
 * `player.look(dx, dy)`. A Jump button sits above the right zone. Everything uses pointer
 * events so two fingers (move + look) work at once. Sets `player.touchActive` so the
 * controller moves without pointer lock.
 */

const JOY_RADIUS = 56; // px: knob travel
const LOOK_GAIN = 2.2; // touch drags are shorter than mouse sweeps

export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const noLock = typeof HTMLElement === 'undefined' || !('requestPointerLock' in HTMLElement.prototype);
  return coarse || noLock;
}

export class TouchControls {
  /**
   * @param {HTMLElement} container  game container; the control layer is appended to it
   * @param {import('./PlayerController.js').PlayerController} player
   */
  constructor(container, player) {
    this.container = container;
    this.player = player;
    this.listeners = [];
    this.movePointer = null;
    this.lookPointer = null;
    this.lookLast = { x: 0, y: 0 };
    this.joyOrigin = { x: 0, y: 0 };

    player.touchActive = true;
    if (!player.moveVec) player.moveVec = { x: 0, y: 0 };

    const root = document.createElement('div');
    root.className = 'touch-controls';
    // The zones are gesture surfaces only; the Jump button stays in the accessibility tree.
    root.innerHTML =
      '<div class="touch-zone touch-move" aria-hidden="true"><div class="joystick"><div class="joystick-knob"></div></div></div>' +
      '<div class="touch-zone touch-look" aria-hidden="true"></div>' +
      '<button type="button" class="touch-jump" aria-label="Jump">Jump</button>';
    container.appendChild(root);
    this.root = root;
    this.moveZone = root.querySelector('.touch-move');
    this.lookZone = root.querySelector('.touch-look');
    this.joystick = root.querySelector('.joystick');
    this.knob = root.querySelector('.joystick-knob');
    this.jumpBtn = root.querySelector('.touch-jump');

    this.bind();
  }

  on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.listeners.push(() => target.removeEventListener(type, fn, opts));
  }

  bind() {
    const mz = this.moveZone;
    const lz = this.lookZone;
    const stop = (e) => {
      // Taps on the controls must not bubble to the container's pointer-lock click.
      e.stopPropagation();
    };
    this.on(this.root, 'click', stop);
    this.on(this.root, 'contextmenu', (e) => e.preventDefault());

    this.on(mz, 'pointerdown', (e) => {
      if (this.movePointer !== null) return;
      this.movePointer = e.pointerId;
      mz.setPointerCapture?.(e.pointerId);
      const r = mz.getBoundingClientRect();
      this.joyOrigin = { x: e.clientX - r.left, y: e.clientY - r.top };
      this.joystick.style.left = `${this.joyOrigin.x}px`;
      this.joystick.style.top = `${this.joyOrigin.y}px`;
      this.joystick.classList.add('active');
      this.setKnob(0, 0);
      e.preventDefault();
    });
    this.on(mz, 'pointermove', (e) => {
      if (e.pointerId !== this.movePointer) return;
      const r = mz.getBoundingClientRect();
      let dx = e.clientX - r.left - this.joyOrigin.x;
      let dy = e.clientY - r.top - this.joyOrigin.y;
      const len = Math.hypot(dx, dy);
      if (len > JOY_RADIUS) {
        dx = (dx / len) * JOY_RADIUS;
        dy = (dy / len) * JOY_RADIUS;
      }
      this.setKnob(dx, dy);
      this.player.moveVec.x = dx / JOY_RADIUS;
      this.player.moveVec.y = -dy / JOY_RADIUS;
      this.player.isRun = len >= JOY_RADIUS * 0.98;
      e.preventDefault();
    });
    const endMove = (e) => {
      if (e.pointerId !== this.movePointer) return;
      this.movePointer = null;
      this.player.moveVec.x = 0;
      this.player.moveVec.y = 0;
      this.player.isRun = false;
      this.joystick.classList.remove('active');
      this.setKnob(0, 0);
    };
    this.on(mz, 'pointerup', endMove);
    this.on(mz, 'pointercancel', endMove);
    this.on(mz, 'lostpointercapture', endMove);

    this.on(lz, 'pointerdown', (e) => {
      if (this.lookPointer !== null) return;
      this.lookPointer = e.pointerId;
      lz.setPointerCapture?.(e.pointerId);
      this.lookLast = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    });
    this.on(lz, 'pointermove', (e) => {
      if (e.pointerId !== this.lookPointer) return;
      const dx = e.clientX - this.lookLast.x;
      const dy = e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY };
      this.player.look(dx * LOOK_GAIN, dy * LOOK_GAIN);
      e.preventDefault();
    });
    const endLook = (e) => {
      if (e.pointerId === this.lookPointer) this.lookPointer = null;
    };
    this.on(lz, 'pointerup', endLook);
    this.on(lz, 'pointercancel', endLook);
    this.on(lz, 'lostpointercapture', endLook);

    this.on(this.jumpBtn, 'pointerdown', (e) => {
      e.preventDefault();
      this.player.jump();
    });
  }

  setKnob(dx, dy) {
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  dispose() {
    for (const off of this.listeners) off();
    this.listeners = [];
    this.player.touchActive = false;
    if (this.player.moveVec) {
      this.player.moveVec.x = 0;
      this.player.moveVec.y = 0;
    }
    this.root.remove();
  }
}
