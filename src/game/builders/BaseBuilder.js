import * as THREE from 'three';

/**
 * World-space size of one texture tile per material key in TempleBuilder.mat. Materials
 * are shared between every mesh (instancing-safe), so a box's UVs are scaled from its
 * own size instead of setting texture.repeat globally. Keys not listed tile every
 * DEFAULT_TILE_METRES; a material can override with `material.userData.tileMetres`.
 */
export const TILE_METRES = {
  stone: 3,          // ashlar: one 1K tile = three courses of ~1 m blocks
  stonePolished: 2,
  floor: 2,
  mosaic: 2,
  marbleW: 2,
  marbleR: 2,
  cedar: 2,
  acacia: 2,
  paroches: 4,
  ground: 8,
};
export const DEFAULT_TILE_METRES = 4;

/**
 * Scale a BoxGeometry's UVs per face so a RepeatWrapping texture tiles every
 * `tileMetres` metres of world size on each face, whatever the box's dimensions.
 * BoxGeometry lays its vertices out face by face (+x, -x, +y, -y, +z, -z); the side
 * faces are (d x h), the top/bottom (w x d) and the front/back (w x h).
 *
 * @param {THREE.BoxGeometry} geo a fresh, unshared BoxGeometry
 * @param {number} w width (x)   @param {number} h height (y)   @param {number} d depth (z)
 * @param {number} [tileMetres]
 * @returns {THREE.BoxGeometry} the same geometry, UVs scaled in place
 */
export function scaleBoxUVs(geo, w, h, d, tileMetres = DEFAULT_TILE_METRES) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  const seg = geo.parameters ?? {};
  const sw = (seg.widthSegments ?? 1) + 1;
  const sh = (seg.heightSegments ?? 1) + 1;
  const sd = (seg.depthSegments ?? 1) + 1;
  // Vertex count and (u, v) world extent per face, in BoxGeometry face order.
  const faces = [
    [sd * sh, d, h], [sd * sh, d, h], // +x, -x
    [sw * sd, w, d], [sw * sd, w, d], // +y, -y
    [sw * sh, w, h], [sw * sh, w, h], // +z, -z
  ];
  let i = 0;
  for (const [count, uExtent, vExtent] of faces) {
    const su = uExtent / tileMetres;
    const sv = vExtent / tileMetres;
    for (let k = 0; k < count && i < uv.count; k++, i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  uv.needsUpdate = true;
  // aoMap needs no second UV set here: since three r152 Texture.channel defaults to 0,
  // so every map (aoMap included) samples this same scaled `uv` (see BaseBuilder.test.js).
  return geo;
}

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

  /** Tile size (metres) for a material: userData override, else its key in this.mat. */
  tileMetresFor(mat) {
    if (mat?.userData?.tileMetres) return mat.userData.tileMetres;
    for (const key in this.mat) if (this.mat[key] === mat) return TILE_METRES[key] ?? DEFAULT_TILE_METRES;
    return DEFAULT_TILE_METRES;
  }

  /** BoxGeometry whose UVs tile `mat`'s texture at a fixed world scale. */
  box(w, h, d, mat) {
    return scaleBoxUVs(new THREE.BoxGeometry(w, h, d), w, h, d, this.tileMetresFor(mat));
  }

  addFloor(x, y, z, w, d, mat, name) {
    const m = new THREE.Mesh(this.box(w, 0.4, d, mat), mat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.userData = { isFloor: true, name };
    this.scene.add(m);
    this.floors.push(m);
    return m;
  }

  addWall(x, y, z, w, h, d, mat) {
    const m = new THREE.Mesh(this.box(w, h, d, mat), mat);
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
    const m = new THREE.Mesh(this.box(w, h, d, mat), mat);
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
      const step = new THREE.Mesh(this.box(w, sh, sd, mat), mat);
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
    const fill = new THREE.Mesh(this.box(width, height, depth, this.mat.stone), this.mat.stone);
    fill.position.set(x, bottomY + height/2, z);
    fill.receiveShadow = true;
    this.scene.add(fill);
  }

  addStepRow(x, baseY, z, width, rise) {
    const step = new THREE.Mesh(this.box(width, rise, 1, this.mat.marbleW), this.mat.marbleW);
    step.position.set(x, baseY + rise/2, z);
    step.userData = { isFloor: true, isStep: true };
    step.receiveShadow = true;
    this.scene.add(step);
    this.floors.push(step);
  }

  addGateFrame(x, y, z, width, height, mat, name) {
    const frameThick = 0.8;
    // Left pillar
    const left = new THREE.Mesh(this.box(frameThick, height, frameThick, mat), mat);
    left.position.set(x - width/2 + frameThick/2, y + height/2, z);
    left.castShadow = true;
    this.scene.add(left);
    // Right pillar
    const right = new THREE.Mesh(this.box(frameThick, height, frameThick, mat), mat);
    right.position.set(x + width/2 - frameThick/2, y + height/2, z);
    right.castShadow = true;
    this.scene.add(right);
    // Top beam
    const top = new THREE.Mesh(this.box(width, frameThick, frameThick, mat), mat);
    top.position.set(x, y + height - frameThick/2, z);
    top.castShadow = true;
    this.scene.add(top);
  }
}
