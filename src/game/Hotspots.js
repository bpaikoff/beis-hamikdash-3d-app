import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { hotspots, worldPos } from '../content/index.js';

const VISIBLE_DISTANCE = 25; // metres: labels beyond this are hidden
const NEAR_DISTANCE = 4; // metres: labels this close show regardless of gaze
const CONE = THREE.MathUtils.degToRad(10); // half-angle of the gaze cone
const LABEL_HEIGHT = 2.2; // metres above the entry's anchor
const ANCHOR_HEIGHT = 1.0; // metres above the anchor used for the gaze test

const _forward = new THREE.Vector3();
const _to = new THREE.Vector3();

/**
 * In-scene hotspot labels: one CSS2DObject pill per content entry of the current period.
 *
 * A pill is visible when the camera is within VISIBLE_DISTANCE and the entry sits inside
 * the gaze cone (or within NEAR_DISTANCE regardless). The entry the player is looking at
 * gets `.focused`; pressing `E` or clicking a pill sets `store.selected`, which opens the
 * HotspotCard. The labels live in their own root (not in the scene) so the CSS2DRenderer
 * only walks the ~40 labels each frame instead of the whole temple.
 */
export class Hotspots {
  /**
   * @param {THREE.Camera} camera
   * @param {HTMLElement} container  the game container; the label layer is appended to it
   * @param {import('zustand/vanilla').StoreApi} store
   */
  constructor(camera, container, store) {
    this.camera = camera;
    this.container = container;
    this.store = store;
    this.root = new THREE.Group();
    this.items = [];
    this.focused = null;
    this.disposed = false;

    this.labels = new CSS2DRenderer();
    const dom = this.labels.domElement;
    dom.className = 'hotspot-layer';
    dom.style.position = 'absolute';
    dom.style.top = '0';
    dom.style.left = '0';
    dom.style.pointerEvents = 'none';
    dom.setAttribute('aria-hidden', 'true');
    container.appendChild(dom);
    this.resize(container.clientWidth, container.clientHeight);

    this.build();
    this.unsubPeriod = store.subscribe(
      (s) => s.period,
      () => this.build()
    );
    this.unsubLang = store.subscribe(
      (s) => s.lang,
      (lang) => {
        for (const it of this.items) it.el.classList.toggle('he-first', lang === 'he');
      }
    );
    this.onKey = (e) => {
      if (e.code !== 'KeyE' || e.repeat) return;
      if (this.focused) this.select(this.focused.entry.id);
    };
    document.addEventListener('keydown', this.onKey);
  }

  select(id) {
    this.store.setState({ selected: id });
  }

  /** (Re)create one label per hotspot of the current period. */
  build() {
    this.clear();
    const lang = this.store.getState().lang;
    for (const entry of hotspots(this.store.getState().period)) {
      const [x, y, z] = worldPos(entry);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'hotspot-pill';
      el.dataset.id = entry.id;
      el.setAttribute('aria-label', `${entry.name.en} / ${entry.name.he}`);
      el.innerHTML =
        `<span class="hotspot-icon" aria-hidden="true">${entry.icon ?? '•'}</span>` +
        `<span class="hotspot-he" lang="he" dir="rtl">${entry.name.he}</span>` +
        `<span class="hotspot-en">${entry.name.en}</span>`;
      if (lang === 'he') el.classList.add('he-first');
      const onClick = (e) => {
        // The container's click handler requests pointer lock; a pill click must not.
        e.stopPropagation();
        this.select(entry.id);
      };
      el.addEventListener('click', onClick);
      const obj = new CSS2DObject(el);
      obj.position.set(x, y + LABEL_HEIGHT, z);
      obj.visible = false;
      this.root.add(obj);
      this.items.push({ entry, obj, el, onClick, anchor: new THREE.Vector3(x, y + ANCHOR_HEIGHT, z) });
    }
    this.focused = null;
    this.store.setState({ focused: null });
  }

  clear() {
    for (const it of this.items) {
      it.el.removeEventListener('click', it.onClick);
      this.root.remove(it.obj);
      it.el.remove();
    }
    this.items = [];
  }

  /** Per-frame visibility and focus. Call after the player has moved, before render(). */
  update() {
    const cam = this.camera;
    cam.getWorldDirection(_forward);
    let best = null;
    let bestAngle = Infinity;
    let nearest = null;
    let nearestDist = NEAR_DISTANCE;
    for (const it of this.items) {
      _to.subVectors(it.anchor, cam.position);
      const dist = _to.length();
      if (dist > VISIBLE_DISTANCE) {
        it.obj.visible = false;
        continue;
      }
      const angle = Math.acos(THREE.MathUtils.clamp(_to.divideScalar(dist || 1).dot(_forward), -1, 1));
      const inCone = angle < CONE;
      it.obj.visible = inCone || dist < NEAR_DISTANCE;
      if (inCone && angle < bestAngle) {
        bestAngle = angle;
        best = it;
      }
      if (dist < nearestDist && angle < Math.PI / 2) {
        nearestDist = dist;
        nearest = it;
      }
    }
    const focused = best ?? nearest;
    if (focused !== this.focused) {
      this.focused?.el.classList.remove('focused');
      focused?.el.classList.add('focused');
      this.focused = focused;
      this.store.setState({ focused: focused?.entry.id ?? null });
    }
  }

  /** Project the labels for the current camera. Call after the main render. */
  render() {
    this.labels.render(this.root, this.camera);
  }

  resize(width, height) {
    this.labels.setSize(width, height);
  }

  dispose() {
    this.disposed = true;
    this.unsubPeriod?.();
    this.unsubLang?.();
    document.removeEventListener('keydown', this.onKey);
    this.clear();
    this.labels.domElement.remove();
  }
}
