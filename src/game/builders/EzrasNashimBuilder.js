import * as THREE from 'three';
import { BaseBuilder } from './BaseBuilder.js';

// ============================================================================
// EZRAS NASHIM BUILDER - Court of the Women
// ============================================================================
export class EzrasNashimBuilder extends BaseBuilder {
  build() {
    const floorY = 3.8;
    const harHaBayisY = 1.8;
    const wallH = 14;
    const courtWidth = 66;
    const courtDepth = 50;
    const southZ = 58;
    const northZ = 8;
    const centerZ = 33;

    this.buildMainFloor(floorY, harHaBayisY, courtWidth, courtDepth, centerZ);
    this.buildEntranceStairs(harHaBayisY, floorY, southZ);
    this.buildWalls(floorY, wallH, southZ, northZ);
    this.buildCornerChambers(floorY);
    this.buildColonnade(floorY, southZ);
    this.buildNicanorGate(floorY, wallH, northZ);
    this.build15Steps(floorY, northZ);
  }

  buildMainFloor(floorY, harHaBayisY, courtWidth, courtDepth, centerZ) {
    this.addFloor(0, floorY, centerZ, courtWidth, courtDepth, this.mat.mosaic, 'ezras-nashim');

    const floorFill = new THREE.Mesh(
      new THREE.BoxGeometry(courtWidth, floorY - harHaBayisY, courtDepth),
      this.mat.stone
    );
    floorFill.position.set(0, harHaBayisY + (floorY - harHaBayisY) / 2, centerZ);
    floorFill.receiveShadow = true;
    this.scene.add(floorFill);
  }

  buildEntranceStairs(harHaBayisY, floorY, southZ) {
    this.addStairs(0, harHaBayisY, southZ + 6, 16, floorY - harHaBayisY, 8, 12, this.mat.stone, 'north');
  }

  buildWalls(floorY, wallH, southZ, northZ) {
    const gateWidth = 12;
    const gateHeight = 8;

    // South wall with Beautiful Gate (Sha'ar HaYafeh)
    this.addWall(-24, floorY, southZ, 18, wallH, 2, this.mat.stonePolished);
    this.addWall(24, floorY, southZ, 18, wallH, 2, this.mat.stonePolished);
    // Lintel - non-colliding so it doesn't block passage
    this.addWallNonCollide(0, floorY + gateHeight, southZ, gateWidth, wallH - gateHeight, 2, this.mat.stonePolished);
    this.addGateFrame(0, floorY, southZ - 1, gateWidth, gateHeight, this.mat.copperP, 'Beautiful Gate');

    // Side walls with gates
    const sideGateZ = 33;
    // East wall
    this.addWall(33, floorY, 47, 2, wallH, 20, this.mat.stonePolished);
    this.addWall(33, floorY, 19, 2, wallH, 20, this.mat.stonePolished);
    this.addWallNonCollide(33, floorY + 5, sideGateZ, 2, wallH - 5, 6, this.mat.stonePolished); // Lintel
    // West wall
    this.addWall(-33, floorY, 47, 2, wallH, 20, this.mat.stonePolished);
    this.addWall(-33, floorY, 19, 2, wallH, 20, this.mat.stonePolished);
    this.addWallNonCollide(-33, floorY + 5, sideGateZ, 2, wallH - 5, 6, this.mat.stonePolished); // Lintel
  }

  buildCornerChambers(floorY) {
    const chambers = [
      { pos: [-27, 52], name: 'לשכת השמנים', nameEn: 'Chamber of Oils', doorDir: 'east', contentType: 'oils' },
      { pos: [27, 52], name: 'לשכת המצורעים', nameEn: 'Chamber of Lepers', doorDir: 'west', contentType: 'lepers' },
      { pos: [-27, 14], name: 'לשכת הנזירים', nameEn: 'Chamber of Nazarites', doorDir: 'east', contentType: 'nazarites' },
      { pos: [27, 14], name: 'לשכת העצים', nameEn: 'Chamber of Wood', doorDir: 'west', contentType: 'wood' }
    ];

    const chamberSize = 10;
    const chamberHeight = 8;
    const doorWidth = 3;
    const doorHeight = 5;

    chambers.forEach(ch => {
      const cx = ch.pos[0];
      const cz = ch.pos[1];
      const half = chamberSize / 2;

      // Back wall
      if (ch.doorDir === 'east') {
        this.addWallNonCollide(cx - half, floorY, cz, 0.5, chamberHeight, chamberSize, this.mat.stonePolished);
      } else {
        this.addWallNonCollide(cx + half, floorY, cz, 0.5, chamberHeight, chamberSize, this.mat.stonePolished);
      }

      // Front wall with door opening
      if (ch.doorDir === 'east') {
        this.addWallNonCollide(cx + half, floorY, cz - half + (chamberSize - doorWidth) / 4, 0.5, chamberHeight, (chamberSize - doorWidth) / 2, this.mat.stonePolished);
        this.addWallNonCollide(cx + half, floorY, cz + half - (chamberSize - doorWidth) / 4, 0.5, chamberHeight, (chamberSize - doorWidth) / 2, this.mat.stonePolished);
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

      // Add chamber-specific contents
      this.addChamberContents(cx, floorY + 0.3, cz, ch.contentType);
    });
  }

  addChamberContents(cx, floorY, cz, contentType) {
    switch (contentType) {
      case 'oils':
        this.addOilStorage(cx, floorY, cz);
        break;
      case 'lepers':
        this.addMikvah(cx, floorY, cz);
        break;
      case 'nazarites':
        this.addCookingArea(cx, floorY, cz);
        break;
      case 'wood':
        this.addWoodStorage(cx, floorY, cz);
        break;
    }
  }

  addOilStorage(cx, floorY, cz) {
    // Oil jars and storage vessels for the Menorah and Mincha offerings
    const jarMat = new THREE.MeshStandardMaterial({ color: 0xC4A35A, roughness: 0.6 }); // Ceramic
    const oilMat = new THREE.MeshStandardMaterial({ color: 0xDAA520, roughness: 0.3, metalness: 0.1 }); // Golden oil color

    // Large storage jars along the walls
    const jarPositions = [
      { x: -3, z: -2 }, { x: -3, z: 0 }, { x: -3, z: 2 },
      { x: 3, z: -2 }, { x: 3, z: 0 }, { x: 3, z: 2 }
    ];

    jarPositions.forEach(pos => {
      // Large amphora-style jar
      const jar = new THREE.Group();

      // Body
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, 1.2, 12),
        jarMat
      );
      body.position.y = 0.6;
      jar.add(body);

      // Neck
      const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.25, 0.4, 12),
        jarMat
      );
      neck.position.y = 1.4;
      jar.add(neck);

      // Oil level visible at top
      const oil = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.13, 0.05, 12),
        oilMat
      );
      oil.position.y = 1.55;
      jar.add(oil);

      // Handles
      [-0.35, 0.35].forEach(hx => {
        const handle = new THREE.Mesh(
          new THREE.TorusGeometry(0.12, 0.03, 8, 12, Math.PI),
          jarMat
        );
        handle.position.set(hx, 1.1, 0);
        handle.rotation.z = Math.PI / 2;
        handle.rotation.y = hx > 0 ? 0 : Math.PI;
        jar.add(handle);
      });

      jar.position.set(cx + pos.x, floorY, cz + pos.z);
      jar.traverse(c => { if (c.isMesh) c.castShadow = true; });
      this.scene.add(jar);
    });

    // Smaller oil vessels on a central table
    const tableMat = this.mat.cedar;
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.6, 1.5),
      tableMat
    );
    table.position.set(cx, floorY + 0.3, cz);
    table.castShadow = true;
    this.scene.add(table);

    // Small oil pitchers on table
    for (let i = -2; i <= 2; i++) {
      const pitcher = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.12, 0.3, 8),
        jarMat
      );
      pitcher.position.set(cx + i * 0.35, floorY + 0.75, cz);
      pitcher.castShadow = true;
      this.scene.add(pitcher);
    }
  }

  addMikvah(cx, floorY, cz) {
    // Mikvah (ritual bath) for the leper's purification
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x4A90D9,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.7
    });
    const stoneMat = this.mat.stone;

    // Mikvah basin (sunken pool)
    const basinSize = 3;
    const basinDepth = 1.5;

    // Basin walls
    const wallThick = 0.3;
    // Back
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(basinSize + wallThick * 2, basinDepth, wallThick),
      stoneMat
    );
    backWall.position.set(cx, floorY + basinDepth / 2, cz - basinSize / 2);
    this.scene.add(backWall);

    // Front (lower, with steps)
    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(basinSize + wallThick * 2, basinDepth * 0.5, wallThick),
      stoneMat
    );
    frontWall.position.set(cx, floorY + basinDepth * 0.25, cz + basinSize / 2);
    this.scene.add(frontWall);

    // Sides
    [-1, 1].forEach(side => {
      const sideWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThick, basinDepth, basinSize),
        stoneMat
      );
      sideWall.position.set(cx + side * (basinSize / 2 + wallThick / 2), floorY + basinDepth / 2, cz);
      this.scene.add(sideWall);
    });

    // Water surface
    const water = new THREE.Mesh(
      new THREE.BoxGeometry(basinSize, 0.1, basinSize),
      waterMat
    );
    water.position.set(cx, floorY + basinDepth - 0.2, cz);
    this.scene.add(water);

    // Steps into mikvah
    for (let i = 0; i < 3; i++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(basinSize * 0.8, 0.3, 0.4),
        stoneMat
      );
      step.position.set(cx, floorY + i * 0.3 + 0.15, cz + basinSize / 2 - 0.5 - i * 0.4);
      step.castShadow = true;
      this.scene.add(step);
    }

    // Purification vessels nearby
    const vesselMat = new THREE.MeshStandardMaterial({ color: 0xC4A35A, roughness: 0.6 });
    [{ x: 2.5, z: -1 }, { x: 2.5, z: 1 }].forEach(pos => {
      const vessel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.25, 0.5, 10),
        vesselMat
      );
      vessel.position.set(cx + pos.x, floorY + 0.25, cz + pos.z);
      vessel.castShadow = true;
      this.scene.add(vessel);
    });
  }

  addCookingArea(cx, floorY, cz) {
    // Cooking area for Nazarites to cook their Shelamim offerings
    const potMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 }); // Bronze/copper
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xFF4500 });
    const ashMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 1 });

    // Central cooking hearth
    const hearth = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.4, 0.4, 16),
      ashMat
    );
    hearth.position.set(cx, floorY + 0.2, cz);
    this.scene.add(hearth);

    // Fire
    const fire = new THREE.Mesh(
      new THREE.ConeGeometry(0.6, 1, 8),
      fireMat
    );
    fire.position.set(cx, floorY + 0.9, cz);
    this.scene.add(fire);

    // Fire light
    const fireLight = new THREE.PointLight(0xff6600, 0.8, 6);
    fireLight.position.set(cx, floorY + 1.2, cz);
    this.scene.add(fireLight);

    // Large cooking pot over fire
    const pot = new THREE.Group();
    // Pot body
    const potBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.4, 0.6, 16, 1, true),
      potMat
    );
    potBody.position.y = 0.3;
    pot.add(potBody);

    // Pot bottom
    const potBottom = new THREE.Mesh(
      new THREE.CircleGeometry(0.4, 16),
      potMat
    );
    potBottom.rotation.x = -Math.PI / 2;
    pot.add(potBottom);

    // Handles
    [-0.55, 0.55].forEach(hx => {
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.1, 0.025, 6, 12, Math.PI),
        potMat
      );
      handle.position.set(hx, 0.5, 0);
      handle.rotation.z = Math.PI / 2;
      handle.rotation.y = hx > 0 ? 0 : Math.PI;
      pot.add(handle);
    });

    pot.position.set(cx, floorY + 1.2, cz);
    pot.traverse(c => { if (c.isMesh) c.castShadow = true; });
    this.scene.add(pot);

    // Tripod stand for pot
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 })
      );
      leg.position.set(
        cx + Math.cos(angle) * 0.5,
        floorY + 0.6,
        cz + Math.sin(angle) * 0.5
      );
      leg.rotation.z = 0.15 * Math.cos(angle);
      leg.rotation.x = 0.15 * Math.sin(angle);
      this.scene.add(leg);
    }

    // Additional cooking utensils along the wall
    const utensilPositions = [
      { x: -3, z: 0 }, { x: -3, z: 2 }, { x: 3, z: 0 }, { x: 3, z: 2 }
    ];
    utensilPositions.forEach(pos => {
      // Smaller pots
      const smallPot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.2, 0.35, 12),
        potMat
      );
      smallPot.position.set(cx + pos.x, floorY + 0.175, cz + pos.z);
      smallPot.castShadow = true;
      this.scene.add(smallPot);
    });

    // Bench for sitting
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.4, 0.8),
      this.mat.cedar
    );
    bench.position.set(cx, floorY + 0.2, cz - 3);
    bench.castShadow = true;
    this.scene.add(bench);

    // Nazirite seated on bench (waiting for their offering to cook)
    this.addNaziriteFigure(cx, floorY + 0.4, cz - 3, Math.PI);
  }

  addNaziriteFigure(x, baseY, z, rotation) {
    // A Nazirite with long hair (they don't cut during their vow)
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xD4A574, roughness: 0.8 });
    const robeMat = new THREE.MeshStandardMaterial({ color: 0xF5F5DC, roughness: 0.8 }); // Simple white/cream robe
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x2C1810, roughness: 0.9 }); // Dark brown hair

    const figure = new THREE.Group();

    // Body (seated, torso)
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.3, 0.8, 8),
      robeMat
    );
    torso.position.y = 0.9;
    figure.add(torso);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 10, 10),
      skinMat
    );
    head.position.y = 1.45;
    figure.add(head);

    // Long hair (distinctive of Nazirite)
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 10),
      hairMat
    );
    hair.position.y = 1.5;
    hair.scale.set(1, 1.2, 1);
    figure.add(hair);

    // Hair flowing down back
    const hairBack = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.08, 0.5, 8),
      hairMat
    );
    hairBack.position.set(0, 1.2, -0.1);
    figure.add(hairBack);

    // Legs (bent, seated)
    const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6);
    [-0.12, 0.12].forEach(lz => {
      const leg = new THREE.Mesh(legGeo, robeMat);
      leg.position.set(0.2, 0.4, lz);
      leg.rotation.z = Math.PI / 3;
      figure.add(leg);
    });

    figure.position.set(x, baseY, z);
    figure.rotation.y = rotation;
    figure.traverse(c => { if (c.isMesh) c.castShadow = true; });
    this.scene.add(figure);
  }

  addWoodStorage(cx, floorY, cz) {
    // Wood storage for the altar - Kohanim would inspect wood for worms here
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.9 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x5C4033, roughness: 0.85 });

    // Stacked wood piles
    const pilePositions = [
      { x: -2, z: -2, height: 4 },
      { x: 2, z: -2, height: 5 },
      { x: -2, z: 2, height: 3 },
      { x: 2, z: 2, height: 4 },
      { x: 0, z: 0, height: 6 } // Central pile
    ];

    pilePositions.forEach(pile => {
      for (let layer = 0; layer < pile.height; layer++) {
        const isEvenLayer = layer % 2 === 0;
        const logsPerLayer = 3 + Math.floor(Math.random() * 2);

        for (let log = 0; log < logsPerLayer; log++) {
          const logMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.14, 1.4, 8),
            Math.random() > 0.5 ? woodMat : darkWoodMat
          );

          if (isEvenLayer) {
            logMesh.rotation.z = Math.PI / 2;
            logMesh.position.set(
              cx + pile.x,
              floorY + layer * 0.25 + 0.12,
              cz + pile.z - 0.5 + log * 0.35
            );
          } else {
            logMesh.rotation.x = Math.PI / 2;
            logMesh.position.set(
              cx + pile.x - 0.5 + log * 0.35,
              floorY + layer * 0.25 + 0.12,
              cz + pile.z
            );
          }

          logMesh.castShadow = true;
          this.scene.add(logMesh);
        }
      }
    });

    // Inspection table where Kohanim check wood for worms
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.6, 1.2),
      this.mat.cedar
    );
    table.position.set(cx, floorY + 0.3, cz - 3.5);
    table.castShadow = true;
    this.scene.add(table);

    // A few logs on the table being inspected
    for (let i = 0; i < 3; i++) {
      const inspectLog = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.12, 0.8, 8),
        woodMat
      );
      inspectLog.rotation.z = Math.PI / 2;
      inspectLog.position.set(cx - 0.6 + i * 0.6, floorY + 0.7, cz - 3.5);
      inspectLog.castShadow = true;
      this.scene.add(inspectLog);
    }

    // Wooden storage rack
    const rackMat = this.mat.cedar;
    // Vertical posts
    [[-3.5, -1], [-3.5, 1], [3.5, -1], [3.5, 1]].forEach(([rx, rz]) => {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 3, 0.2),
        rackMat
      );
      post.position.set(cx + rx, floorY + 1.5, cz + rz);
      post.castShadow = true;
      this.scene.add(post);
    });

    // Horizontal beams
    [0.5, 1.5, 2.5].forEach(ry => {
      [-3.5, 3.5].forEach(rx => {
        const beam = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.15, 2.2),
          rackMat
        );
        beam.position.set(cx + rx, floorY + ry, cz);
        this.scene.add(beam);
      });
    });
  }

  buildColonnade(floorY, southZ) {
    for (let x = -24; x <= 24; x += 6) {
      this.addColumn(x, floorY, southZ - 3, 0.5, 10, this.mat.marbleW);
    }
    for (let z = 16; z <= 50; z += 6) {
      this.addColumn(-30, floorY, z, 0.5, 10, this.mat.marbleW);
      this.addColumn(30, floorY, z, 0.5, 10, this.mat.marbleW);
    }
  }

  buildNicanorGate(floorY, wallH, northZ) {
    // Gate opening is 14 units wide (matching the gate frame)
    const gateWidth = 14;
    const gateHeight = 10;

    // Left wall section - from x=-33 to x=-7 (leaving opening from -7 to +7)
    this.addWall(-20, floorY, northZ, 26, wallH, 2, this.mat.stonePolished);
    // Right wall section - from x=+7 to x=+33
    this.addWall(20, floorY, northZ, 26, wallH, 2, this.mat.stonePolished);

    // Lintel above gate - NOT a collision wall (use addWallNonCollide)
    this.addWallNonCollide(0, floorY + gateHeight, northZ, gateWidth, wallH - gateHeight, 2, this.mat.stonePolished);

    // Decorative gate frame
    this.addGateFrame(0, floorY, northZ - 1, gateWidth, gateHeight, this.mat.copper, 'Nicanor Gate');
  }

  build15Steps(floorY, northZ) {
    // 15 Steps (Shir HaMaalos) from Ezras Nashim up to Azaras Yisrael
    // Steps start narrow at the Nicanor Gate (14 units wide) and widen into the Azara
    const stepsRise = 3.0;
    for (let i = 0; i < 15; i++) {
      const stepY = floorY + ((i + 1) / 15) * stepsRise;
      const stepZ = northZ - 1 - i;
      // Start at gate width (14) and widen to 44 as we go into the Azara
      const stepWidth = 14 + i * 2;
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
}
