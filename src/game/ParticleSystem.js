import * as THREE from 'three';

// ============================================================================
// PARTICLE SYSTEM
// ============================================================================
export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.systems = [];
  }

  createFire(x, y, z, size = 1) {
    const count = 80;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const vel = [];

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * size;
      pos[i * 3 + 1] = Math.random() * size * 2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * size;
      const t = pos[i * 3 + 1] / (size * 2);
      col[i * 3] = 1;
      col[i * 3 + 1] = 0.5 - t * 0.3;
      col[i * 3 + 2] = 0;
      vel.push(new THREE.Vector3((Math.random() - 0.5) * 0.5, 1 + Math.random() * 2, (Math.random() - 0.5) * 0.5));
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({ size: 0.25, vertexColors: true, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    pts.position.set(x, y, z);
    pts.userData = { vel, size };
    this.scene.add(pts);
    this.systems.push({ type: 'fire', mesh: pts });

    const light = new THREE.PointLight(0xFF6622, 2, 20);
    light.position.set(x, y + size, z);
    this.scene.add(light);
    this.systems.push({ type: 'fireLight', mesh: light, baseIntensity: 2 });
    return pts;
  }

  createSmoke(x, y, z, size = 0.5) {
    const count = 25;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * size;
      pos[i * 3 + 1] = Math.random() * size * 3;
      pos[i * 3 + 2] = (Math.random() - 0.5) * size;
      vel.push(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.2));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ size: 0.35, color: 0x888888, transparent: true, opacity: 0.25, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    pts.position.set(x, y, z);
    pts.userData = { vel, size };
    this.scene.add(pts);
    this.systems.push({ type: 'smoke', mesh: pts });
    return pts;
  }

  update(delta) {
    this.systems.forEach(s => {
      if (s.type === 'fire') {
        const pos = s.mesh.geometry.attributes.position.array;
        const col = s.mesh.geometry.attributes.color.array;
        const { vel, size } = s.mesh.userData;
        for (let i = 0; i < vel.length; i++) {
          pos[i * 3] += vel[i].x * delta;
          pos[i * 3 + 1] += vel[i].y * delta;
          pos[i * 3 + 2] += vel[i].z * delta;
          if (pos[i * 3 + 1] > size * 3) { pos[i * 3] = (Math.random() - 0.5) * size; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = (Math.random() - 0.5) * size; }
          const t = pos[i * 3 + 1] / (size * 3);
          col[i * 3] = 1; col[i * 3 + 1] = Math.max(0, 0.5 - t * 0.5); col[i * 3 + 2] = 0;
        }
        s.mesh.geometry.attributes.position.needsUpdate = true;
        s.mesh.geometry.attributes.color.needsUpdate = true;
      }
      if (s.type === 'fireLight') s.mesh.intensity = s.baseIntensity + Math.sin(Date.now() * 0.01) * 0.5;
      if (s.type === 'smoke') {
        const pos = s.mesh.geometry.attributes.position.array;
        const { vel, size } = s.mesh.userData;
        for (let i = 0; i < vel.length; i++) {
          pos[i * 3] += vel[i].x * delta + (Math.random() - 0.5) * 0.1;
          pos[i * 3 + 1] += vel[i].y * delta;
          pos[i * 3 + 2] += vel[i].z * delta + (Math.random() - 0.5) * 0.1;
          if (pos[i * 3 + 1] > size * 6) { pos[i * 3] = (Math.random() - 0.5) * size; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = (Math.random() - 0.5) * size; }
        }
        s.mesh.geometry.attributes.position.needsUpdate = true;
      }
    });
  }
}
