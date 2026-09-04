import * as THREE from 'three';
import { mulberry32 } from './random.js';

/**
 * Soft radial sprite shared by every particle system: white centre fading to transparent,
 * so the point colour/opacity does the tinting. 64 px is plenty for a blurred disc.
 */
export function makeParticleTexture(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ============================================================================
// PARTICLE SYSTEM - fire and smoke as textured, size-attenuated points
// ============================================================================
export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.systems = [];
    this.rand = mulberry32(5); // same initial scatter on every load (screenshots)
    this.sprite = makeParticleTexture();
  }

  createFire(x, y, z, size = 1) {
    const count = 80;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const vel = [];

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (this.rand() - 0.5) * size;
      pos[i * 3 + 1] = this.rand() * size * 2;
      pos[i * 3 + 2] = (this.rand() - 0.5) * size;
      const t = pos[i * 3 + 1] / (size * 2);
      col[i * 3] = 1;
      col[i * 3 + 1] = 0.5 - t * 0.3;
      col[i * 3 + 2] = 0;
      vel.push(new THREE.Vector3((this.rand() - 0.5) * 0.5, 1 + this.rand() * 2, (this.rand() - 0.5) * 0.5));
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
      map: this.sprite,
      size: 1.2,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.position.set(x, y, z);
    pts.userData = { vel, size };
    pts.name = 'fire';
    this.scene.add(pts);
    this.systems.push({ type: 'fire', mesh: pts });

    // Physical units (candela, inverse-square decay): the old intensity 2 lit nothing.
    const baseIntensity = 400;
    const light = new THREE.PointLight(0xff6622, baseIntensity, 0, 2);
    light.position.set(x, y + size, z);
    this.scene.add(light);
    this.systems.push({ type: 'fireLight', mesh: light, baseIntensity });
    return pts;
  }

  createSmoke(x, y, z, size = 0.5) {
    const count = 25;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (this.rand() - 0.5) * size;
      pos[i * 3 + 1] = this.rand() * size * 3;
      pos[i * 3 + 2] = (this.rand() - 0.5) * size;
      vel.push(new THREE.Vector3((this.rand() - 0.5) * 0.2, 0.5 + this.rand() * 0.5, (this.rand() - 0.5) * 0.2));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      map: this.sprite,
      size: 2,
      sizeAttenuation: true,
      color: 0x8a8a8a,
      transparent: true,
      opacity: 0.3,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.position.set(x, y, z);
    pts.userData = { vel, size };
    pts.name = 'smoke';
    this.scene.add(pts);
    this.systems.push({ type: 'smoke', mesh: pts });
    return pts;
  }

  update(delta) {
    const rand = Math.random; // per-frame jitter need not be reproducible
    for (const s of this.systems) {
      if (s.type === 'fire') {
        const pos = s.mesh.geometry.attributes.position.array;
        const col = s.mesh.geometry.attributes.color.array;
        const { vel, size } = s.mesh.userData;
        for (let i = 0; i < vel.length; i++) {
          pos[i * 3] += vel[i].x * delta;
          pos[i * 3 + 1] += vel[i].y * delta;
          pos[i * 3 + 2] += vel[i].z * delta;
          if (pos[i * 3 + 1] > size * 3) { pos[i * 3] = (rand() - 0.5) * size; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = (rand() - 0.5) * size; }
          const t = pos[i * 3 + 1] / (size * 3);
          col[i * 3] = 1; col[i * 3 + 1] = Math.max(0, 0.5 - t * 0.5); col[i * 3 + 2] = 0;
        }
        s.mesh.geometry.attributes.position.needsUpdate = true;
        s.mesh.geometry.attributes.color.needsUpdate = true;
      } else if (s.type === 'fireLight') {
        s.mesh.intensity = s.baseIntensity * (1 + Math.sin(Date.now() * 0.01) * 0.25);
      } else if (s.type === 'smoke') {
        const pos = s.mesh.geometry.attributes.position.array;
        const { vel, size } = s.mesh.userData;
        for (let i = 0; i < vel.length; i++) {
          pos[i * 3] += vel[i].x * delta + (rand() - 0.5) * 0.1;
          pos[i * 3 + 1] += vel[i].y * delta;
          pos[i * 3 + 2] += vel[i].z * delta + (rand() - 0.5) * 0.1;
          if (pos[i * 3 + 1] > size * 6) { pos[i * 3] = (rand() - 0.5) * size; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = (rand() - 0.5) * size; }
        }
        s.mesh.geometry.attributes.position.needsUpdate = true;
      }
    }
  }

  dispose() {
    for (const s of this.systems) {
      this.scene.remove(s.mesh);
      s.mesh.geometry?.dispose();
      s.mesh.material?.dispose();
    }
    this.systems = [];
    this.sprite.dispose();
  }
}
