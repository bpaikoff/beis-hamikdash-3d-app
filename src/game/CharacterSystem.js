import * as THREE from 'three';

// ============================================================================
// CHARACTER SYSTEM
// ============================================================================
export class CharacterSystem {
  constructor(scene, tex) {
    this.scene = scene;
    this.tex = tex;
    this.kohanim = [];
    this.animals = [];
    this.time = 0;
  }

  createKohen(x, y, z, isKG = false) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ map: this.tex.get('whiteLinen'), roughness: 0.8 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xE8C4A0, roughness: 0.7 });

    // Torso
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.9, 8), bodyMat));
    g.children[0].position.y = 1.1;

    // Head
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), skinMat));
    g.children[1].position.y = 1.75;

    // Hat (Migba'as)
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.2, 12), bodyMat));
    g.children[2].position.y = 1.95;

    // Belt (Avnet)
    const beltMat = new THREE.MeshStandardMaterial({ color: isKG ? 0xFFD700 : 0xFFFFFF, roughness: 0.6 });
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 12), beltMat));
    g.children[3].position.y = 0.75;

    // Legs
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.7, 8), bodyMat));
    g.children[4].position.y = 0.35;

    // Arms
    [-0.35, 0.35].forEach(side => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6), bodyMat);
      arm.position.set(side, 1.1, 0);
      arm.rotation.z = side > 0 ? -0.3 : 0.3;
      g.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), skinMat);
      hand.position.set(side * 1.2, 0.9, 0);
      g.add(hand);
    });

    if (isKG) {
      // Me'il (blue robe)
      const meilMat = new THREE.MeshStandardMaterial({ map: this.tex.get('techeiles'), roughness: 0.8 });
      const meil = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.2, 12), meilMat);
      meil.position.y = 0.6;
      g.add(meil);

      // Ephod
      const ephodMat = new THREE.MeshStandardMaterial({ map: this.tex.get('goldEngraved'), roughness: 0.3, metalness: 0.7 });
      const ephod = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.1), ephodMat);
      ephod.position.set(0, 1.2, 0.2);
      g.add(ephod);

      // Choshen
      const choshen = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05),
        new THREE.MeshStandardMaterial({ map: this.tex.get('goldPolished'), roughness: 0.2, metalness: 0.9 }));
      choshen.position.set(0, 1.15, 0.28);
      g.add(choshen);

      // 12 stones
      const stoneColors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF, 0xFFA500, 0x800080, 0x008000, 0x000080, 0x808000, 0x800000];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 3; c++) {
          const stone = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02),
            new THREE.MeshStandardMaterial({ color: stoneColors[r * 3 + c], roughness: 0.2, metalness: 0.3 }));
          stone.position.set(-0.08 + c * 0.08, 1.22 - r * 0.07, 0.31);
          g.add(stone);
        }
      }

      // Tzitz
      const tzitz = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.02),
        new THREE.MeshStandardMaterial({ map: this.tex.get('goldPolished'), roughness: 0.1, metalness: 0.95 }));
      tzitz.position.set(0, 1.88, 0.15);
      g.add(tzitz);

      // Mitznefes (turban)
      const turban = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat);
      turban.position.y = 1.9;
      g.add(turban);
    }

    g.position.set(x, y, z);
    g.userData = { type: 'kohen', isKG, baseX: x, baseY: y, baseZ: z, phase: Math.random() * Math.PI * 2, walkRadius: Math.random() * 3 + 2 };
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    this.scene.add(g);
    this.kohanim.push(g);
    return g;
  }

  createAnimal(type, x, z) {
    const g = new THREE.Group();
    let color, size, legH;
    switch(type) {
      case 'sheep': color = 0xF5F5DC; size = { x: 0.5, y: 0.35, z: 0.8 }; legH = 0.3; break;
      case 'goat': color = 0x8B7355; size = { x: 0.45, y: 0.4, z: 0.75 }; legH = 0.35; break;
      case 'bull': color = 0x5C4033; size = { x: 0.8, y: 0.6, z: 1.4 }; legH = 0.5; break;
      default: return null;
    }
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const bodyMat = type === 'sheep' ? new THREE.MeshStandardMaterial({ map: this.tex.get('sheepWool'), roughness: 0.95 }) : mat;

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), bodyMat);
    body.position.y = legH + size.y / 2;
    g.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(size.x * 0.5, size.y * 0.6, size.z * 0.3), mat);
    head.position.set(0, legH + size.y * 0.8, size.z * 0.55);
    g.add(head);

    // Legs
    const legGeo = new THREE.CylinderGeometry(size.x * 0.1, size.x * 0.08, legH, 6);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = new THREE.Mesh(legGeo, mat);
      leg.position.set(sx * size.x * 0.35, legH / 2, sz * size.z * 0.35);
      g.add(leg);
    });

    // Horns for goat/bull
    if (type === 'goat' || type === 'bull') {
      const hornMat = new THREE.MeshStandardMaterial({ color: 0x3D3D3D, roughness: 0.6 });
      [-1, 1].forEach(side => {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, type === 'bull' ? 0.3 : 0.2, 6), hornMat);
        horn.position.set(side * size.x * 0.25, legH + size.y + 0.1, size.z * 0.45);
        horn.rotation.x = type === 'bull' ? 0.5 : -0.3;
        horn.rotation.z = side * 0.3;
        g.add(horn);
      });
    }

    // Tail
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.01, 0.25, 6), mat);
    tail.position.set(0, legH + size.y * 0.3, -size.z * 0.5);
    tail.rotation.x = 0.5;
    g.add(tail);

    g.position.set(x, 0, z);
    g.userData = { type: 'animal', animalType: type, baseX: x, baseZ: z, phase: Math.random() * Math.PI * 2, wanderRadius: 2 + Math.random() * 3 };
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    this.scene.add(g);
    this.animals.push(g);
    return g;
  }

  createDove(x, y, z) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xE8E8E8, roughness: 0.7 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mat);
    body.scale.set(1, 0.8, 1.3);
    g.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), mat);
    head.position.set(0, 0.05, 0.1);
    g.add(head);

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.04, 4), new THREE.MeshStandardMaterial({ color: 0xFFA500 }));
    beak.position.set(0, 0.04, 0.14);
    beak.rotation.x = Math.PI / 2;
    g.add(beak);

    [-1, 1].forEach(side => {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.01, 0.1), mat);
      wing.position.set(side * 0.1, 0, 0);
      wing.rotation.z = side * 0.3;
      wing.userData.isWing = true;
      wing.userData.side = side;
      g.add(wing);
    });

    g.position.set(x, y, z);
    g.userData = { type: 'dove', baseX: x, baseY: y, baseZ: z, phase: Math.random() * Math.PI * 2, circleRadius: 3 + Math.random() * 5, circleSpeed: 0.3 + Math.random() * 0.3 };
    this.scene.add(g);
    this.animals.push(g);
    return g;
  }

  update(delta) {
    this.time += delta;

    this.kohanim.forEach(k => {
      const d = k.userData, t = this.time * 0.3 + d.phase;
      k.position.x = d.baseX + Math.sin(t) * d.walkRadius * 0.3;
      k.position.z = d.baseZ + Math.cos(t * 0.7) * d.walkRadius * 0.3;
      k.rotation.y = Math.atan2(Math.cos(t) * 0.3, -Math.sin(t * 0.7) * 0.3);
      k.position.y = d.baseY + Math.sin(t * 4) * 0.02;
    });

    this.animals.forEach(a => {
      const d = a.userData;
      if (d.type === 'dove') {
        const t = this.time * d.circleSpeed + d.phase;
        a.position.x = d.baseX + Math.cos(t) * d.circleRadius;
        a.position.z = d.baseZ + Math.sin(t) * d.circleRadius;
        a.position.y = d.baseY + Math.sin(t * 2) * 0.5;
        a.rotation.y = -t + Math.PI / 2;
        a.children.forEach(c => { if (c.userData.isWing) c.rotation.z = c.userData.side * (0.3 + Math.sin(this.time * 15) * 0.4); });
      } else {
        const t = this.time * 0.2 + d.phase;
        a.position.x = d.baseX + Math.sin(t) * d.wanderRadius;
        a.position.z = d.baseZ + Math.cos(t * 0.8) * d.wanderRadius;
        a.rotation.y = Math.atan2(Math.cos(t), -Math.sin(t * 0.8));
      }
    });
  }
}
