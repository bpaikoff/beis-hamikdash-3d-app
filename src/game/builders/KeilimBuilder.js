import * as THREE from 'three';
import { BaseBuilder } from './BaseBuilder.js';

// ============================================================================
// KEILIM BUILDER - Holy vessels and the altar
// ============================================================================
export class KeilimBuilder extends BaseBuilder {
  build() {
    const kohanimY = 7.3;
    const heichalY = 8.3;

    this.buildMizbeiach(kohanimY);
    this.buildKiyor(kohanimY);
    this.buildMenorah(heichalY);
    this.buildShulchan(heichalY);
    this.buildMizbeiachHazahav(heichalY);
    this.buildAron(heichalY);
  }

  buildMizbeiach(baseY) {
    const g = new THREE.Group();

    // Yesod (Foundation) - 32 amos square, 1 amah high
    const yesod = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 14), this.mat.altar);
    yesod.position.y = 0.5;
    g.add(yesod);

    // Sovev (Ledge) - 30 amos, 5 amos high
    const sovev = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 12), this.mat.altar);
    sovev.position.y = 3.5;
    g.add(sovev);

    // Ma'aracha (Top) - 28 amos, 3 amos high
    const maaracha = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 10), this.mat.altar);
    maaracha.position.y = 7.5;
    g.add(maaracha);

    // Keranos (Horns)
    [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]].forEach(([kx, kz]) => {
      const keren = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 1), this.mat.altar);
      keren.position.set(kx, 9.75, kz);
      g.add(keren);
    });

    // Chut HaSikra (Red Line)
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

    // Kevesh (Ramp) - goes SOUTH from altar
    this.buildKevesh(baseY);
  }

  buildKevesh(baseY) {
    // The kevesh is a smooth ramp on the SOUTH side of the altar (Mishnah Middot 3:3,
    // Rambam Beit HaBechirah 2:13): as long as the altar is wide, rising to its top.
    // South is -x in this scene. It is one sloped slab (walkable) over a solid wedge.
    const altarHalf = 7; // half of the current 14 m altar footprint
    const run = 14; // ramp length along -x
    const rise = 9; // to the top of the ma'aracha
    const width = 8;
    const angle = Math.atan2(rise, run);
    const hyp = Math.hypot(run, rise);

    const slab = new THREE.Mesh(new THREE.BoxGeometry(hyp, 0.4, width), this.mat.stone);
    slab.position.set(-(altarHalf + run / 2), baseY + rise / 2, -28);
    slab.rotation.z = angle; // rising toward +x (toward the altar)
    slab.castShadow = true;
    slab.receiveShadow = true;
    slab.userData = { isFloor: true, isRamp: true };
    this.scene.add(slab);
    this.floors.push(slab);

    // Solid body under the slab: a right triangle in the x-y plane extruded along z.
    const tri = new THREE.Shape();
    tri.moveTo(-(altarHalf + run), 0);
    tri.lineTo(-altarHalf, 0);
    tri.lineTo(-altarHalf, rise - 0.2);
    tri.closePath();
    const wedgeGeo = new THREE.ExtrudeGeometry(tri, { depth: width, bevelEnabled: false });
    const wedge = new THREE.Mesh(wedgeGeo, this.mat.stone);
    wedge.position.set(0, baseY, -28 - width / 2);
    wedge.castShadow = true;
    wedge.receiveShadow = true;
    this.scene.add(wedge);

    // Low parapets along both edges of the ramp.
    [-width / 2 - 0.15, width / 2 + 0.15].forEach((dz) => {
      const side = new THREE.Mesh(new THREE.BoxGeometry(hyp, 0.8, 0.3), this.mat.stone);
      side.position.set(-(altarHalf + run / 2), baseY + rise / 2 + 0.4, -28 + dz);
      side.rotation.z = angle;
      side.castShadow = true;
      this.scene.add(side);
    });
  }

  buildKiyor(baseY) {
    const g = new THREE.Group();

    // Stand
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1.3, 3, 12), this.mat.copper));
    g.children[0].position.y = 1.5;

    // Basin
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(2, 1.5, 2, 16), this.mat.copperP));
    g.children[1].position.y = 4;

    // Water
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.3, 16), this.mat.water);
    water.position.y = 4.8;
    g.add(water);

    // 12 spouts
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6), this.mat.copper);
      spout.position.set(Math.cos(angle) * 1.9, 4, Math.sin(angle) * 1.9);
      spout.rotation.z = Math.PI / 2;
      spout.rotation.y = -angle;
      g.add(spout);
    }

    g.position.set(-8, baseY, -38);
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    g.userData = { name: 'כיור', nameEn: 'Laver' };
    this.scene.add(g);
  }

  buildMenorah(baseY) {
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
    });

    g.position.set(-3, baseY, -68);
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    g.userData = { name: 'מנורה', nameEn: 'Golden Menorah' };
    this.scene.add(g);
  }

  buildShulchan(baseY) {
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

    g.position.set(3, baseY, -68);
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    g.userData = { name: 'שולחן הפנים', nameEn: 'Showbread Table' };
    this.scene.add(g);
  }

  buildMizbeiachHazahav(baseY) {
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

    const glow = new THREE.PointLight(0xFFEEDD, 30, 0, 2); // candela, physical falloff
    glow.position.y = 1.8;
    g.add(glow);

    g.position.set(0, baseY, -75);
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    g.userData = { name: 'מזבח הזהב', nameEn: 'Golden Altar' };
    this.scene.add(g);
  }

  buildAron(baseY) {
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

    const divineLight = new THREE.PointLight(0xFFFFFF, 120, 0, 2);
    divineLight.position.y = 2.5;
    g.add(divineLight);

    const glowSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xFFFFEE, transparent: true, opacity: 0.15 })
    );
    glowSphere.position.y = 2.2;
    g.add(glowSphere);

    g.position.set(0, baseY, -83);
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    g.userData = { name: 'ארון הקודש', nameEn: 'Holy Ark' };
    this.scene.add(g);
  }
}
