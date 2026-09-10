import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { outcropGeometry } from './outcrop.js';

const P = { radius: 0.75, height: 0.0625, seed: 5 };

describe('outcropGeometry', () => {
  it('is one indexed mesh with a centre vertex at exactly the content height', () => {
    const g = outcropGeometry(P);
    const pos = g.getAttribute('position');
    expect(g.index).not.toBeNull();
    expect(g.getAttribute('normal')).toBeDefined();
    expect(g.getAttribute('uv')).toBeDefined();
    expect(pos.getX(0)).toBe(0);
    expect(pos.getZ(0)).toBe(0);
    expect(pos.getY(0)).toBe(P.height);
    expect(g.index.count % 3).toBe(0);
    expect(g.index.count / 3).toBeLessThan(2000); // a few hundred triangles, one draw call
  });

  it('is not a box: the outline wobbles and the top is noised, but stays within bounds', () => {
    const g = outcropGeometry(P);
    const pos = g.getAttribute('position');
    const radii = new Set();
    let yMax = -1, yMin = 1, aboveHalf = 0, topCount = 0;
    for (let i = 1; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const r = Math.hypot(x, z);
      radii.add(r.toFixed(3));
      expect(r).toBeLessThan(P.radius * 1.3);
      yMax = Math.max(yMax, y);
      yMin = Math.min(yMin, y);
      if (y > 0.5 * P.height) aboveHalf++;
      if (y > 0) topCount++;
    }
    expect(radii.size).toBeGreaterThan(50); // no two spokes at the same radius: an irregular outline
    expect(yMax).toBeLessThan(P.height * 1.5);
    expect(yMax).toBeGreaterThan(P.height * 1.02); // the relief rises above the centre somewhere
    expect(yMin).toBeLessThan(0); // the skirt drops below the floor
    expect(aboveHalf).toBeGreaterThan(topCount * 0.5);
    g.computeBoundingBox();
    expect(g.boundingBox.min.y).toBeLessThan(0);
    expect(g.boundingBox.max.y).toBeLessThan(P.height * 1.5);
  });

  it('faces up: a downward ray at the centre hits the top at the content height', () => {
    const g = outcropGeometry(P);
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, -1, 0), 0, 10);
    const hits = ray.intersectObject(mesh, false);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].point.y).toBeCloseTo(P.height, 6);
    expect(hits[0].face.normal.y).toBeGreaterThan(0.9);
    const n = g.getAttribute('normal');
    expect(n.getY(0)).toBeGreaterThan(0.99);
    // Off-centre the top still reads at about the content height (rounded edge, low relief).
    const side = new THREE.Raycaster(new THREE.Vector3(0.3, 5, -0.2), new THREE.Vector3(0, -1, 0), 0, 10).intersectObject(mesh, false);
    expect(side[0].point.y).toBeGreaterThan(P.height * 0.5);
    expect(side[0].point.y).toBeLessThan(P.height * 1.5);
  });

  it('is deterministic per seed and differs between seeds', () => {
    const a = outcropGeometry(P).getAttribute('position').array;
    const b = outcropGeometry(P).getAttribute('position').array;
    const c = outcropGeometry({ ...P, seed: 9 }).getAttribute('position').array;
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
  });
});
