import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { TextureFactory } from './TextureFactory.js';
import { TempleBuilder } from './TempleBuilder.js';
import { PlayerController } from './PlayerController.js';
import { CharacterSystem } from './CharacterSystem.js';
import { ParticleSystem } from './ParticleSystem.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { mulberry32 } from './random.js';
import { areas, byId, hotspots, worldBounds, worldPos } from '../content/index.js';
import { Hotspots } from './Hotspots.js'; // HUD: in-scene labels

const HOTSPOT_RADIUS = 8; // metres; the nearest entry within this shows in the HUD

const BLOOM = { strength: 0.35, radius: 0.6, threshold: 0.9 };

/**
 * Bloom needs WebGL2 (MSAA + half-float render targets) and is skipped on phones/tablets
 * (coarse pointer: fill-rate bound) and for users who asked for reduced motion.
 */
function wantsPostFX(renderer) {
  if (!renderer.capabilities.isWebGL2) return false;
  const mm = typeof window.matchMedia === 'function' ? (q) => window.matchMedia(q).matches : () => false;
  if (mm('(pointer: coarse)') || mm('(prefers-reduced-motion: reduce)')) return false;
  return new URLSearchParams(window.location.search).get('bloom') !== '0';
}

/** Let the browser paint (loading text) between build phases. */
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/** Parse `?cam=x,y,z,yaw,pitch` (metres, degrees) and `?at=<hotspot id>`. */
function readSpawn(search) {
  const q = new URLSearchParams(search);
  const cam = q.get('cam');
  if (cam) {
    const [x, y, z, yaw = 0, pitch = 0] = cam.split(',').map(Number);
    if ([x, y, z].every(Number.isFinite)) return { pos: [x, y, z], yaw, pitch };
  }
  const at = q.get('at');
  if (at && byId[at]) {
    const [x, y, z] = worldPos(byId[at]);
    // 4 m east of the item, at eye height, facing west toward it.
    return { pos: [x, y + CONFIG.PLAYER_HEIGHT, z + 4], yaw: 0, pitch: 0 };
  }
  return null;
}

// ============================================================================
// MAIN GAME
// ============================================================================
export class TempleGame {
  /**
   * @param {HTMLElement} container  the element the canvas is appended to
   * @param {import('zustand/vanilla').StoreApi} store  app store (see ../store.js)
   */
  constructor(container, store) {
    this.container = container;
    this.store = store;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      CONFIG.FOV,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      CONFIG.RENDER_DISTANCE
    );
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.clock = new THREE.Clock();
    this.tex = new TextureFactory({
      maxAnisotropy: this.renderer.capabilities.getMaxAnisotropy(),
      baked: new URLSearchParams(window.location.search).get('bake') !== '0',
    });
    this.currentArea = null;
    this.nearbyKli = null;
    this.raf = 0;
    this.disposed = false;
    this.listeners = [];
    this.areaBounds = areas.map((a) => ({ entry: a, bounds: worldBounds(a) }));
    this.refreshHotspots();
    this.unsubPeriod = store.subscribe((s) => s.period, () => this.refreshHotspots());
    this.ready = this.init().catch((e) => {
      console.error(e);
      store.setState({ loading: null, error: e.message });
    });
  }

  refreshHotspots() {
    this.hotspotList = hotspots(this.store.getState().period).map((e) => {
      const [x, y, z] = worldPos(e);
      return { entry: e, x, y, z };
    });
  }

  setLoading(msg) {
    this.store.setState({ loading: msg });
    return nextFrame();
  }

  async init() {
    const r = this.renderer;
    r.setSize(this.container.clientWidth, this.container.clientHeight);
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.2;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.domElement.style.display = 'block';
    // Static scene: render the shadow map once, then refresh it every few frames for the
    // moving Kohanim instead of every frame.
    r.shadowMap.autoUpdate = false;
    this.container.appendChild(r.domElement);
    this.setupPostFX();
    this.camera.position.set(0, CONFIG.PLAYER_HEIGHT + 1.8, 62);

    // Image-based lighting: without an environment the PBR gold and copper have nothing
    // to reflect and render almost black. RoomEnvironment ships with three (no download).
    const pmrem = new THREE.PMREMGenerator(r);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmrem.dispose();

    // Baked textures stream in from /textures/*.webp while the geometry builds; the
    // canvas generators only run for files that are missing (or with ?bake=0).
    this.tex.onProgress((n, total) => this.store.setState({ loading: `Loading textures ${n}/${total}...` }));
    await this.setLoading(this.tex.baked ? 'Loading textures...' : 'Generating textures...');
    const builder = new TempleBuilder(this.scene, this.tex);
    await this.setLoading('Building the Beis HaMikdash...');
    const { floors, walls } = builder.build();
    this.sky = this.scene.getObjectByName('sky');
    const all = this.areaBounds.map((a) => a.bounds);
    const bounds = {
      minX: Math.min(...all.map((b) => b.minX)),
      maxX: Math.max(...all.map((b) => b.maxX)),
      minZ: Math.min(...all.map((b) => b.minZ)),
      maxZ: Math.max(...all.map((b) => b.maxZ)),
    };
    this.player = new PlayerController(this.camera, floors, walls, { bounds });
    if (this.disposed) return;

    await this.setLoading('Placing Kohanim and animals...');
    this.characters = new CharacterSystem(this.scene, this.tex);
    this.characters.createKohen(0, 8.3, -68, true); // Kohen Gadol in the Heichal
    // Azaras Kohanim (y=7.3), Azaras Yisrael (y=6.8), Ezras Nashim (y=3.8)
    [[10, -18], [-10, -18], [8, -28], [-8, -28], [12, -36], [-12, -36], [15, -42], [-15, -42]]
      .forEach(([x, z]) => this.characters.createKohen(x, 7.3, z));
    [[8, -9], [-8, -9], [0, -9]].forEach(([x, z]) => this.characters.createKohen(x, 6.8, z));
    [[0, 30], [15, 35], [-15, 35], [10, 20], [-10, 20]].forEach(([x, z]) => this.characters.createKohen(x, 3.8, z));
    const rand = mulberry32(11); // same flock on every load
    for (let i = 0; i < 8; i++) this.characters.createAnimal('sheep', 20 + (rand() - 0.5) * 10 * (i % 2 === 0 ? 1 : -1), 30 + (rand() - 0.5) * 10);
    for (let i = 0; i < 4; i++) this.characters.createAnimal('goat', 25 + (rand() - 0.5) * 8 * (i % 2 === 0 ? 1 : -1), 35 + (rand() - 0.5) * 8);
    for (let i = 0; i < 2; i++) this.characters.createAnimal('bull', 30 + i * 5, 45);
    for (let i = 0; i < 12; i++) this.characters.createDove((rand() - 0.5) * 60, 25 + rand() * 15, (rand() - 0.5) * 60);

    if (this.tex.total > this.tex.loaded) {
      await this.setLoading(`Loading textures ${this.tex.loaded}/${this.tex.total}...`);
      await this.tex.whenLoaded();
    }
    if (this.disposed) return;

    await this.setLoading('Lighting the fire...');
    this.particles = new ParticleSystem(this.scene);
    this.particles.createFire(0, 17, -28, 4);
    this.particles.createSmoke(0, 10, -75, 0.3);
    if (this.disposed) return;

    const spawn = readSpawn(window.location.search);
    if (spawn) {
      this.camera.position.set(...spawn.pos);
      this.camera.rotation.set(THREE.MathUtils.degToRad(spawn.pitch), THREE.MathUtils.degToRad(spawn.yaw), 0, 'YXZ');
      this.player.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    }

    this.setupControls();
    this.hotspotLabels = new Hotspots(this.camera, this.container, this.store); // HUD: in-scene labels
    this.store.setState({ loading: null });
    window.__mikdash = {
      ready: false,
      info: this.renderer.info.render, // whole-frame counts (all passes), see animate()
      camera: this.camera,
      game: this,
      postfx: Boolean(this.composer),
    };
    this.animate();
    // Ready once one full frame has been rendered.
    await nextFrame();
    window.__mikdash.ready = true;
  }

  /**
   * RenderPass -> UnrealBloomPass -> OutputPass on an MSAA half-float target. Tone
   * mapping and the sRGB transfer happen in OutputPass (it reads renderer.toneMapping),
   * so the renderer settings above stay the single source of truth. Without post-fx
   * animate() falls back to renderer.render().
   */
  setupPostFX() {
    const r = this.renderer;
    if (!wantsPostFX(r)) return;
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    const pr = r.getPixelRatio();
    const target = new THREE.WebGLRenderTarget(w * pr, h * pr, { samples: 4, type: THREE.HalfFloatType });
    target.texture.name = 'EffectComposer.msaa';
    const composer = new EffectComposer(r, target);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
    this.outputPass = new OutputPass();
    composer.addPass(this.renderPass);
    composer.addPass(this.bloomPass);
    composer.addPass(this.outputPass);
    this.composer = composer;
    // renderer.info resets on every render() call; with several passes per frame the
    // counts would only show the last one. Reset once per frame in animate() instead.
    r.info.autoReset = false;
  }

  on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.listeners.push(() => target.removeEventListener(type, fn, opts));
  }

  setupControls() {
    const p = this.player;
    this.on(document, 'keydown', (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') p.moveF = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') p.moveB = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') p.moveL = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') p.moveR = true;
      if (e.code === 'ShiftLeft') p.isRun = true;
      if (e.code === 'Space') { e.preventDefault(); p.jump(); }
      if (e.code === 'KeyG') p.toggleDebug((debug) => this.store.setState({ debug }));
    });
    this.on(document, 'keyup', (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') p.moveF = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') p.moveB = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') p.moveL = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') p.moveR = false;
      if (e.code === 'ShiftLeft') p.isRun = false;
    });
    this.on(document, 'mousemove', (e) => p.onMouseMove(e));
    this.on(this.container, 'click', () => this.requestLock());
    this.on(document, 'pointerlockchange', () => {
      p.isLocked = document.pointerLockElement === this.container;
      this.store.setState({ locked: p.isLocked });
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  async requestLock() {
    if (document.pointerLockElement === this.container) return;
    try {
      await this.container.requestPointerLock();
    } catch (e) {
      // Chrome rejects rapid re-locks and some embeds forbid it; the HUD falls back to drag-look.
      console.warn('pointer lock unavailable:', e.message);
    }
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    this.hotspotLabels?.resize(w, h); // HUD
  }

  checkLocation() {
    const p = this.camera.position;
    let area = this.areaBounds.find((a) => a.entry.id === 'outside')?.entry ?? null;
    for (const { entry, bounds: b } of this.areaBounds) {
      if (entry.id === 'outside') continue;
      if (p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ) area = entry;
    }
    if (area?.id !== this.currentArea) {
      this.currentArea = area?.id ?? null;
      this.store.setState({ location: area });
    }

    let closest = null;
    let minDist = HOTSPOT_RADIUS;
    for (const h of this.hotspotList) {
      const d = Math.hypot(p.x - h.x, p.z - h.z);
      if (d < minDist) { minDist = d; closest = h.entry; }
    }
    if (closest?.id !== this.nearbyKli?.id) {
      this.nearbyKli = closest;
      this.store.setState({ nearbyKli: closest });
    }
  }

  animate() {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(() => this.animate());
    if (window.__mikdash?.paused) return; // screenshot tooling holds the last frame
    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.player.update(delta);
    this.characters.update(delta);
    this.particles.update(delta);
    this.checkLocation();
    if (this.sky) this.sky.position.copy(this.camera.position);
    this.frameCount = (this.frameCount ?? 0) + 1;
    if (this.frameCount % 6 === 1) this.renderer.shadowMap.needsUpdate = true;
    const c = this.camera.position;
    this.store.setState({
      frame: { x: c.x, y: c.y, z: c.z, yaw: this.player.euler.y, elev: Number(this.player.getElevation()) },
    });
    if (this.composer) {
      this.renderer.info.reset();
      this.composer.render(delta);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    // HUD: hotspot labels are projected after the main render (CSS2DRenderer overlay).
    if (this.hotspotLabels) {
      this.hotspotLabels.update();
      this.hotspotLabels.render();
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.unsubPeriod?.();
    this.resizeObserver?.disconnect();
    for (const off of this.listeners) off();
    this.listeners = [];
    if (document.pointerLockElement === this.container) document.exitPointerLock();
    this.hotspotLabels?.dispose(); // HUD
    this.hotspotLabels = null;
    this.particles?.dispose();
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap', 'envMap']) m[k]?.dispose?.();
        m.dispose?.();
      }
    });
    this.scene.clear();
    this.tex.dispose();
    this.envTexture?.dispose();
    if (this.composer) {
      this.bloomPass?.dispose();
      this.outputPass?.dispose();
      this.composer.renderTarget1.dispose();
      this.composer.renderTarget2.dispose();
      this.composer = null;
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
    if (window.__mikdash?.game === this) delete window.__mikdash;
  }
}
