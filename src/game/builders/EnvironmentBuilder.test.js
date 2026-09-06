import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { EnvironmentBuilder, hillPlacements, groundSize } from './EnvironmentBuilder.js';
import { walkableBounds, byId, worldBounds } from '../../content/index.js';
import { CONFIG } from '../../config.js';

/** Distance from (x, z) to the nearest point of a rectangle; 0 inside it. */
const gap = (x, z, r) => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));

describe('environment', () => {
  const walkable = walkableBounds();
  const hills = hillPlacements();

  it('the walkable ground is the outside ring round the mount', () => {
    const mount = worldBounds(byId.har_habayis);
    expect(walkable.minX).toBeLessThan(mount.minX - 10);
    expect(walkable.maxX).toBeGreaterThan(mount.maxX + 10);
    expect(walkable.minZ).toBeLessThan(mount.minZ - 10);
    expect(walkable.maxZ).toBeGreaterThan(mount.maxZ + 10);
  });

  it('keeps every hill cone base clear of the walkable ground and the mount corners', () => {
    expect(hills).toHaveLength(8);
    for (const h of hills) {
      expect(gap(h.x, h.z, walkable), `hill at (${h.x.toFixed(0)}, ${h.z.toFixed(0)}) r ${h.radius.toFixed(0)}`).toBeGreaterThanOrEqual(h.radius + 10);
      expect(h.dist + h.radius, 'inside the far plane').toBeLessThan(CONFIG.RENDER_DISTANCE);
    }
  });

  it('builds the ground plane under every hill and the whole walkable ground', () => {
    const scene = new THREE.Scene();
    const mat = { ground: new THREE.MeshStandardMaterial() };
    const b = new EnvironmentBuilder(scene, { get: () => undefined }, mat, [], []);
    b.hills = hills;
    b.buildGround();
    b.buildDistantHills();
    const ground = scene.getObjectByName('ground');
    const half = ground.geometry.parameters.width / 2;
    expect(ground.geometry.parameters.width).toBe(groundSize(hills));
    for (const v of [walkable.minX, walkable.maxX, walkable.minZ, walkable.maxZ]) expect(Math.abs(v) + 20).toBeLessThan(half);
    const cones = scene.children.filter((o) => o.name === 'hill');
    expect(cones).toHaveLength(8);
    for (const c of cones) {
      const r = c.geometry.parameters.radius;
      expect(Math.max(Math.abs(c.position.x), Math.abs(c.position.z)) + r).toBeLessThan(half);
      expect(c.position.y - c.geometry.parameters.height / 2, 'base under the ground').toBeLessThan(0);
    }
  });
});
