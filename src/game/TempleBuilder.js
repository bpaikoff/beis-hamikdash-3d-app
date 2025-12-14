import * as THREE from 'three';
import { CONFIG } from '../config.js';

// ============================================================================
// TEMPLE BUILDER - with fixed layout for accessibility
// ============================================================================
export class TempleBuilder {
  constructor(scene, tex) {
    this.scene = scene;
    this.tex = tex;
    this.floors = [];
    this.walls = [];
    this.createMaterials();
  }

  createMaterials() {
    this.mat = {
      stone: new THREE.MeshStandardMaterial({ map: this.tex.get('jerusalemStone'), normalMap: this.tex.normalMap(), roughness: 0.85, metalness: 0.05 }),
      stonePolished: new THREE.MeshStandardMaterial({ map: this.tex.get('jerusalemStone'), roughness: 0.4, metalness: 0.1 }),
      gold: new THREE.MeshStandardMaterial({ map: this.tex.get('goldPolished'), roughness: 0.15, metalness: 0.95 }),
      goldEng: new THREE.MeshStandardMaterial({ map: this.tex.get('goldEngraved'), roughness: 0.25, metalness: 0.9 }),
      copper: new THREE.MeshStandardMaterial({ map: this.tex.get('copper'), roughness: 0.35, metalness: 0.85 }),
      copperP: new THREE.MeshStandardMaterial({ map: this.tex.get('copperPatina'), roughness: 0.5, metalness: 0.7 }),
      cedar: new THREE.MeshStandardMaterial({ map: this.tex.get('cedarWood'), roughness: 0.7, metalness: 0.05 }),
      acacia: new THREE.MeshStandardMaterial({ map: this.tex.get('acaciaWood'), roughness: 0.65, metalness: 0.05 }),
      marbleW: new THREE.MeshStandardMaterial({ map: this.tex.get('marbleWhite'), roughness: 0.2, metalness: 0.1 }),
      marbleR: new THREE.MeshStandardMaterial({ map: this.tex.get('marbleRose'), roughness: 0.25, metalness: 0.1 }),
      paroches: new THREE.MeshStandardMaterial({ map: this.tex.get('paroches'), roughness: 0.85, metalness: 0.1, side: THREE.DoubleSide }),
      ground: new THREE.MeshStandardMaterial({ map: this.tex.get('groundSand'), roughness: 0.95 }),
      floor: new THREE.MeshStandardMaterial({ map: this.tex.get('floorTiles'), roughness: 0.6 }),
      mosaic: new THREE.MeshStandardMaterial({ map: this.tex.get('mosaic'), roughness: 0.5 }),
      water: new THREE.MeshStandardMaterial({ map: this.tex.get('water'), roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.8 }),
      altar: new THREE.MeshStandardMaterial({ color: 0x5A4A40, roughness: 0.9 })
    };
    this.tex.get('jerusalemStone').repeat.set(4, 4);
    this.tex.get('floorTiles').repeat.set(8, 8);
    this.tex.get('marbleWhite').repeat.set(4, 4);
  }

  addFloor(x, y, z, w, d, mat, name) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), mat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.userData = { isFloor: true, name };
    this.scene.add(m);
    this.floors.push(m);
    return m;
  }

  addWall(x, y, z, w, h, d, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h/2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData = { isWall: true };
    this.scene.add(m);
    this.walls.push(m);
    return m;
  }

  addStairs(x, y, z, w, totalH, d, steps, mat, dir = 'north') {
    const sh = totalH / steps;
    const sd = d / steps;
    for (let i = 0; i < steps; i++) {
      const sy = y + i * sh + sh/2;
      const sz = dir === 'north' ? z - i * sd : z + i * sd;
      const step = new THREE.Mesh(new THREE.BoxGeometry(w, sh, sd), mat);
      step.position.set(x, sy, sz);
      step.receiveShadow = true;
      step.castShadow = true;
      step.userData = { isFloor: true, isStep: true };
      this.scene.add(step);
      this.floors.push(step);
    }
  }

  addColumn(x, y, z, r, h, mat) {
    const g = new THREE.Group();
    // Base
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(r*1.3, r*1.4, h*0.06, 16), mat));
    g.children[0].position.y = h * 0.03;
    // Shaft with entasis
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      pts.push(new THREE.Vector2(r * (1 + Math.sin(t * Math.PI) * 0.04) * (1 - t * 0.08), t * h * 0.88));
    }
    g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 16), mat));
    g.children[1].position.y = h * 0.06;
    // Capital
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(r*1.2, r*0.95, h*0.06, 16), mat));
    g.children[2].position.y = h * 0.94;
    g.position.set(x, y, z);
    g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    this.scene.add(g);
    return g;
  }

  build() {
    this.buildEnv();
    this.buildHarHaBayis();
    this.buildOuterWalls();
    this.buildEzrasNashim();
    this.buildAzaros();
    this.buildHeichal();
    this.buildKodeshHakodashim();
    this.buildKeilim();
    this.buildLighting();
    return { floors: this.floors, walls: this.walls };
  }

  buildEnv() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500, 50, 50), this.mat.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData = { isFloor: true };
    this.scene.add(ground);
    this.floors.push(ground);

    const skyGeo = new THREE.SphereGeometry(CONFIG.RENDER_DISTANCE, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x4A90C8) },
        bottomColor: { value: new THREE.Color(0xD4E4F4) },
        sunPos: { value: new THREE.Vector3(0.5, 0.3, 0.5).normalize() }
      },
      vertexShader: `varying vec3 vPos; void main() { vPos = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 topColor, bottomColor, sunPos; varying vec3 vPos; void main() { vec3 dir = normalize(vPos); float h = dir.y * 0.5 + 0.5; vec3 sky = mix(bottomColor, topColor, pow(h, 0.6)); float sun = max(0.0, dot(dir, sunPos)); sky += vec3(1.0,0.98,0.9) * pow(sun, 32.0) * 0.5 + pow(sun, 4.0) * 0.2; gl_FragColor = vec4(sky, 1.0); }`,
      side: THREE.BackSide
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    // Distant hills
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = 180 + Math.random() * 40;
      const height = 15 + Math.random() * 25;
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(30 + Math.random() * 20, height, 6),
        new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.1, 0.2, 0.5 + Math.random() * 0.1), roughness: 0.9 })
      );
      m.position.set(Math.cos(angle) * dist, height/2 - 5, Math.sin(angle) * dist);
      m.rotation.y = Math.random() * Math.PI;
      this.scene.add(m);
    }
  }

  buildHarHaBayis() {
    // Main platform - the Temple Mount floor
    this.addFloor(0, 1.8, 22, 140, 88, this.mat.floor, 'har-habayis');

    // Fill underneath the platform
    const platformFill = new THREE.Mesh(new THREE.BoxGeometry(140, 1.8, 88), this.mat.stone);
    platformFill.position.set(0, 0.9, 22);
    platformFill.receiveShadow = true;
    this.scene.add(platformFill);

    // Stairs from ground (y=0) up to Har HaBayis (y=1.8) through the Chuldah Gates
    // FIXED: Stairs now properly aligned with gate openings
    // Left gate stairs (centered at x=-27)
    this.addStairs(-27, 0, 78, 12, 1.8, 12, 9, this.mat.stone, 'north');
    // Right gate stairs (centered at x=27)
    this.addStairs(27, 0, 78, 12, 1.8, 12, 9, this.mat.stone, 'north');
  }

  buildOuterWalls() {
    const wallH = 24;
    const wallThick = 5;
    const southZ = 68;
    const northZ = -22;
    const eastX = 72;
    const westX = -72;

    // === SOUTH WALL with two Chuldah Gate openings ===
    // FIXED: Gate openings properly sized and positioned
    // Gates are 14 units wide for comfortable passage
    const gateWidth = 14;
    const gateHeight = 8;

    // Far left section (from west wall to left gate)
    // Left gate is centered at x=-27, so opening is from x=-34 to x=-20
    this.addWall(-53, 0, southZ, 38, wallH, wallThick, this.mat.stone);

    // Section between gates (from x=-20 to x=20)
    this.addWall(0, 0, southZ, 40, wallH, wallThick, this.mat.stone);

    // Far right section (from right gate to east wall)
    // Right gate is centered at x=27, so opening is from x=20 to x=34
    this.addWall(53, 0, southZ, 38, wallH, wallThick, this.mat.stone);

    // Gate lintels (above the openings)
    this.addWall(-27, gateHeight, southZ, gateWidth, wallH - gateHeight, wallThick, this.mat.stone);
    this.addWall(27, gateHeight, southZ, gateWidth, wallH - gateHeight, wallThick, this.mat.stone);

    // === NORTH WALL - solid ===
    this.addWall(0, 0, northZ, 144, wallH, wallThick, this.mat.stone);

    // === EAST WALL - solid ===
    this.addWall(eastX, 0, 23, wallThick, wallH, 90, this.mat.stone);

    // === WEST WALL - solid ===
    this.addWall(westX, 0, 23, wallThick, wallH, 90, this.mat.stone);

    // === Crenellations on top ===
    for (let i = -68; i <= 68; i += 8) {
      // Skip over gate areas
      if (Math.abs(i + 27) > gateWidth/2 && Math.abs(i - 27) > gateWidth/2) {
        this.addWall(i, wallH, southZ, 3, 3, wallThick + 0.5, this.mat.stone);
      }
      this.addWall(i, wallH, northZ, 3, 3, wallThick + 0.5, this.mat.stone);
    }
    for (let z = northZ + 5; z <= southZ - 5; z += 8) {
      this.addWall(eastX, wallH, z, wallThick + 0.5, 3, 3, this.mat.stone);
      this.addWall(westX, wallH, z, wallThick + 0.5, 3, 3, this.mat.stone);
    }

    // === Guard towers at corners ===
    [[westX, southZ], [eastX, southZ], [westX, northZ], [eastX, northZ]].forEach(([tx, tz]) => {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(10, wallH + 8, 10), this.mat.stone);
      tower.position.set(tx, (wallH + 8) / 2, tz);
      tower.castShadow = true;
      tower.receiveShadow = true;
      this.scene.add(tower);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 5, 4), this.mat.stonePolished);
      roof.position.set(tx, wallH + 8 + 2.5, tz);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      this.scene.add(roof);
    });
  }

  buildEzrasNashim() {
    // Court of the Women - with FIXED accessibility
    const floorY = 3.8;
    const harHaBayisY = 1.8;
    const wallH = 14;
    const courtWidth = 66;
    const courtDepth = 50;
    const southZ = 58;
    const northZ = southZ - courtDepth; // 8
    const centerZ = (southZ + northZ) / 2; // 33

    // === MAIN FLOOR ===
    this.addFloor(0, floorY, centerZ, courtWidth, courtDepth, this.mat.mosaic, 'ezras-nashim');

    // Solid fill under floor
    const floorFill = new THREE.Mesh(
      new THREE.BoxGeometry(courtWidth, floorY - harHaBayisY, courtDepth),
      this.mat.stone
    );
    floorFill.position.set(0, harHaBayisY + (floorY - harHaBayisY) / 2, centerZ);
    floorFill.receiveShadow = true;
    this.scene.add(floorFill);

    // === ENTRANCE STAIRS (Beautiful Gate / Sha'ar HaYafeh) ===
    // FIXED: Stairs positioned to not collide with south wall
    this.addStairs(0, harHaBayisY, southZ + 6, 16, floorY - harHaBayisY, 8, 12, this.mat.stone, 'north');

    // === WALLS - with proper gate openings ===
    const gateWidth = 12;
    const gateHeight = 8;

    // South wall with Beautiful Gate
    this.addWall(-24, floorY, southZ, 18, wallH, 2, this.mat.stonePolished);
    this.addWall(24, floorY, southZ, 18, wallH, 2, this.mat.stonePolished);
    this.addWall(0, floorY + gateHeight, southZ, gateWidth, wallH - gateHeight, 2, this.mat.stonePolished);
    this.addGateFrame(0, floorY, southZ - 1, gateWidth, gateHeight, this.mat.copperP, 'Beautiful Gate');

    // === SIDE WALLS with proper gate openings ===
    // East wall with gate in middle
    const sideGateZ = 33; // center of court
    this.addWall(33, floorY, 47, 2, wallH, 20, this.mat.stonePolished); // south section
    this.addWall(33, floorY, 19, 2, wallH, 20, this.mat.stonePolished); // north section
    this.addWall(33, floorY + 5, sideGateZ, 2, wallH - 5, 6, this.mat.stonePolished); // lintel

    // West wall with gate in middle
    this.addWall(-33, floorY, 47, 2, wallH, 20, this.mat.stonePolished);
    this.addWall(-33, floorY, 19, 2, wallH, 20, this.mat.stonePolished);
    this.addWall(-33, floorY + 5, sideGateZ, 2, wallH - 5, 6, this.mat.stonePolished);

    // === FOUR CORNER CHAMBERS - FIXED with proper accessibility ===
    const chambers = [
      { pos: [-27, 52], name: 'לשכת השמנים', nameEn: 'Chamber of Oils', doorDir: 'east' },
      { pos: [27, 52], name: 'לשכת המצורעים', nameEn: 'Chamber of Lepers', doorDir: 'west' },
      { pos: [-27, 14], name: 'לשכת הנזירים', nameEn: 'Chamber of Nazarites', doorDir: 'east' },
      { pos: [27, 14], name: 'לשכת העצים', nameEn: 'Chamber of Wood', doorDir: 'west' }
    ];

    chambers.forEach(ch => {
      const chamberSize = 10;
      const chamberHeight = 8;
      const doorWidth = 3;
      const doorHeight = 5;

      // Create chamber as individual walls instead of solid box for accessibility
      const cx = ch.pos[0];
      const cz = ch.pos[1];
      const half = chamberSize / 2;

      // Back wall (opposite to door)
      if (ch.doorDir === 'east') {
        this.addWallNonCollide(cx - half, floorY, cz, 0.5, chamberHeight, chamberSize, this.mat.stonePolished);
      } else {
        this.addWallNonCollide(cx + half, floorY, cz, 0.5, chamberHeight, chamberSize, this.mat.stonePolished);
      }

      // Front wall with door opening
      if (ch.doorDir === 'east') {
        // Right side of door
        this.addWallNonCollide(cx + half, floorY, cz - half + (chamberSize - doorWidth) / 4, 0.5, chamberHeight, (chamberSize - doorWidth) / 2, this.mat.stonePolished);
        // Left side of door
        this.addWallNonCollide(cx + half, floorY, cz + half - (chamberSize - doorWidth) / 4, 0.5, chamberHeight, (chamberSize - doorWidth) / 2, this.mat.stonePolished);
        // Above door
        this.addWallNonCollide(cx + half, floorY + doorHeight, cz, 0.5, chamberHeight - doorHeight, doorWidth, this.mat.stonePolished);
      } else {
        this.addWallNonCollide(cx - half, floorY, cz - half + (chamberSize - doorWidth) / 4, 0.5, chamberHeight, (chamberSize - doorWidth) / 2, this.mat.stonePolished);
        this.addWallNonCollide(cx - half, floorY, cz + half - (chamberSize - doorWidth) / 4, 0.5, chamberHeight, (chamberSize - doorWidth) / 2, this.mat.stonePolished);
        this.addWallNonCollide(cx - half, floorY + doorHeight, cz, 0.5, chamberHeight - doorHeight, doorWidth, this.mat.stonePolished);
      }

      // North and South walls
      this.addWallNonCollide(cx, floorY, cz + half, chamberSize, chamberHeight, 0.5, this.mat.stonePolished);
      this.addWallNonCollide(cx, floorY, cz - half, chamberSize, chamberHeight, 0.5, this.mat.stonePolished);

      // Chamber floor
      const chamberFloor = new THREE.Mesh(
        new THREE.BoxGeometry(chamberSize, 0.3, chamberSize),
        this.mat.floor
      );
      chamberFloor.position.set(cx, floorY + 0.15, cz);
      chamberFloor.receiveShadow = true;
      chamberFloor.userData = { isFloor: true };
      this.scene.add(chamberFloor);
      this.floors.push(chamberFloor);

      // Roof
      const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 4, 4), this.mat.stone);
      roof.position.set(cx, floorY + chamberHeight + 2, cz);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      this.scene.add(roof);
    });

    // === COLONNADE around the court ===
    for (let x = -24; x <= 24; x += 6) {
      this.addColumn(x, floorY, southZ - 3, 0.5, 10, this.mat.marbleW);
    }
    for (let z = 16; z <= 50; z += 6) {
      this.addColumn(-30, floorY, z, 0.5, 10, this.mat.marbleW);
      this.addColumn(30, floorY, z, 0.5, 10, this.mat.marbleW);
    }

    // === NICANOR GATE (north wall) ===
    this.addWall(-26, floorY, northZ, 20, wallH, 2, this.mat.stonePolished);
    this.addWall(26, floorY, northZ, 20, wallH, 2, this.mat.stonePolished);
    this.addWall(0, floorY + 10, northZ, 14, wallH - 10, 2, this.mat.stonePolished);
    this.addGateFrame(0, floorY, northZ - 1, 14, 10, this.mat.copper, 'Nicanor Gate');

    // === 15 SEMICIRCULAR STEPS (Shir HaMaalos) ===
    // FIXED: Steps properly connect floor levels
    const stepsRise = 3.0; // Rise from floorY (3.8) to yisraelY (6.8)
    for (let i = 0; i < 15; i++) {
      const stepY = floorY + ((i + 1) / 15) * stepsRise;
      const stepZ = northZ - 1 - i;
      const stepWidth = 44 - i * 0.5;
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(stepWidth, 0.2, 1),
        this.mat.marbleW
      );
      stepMesh.position.set(0, stepY, stepZ);
      stepMesh.receiveShadow = true;
      stepMesh.userData = { isFloor: true, isStep: true, stepNum: i + 1 };
      this.scene.add(stepMesh);
      this.floors.push(stepMesh);
    }
  }

  // Helper: Add wall that doesn't block player (for interior decoration)
  addWallNonCollide(x, y, z, w, h, d, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h/2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    // Note: NOT marked as isWall so player can pass through chambers
    this.scene.add(m);
    return m;
  }

  addGateFrame(x, y, z, width, height, mat, name) {
    const frameThick = 0.8;
    // Left pillar
    const left = new THREE.Mesh(new THREE.BoxGeometry(frameThick, height, frameThick), mat);
    left.position.set(x - width/2 + frameThick/2, y + height/2, z);
    left.castShadow = true;
    this.scene.add(left);
    // Right pillar
    const right = new THREE.Mesh(new THREE.BoxGeometry(frameThick, height, frameThick), mat);
    right.position.set(x + width/2 - frameThick/2, y + height/2, z);
    right.castShadow = true;
    this.scene.add(right);
    // Top beam
    const top = new THREE.Mesh(new THREE.BoxGeometry(width, frameThick, frameThick), mat);
    top.position.set(x, y + height - frameThick/2, z);
    top.castShadow = true;
    this.scene.add(top);
  }

  buildAzaros() {
    // FIXED LAYOUT - all coordinates connect seamlessly
    const yisraelY = 6.8;
    const duchanY = 7.0;
    const kohanimY = 7.3;
    const baseY = 3.8;
    const wallH = 14;
    const innerWidth = 52;

    // === AZARAS YISRAEL (Court of Israelites) ===
    this.addFloor(0, yisraelY, -9, innerWidth, 4, this.mat.marbleW, 'azaras-yisrael');
    this.addSolidFill(0, baseY, yisraelY, -9, innerWidth, 4);

    // === DUCHAN (Levite Platform) ===
    this.addFloor(0, duchanY, -12, innerWidth - 6, 2, this.mat.marbleR, 'duchan');
    this.addStepRow(0, yisraelY, -11, innerWidth - 6, duchanY - yisraelY);

    // === AZARAS KOHANIM (Priests' Court) ===
    const kohanimDepth = 32;
    const kohanimCenterZ = -13 - kohanimDepth/2; // -29
    this.addFloor(0, kohanimY, kohanimCenterZ, innerWidth, kohanimDepth, this.mat.floor, 'azaras-kohanim');
    this.addSolidFill(0, baseY, kohanimY, kohanimCenterZ, innerWidth, kohanimDepth);
    this.addStepRow(0, duchanY, -13, innerWidth - 6, kohanimY - duchanY);

    // === SIDE WALLS with FIXED gate openings ===
    const wallStartZ = -7;
    const wallEndZ = -45;

    // West wall with gates
    this.buildSideWallWithGates(-26, baseY, wallH, wallStartZ, wallEndZ, [
      { z: -18, name: 'שער הדלק', nameEn: 'Kindling Gate' },
      { z: -29, name: 'שער המים', nameEn: 'Water Gate' },
      { z: -40, name: 'שער הבכורות', nameEn: 'Gate of Firstlings' }
    ], kohanimY);

    // East wall with gates
    this.buildSideWallWithGates(26, baseY, wallH, wallStartZ, wallEndZ, [
      { z: -18, name: 'שער בית המוקד', nameEn: 'Hearth Gate' },
      { z: -29, name: 'שער הניצוץ', nameEn: 'Flame Gate' },
      { z: -40, name: 'שער הקרבן', nameEn: 'Sacrifice Gate' }
    ], kohanimY);

    // === SLAUGHTER AREA ===
    this.buildSlaughterArea(14, kohanimY, -38);

    // === CHAMBERS ===
    this.addChamber(-21, kohanimY, -35, 8, 6, 10, 'לשכת הגזית', 'Chamber of Hewn Stone');
    this.addChamber(21, kohanimY, -20, 8, 6, 8, 'בית המוקד', 'Chamber of the Hearth');
  }

  addSolidFill(x, bottomY, topY, z, width, depth) {
    const height = topY - bottomY;
    const fill = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      this.mat.stone
    );
    fill.position.set(x, bottomY + height/2, z);
    fill.receiveShadow = true;
    this.scene.add(fill);
  }

  addStepRow(x, baseY, z, width, rise) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(width, rise, 1),
      this.mat.marbleW
    );
    step.position.set(x, baseY + rise/2, z);
    step.userData = { isFloor: true, isStep: true };
    step.receiveShadow = true;
    this.scene.add(step);
    this.floors.push(step);
  }

  buildSideWallWithGates(x, baseY, wallH, startZ, endZ, gates, floorY) {
    const gateWidth = 5;
    const gateHeight = 6;

    // Sort gates by z position (descending - from north to south)
    gates.sort((a, b) => b.z - a.z);

    let currentZ = startZ;
    gates.forEach((gate) => {
      const segmentStart = currentZ;
      const segmentEnd = gate.z + gateWidth/2;

      if (segmentStart > segmentEnd) {
        const segDepth = segmentStart - segmentEnd;
        const segCenterZ = (segmentStart + segmentEnd) / 2;
        this.addWall(x, baseY, segCenterZ, 2, wallH, segDepth, this.mat.stonePolished);
      }

      // Gate lintel (wall above opening)
      this.addWall(x, baseY + gateHeight, gate.z, 2, wallH - gateHeight, gateWidth, this.mat.stonePolished);

      // Gate frame (decorative, non-blocking)
      this.addGateFrame(x, floorY, gate.z, gateWidth, gateHeight, this.mat.copperP, gate.nameEn);

      currentZ = gate.z - gateWidth/2;
    });

    // Final wall segment after last gate
    if (currentZ > endZ) {
      const segDepth = currentZ - endZ;
      const segCenterZ = (currentZ + endZ) / 2;
      this.addWall(x, baseY, segCenterZ, 2, wallH, segDepth, this.mat.stonePolished);
    }
  }

  buildSlaughterArea(centerX, baseY, centerZ) {
    // 8 marble slaughter tables
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        const table = new THREE.Mesh(
          new THREE.BoxGeometry(1.8, 0.5, 1.2),
          this.mat.marbleW
        );
        table.position.set(centerX - 4 + col * 2.5, baseY + 0.25, centerZ - row * 2);
        table.castShadow = true;
        table.receiveShadow = true;
        this.scene.add(table);
      }
    }

    // Slaughter rings
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.12, 0.025, 8, 16),
          this.mat.copper
        );
        ring.position.set(centerX - 6 + col * 2, baseY + 0.01, centerZ + 3 - row * 1.2);
        ring.rotation.x = Math.PI / 2;
        this.scene.add(ring);
      }
    }

    // Hanging pillars
    [centerX - 8, centerX + 8].forEach(px => {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 6, 8),
        this.mat.cedar
      );
      pillar.position.set(px, baseY + 3, centerZ + 2);
      pillar.castShadow = true;
      this.scene.add(pillar);

      const bar = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 0.2), this.mat.cedar);
      bar.position.set(px, baseY + 5.5, centerZ + 2);
      this.scene.add(bar);
    });
  }

  addChamber(x, baseY, z, w, h, d, nameHeb, nameEn) {
    const chamber = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      this.mat.stonePolished
    );
    chamber.position.set(x, baseY + h/2, z);
    chamber.castShadow = true;
    chamber.receiveShadow = true;
    chamber.userData = { name: nameHeb, nameEn: nameEn };
    this.scene.add(chamber);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.5, 0.5, d + 0.5),
      this.mat.stone
    );
    roof.position.set(x, baseY + h + 0.25, z);
    this.scene.add(roof);
  }

  buildHeichal() {
    const kohanimY = 7.3;
    const ulamY = 8.0;
    const heichalY = 8.3;
    const wallH = 20;
    const groundY = 3.8;

    // === 12 STEPS from Azara (z=-45) up to Ulam (z=-48) ===
    const stepDepth = 0.25;
    const totalStepDepth = 3;
    const risePerStep = (ulamY - kohanimY) / 12;

    for (let i = 0; i < 12; i++) {
      const stepY = kohanimY + (i + 1) * risePerStep;
      const stepZ = -45 - (i * totalStepDepth / 12);

      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(12, 0.15, stepDepth + 0.1),
        this.mat.marbleW
      );
      stepMesh.position.set(0, stepY, stepZ - stepDepth/2);
      stepMesh.receiveShadow = true;
      stepMesh.userData = { isFloor: true, isStep: true };
      this.scene.add(stepMesh);
      this.floors.push(stepMesh);
    }

    // Solid base under steps
    const stepsBase = new THREE.Mesh(
      new THREE.BoxGeometry(12, kohanimY - groundY, totalStepDepth),
      this.mat.stone
    );
    stepsBase.position.set(0, groundY + (kohanimY - groundY)/2, -46.5);
    this.scene.add(stepsBase);

    // === ULAM (Porch) ===
    const ulamWidth = 20;
    const ulamDepth = 10;
    const ulamCenterZ = -53;

    this.addFloor(0, ulamY, ulamCenterZ, ulamWidth, ulamDepth, this.mat.marbleW, 'ulam');

    const ulamBase = new THREE.Mesh(
      new THREE.BoxGeometry(ulamWidth, ulamY - groundY, ulamDepth),
      this.mat.stone
    );
    ulamBase.position.set(0, groundY + (ulamY - groundY)/2, ulamCenterZ);
    this.scene.add(ulamBase);

    // Ulam side walls
    this.addWall(-10, ulamY, ulamCenterZ, 2, wallH, ulamDepth + 2, this.mat.stonePolished);
    this.addWall(10, ulamY, ulamCenterZ, 2, wallH, ulamDepth + 2, this.mat.stonePolished);

    // === YACHIN AND BOAZ PILLARS ===
    [[-5, 'יכין', 'Yachin'], [5, 'בועז', 'Boaz']].forEach(([px, heb, eng]) => {
      const pillar = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 2, 16), this.mat.copper);
      base.position.y = 1;
      pillar.add(base);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 14, 16), this.mat.copper);
      shaft.position.y = 9;
      pillar.add(shaft);
      const capital = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 0.9, 3, 16), this.mat.copperP);
      capital.position.y = 17.5;
      pillar.add(capital);

      pillar.position.set(px, ulamY, -49);
      pillar.traverse(c => { if (c.isMesh) c.castShadow = true; });
      pillar.userData = { name: heb, nameEn: eng };
      this.scene.add(pillar);
    });

    // === HEICHAL (Holy Place) ===
    const heichalWidth = 10;
    const heichalDepth = 20;
    const heichalCenterZ = -68;

    this.addFloor(0, heichalY, heichalCenterZ, heichalWidth, heichalDepth, this.mat.cedar, 'heichal');

    // Step from Ulam to Heichal
    const ulamToHeichalStep = new THREE.Mesh(
      new THREE.BoxGeometry(heichalWidth, heichalY - ulamY, 1),
      this.mat.marbleW
    );
    ulamToHeichalStep.position.set(0, ulamY + (heichalY - ulamY)/2, -58);
    ulamToHeichalStep.userData = { isFloor: true, isStep: true };
    this.scene.add(ulamToHeichalStep);
    this.floors.push(ulamToHeichalStep);

    const heichalBase = new THREE.Mesh(
      new THREE.BoxGeometry(heichalWidth, heichalY - groundY, heichalDepth),
      this.mat.stone
    );
    heichalBase.position.set(0, groundY + (heichalY - groundY)/2, heichalCenterZ);
    this.scene.add(heichalBase);

    // Heichal walls
    this.addWall(-5, heichalY, heichalCenterZ, 1, wallH, heichalDepth + 2, this.mat.goldEng);
    this.addWall(5, heichalY, heichalCenterZ, 1, wallH, heichalDepth + 2, this.mat.goldEng);

    // Back wall between Ulam and Heichal
    this.addWall(-7.5, ulamY, -58.5, 5, wallH, 1, this.mat.stonePolished);
    this.addWall(7.5, ulamY, -58.5, 5, wallH, 1, this.mat.stonePolished);
    this.addWall(0, ulamY + 8, -58.5, 10, wallH - 8, 1, this.mat.stonePolished);

    // Heichal ceiling
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(heichalWidth, 1, heichalDepth), this.mat.cedar);
    ceiling.position.set(0, heichalY + wallH, heichalCenterZ);
    this.scene.add(ceiling);

    // === TA'IM (Side Chambers) ===
    [-8, 8].forEach(side => {
      for (let story = 0; story < 3; story++) {
        const storyH = 4;
        const storyY = heichalY + story * storyH;
        for (let zOff = 0; zOff < 3; zOff++) {
          const cell = new THREE.Mesh(
            new THREE.BoxGeometry(3, storyH - 0.5, 5),
            this.mat.stonePolished
          );
          cell.position.set(side, storyY + storyH/2, -60 - zOff * 7);
          cell.castShadow = true;
          this.scene.add(cell);
        }
      }
    });
  }

  buildKodeshHakodashim() {
    const groundY = 3.8;
    const floorY = 8.3;
    const wallH = 20;

    // === PAROCHES ===
    const parochesGeo = new THREE.PlaneGeometry(10, wallH);
    [0, 0.3].forEach(offset => {
      const paroches = new THREE.Mesh(parochesGeo, this.mat.paroches);
      paroches.position.set(0, floorY + wallH/2, -78 - offset);
      this.scene.add(paroches);
    });

    // === KODESH HAKODASHIM FLOOR ===
    this.addFloor(0, floorY, -83, 10, 10, this.mat.gold, 'kodesh-hakodashim');

    const kkBase = new THREE.Mesh(
      new THREE.BoxGeometry(10, floorY - groundY, 10),
      this.mat.stone
    );
    kkBase.position.set(0, groundY + (floorY - groundY)/2, -83);
    this.scene.add(kkBase);

    // === WALLS ===
    this.addWall(-5, floorY, -83, 1, wallH, 12, this.mat.gold);
    this.addWall(5, floorY, -83, 1, wallH, 12, this.mat.gold);
    this.addWall(0, floorY, -88.5, 11, wallH, 1, this.mat.gold);

    // === CEILING ===
    const kkCeiling = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 10), this.mat.gold);
    kkCeiling.position.set(0, floorY + wallH, -83);
    this.scene.add(kkCeiling);

    // === EVEN HASHTIYA ===
    const even = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.5, 0.8, 16), this.mat.altar);
    even.position.set(0, floorY + 0.4, -83);
    even.castShadow = true;
    even.userData = { name: 'אבן השתיה', nameEn: 'Foundation Stone' };
    this.scene.add(even);
  }

  buildKeilim() {
    this.buildMizbeiach();
    this.buildKiyor();
    this.buildMenorah();
    this.buildShulchan();
    this.buildMizbeiachHazahav();
    this.buildAron();
  }

  buildMizbeiach() {
    const baseY = 7.3;
    const g = new THREE.Group();

    // === YESOD ===
    const yesod = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 14), this.mat.altar);
    yesod.position.y = 0.5;
    g.add(yesod);

    // === SOVEV ===
    const sovev = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 12), this.mat.altar);
    sovev.position.y = 3.5;
    g.add(sovev);

    // === MA'ARACHA ===
    const maaracha = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 10), this.mat.altar);
    maaracha.position.y = 7.5;
    g.add(maaracha);

    // === KERANOS ===
    [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]].forEach(([kx, kz]) => {
      const keren = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 1), this.mat.altar);
      keren.position.set(kx, 9.75, kz);
      g.add(keren);
    });

    // === CHUT HASIKRA ===
    const redLine = new THREE.Mesh(
      new THREE.BoxGeometry(12.2, 0.1, 12.2),
      new THREE.MeshStandardMaterial({ color: 0x8B0000 })
    );
    redLine.position.y = 5;
    g.add(redLine);

    g.position.set(0, baseY, -28);
    g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    g.userData = { name: 'מזבח העולה', nameEn: 'Altar of Burnt Offering' };
    this.scene.add(g);

    // === KEVESH (Ramp) ===
    const rampLength = 14;
    const rampHeight = 6;
    const rampWidth = 5;
    const rampSteps = 20;

    for (let i = 0; i < rampSteps; i++) {
      const progress = i / rampSteps;
      const stepY = baseY + rampHeight * (1 - progress);
      const stepZ = -30 + 7 + progress * rampLength;
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(rampWidth, 0.4, rampLength / rampSteps + 0.1),
        this.mat.stone
      );
      stepMesh.position.set(0, stepY + 0.2, stepZ);
      stepMesh.receiveShadow = true;
      stepMesh.userData = { isFloor: true };
      this.scene.add(stepMesh);
      this.floors.push(stepMesh);
    }

    // Ramp side walls
    const rampSideGeo = new THREE.BoxGeometry(0.3, 1, rampLength);
    [-rampWidth/2 - 0.15, rampWidth/2 + 0.15].forEach(sx => {
      const side = new THREE.Mesh(rampSideGeo, this.mat.stone);
      side.position.set(sx, baseY + rampHeight/2, -30 + 7 + rampLength/2);
      side.castShadow = true;
      this.scene.add(side);
    });
  }

  buildKiyor() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1.3, 3, 12), this.mat.copper));
    g.children[0].position.y = 1.5;
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(2, 1.5, 2, 16), this.mat.copperP));
    g.children[1].position.y = 4;
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.3, 16), this.mat.water);
    water.position.y = 4.8;
    g.add(water);

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6), this.mat.copper);
      spout.position.set(Math.cos(angle) * 1.9, 4, Math.sin(angle) * 1.9);
      spout.rotation.z = Math.PI / 2;
      spout.rotation.y = -angle;
      g.add(spout);
    }

    g.position.set(-8, 7.3, -38);
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    g.userData = { name: 'כיור', nameEn: 'Laver' };
    this.scene.add(g);
  }

  buildMenorah() {
    const g = new THREE.Group();

    // Legs
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.7), this.mat.gold);
      leg.position.set(Math.cos(angle) * 0.3, 0.04, Math.sin(angle) * 0.3);
      leg.rotation.y = -angle;
      g.add(leg);
    }

    // Decorative elements on stem
    for (let i = 0; i < 4; i++) {
      const y = 0.2 + i * 0.6;
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), this.mat.gold));
      g.children[g.children.length-1].position.y = y;
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), this.mat.goldEng));
      g.children[g.children.length-1].position.y = y + 0.18;
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.05, 0.1, 8), this.mat.gold));
      g.children[g.children.length-1].position.y = y + 0.32;
    }

    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.6, 8), this.mat.gold));
    g.children[g.children.length-1].position.y = 2.9;

    const branchH = [2.6, 2.8, 3.0, 3.3, 3.0, 2.8, 2.6];
    const branchX = [-0.8, -0.53, -0.27, 0, 0.27, 0.53, 0.8];

    branchX.forEach((bx, i) => {
      const bh = branchH[i];
      if (i !== 3) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), this.mat.gold);
        arm.position.set(bx * 0.5, 1.4, 0);
        arm.rotation.z = Math.atan2(bx, 0.6);
        g.add(arm);
      }
      const vert = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, bh - 1.8, 8), this.mat.gold);
      vert.position.set(bx, 1.8 + (bh - 1.8) / 2, 0);
      g.add(vert);
      const ner = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.15, 8), this.mat.gold);
      ner.position.set(bx, bh + 0.08, 0);
      g.add(ner);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 8), new THREE.MeshBasicMaterial({ color: 0xFFDD44 }));
      flame.position.set(bx, bh + 0.26, 0);
      g.add(flame);
      const light = new THREE.PointLight(0xFFBB44, 0.4, 4);
      light.position.set(bx, bh + 0.3, 0);
      g.add(light);
    });

    g.position.set(-3, 8.3, -68);
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    g.userData = { name: 'מנורה', nameEn: 'Golden Menorah' };
    this.scene.add(g);
  }

  buildShulchan() {
    const g = new THREE.Group();

    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.75), this.mat.gold));
    g.children[0].position.y = 1.1;
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.85), this.mat.goldEng));
    g.children[1].position.y = 1.2;

    [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1), this.mat.gold);
      leg.position.set(lx, 0.5, lz);
      g.add(leg);
    });

    const breadMat = new THREE.MeshStandardMaterial({ color: 0xD4A862, roughness: 0.85 });
    [-0.4, 0.4].forEach(sx => {
      for (let i = 0; i < 6; i++) {
        const bread = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.25), breadMat);
        bread.position.set(sx, 1.32 + i * 0.09, 0);
        g.add(bread);
      }
    });

    [-0.55, 0.55].forEach(bx => {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.06, 8), this.mat.gold);
      bowl.position.set(bx, 1.88, 0);
      g.add(bowl);
      const lev = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshStandardMaterial({ color: 0xFFFFF0, roughness: 0.9 }));
      lev.position.set(bx, 1.9, 0);
      g.add(lev);
    });

    g.position.set(3, 8.3, -68);
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    g.userData = { name: 'שולחן הפנים', nameEn: 'Showbread Table' };
    this.scene.add(g);
  }

  buildMizbeiachHazahav() {
    const g = new THREE.Group();

    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.6), this.mat.gold));
    g.children[0].position.y = 0.6;
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.7), this.mat.goldEng));
    g.children[1].position.y = 1.25;

    [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]].forEach(([kx, kz]) => {
      const keren = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), this.mat.gold);
      keren.position.set(kx, 1.4, kz);
      g.add(keren);
    });

    [-0.35, 0.35].forEach(rx => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 8, 16), this.mat.gold);
      ring.position.set(rx, 0.8, 0.32);
      ring.rotation.y = Math.PI / 2;
      g.add(ring);
    });

    const glow = new THREE.PointLight(0xFFEEDD, 0.6, 5);
    glow.position.y = 1.8;
    g.add(glow);

    g.position.set(0, 8.3, -75);
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    g.userData = { name: 'מזבח הזהב', nameEn: 'Golden Altar' };
    this.scene.add(g);
  }

  buildAron() {
    const g = new THREE.Group();

    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 0.85), this.mat.gold));
    g.children[0].position.y = 0.5;
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.95), this.mat.goldEng));
    g.children[1].position.y = 1.05;
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.15, 0.9), this.mat.gold));
    g.children[2].position.y = 1.15;

    [[-0.45, false], [0.45, true]].forEach(([kx, mirror]) => {
      const keruv = new THREE.Group();
      keruv.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), this.mat.gold));
      keruv.children[0].position.y = 0.18;
      keruv.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), this.mat.gold));
      keruv.children[1].position.y = 0.45;

      const wingGeo = new THREE.BoxGeometry(0.45, 0.45, 0.03);
      const innerWing = new THREE.Mesh(wingGeo, this.mat.gold);
      innerWing.position.set(mirror ? 0.18 : -0.18, 0.5, 0);
      innerWing.rotation.z = mirror ? -0.5 : 0.5;
      innerWing.rotation.y = mirror ? -0.3 : 0.3;
      keruv.add(innerWing);

      const outerWing = new THREE.Mesh(wingGeo.clone(), this.mat.gold);
      outerWing.position.set(mirror ? -0.22 : 0.22, 0.45, 0);
      outerWing.rotation.z = mirror ? 0.55 : -0.55;
      keruv.add(outerWing);

      keruv.position.set(kx, 1.25, 0);
      g.add(keruv);
    });

    [-0.6, 0.6].forEach(px => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.5, 8), this.mat.gold);
      pole.position.set(px, 0.5, 0);
      pole.rotation.x = Math.PI / 2;
      g.add(pole);
    });

    const divineLight = new THREE.PointLight(0xFFFFFF, 1.5, 15);
    divineLight.position.y = 2.5;
    g.add(divineLight);

    const glowSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xFFFFEE, transparent: true, opacity: 0.15 })
    );
    glowSphere.position.y = 2.2;
    g.add(glowSphere);

    g.position.set(0, 8.3, -83);
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    g.userData = { name: 'ארון הקודש', nameEn: 'Holy Ark' };
    this.scene.add(g);
  }

  buildLighting() {
    this.scene.add(new THREE.AmbientLight(0xFFF8F0, 0.4));

    const sun = new THREE.DirectionalLight(0xFFFAF0, 1.5);
    sun.position.set(60, 120, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.width = CONFIG.SHADOW_MAP_SIZE;
    sun.shadow.mapSize.height = CONFIG.SHADOW_MAP_SIZE;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120;
    sun.shadow.camera.bottom = -120;
    sun.shadow.bias = -0.0002;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0xB0C4DE, 0.35);
    fill.position.set(-50, 80, -40);
    this.scene.add(fill);

    this.scene.add(new THREE.HemisphereLight(0x88AACC, 0xD4C4A8, 0.5));

    const heichalLight = new THREE.PointLight(0xFFDD88, 2, 40);
    heichalLight.position.set(0, 25, -68);
    this.scene.add(heichalLight);
  }
}
