import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { lodCount, InstancedLOD, DistanceCuller } from './lod.js';

describe('lodCount', () => {
  it('puts the near instances first and returns how many there are', () => {
    const centers = [0, 0, 0, 10, 0, 0, 100, 0, 0, 0, 0, 30];
    const order = new Uint32Array(4);
    const n = lodCount(centers, { x: 0, y: 0, z: 0 }, 20, order);
    expect(n).toBe(2);
    expect([...order.slice(0, n)].sort()).toEqual([0, 1]);
    expect(new Set(order).size).toBe(4); // a permutation
  });

  it('measures to the edge of the sphere, per instance or shared', () => {
    const centers = [0, 0, 50];
    const order = new Uint32Array(1);
    expect(lodCount(centers, { x: 0, y: 0, z: 0 }, 40, order)).toBe(0);
    expect(lodCount(centers, { x: 0, y: 0, z: 0 }, 40, order, 12)).toBe(1);
    expect(lodCount(centers, { x: 0, y: 0, z: 0 }, 40, order, [12])).toBe(1);
  });

  it('handles an empty set', () => {
    expect(lodCount([], { x: 0, y: 0, z: 0 }, 10, new Uint32Array(0))).toBe(0);
  });
});

function instanced(positions) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), positions.length);
  const m = new THREE.Matrix4();
  positions.forEach((p, i) => mesh.setMatrixAt(i, m.makeTranslation(...p)));
  mesh.updateMatrixWorld();
  return mesh;
}

describe('InstancedLOD', () => {
  it('trims count to the instances within range and restores the rest when the camera returns', () => {
    const mesh = instanced([[0, 0, 0], [0, 0, 50], [0, 0, 300]]);
    const lod = new InstancedLOD(mesh, 100);
    expect(lod.update(new THREE.Vector3(0, 0, 0))).toBe(2);
    expect(mesh.count).toBe(2);
    expect(mesh.visible).toBe(true);
    // The two near matrices are at the front of the buffer, whichever order they came in.
    const z = [0, 1].map((i) => mesh.instanceMatrix.array[i * 16 + 14]).sort((a, b) => a - b);
    expect(z).toEqual([0, 50]);
    expect(lod.update(new THREE.Vector3(0, 0, 1))).toBe(2); // moved < 2 m: no re-partition
    expect(lod.update(new THREE.Vector3(0, 0, 1000))).toBe(0);
    expect(mesh.visible).toBe(false);
    expect(lod.update(new THREE.Vector3(0, 0, 300))).toBe(1);
    expect(mesh.instanceMatrix.array[14]).toBe(300);
  });
});

describe('DistanceCuller', () => {
  it('hides meshes that project below minPixels and leaves large, tagged and period objects alone', () => {
    const scene = new THREE.Scene();
    const small = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial());
    small.position.set(0, 0, -200);
    const big = new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshBasicMaterial());
    big.position.set(0, 0, -200);
    const tagged = small.clone();
    tagged.userData.noCull = true;
    const period = small.clone();
    period.userData.period = ['bayis_rishon'];
    const far = instanced([[0, 0, -300]]);
    far.userData.lodDistance = 100;
    scene.add(small, big, tagged, period, far);
    scene.updateMatrixWorld(true);
    const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 400);
    const culler = new DistanceCuller({ minPixels: 4 }).collect(scene);
    expect(culler.items.map((i) => i.obj)).toEqual([small, big]);
    expect(culler.instanced).toHaveLength(1);
    culler.update(camera, 720);
    expect(small.visible).toBe(false);
    expect(big.visible).toBe(true);
    expect(tagged.visible).toBe(true);
    expect(culler.hidden).toBe(1);
    expect(far.count).toBe(0);
    camera.position.set(0, 0, -195);
    culler.update(camera, 720);
    expect(small.visible).toBe(true);
    culler.reset();
    expect(far.count).toBe(1);
    expect(far.visible).toBe(true);
  });
});
