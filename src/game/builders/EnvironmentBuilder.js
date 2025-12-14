import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { BaseBuilder } from './BaseBuilder.js';

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
    const skyGeo = new THREE.SphereGeometry(CONFIG.RENDER_DISTANCE, 32, 32);
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
      side: THREE.BackSide
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));
  }

  buildDistantHills() {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = 180 + Math.random() * 40;
      const height = 15 + Math.random() * 25;
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(30 + Math.random() * 20, height, 6),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.1, 0.2, 0.5 + Math.random() * 0.1),
          roughness: 0.9
        })
      );
      m.position.set(Math.cos(angle) * dist, height/2 - 5, Math.sin(angle) * dist);
      m.rotation.y = Math.random() * Math.PI;
      this.scene.add(m);
    }
  }
}
