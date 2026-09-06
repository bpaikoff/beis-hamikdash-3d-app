import * as THREE from 'three';

/**
 * Distance culling.
 *
 * Two mechanisms, both driven from animate():
 *  - `InstancedLOD`: an InstancedMesh (ta'im cells, merlons, soreg posts) keeps only the
 *    instances within `userData.lodDistance` of the camera: the matrices are reordered
 *    near-first and `count` trimmed (`lodCount`, the pure part). One draw call either way;
 *    this spares the vertex work and, when nothing is near, the call itself.
 *  - `DistanceCuller`: a plain Mesh is hidden once its bounding sphere would cover fewer
 *    than `minPixels` on screen. Hooks, lamps and loaves are
 *    sub-pixel long before the far plane; the walls and floors never qualify.
 */

/**
 * Partition instances by distance. Indices of the instances whose sphere (centre, `radius`)
 * lies within `maxDist` of `cam` are written to the front of `order`, the rest after them.
 *
 * @param {ArrayLike<number>} centers xyz triples, one per instance
 * @param {{x: number, y: number, z: number}} cam camera position
 * @param {number} maxDist metres from the camera to the nearest point of the sphere
 * @param {Uint32Array | number[]} order receives the permutation (length centers.length / 3)
 * @param {number | ArrayLike<number>} [radius] per-instance or shared bounding radius
 * @returns {number} how many instances are near (the InstancedMesh `count`)
 */
export function lodCount(centers, cam, maxDist, order, radius = 0) {
  const n = centers.length / 3;
  let near = 0;
  let far = n;
  for (let i = 0; i < n; i++) {
    const dx = centers[i * 3] - cam.x;
    const dy = centers[i * 3 + 1] - cam.y;
    const dz = centers[i * 3 + 2] - cam.z;
    const r = typeof radius === 'number' ? radius : radius[i];
    if (Math.sqrt(dx * dx + dy * dy + dz * dz) - r <= maxDist) order[near++] = i;
    else order[--far] = i;
  }
  return near;
}

const _m = new THREE.Matrix4();
const _inv = new THREE.Matrix4();
const _local = new THREE.Vector3();

export class InstancedLOD {
  /**
   * @param {THREE.InstancedMesh} mesh
   * @param {number} maxDist metres; instances farther than this are dropped from `count`
   */
  constructor(mesh, maxDist) {
    this.mesh = mesh;
    this.maxDist = maxDist;
    const n = mesh.count;
    this.total = n;
    this.matrices = Float32Array.from(mesh.instanceMatrix.array); // the authored order
    this.centers = new Float32Array(n * 3);
    this.radii = new Float32Array(n);
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    const r = mesh.geometry.boundingSphere.radius;
    for (let i = 0; i < n; i++) {
      _m.fromArray(this.matrices, i * 16);
      this.centers[i * 3] = _m.elements[12];
      this.centers[i * 3 + 1] = _m.elements[13];
      this.centers[i * 3 + 2] = _m.elements[14];
      this.radii[i] = r * _m.getMaxScaleOnAxis();
    }
    this.order = new Uint32Array(n);
    this.last = null; // camera position at the last partition
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  /** Re-partition when the camera has moved more than `step` metres since the last time. */
  update(camPos, step = 2) {
    if (this.last && this.last.distanceToSquared(camPos) < step * step) return this.mesh.count;
    this.last = (this.last ?? new THREE.Vector3()).copy(camPos);
    // Instance matrices are local to the mesh: bring the camera into that frame.
    const cam = _local.copy(camPos).applyMatrix4(_inv.copy(this.mesh.matrixWorld).invert());
    const count = lodCount(this.centers, cam, this.maxDist, this.order, this.radii);
    const dst = this.mesh.instanceMatrix.array;
    for (let i = 0; i < count; i++) {
      const src = this.order[i] * 16;
      for (let k = 0; k < 16; k++) dst[i * 16 + k] = this.matrices[src + k];
    }
    this.mesh.count = count;
    this.mesh.visible = count > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    return count;
  }
}

const _c = new THREE.Vector3();

export class DistanceCuller {
  /** @param {{ minPixels?: number }} [opts] projected diameter below which a mesh is hidden */
  constructor({ minPixels = 4 } = {}) {
    this.minPixels = minPixels;
    this.items = [];
    this.instanced = [];
    this.hidden = 0;
  }

  /**
   * Register every plain mesh under `root` that is visible now, and every InstancedMesh
   * tagged with `userData.lodDistance`. Skips the sky and other frustumCulled=false objects,
   * period-switched objects (TempleGame.applyPeriod owns their `visible`) and anything
   * tagged `userData.noCull`.
   */
  collect(root) {
    root.traverse((o) => {
      if (o.userData?.noCull || o.frustumCulled === false || !o.visible) return;
      if (o.isInstancedMesh) {
        if (o.userData.lodDistance > 0) this.instanced.push(new InstancedLOD(o, o.userData.lodDistance));
        return;
      }
      if (!o.isMesh || o.isSkinnedMesh || !o.geometry || o.userData?.period) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const bs = o.geometry.boundingSphere;
      if (!bs || !Number.isFinite(bs.radius)) return;
      const radius = bs.radius * o.matrixWorld.getMaxScaleOnAxis();
      this.items.push({ obj: o, radius, center: bs.center });
    });
    return this;
  }

  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {number} viewportHeight CSS pixels
   */
  update(camera, viewportHeight) {
    const k = viewportHeight / (this.minPixels * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    const cam = camera.position;
    let hidden = 0;
    for (const it of this.items) {
      _c.copy(it.center).applyMatrix4(it.obj.matrixWorld);
      const near = _c.distanceTo(cam) <= it.radius * k;
      it.obj.visible = near;
      if (!near) hidden++;
    }
    for (const l of this.instanced) l.update(cam);
    this.hidden = hidden;
  }

  /** Show everything again (before disposing, or when culling is switched off). */
  reset() {
    for (const it of this.items) it.obj.visible = true;
    for (const l of this.instanced) {
      l.mesh.instanceMatrix.array.set(l.matrices);
      l.mesh.count = l.total;
      l.mesh.visible = true;
      l.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
