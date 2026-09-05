import * as THREE from 'three';

/**
 * InstancedMesh helpers: one draw call for N copies of the same geometry + material.
 *
 * Materials are shared, so never mutate a material per instance; vary with the
 * per-instance matrix (position/rotation/scale) or `mesh.setColorAt` instead.
 */

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();

/**
 * @typedef {{ position: number[], rotation?: number[], scale?: number[] | number }} Placement
 *   position/rotation/scale as [x, y, z] (rotation in radians, XYZ order); scale may be a
 *   single number for uniform scale.
 */

/** Convert one Matrix4 or Placement into a Matrix4 (written into `out`). */
export function toMatrix(item, out = new THREE.Matrix4()) {
  if (item?.isMatrix4) return out.copy(item);
  const { position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 } = item;
  _pos.fromArray(position);
  _euler.set(rotation[0] ?? 0, rotation[1] ?? 0, rotation[2] ?? 0, 'XYZ');
  _quat.setFromEuler(_euler);
  if (typeof scale === 'number') _scale.set(scale, scale, scale);
  else _scale.fromArray(scale);
  return out.compose(_pos, _quat, _scale);
}

/**
 * Build an InstancedMesh with one instance per matrix/placement.
 *
 * @param {THREE.BufferGeometry} geometry shared geometry
 * @param {THREE.Material} material shared material
 * @param {(THREE.Matrix4 | Placement)[]} matrices one entry per instance
 * @param {{ castShadow?: boolean, receiveShadow?: boolean, name?: string }} [opts]
 * @returns {THREE.InstancedMesh}
 */
export function instance(geometry, material, matrices, { castShadow = true, receiveShadow = true, name } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  const m = new THREE.Matrix4();
  for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, toMatrix(matrices[i], m));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  if (name) mesh.name = name;
  // Static geometry: compute bounds once so frustum culling works on the whole batch.
  mesh.computeBoundingSphere();
  return mesh;
}

/**
 * Sugar for the common case of identical, unrotated copies at a list of positions.
 *
 * @param {THREE.BufferGeometry} geometry
 * @param {THREE.Material} material
 * @param {number[][]} positions [[x, y, z], ...]
 * @param {Parameters<typeof instance>[3]} [opts]
 */
export function instancePositions(geometry, material, positions, opts) {
  return instance(geometry, material, positions.map((position) => ({ position })), opts);
}
