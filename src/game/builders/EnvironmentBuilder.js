import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { BaseBuilder } from './BaseBuilder.js';
import { mulberry32 } from '../random.js';

// ============================================================================
// ENVIRONMENT BUILDER - Sky, ground, and distant scenery
// ============================================================================
export class EnvironmentBuilder extends BaseBuilder {
  build() {
    this.buildGround();
    this.buildSky();
    this.buildDistantHills();
  }

  buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500, 50, 50),
      this.mat.ground
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData = { isFloor: true };
    this.scene.add(ground);
    this.floors.push(ground);
  }

  buildSky() {
    // Kept inside the far plane and re-centred on the camera every frame (TempleGame),
    // so no part of it is ever clipped when the player stands far from the origin.
    const skyGeo = new THREE.SphereGeometry(CONFIG.RENDER_DISTANCE * 0.9, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x4A90C8) },
        bottomColor: { value: new THREE.Color(0xD4E4F4) },
        sunPos: { value: new THREE.Vector3(0.5, 0.3, 0.5).normalize() }
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor, bottomColor, sunPos;
        varying vec3 vPos;
        void main() {
          vec3 dir = normalize(vPos);
          float h = dir.y * 0.5 + 0.5;
          vec3 sky = mix(bottomColor, topColor, pow(h, 0.6));
          float sun = max(0.0, dot(dir, sunPos));
          sky += vec3(1.0, 0.98, 0.9) * pow(sun, 32.0) * 0.5 + pow(sun, 4.0) * 0.2;
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.name = 'sky';
    sky.frustumCulled = false;
    sky.renderOrder = -1;
    this.scene.add(sky);
    this.scene.fog = new THREE.Fog(0xd8e2ec, 140, CONFIG.RENDER_DISTANCE * 0.88);
  }

  buildDistantHills() {
    const rand = mulberry32(7); // same hills on every load
    const hillMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.1, 0.2, 0.55), roughness: 0.9 });
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = 180 + rand() * 40;
      const height = 15 + rand() * 25;
      const m = new THREE.Mesh(new THREE.ConeGeometry(30 + rand() * 20, height, 6), hillMat);
      m.position.set(Math.cos(angle) * dist, height / 2 - 5, Math.sin(angle) * dist);
      m.rotation.y = rand() * Math.PI;
      this.scene.add(m);
    }
  }
}
