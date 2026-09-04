import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { BaseBuilder, scaleBoxUVs, TILE_METRES } from './BaseBuilder.js';

/** Per-face [minU, maxU, minV, maxV] in BoxGeometry face order (+x, -x, +y, -y, +z, -z). */
function faceRanges(geo) {
  const uv = geo.attributes.uv;
  const out = [];
  for (let f = 0; f < 6; f++) {
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (let i = f * 4; i < f * 4 + 4; i++) {
      minU = Math.min(minU, uv.getX(i)); maxU = Math.max(maxU, uv.getX(i));
      minV = Math.min(minV, uv.getY(i)); maxV = Math.max(maxV, uv.getY(i));
    }
    out.push([minU, maxU, minV, maxV]);
  }
  return out;
}

describe('scaleBoxUVs', () => {
  it('a 40 x 4 m stone wall spans 10 x 1 tiles at 4 m per tile', () => {
    const geo = scaleBoxUVs(new THREE.BoxGeometry(40, 4, 1), 40, 4, 1, TILE_METRES.stone);
    const [px, nx, py, ny, pz, nz] = faceRanges(geo);
    expect(pz).toEqual([0, 10, 0, 1]); // front face: width x height
    expect(nz).toEqual([0, 10, 0, 1]);
    expect(px).toEqual([0, 0.25, 0, 1]); // end face: depth x height
    expect(nx).toEqual([0, 0.25, 0, 1]);
    expect(py).toEqual([0, 10, 0, 0.25]); // top: width x depth
    expect(ny).toEqual([0, 10, 0, 0.25]);
  });

  it('a 2 x 2 floor slab at 2 m per tile keeps unit UVs on its top', () => {
    const geo = scaleBoxUVs(new THREE.BoxGeometry(2, 0.4, 2), 2, 0.4, 2, 2);
    const [, , py] = faceRanges(geo);
    expect(py).toEqual([0, 1, 0, 1]);
  });

  it('BaseBuilder.box picks the tile size from the material map', () => {
    const mat = { stone: new THREE.MeshStandardMaterial(), floor: new THREE.MeshStandardMaterial() };
    const b = new BaseBuilder(new THREE.Scene(), null, mat, [], []);
    expect(b.tileMetresFor(mat.stone)).toBe(4);
    expect(b.tileMetresFor(mat.floor)).toBe(2);
    const other = new THREE.MeshStandardMaterial();
    other.userData.tileMetres = 1;
    expect(b.tileMetresFor(other)).toBe(1);
    const geo = b.box(20, 0.4, 10, mat.floor);
    const [, , py] = faceRanges(geo);
    expect(py).toEqual([0, 10, 0, 5]);
  });

  it('addWall registers a collidable mesh with scaled UVs', () => {
    const mat = { stone: new THREE.MeshStandardMaterial() };
    const walls = [];
    const b = new BaseBuilder(new THREE.Scene(), null, mat, [], walls);
    const m = b.addWall(0, 0, 0, 40, 4, 1, mat.stone);
    expect(walls).toContain(m);
    expect(m.position.y).toBe(2);
    expect(faceRanges(m.geometry)[4]).toEqual([0, 10, 0, 1]);
  });
});
