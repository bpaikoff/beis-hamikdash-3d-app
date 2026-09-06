import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { TextureFactory } from './TextureFactory.js';
import { TempleBuilder } from './TempleBuilder.js';
import { PlayerController } from './PlayerController.js';
import { CharacterSystem, templePlacements } from './CharacterSystem.js';
import { ParticleSystem } from './ParticleSystem.js';
import { Daylight } from './Daylight.js';
import { DistanceCuller } from './lod.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { areas, byId, hotspots, walkableBounds, worldBounds, worldPos, levelWorldY } from '../content/index.js';
import { AMAH } from '../content/units.js';
import { byTourId } from '../content/tours/index.js';
import { Tour } from './Tour.js';
import { Hotspots } from './Hotspots.js'; // HUD: in-scene labels
import { TouchControls, isTouchDevice } from './TouchControls.js'; // HUD: virtual joystick

const HOTSPOT_RADIUS = 8; // metres; the nearest entry within this shows in the HUD

const BLOOM = { strength: 0.15, radius: 0.3, threshold: 1.2 };

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
    const entry = byId[at];
    const [x, y, z] = worldPos(entry);
    // East of the item (clear of its footprint), at eye height, facing west toward it.
    const depth = (entry.geometry?.d ?? entry.geometry?.w ?? 0) * AMAH;
    const height = (entry.geometry?.h ?? 0) * AMAH;
    // Stand far enough back to take the whole object in (its depth plus roughly its height).
    const back = Math.max(4, depth / 2 + 3 + Math.min(height, 12) * 0.8);
    return { pos: [x, y + CONFIG.PLAYER_HEIGHT, z + back], yaw: 0, pitch: height > 6 ? 8 : 0 };
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
      pbr: new URLSearchParams(window.location.search).get('pbr') !== '0',
    });
    this.currentArea = null;
    this.nearbyKli = null;
    this.raf = 0;
    this.disposed = false;
    this.listeners = [];
    this.areaBounds = areas.map((a) => ({ entry: a, bounds: worldBounds(a) }));
    this.refreshHotspots();
    this.unsubPeriod = store.subscribe((s) => s.period, (period) => {
      this.refreshHotspots();
      this.applyPeriod(period);
    });
    this.unsubTime = store.subscribe((s) => s.timeOfDay, (t) => this.daylight?.set(t));
    this.ready = this.init().catch((e) => {
      console.error(e);
      store.setState({ loading: null, error: e.message });
    });
  }

  /** Show/hide groups the builders tagged with userData.period (e.g. Aron, Yachin/Boaz). */
  applyPeriod(period = this.store.getState().period) {
    // Only vessels and free-standing structures switch with the period (Aron, keruvim,
    // Yachin/Boaz, the Amah Traksin wall vs the two parochos). Courts, gates and chambers
    // are tagged bayis_sheni because that is what is modelled, but they stay visible.
    this.scene.traverse((o) => {
      const p = o.userData?.period;
      if (!Array.isArray(p) || !p.length) return;
      const type = o.userData.entryId ? byId[o.userData.entryId]?.type : 'kli';
      if (type === 'area' || type === 'gate' || type === 'chamber') return;
      o.visible = p.includes(period);
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
    r.shadowMap.enabled = new URLSearchParams(window.location.search).get('shadows') !== '0';
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.85; // 1.2 blew out the sand and stone once the IBL and physical sun arrived
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.domElement.style.display = 'block';
    // Static scene: render the shadow map once, then refresh it every few frames for the
    // moving Kohanim instead of every frame.
    r.shadowMap.autoUpdate = false;
    this.container.appendChild(r.domElement);
    this.setupPostFX();
    // Default spawn: on Har HaBayis, a few metres east of the Ezras Nashim gate, facing west.
    {
      const gate = byId.ezras_nashim_gate ?? byId.nicanor_gate;
      const [gx, , gz] = worldPos(gate);
      this.camera.position.set(gx, levelWorldY('har_habayis') + CONFIG.PLAYER_HEIGHT, gz + 14);
    }

    // Image-based lighting: without an environment the PBR gold and copper have nothing
    // to reflect and render almost black. RoomEnvironment ships with three (no download).
    const pmrem = new THREE.PMREMGenerator(r);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmrem.dispose();

    // Baked textures stream in from /textures/*.webp while the geometry builds; the
    // canvas generators only run for files that are missing (or with ?bake=0).
    this.tex.onProgress((n, total) => this.store.setState({ loading: `Loading textures ${n}/${total}...` })); // counts PBR maps and models too
    await this.setLoading(this.tex.baked ? 'Loading textures...' : 'Generating textures...');
    const builder = new TempleBuilder(this.scene, this.tex);
    await this.setLoading('Building the Beis HaMikdash...');
    const { floors, walls } = builder.build();
    this.sky = this.scene.getObjectByName('sky');
    // The sun, the sky dome, the hemisphere light and the fog follow store.timeOfDay.
    this.daylight = new Daylight(this.scene, { exposure: r.toneMappingExposure });
    this.daylight.set(this.store.getState().timeOfDay);
    this.player = new PlayerController(this.camera, floors, walls, { bounds: walkableBounds() });
    this.applyPeriod();
    if (this.disposed) return;

    await this.setLoading('Placing Kohanim and animals...');
    this.characters = new CharacterSystem(this.scene, this.tex);
    // The model files (public/assets/characters/) load once through the shared manager;
    // placements derive from the content JSON (CharacterSystem.templePlacements) so they
    // follow the geometry when it moves, and Characters.test.js probes every spot.
    await this.characters.load();
    if (this.disposed) return;
    for (const p of templePlacements()) this.characters.place(p);
    // Content-relative positions for the fire below (same helper templePlacements uses).
    const at = (id, dx = 0, dz = 0, level) => {
      const [x, y, z] = worldPos(byId[id]);
      return [x + dx, level ? levelWorldY(level) : y, z + dz];
    };

    if (this.tex.total > this.tex.loaded) {
      await this.setLoading(`Loading textures ${this.tex.progress().join('/')}...`);
      await this.tex.whenLoaded();
    }
    if (this.disposed) return;

    await this.setLoading('Lighting the fire...');
    this.particles = new ParticleSystem(this.scene);
    {
      // Altar fire on top of the ma'aracha (the altar is 10 amos high).
      const [fx, fy, fz] = at('mizbeach');
      this.particles.createFire(fx, fy + 10 * AMAH, fz, 4);
      // The Menorah's lamps and the coals of the golden altar: KeilimBuilder leaves named
      // anchors inside the period groups; the flames hang on them and toggle with the vessel.
      const wicks = [];
      let coals = null;
      this.scene.traverse((o) => {
        if (o.name === 'menorah-flame') wicks.push(o);
        else if (o.name === 'golden-altar-coals') coals = o;
      });
      wicks.forEach((w, i) => this.particles.createCandle(w, { light: i === 3 ? 6 : 0 }));
      if (coals) this.particles.createCoals(coals);
    }
    if (this.disposed) return;

    const spawn = readSpawn(window.location.search);
    if (spawn) {
      this.camera.position.set(...spawn.pos);
      this.camera.rotation.set(THREE.MathUtils.degToRad(spawn.pitch), THREE.MathUtils.degToRad(spawn.yaw), 0, 'YXZ');
      this.player.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    }

    this.setupControls();
    this.hotspotLabels = new Hotspots(this.camera, this.container, this.store); // HUD: in-scene labels
    if (isTouchDevice()) this.touch = new TouchControls(this.container, this.player); // HUD: joystick + drag-look
    const q = new URLSearchParams(window.location.search);
    // Distance culling of small meshes and far instances (game/lod.js); `?lod=0` draws everything.
    if (q.get('lod') !== '0') this.culler = new DistanceCuller().collect(this.scene);
    // `?tour=tamid[&stop=N]` (N 1-based): stand at the stop before the first frame.
    if (q.get('tour') && byTourId[q.get('tour')]) this.startTour(q.get('tour'), (Number(q.get('stop')) || 1) - 1);
    this.store.setState({ loading: null });
    // Test hooks (scripts/walk.mjs, scripts/screenshot.mjs). ?render=0 keeps the simulation
    // running at full rAF speed without drawing; ?step=<seconds> fixes the frame delta.
    this.renderEnabled = q.get('render') !== '0';
    this.fixedStep = Number(q.get('step')) || 0;
    window.__mikdash = {
      ready: false,
      info: this.renderer.info.render, // whole-frame counts (all passes), see animate()
      camera: this.camera,
      game: this,
      postfx: Boolean(this.composer),
      /** Distance culler (null with ?lod=0): `.hidden` meshes this frame, `.instanced[i].mesh.count`. */
      get culler() {
        return this.game.culler ?? null;
      },
      /** The sun/sky rig: `.time`, `.set('dusk')` (or write store.timeOfDay). */
      get daylight() {
        return this.game.daylight;
      },
      get player() {
        return this.game.player;
      },
      /** The running guided tour (game/Tour.js), or null; `state` is 'dwell' once it stands at a stop. */
      get tour() {
        return this.game.tour ?? null;
      },
      startTour: (id, stop = 0) => this.startTour(id, stop),
      /** Walk without pointer lock (headless drivers cannot lock the pointer). */
      lock: () => {
        this.player.isLocked = true;
        this.store.setState({ locked: true });
      },
      teleport: (x, y, z) => {
        this.camera.position.set(x, y, z);
        this.player.verticalVelocity = 0;
      },
      /** Face a point (x, z) on the ground plane, level pitch. */
      lookAt: (x, z) => {
        const c = this.camera.position;
        const yaw = Math.atan2(-(x - c.x), -(z - c.z));
        this.camera.rotation.set(0, yaw, 0, 'YXZ');
        this.player.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
      },
      /** Highest walkable surface under (x, z), or 0. */
      floorAt: (x, z) => this.player.getFloorHeight(x, z, 200),
      /** True when the feet point is inside a collision box (clipped into a solid). */
      insideSolid: () => {
        const c = this.camera.position;
        const feetY = c.y - CONFIG.PLAYER_HEIGHT;
        const p = this.player.probe(c.x, c.z, feetY + CONFIG.STEP_HEIGHT + 0.05);
        const feet = new THREE.Vector3(c.x, feetY + 0.3, c.z);
        return p.inside || this.player.wallBoxes.some((b) => b.containsPoint(feet));
      },
      renderOnce: () => this.renderFrame(0, true),
      entries: byId,
      worldPos,
      levelWorldY,
      /**
       * Areas with scene-space bounds and their floor level (metres), for the fuzz walker.
       * An area without a level in meta.levels ('outside') stands at its own position.y.
       */
      areas: this.areaBounds.map(({ entry, bounds }) => {
        let level;
        try { level = levelWorldY(entry.id); } catch { level = worldPos(entry)[1]; }
        return { id: entry.id, bounds, level };
      }),
    };
    this.animate();
    // Ready once one full frame has been rendered.
    await nextFrame();
    window.__mikdash.ready = true;
  }

  /**
   * Start (or restart) the guided tour `id` at stop `stop` (0-based). The Tour drives the
   * camera from animate() instead of the player until it is stopped (Escape / Exit).
   */
  startTour(id = 'tamid', stop = 0) {
    const data = byTourId[id];
    if (!data || !this.player) return null;
    if (this.tour?.data !== data) {
      this.tour?.stop();
      this.tour = new Tour(this, data);
    }
    this.tour.start(stop);
    this.store.setState({ tourCtl: this.tour, selected: null });
    return this.tour;
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
      if (this.tour?.active) return; // the rail drives the camera; the TourCard owns the keys
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
    // HUD: the start screen may have locked the pointer during the build; sync that state.
    p.isLocked = document.pointerLockElement === this.container;
    this.store.setState({ locked: p.isLocked });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  async requestLock() {
    if (this.tour?.active) return; // the tour reads without the pointer
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
    const delta = this.fixedStep || Math.min(this.clock.getDelta(), 0.1);
    if (this.tour?.active) this.tour.update(delta);
    else this.player.update(delta);
    this.characters.update(delta, this.camera);
    this.particles.update(delta, this.camera);
    this.checkLocation();
    if (this.sky) this.sky.position.copy(this.camera.position);
    this.culler?.update(this.camera, this.container.clientHeight || 720);
    this.frameCount = (this.frameCount ?? 0) + 1;
    if (this.frameCount % 6 === 1) this.renderer.shadowMap.needsUpdate = true;
    const c = this.camera.position;
    this.store.setState({
      frame: { x: c.x, y: c.y, z: c.z, yaw: this.player.euler.y, elev: Number(this.player.getElevation()) },
    });
    this.renderFrame(delta);
  }

  renderFrame(delta, force = false) {
    if (!this.renderEnabled && !force) return;
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
    this.unsubTime?.();
    this.resizeObserver?.disconnect();
    for (const off of this.listeners) off();
    this.listeners = [];
    if (document.pointerLockElement === this.container) document.exitPointerLock();
    this.tour?.stop();
    this.tour = null;
    this.store.setState({ tourCtl: null });
    this.hotspotLabels?.dispose(); // HUD
    this.hotspotLabels = null;
    this.touch?.dispose(); // HUD
    this.touch = null;
    this.particles?.dispose();
    this.characters?.dispose();
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
