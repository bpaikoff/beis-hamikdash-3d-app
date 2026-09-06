import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  EnvironmentBuilder, hillPlacements, groundSize, gridCoords, terrainHeight, terrainBlend,
  HILL_CLEARANCE, BLEND_WIDTH, NOISE_AMPLITUDE, FOG_END,
} from './EnvironmentBuilder.js';
import { walkableBounds, byId, worldBounds } from '../../content/index.js';
import { CONFIG } from '../../config.js';

/** Distance from (x, z) to the nearest point of a rectangle; 0 inside it. */
const gap = (x, z, r) => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));

describe('environment', () => {
  const walkable = walkableBounds();
  const hills = hillPlacements();
  const east = hills[2]; // octant 2 is +z, east: the Har HaMishcha ridge

  it('the walkable ground is the outside ring round the mount', () => {
    const mount = worldBounds(byId.har_habayis);
    expect(walkable.minX).toBeLessThan(mount.minX - 10);
    expect(walkable.maxX).toBeGreaterThan(mount.maxX + 10);
    expect(walkable.minZ).toBeLessThan(mount.minZ - 10);
    expect(walkable.maxZ).toBeGreaterThan(mount.maxZ + 10);
  });

  it('keeps every hill clear of the walkable ground and inside the far plane', () => {
    expect(hills).toHaveLength(8);
    for (const h of hills) {
      expect(gap(h.x, h.z, walkable), `hill at (${h.x.toFixed(0)}, ${h.z.toFixed(0)}) r ${h.radius.toFixed(0)}`).toBeGreaterThanOrEqual(h.radius + 10);
      // The visible foot is HILL_FOOT (1.6) radii, and the east ridge is stretched 3.2 x along x.
      expect(h.dist + h.radius * 1.6 * (h.ridge?.stretchX ?? 1), 'the foot inside the far plane').toBeLessThan(CONFIG.RENDER_DISTANCE);
    }
    expect(hills.filter((h) => h.ridge)).toEqual([east]);
    expect(Math.abs(east.x)).toBeLessThan(1e-9);
    expect(east.z).toBeGreaterThan(walkable.maxZ);
  });

  it('the terrain is exactly flat on the ring and its clearance, and finite everywhere', () => {
    const probes = [
      [walkable.minX, walkable.minZ], [walkable.minX, walkable.maxZ], [walkable.maxX, walkable.minZ], [walkable.maxX, walkable.maxZ],
      [20, 166], [118, 14], [14, -122], [-200, 23], [-175, 163], // the gate approaches and the SE corner (screenshot views)
      [walkable.maxX + HILL_CLEARANCE, 0], [0, walkable.maxZ + HILL_CLEARANCE], [walkable.minX + 1, walkable.minZ + 1],
    ];
    for (const [x, z] of probes) {
      expect(terrainBlend(x, z, walkable), `blend at (${x}, ${z})`).toBe(0);
      expect(terrainHeight(x, z, hills, walkable), `height at (${x}, ${z})`).toBe(0);
    }
    for (let x = -800; x <= 800; x += 25) {
      for (let z = -800; z <= 800; z += 25) {
        const y = terrainHeight(x, z, hills, walkable);
        expect(Number.isFinite(y), `finite at (${x}, ${z})`).toBe(true);
        expect(y).toBeLessThan(60);
        expect(y).toBeGreaterThan(-NOISE_AMPLITUDE);
      }
    }
  });

  it('rises smoothly past the clearance to a hill at each seeded centre, and to a ridge in the east', () => {
    for (const h of hills) expect(terrainHeight(h.x, h.z, hills, walkable), `hill at (${h.x.toFixed(0)}, ${h.z.toFixed(0)})`).toBeGreaterThan(5);
    // The blend: no step at the clearance line, full height BLEND_WIDTH further out.
    const z0 = walkable.maxZ + HILL_CLEARANCE;
    expect(terrainBlend(0, z0 + 0.5, walkable)).toBeLessThan(0.01);
    expect(terrainBlend(0, z0 + BLEND_WIDTH, walkable)).toBe(1);
    let prev = 0;
    for (let z = z0; z <= east.z; z += 1) {
      const y = terrainHeight(0, z, hills, walkable);
      expect(y - prev, `no step at z ${z}`).toBeLessThan(2.5);
      prev = y;
    }
    // The ridge runs north-south (along x) at the east hill's z, well past a round hill's foot.
    const stretch = east.radius * east.ridge.stretchX;
    for (const dx of [-stretch * 0.5, stretch * 0.5]) expect(terrainHeight(east.x + dx, east.z, hills, walkable)).toBeGreaterThan(5);
    expect(terrainHeight(east.x, east.z + east.radius * 2, hills, walkable)).toBeLessThan(NOISE_AMPLITUDE);
  });

  it('builds one heightfield floor that covers the ring, the hills and the fog range', () => {
    const scene = new THREE.Scene();
    const mat = { ground: new THREE.MeshStandardMaterial() };
    const floors = [];
    const b = new EnvironmentBuilder(scene, { get: () => undefined }, mat, floors, []);
    b.hills = hills;
    b.buildGround();
    const ground = scene.getObjectByName('ground');
    expect(floors).toEqual([ground]);
    expect(ground.userData).toMatchObject({ isFloor: true, noCull: true });
    expect(ground.material.vertexColors).toBe(true);
    expect(scene.children.filter((o) => o.name === 'hill')).toHaveLength(0);
    ground.geometry.computeBoundingBox();
    const bb = ground.geometry.boundingBox;
    const half = groundSize(hills, walkable) / 2;
    expect(bb.min.x).toBe(-half);
    expect(bb.max.z).toBe(half);
    // The edge is at least the fog's end away from every walkable point.
    for (const [x, z] of [[walkable.minX, walkable.minZ], [walkable.maxX, walkable.maxZ]]) {
      expect(half - Math.abs(x)).toBeGreaterThanOrEqual(FOG_END);
      expect(half - Math.abs(z)).toBeGreaterThanOrEqual(FOG_END);
    }
    for (const h of hills) expect(Math.max(Math.abs(h.x), Math.abs(h.z)) + h.radius * 2).toBeLessThan(half);
    // Vertices carry terrainHeight, smooth normals, and sand-white colour on the flat ring.
    const pos = ground.geometry.attributes.position;
    const col = ground.geometry.attributes.color;
    const nrm = ground.geometry.attributes.normal;
    let flat = 0;
    let raised = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      expect(pos.getY(i)).toBeCloseTo(terrainHeight(x, z, hills, walkable), 3);
      if (gap(x, z, walkable) === 0) {
        flat++;
        expect(pos.getY(i)).toBe(0);
        expect([col.getX(i), col.getY(i), col.getZ(i)]).toEqual([1, 1, 1]);
        expect(nrm.getY(i)).toBeCloseTo(1, 5);
      } else if (pos.getY(i) > 10) {
        raised++;
        expect(col.getX(i)).toBeLessThan(1);
      }
    }
    expect(flat).toBeGreaterThan(1000);
    expect(raised).toBeGreaterThan(50);
    // Triangle budget: fine cells where the hills are, coarse beyond, well under 100k.
    const tris = ground.geometry.index.count / 3;
    expect(tris).toBeGreaterThan(20000);
    expect(tris).toBeLessThan(100000);
    const coords = gridCoords(half, 360);
    expect(coords[0]).toBe(-half);
    expect(coords[coords.length - 1]).toBe(half);
    for (let i = 1; i < coords.length; i++) expect(coords[i] - coords[i - 1]).toBeGreaterThan(0);
  });
});
