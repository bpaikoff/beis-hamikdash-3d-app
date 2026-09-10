import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { TempleBuilder } from '../TempleBuilder.js';

/**
 * Round 7: the wood flicker. Two faces that lie in the same plane, face the same way and
 * overlap are drawn over each other and z-fight: past ~40 m the depth buffer cannot
 * order them and the nearer one shimmers as the camera moves. Gate frames used to
 * sit exactly flush with the reveal and the wall face, so every cedar door frame did
 * this. The probe below decomposes every box mesh in the built scene (BoxGeometry,
 * merged frames of boxes, instanced boxes) into axis-aligned faces and lists the pairs
 * that share a plane within 1 mm with the same normal and an overlapping extent; the
 * test asserts none involve wood, and reports the rest for information.
 */
const TOL = 1e-3; // metres: two planes closer than this are "the same"
// Metres of overlap in both extents before two faces count: edge contact is not a fight,
// and a band narrower than this (the 5 mm the frames stand proud, doubled where two
// frames meet through a wall, or a frame's foot on a leaf's at floor level) is buried.
const MIN_OVERLAP = 0.02;
// Names excluded from the wood assertion (none since the r7/flip merge: Palhedrin's bay
// frame is buried inside Shaar HaKorban's with `frameInset`, and open leaves in a thin
// wall fold against its face instead of into a reveal with no depth).
const EXCLUDE = /$^/;

let scene;
let mat;

beforeAll(() => {
  scene = new THREE.Scene();
  const tb = new TempleBuilder(scene, { get: () => null });
  mat = tb.mat;
  tb.build();
  scene.updateMatrixWorld(true);
});

/** Axis-aligned world boxes [{min, max, name, material}] of a mesh's box geometry, or []. */
function boxesOf(mesh) {
  const geo = mesh.geometry;
  const pos = geo?.attributes?.position;
  if (!pos || pos.count % 24 !== 0 || pos.count === 0) return [];
  const matrices = [];
  if (mesh.isInstancedMesh) {
    const m = new THREE.Matrix4();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      matrices.push(m.clone().premultiply(mesh.matrixWorld));
    }
  } else matrices.push(mesh.matrixWorld);
  const out = [];
  const v = new THREE.Vector3();
  for (const mw of matrices) {
    for (let g = 0; g < pos.count; g += 24) {
      const b = new THREE.Box3();
      const pts = [];
      for (let i = g; i < g + 24; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mw);
        pts.push(v.clone());
        b.expandByPoint(v);
      }
      // Every vertex on a corner of its AABB: an axis-aligned box (a rotated box or a
      // non-box geometry with 24n vertices is skipped).
      const corner = (p) => ['x', 'y', 'z'].every((a) => Math.abs(p[a] - b.min[a]) < 1e-6 || Math.abs(p[a] - b.max[a]) < 1e-6);
      if (!pts.every(corner)) continue;
      if (b.max.x - b.min.x < 1e-6 || b.max.y - b.min.y < 1e-6 || b.max.z - b.min.z < 1e-6) continue;
      out.push({ min: b.min.clone(), max: b.max.clone(), name: mesh.name || mesh.userData?.name || mesh.parent?.name || '(unnamed)', material: mesh.material });
    }
  }
  return out;
}

/** The six faces of a box as { axis, sign, at, u: [lo, hi], v: [lo, hi], box }. */
function facesOf(box) {
  const faces = [];
  const axes = ['x', 'y', 'z'];
  for (const axis of axes) {
    const [ua, va] = axes.filter((a) => a !== axis);
    for (const sign of [-1, 1]) {
      faces.push({ axis, sign, at: sign > 0 ? box.max[axis] : box.min[axis], u: [box.min[ua], box.max[ua]], v: [box.min[va], box.max[va]], box });
    }
  }
  return faces;
}

/** Pairs of faces on the same plane (within TOL), same normal, with an overlapping extent. */
export function coplanarPairs(root) {
  const boxes = [];
  // Invisible meshes (colliders, the keilim's solids) draw nothing and cannot fight.
  root.traverse((o) => { if (o.isMesh && o.visible && o.material?.visible !== false) boxes.push(...boxesOf(o)); });
  const buckets = new Map();
  const key = (f, k) => `${f.axis}${f.sign}:${k}`;
  for (const b of boxes) {
    for (const f of facesOf(b)) {
      const k = Math.round(f.at / TOL);
      const list = buckets.get(key(f, k)) ?? [];
      list.push(f);
      buckets.set(key(f, k), list);
    }
  }
  const overlap = (a, b) => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
  const pairs = [];
  const seen = new Set();
  for (const [k, list] of buckets) {
    const [prefix, idx] = k.split(':');
    // Compare with the same bucket and the next one up, so a plane on a rounding boundary is still found.
    const candidates = [list, buckets.get(`${prefix}:${Number(idx) + 1}`) ?? []];
    for (let ci = 0; ci < candidates.length; ci++) {
      const other = candidates[ci];
      for (let i = 0; i < list.length; i++) {
        for (let j = ci === 0 ? i + 1 : 0; j < other.length; j++) {
          const a = list[i];
          const b = other[j];
          if (a.box === b.box) continue;
          if (Math.abs(a.at - b.at) >= TOL) continue;
          const ou = overlap(a.u, b.u);
          const ov = overlap(a.v, b.v);
          if (ou < MIN_OVERLAP || ov < MIN_OVERLAP) continue;
          const id = [a.box.name, b.box.name, a.axis, a.sign, Math.round(a.at * 1000)].join('|');
          if (seen.has(id)) continue;
          seen.add(id);
          pairs.push({ a: a.box, b: b.box, axis: a.axis, sign: a.sign, at: a.at, overlap: [ou, ov] });
        }
      }
    }
  }
  return { boxes: boxes.length, pairs };
}

const ext = (b) => `[${['x', 'y', 'z'].map((a) => `${b.min[a].toFixed(3)}..${b.max[a].toFixed(3)}`).join(' ')}]`;
const describePair = (p) => `${p.a.name} / ${p.b.name}: ${p.sign > 0 ? '+' : '-'}${p.axis} at ${p.at.toFixed(3)} m, overlap ${p.overlap[0].toFixed(2)} x ${p.overlap[1].toFixed(2)} m; a ${ext(p.a)} b ${ext(p.b)}`;

describe('coplanar faces in the built scene', () => {
  it('decomposes the scene into a few thousand axis-aligned boxes', () => {
    const { boxes } = coplanarPairs(scene);
    expect(boxes).toBeGreaterThan(1000);
  });

  it('no visible box is flat (a zero extent draws two coincident faces that fight each other)', () => {
    // gateA's open leaves in a 1-amah chamber wall were folded into a reveal with no depth
    // left: a box 0 thick (Lishkas Palhedrin's Cheil door, the Gazis' north door).
    const flat = [];
    scene.traverse((o) => {
      const pr = o.isMesh && o.visible && o.geometry?.parameters;
      if (!pr || !('width' in pr && 'height' in pr && 'depth' in pr)) return;
      if (pr.width < 1e-6 || pr.height < 1e-6 || pr.depth < 1e-6) flat.push(`${o.name || o.parent?.name || '(unnamed)'} ${pr.width.toFixed(3)} x ${pr.height.toFixed(3)} x ${pr.depth.toFixed(3)} at (${o.position.x.toFixed(2)}, ${o.position.y.toFixed(2)}, ${o.position.z.toFixed(2)})`);
    });
    expect(flat).toEqual([]);
  });

  it('no wood face shares a plane with another face that looks the same way', () => {
    const wood = new Set([mat.cedar, mat.acacia]);
    const { pairs } = coplanarPairs(scene);
    const woodPairs = pairs.filter((p) => (wood.has(p.a.material) || wood.has(p.b.material)) && !EXCLUDE.test(p.a.name) && !EXCLUDE.test(p.b.name));
    const rest = pairs.filter((p) => !woodPairs.includes(p));
    if (rest.length) console.log(`coplanar (not wood, informational): ${rest.length}\n  ${rest.slice(0, 40).map(describePair).join('\n  ')}`);
    expect(woodPairs.map(describePair), `wood faces that z-fight`).toEqual([]);
  });
});
