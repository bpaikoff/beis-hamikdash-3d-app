import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { TextureFactory } from './TextureFactory.js';
import { TempleBuilder } from './TempleBuilder.js';
import { PlayerController } from './PlayerController.js';
import { CharacterSystem } from './CharacterSystem.js';
import { ParticleSystem } from './ParticleSystem.js';

// ============================================================================
// MAIN GAME
// ============================================================================
export class TempleGame {
  constructor(container, callbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CONFIG.FOV, window.innerWidth / window.innerHeight, 0.1, CONFIG.RENDER_DISTANCE);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.clock = new THREE.Clock();
    this.tex = new TextureFactory();
    this.currentArea = null;
    this.nearbyKli = null;
    this.init();
  }

  init() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);
    this.camera.position.set(0, CONFIG.PLAYER_HEIGHT + 1.8, 62);

    this.callbacks.onLoad('Generating 30+ textures...');
    this.callbacks.onLoad('Building Beis Hamikdash...');
    const builder = new TempleBuilder(this.scene, this.tex);
    const { floors, walls } = builder.build();
    this.player = new PlayerController(this.camera, floors, walls);

    this.callbacks.onLoad('Creating Kohanim & animals...');
    this.characters = new CharacterSystem(this.scene, this.tex);
    // Kohen Gadol in Heichal
    this.characters.createKohen(0, 8.3, -68, true);
    // Kohanim in various areas with correct floor heights
    // Azaras Kohanim (y=7.3): z=-13 to z=-45
    [[10, -18], [-10, -18], [8, -28], [-8, -28], [12, -36], [-12, -36], [15, -42], [-15, -42]].forEach(([x, z]) =>
      this.characters.createKohen(x, 7.3, z));
    // Azaras Yisrael (y=6.8): z=-7 to z=-11
    [[8, -9], [-8, -9], [0, -9]].forEach(([x, z]) =>
      this.characters.createKohen(x, 6.8, z));
    // Ezras Nashim (y=3.8)
    [[0, 30], [15, 35], [-15, 35], [10, 20], [-10, 20]].forEach(([x, z]) =>
      this.characters.createKohen(x, 3.8, z));

    // Animals
    for (let i = 0; i < 8; i++) this.characters.createAnimal('sheep', 20 + (Math.random() - 0.5) * 10 * (i % 2 === 0 ? 1 : -1), 30 + (Math.random() - 0.5) * 10);
    for (let i = 0; i < 4; i++) this.characters.createAnimal('goat', 25 + (Math.random() - 0.5) * 8 * (i % 2 === 0 ? 1 : -1), 35 + (Math.random() - 0.5) * 8);
    for (let i = 0; i < 2; i++) this.characters.createAnimal('bull', 30 + i * 5, 45);
    for (let i = 0; i < 12; i++) this.characters.createDove((Math.random() - 0.5) * 60, 25 + Math.random() * 15, (Math.random() - 0.5) * 60);

    this.callbacks.onLoad('Adding fire & smoke...');
    this.particles = new ParticleSystem(this.scene);
    this.particles.createFire(0, 17, -28, 4);
    this.particles.createSmoke(0, 10, -75, 0.3);

    this.setupControls();
    this.callbacks.onLoad(null);
    this.animate();
  }

  setupControls() {
    document.addEventListener('keydown', e => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.player.moveF = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.player.moveB = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.player.moveL = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.player.moveR = true;
      if (e.code === 'ShiftLeft') this.player.isRun = true;
      if (e.code === 'Space') { e.preventDefault(); this.player.jump(); }
      if (e.code === 'KeyG') { this.player.toggleDebug(this.callbacks.onDebug); }
    });
    document.addEventListener('keyup', e => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.player.moveF = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.player.moveB = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.player.moveL = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.player.moveR = false;
      if (e.code === 'ShiftLeft') this.player.isRun = false;
    });
    document.addEventListener('mousemove', e => this.player.onMouseMove(e));
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    this.container.addEventListener('click', () => this.container.requestPointerLock());
    document.addEventListener('pointerlockchange', () => { this.player.isLocked = document.pointerLockElement === this.container; });
  }

  checkLocation() {
    const p = this.camera.position;
    const AREAS = {
      'outside': { name: 'מחוץ לחומות', nameEn: 'Outside the Walls', desc: 'The steps lead up through the Chuldah Gates into the Temple.', bounds: { minX: -100, maxX: 100, minZ: 60, maxZ: 150 } },
      'har-habayis': { name: 'הר הבית', nameEn: 'Temple Mount', desc: 'The vast plaza of Har HaBayis, where all of Israel gathers.', bounds: { minX: -70, maxX: 70, minZ: 58, maxZ: 70 } },
      'ezras-nashim': { name: 'עזרת נשים', nameEn: "Women's Court", desc: "The outer court. Levi'im sing on the 15 steps.", bounds: { minX: -32, maxX: 32, minZ: -7, maxZ: 58 } },
      'azaras-yisrael': { name: 'עזרת ישראל', nameEn: 'Israelites Court', desc: 'Men bringing Korbanos stand here to observe.', bounds: { minX: -26, maxX: 26, minZ: -12, maxZ: -7 } },
      'azaras-kohanim': { name: 'עזרת כהנים', nameEn: 'Kohanim Court', desc: 'The inner courtyard. The Mizbeiach burns eternally.', bounds: { minX: -26, maxX: 26, minZ: -45, maxZ: -12 } },
      'heichal': { name: 'היכל', nameEn: 'Sanctuary', desc: 'The golden hall. Menorah, Shulchan, and Golden Altar.', bounds: { minX: -9, maxX: 9, minZ: -78, maxZ: -45 } },
      'kodesh-hakodashim': { name: 'קודש הקודשים', nameEn: 'Holy of Holies', desc: 'The Aron HaKodesh rests upon the Even HaShtiya.', bounds: { minX: -5, maxX: 5, minZ: -90, maxZ: -78 } }
    };

    let newArea = 'outside';
    for (const [id, area] of Object.entries(AREAS)) {
      if (id === 'outside') continue;
      const b = area.bounds;
      if (p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ) newArea = id;
    }
    if (newArea !== this.currentArea) {
      this.currentArea = newArea;
      const a = AREAS[newArea];
      this.callbacks.onLoc({ name: a.name, nameEn: a.nameEn, desc: a.desc });
    }

    // Holy vessels
    const KEILIM = {
      // === HEICHAL INTERIOR ===
      menorah: { name: 'מנורה', nameEn: 'Golden Menorah', icon: '🕎', desc: 'Seven branches, 18 tefachim tall, pure beaten gold. Lit daily by the Kohen.', pos: { x: -3, z: -68 } },
      shulchan: { name: 'שולחן הפנים', nameEn: 'Showbread Table', icon: '🍞', desc: '12 loaves arranged in two stacks, changed every Shabbos. Miraculously stayed fresh.', pos: { x: 3, z: -68 } },
      mizbeiachHazahav: { name: 'מזבח הזהב', nameEn: 'Golden Incense Altar', icon: '✨', desc: 'For the Ketores (incense), offered morning and afternoon. One amah square.', pos: { x: 0, z: -75 } },
      paroches: { name: 'פרוכת', nameEn: 'Paroches (Curtain)', icon: '🪟', desc: 'The sacred curtain separating the Heichal from the Kodesh Hakodashim. Embroidered with Keruvim.', pos: { x: 0, z: -78 } },

      // === KODESH HAKODASHIM ===
      aron: { name: 'ארון הקודש', nameEn: 'Holy Ark', icon: '📦', desc: 'Contains the Luchos. Golden Keruvim spread wings above, facing each other.', pos: { x: 0, z: -83 } },
      evenHashtiya: { name: 'אבן השתיה', nameEn: 'Foundation Stone', icon: '🪨', desc: 'The rock from which the world was created. The Ark rested upon it.', pos: { x: 0, z: -83 } },

      // === ULAM (ENTRANCE HALL) ===
      yachin: { name: 'יכין', nameEn: 'Yachin Pillar', icon: '🏛️', desc: 'Southern copper pillar at the Ulam entrance. 18 amos tall. Name means "He establishes."', pos: { x: -5, z: -49 } },
      boaz: { name: 'בועז', nameEn: 'Boaz Pillar', icon: '🏛️', desc: 'Northern copper pillar at the Ulam entrance. 18 amos tall. Name means "In Him is strength."', pos: { x: 5, z: -49 } },

      // === AZARAS KOHANIM ===
      mizbeiach: { name: 'מזבח העולה', nameEn: 'Great Altar', icon: '🔥', desc: '32 amos square at base, 10 amos tall. The eternal fire burned here continuously.', pos: { x: 0, z: -28 } },
      kevesh: { name: 'כבש', nameEn: 'Altar Ramp', icon: '📐', desc: 'The ramp for ascending the altar. 32 amos long, on the south side. No steps, as commanded.', pos: { x: 0, z: -17 } },
      kiyor: { name: 'כיור', nameEn: 'Copper Laver', icon: '💧', desc: 'Made from copper mirrors. Kohanim sanctify hands and feet before the Avodah.', pos: { x: -8, z: -38 } },
      slaughterTables: { name: 'שולחנות השיש', nameEn: 'Marble Slaughter Tables', icon: '🔪', desc: 'Eight marble tables for preparing the sacrifices. Intestines were washed here.', pos: { x: 14, z: -38 } },
      slaughterRings: { name: 'טבעות', nameEn: 'Slaughter Rings', icon: '⭕', desc: '24 rings set in the floor for securing animals during slaughter.', pos: { x: 8, z: -35 } },
      hangingPillars: { name: 'עמודים', nameEn: 'Hanging Pillars', icon: '🪝', desc: 'Cedar pillars with iron hooks for hanging and skinning sacrifices.', pos: { x: 6, z: -36 } },

      // === CHAMBERS ===
      lishkasHagazis: { name: 'לשכת הגזית', nameEn: 'Chamber of Hewn Stone', icon: '⚖️', desc: 'The Sanhedrin of 71 sat here, half inside the Azara. The supreme court of Israel.', pos: { x: -21, z: -35 } },
      beisHamoked: { name: 'בית המוקד', nameEn: 'Chamber of the Hearth', icon: '🏠', desc: 'Kohanim on duty slept here. Fire burned constantly to warm them.', pos: { x: 21, z: -20 } },

      // === DUCHAN & TRANSITION AREAS ===
      duchan: { name: 'דוכן', nameEn: 'Duchan (Levite Platform)', icon: '🎵', desc: 'The Levites stood here to sing during the Avodah, between Yisrael and Kohanim.', pos: { x: 0, z: -12 } },

      // === EZRAS NASHIM CHAMBERS ===
      chamberOils: { name: 'לשכת השמנים', nameEn: 'Chamber of Oils', icon: '🫒', desc: 'Storage for oil and wine used in the Temple service.', pos: { x: -27, z: 52 } },
      chamberLepers: { name: 'לשכת המצורעים', nameEn: 'Chamber of Lepers', icon: '🏥', desc: 'Healed metzora\'im (lepers) immersed here before bringing their offerings.', pos: { x: 27, z: 52 } },
      chamberNazarites: { name: 'לשכת הנזירים', nameEn: 'Chamber of Nazarites', icon: '✂️', desc: 'Nazarites cooked their shelamim offerings and shaved their hair here.', pos: { x: -27, z: 14 } },
      chamberWood: { name: 'לשכת העצים', nameEn: 'Chamber of Wood', icon: '🪵', desc: 'Kohanim with blemishes inspected wood for the altar fire here.', pos: { x: 27, z: 14 } },

      // === GATES ===
      nicanorGate: { name: 'שער ניקנור', nameEn: 'Nicanor Gate', icon: '🏛️', desc: 'The great copper gate from Alexandria. Miraculously survived a storm at sea.', pos: { x: 0, z: 8 } },
      beautifulGate: { name: 'שער היפה', nameEn: 'Beautiful Gate', icon: '🏛️', desc: 'Main gate to Ezras Nashim, plated with Corinthian bronze.', pos: { x: 0, z: 58 } },
      chuldahL: { name: 'שער חולדה', nameEn: 'Chuldah Gate (West)', icon: '🚪', desc: 'Southern entrance from the City of David. Named for the prophetess.', pos: { x: -27, z: 68 } },
      chuldahR: { name: 'שער חולדה', nameEn: 'Chuldah Gate (East)', icon: '🚪', desc: 'Southern entrance from the City of David. Named for the prophetess.', pos: { x: 27, z: 68 } },
      // Azara side gates - West
      kindlingGate: { name: 'שער הדלק', nameEn: 'Kindling Gate', icon: '🚪', desc: 'Wood for the altar fire was brought through here.', pos: { x: -26, z: -18 } },
      waterGate: { name: 'שער המים', nameEn: 'Water Gate', icon: '🚪', desc: 'Water for Nisuch HaMayim (water libation) on Sukkos entered here.', pos: { x: -26, z: -29 } },
      firstlingsGate: { name: 'שער הבכורות', nameEn: 'Gate of Firstlings', icon: '🚪', desc: 'Firstborn animals for redemption were brought through this gate.', pos: { x: -26, z: -38 } },
      // Azara side gates - East
      hearthGate: { name: 'שער בית המוקד', nameEn: 'Hearth Gate', icon: '🚪', desc: 'Entrance to the Chamber of the Hearth where Kohanim slept.', pos: { x: 26, z: -18 } },
      flameGate: { name: 'שער הניצוץ', nameEn: 'Flame Gate', icon: '🚪', desc: 'Fire from here was used to relight the altar if needed.', pos: { x: 26, z: -29 } },
      sacrificeGate: { name: 'שער הקרבן', nameEn: 'Sacrifice Gate', icon: '🚪', desc: 'Kodshei Kodashim sacrifices were brought through this gate.', pos: { x: 26, z: -38 } }
    };

    let closest = null, minDist = 8;
    for (const [id, kli] of Object.entries(KEILIM)) {
      const d = Math.sqrt((p.x - kli.pos.x) ** 2 + (p.z - kli.pos.z) ** 2);
      if (d < minDist) { minDist = d; closest = { id, ...kli }; }
    }
    if (closest?.id !== this.nearbyKli?.id) {
      this.nearbyKli = closest;
      this.callbacks.onKli(closest);
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.player.update(delta);
    this.characters.update(delta);
    this.particles.update(delta);
    this.checkLocation();
    this.callbacks.onUpd({ position: this.camera.position, rotation: this.player.euler.y, elevation: this.player.getElevation() });
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
  }
}
