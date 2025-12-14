import * as THREE from 'three';

// ============================================================================
// BASE BUILDER - Shared functionality for all temple section builders
// ============================================================================
export class BaseBuilder {
  constructor(scene, tex, mat, floors, walls) {
    this.scene = scene;
    this.tex = tex;
    this.mat = mat;
    this.floors = floors;
    this.walls = walls;
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

  // Wall that doesn't block player (for interior decoration)
  addWallNonCollide(x, y, z, w, h, d, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h/2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
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
}
