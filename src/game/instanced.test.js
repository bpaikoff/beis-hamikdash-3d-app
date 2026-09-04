import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { instance, instancePositions, toMatrix } from './instanced.js';

const geo = new THREE.BoxGeometry(1, 1, 1);
const mat = new THREE.MeshStandardMaterial();

describe('instanced.instance', () => {
  it('creates an InstancedMesh with count 3 and the given matrices', () => {
    const mats = [
      new THREE.Matrix4().makeTranslation(1, 2, 3),
      new THREE.Matrix4().makeRotationY(Math.PI / 2),
      new THREE.Matrix4().makeScale(2, 2, 2),
    ];
    const mesh = instance(geo, mat, mats, { name: 'boxes' });
    expect(mesh.isInstancedMesh).toBe(true);
    expect(mesh.count).toBe(3);
    expect(mesh.name).toBe('boxes');
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
    const out = new THREE.Matrix4();
    for (let i = 0; i < 3; i++) {
      mesh.getMatrixAt(i, out);
      // instanceMatrix is a Float32 buffer; compare with float tolerance.
      out.elements.forEach((v, k) => expect(v).toBeCloseTo(mats[i].elements[k], 6));
    }
  });

  it('accepts {position, rotation, scale} placements', () => {
    const mesh = instance(geo, mat, [
      { position: [4, 5, 6] },
      { position: [0, 0, 0], rotation: [0, Math.PI / 2, 0], scale: [1, 2, 3] },
      { position: [1, 1, 1], scale: 2 },
    ], { castShadow: false });
    expect(mesh.count).toBe(3);
    expect(mesh.castShadow).toBe(false);
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();

    mesh.getMatrixAt(0, m);
    m.decompose(p, q, s);
    expect(p.toArray()).toEqual([4, 5, 6]);
    expect(s.toArray()).toEqual([1, 1, 1]);

    mesh.getMatrixAt(1, m);
    m.decompose(p, q, s);
    expect(s.x).toBeCloseTo(1);
    expect(s.y).toBeCloseTo(2);
    expect(s.z).toBeCloseTo(3);
    const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
    expect(e.y).toBeCloseTo(Math.PI / 2);

    mesh.getMatrixAt(2, m);
    m.decompose(p, q, s);
    expect(s.toArray().map((v) => +v.toFixed(6))).toEqual([2, 2, 2]);
  });

  it('instancePositions places unrotated unit-scale copies', () => {
    const mesh = instancePositions(geo, mat, [[0, 0, 0], [10, 0, 0], [0, 0, -10]]);
    expect(mesh.count).toBe(3);
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(2, m);
    expect(new THREE.Vector3().setFromMatrixPosition(m).toArray()).toEqual([0, 0, -10]);
    expect(mesh.boundingSphere).not.toBeNull();
  });

  it('toMatrix copies a Matrix4 unchanged', () => {
    const src = new THREE.Matrix4().makeTranslation(7, 8, 9);
    expect(toMatrix(src).elements).toEqual(src.elements);
  });
});
