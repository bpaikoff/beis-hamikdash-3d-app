import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { Daylight, ENV, ENV_PANELS } from './Daylight.js';
import { SUN, TIMES_OF_DAY, daylight, sunDirection } from './sun.js';

/** A PMREMGenerator stand-in: counts renders and hands out disposable targets. */
function fakePmrem() {
  const targets = [];
  return {
    targets,
    fromScene: vi.fn((scene, sigma) => {
      const texture = { name: `env${targets.length}`, dispose: vi.fn() };
      const target = { scene, sigma, texture, dispose: vi.fn() };
      targets.push(target);
      return target;
    }),
    dispose: vi.fn(),
  };
}

function sceneWithSky() {
  const scene = new THREE.Scene();
  scene.add(Daylight.createSky());
  scene.fog = new THREE.Fog(0xffffff, 1, 100);
  return scene;
}

describe('Daylight environment map', () => {
  it('leaves scene.environment alone without a renderer or generator', () => {
    const scene = sceneWithSky();
    const foreign = { dispose: vi.fn() };
    scene.environment = foreign;
    const dl = new Daylight(scene);
    dl.set('dusk');
    expect(scene.environment).toBe(foreign);
    expect(foreign.dispose).not.toHaveBeenCalled();
    expect(dl.envCache.size).toBe(0);
    dl.dispose(); // no-op without a generator
  });

  it('renders once per time of day and reuses the cached map', () => {
    const scene = sceneWithSky();
    const pmrem = fakePmrem();
    const dl = new Daylight(scene, { pmrem });
    dl.set('dusk');
    dl.set('dusk');
    expect(pmrem.fromScene).toHaveBeenCalledTimes(1);
    expect(pmrem.fromScene.mock.calls[0][1]).toBe(ENV.sigma);
    expect(scene.environment).toBe(pmrem.targets[0].texture);
    dl.set('morning');
    expect(pmrem.fromScene).toHaveBeenCalledTimes(2);
    expect(scene.environment).toBe(pmrem.targets[1].texture);
    dl.set('dusk');
    expect(pmrem.fromScene).toHaveBeenCalledTimes(2); // cached
    expect(scene.environment).toBe(pmrem.targets[0].texture);
    expect(pmrem.targets[0].dispose).not.toHaveBeenCalled(); // cached maps stay for the session
    for (const t of TIMES_OF_DAY) dl.set(t);
    expect(pmrem.fromScene).toHaveBeenCalledTimes(TIMES_OF_DAY.length);
  });

  it('disposes the environment it replaces and everything it made on dispose()', () => {
    const scene = sceneWithSky();
    const foreign = { dispose: vi.fn() }; // e.g. a RoomEnvironment map set before Daylight took over
    scene.environment = foreign;
    const pmrem = fakePmrem();
    const dl = new Daylight(scene, { pmrem });
    dl.set('dawn');
    expect(foreign.dispose).toHaveBeenCalledTimes(1);
    dl.set('dusk');
    expect(foreign.dispose).toHaveBeenCalledTimes(1);
    const env = dl.env;
    const disposed = [];
    for (const part of ['sky', 'ground']) for (const k of ['geometry', 'material']) env[part][k].addEventListener('dispose', () => disposed.push(`${part}.${k}`));
    for (const panel of env.panels) for (const k of ['geometry', 'material']) panel[k].addEventListener('dispose', () => disposed.push(`panel.${k}`));
    dl.dispose();
    for (const t of pmrem.targets) expect(t.dispose).toHaveBeenCalledTimes(1);
    expect(scene.environment).toBeNull();
    expect(dl.envCache.size).toBe(0);
    expect(dl.env).toBeNull();
    expect(disposed).toEqual(['sky.geometry', 'sky.material', 'ground.geometry', 'ground.material', ...ENV_PANELS.flatMap(() => ['panel.geometry', 'panel.material'])]);
    expect(pmrem.dispose).not.toHaveBeenCalled(); // an injected generator belongs to the caller
  });

  it('renders the offscreen dome with the visible dome\'s sun at the environment exposure, over a horizon-coloured ground', () => {
    const scene = sceneWithSky();
    const pmrem = fakePmrem();
    const dl = new Daylight(scene, { pmrem });
    const d = dl.set('dusk');
    const off = pmrem.fromScene.mock.calls[0][0];
    expect(off).toBe(dl.env.scene);
    expect(off.getObjectByName('envSky')).toBe(dl.env.sky);
    expect(off.getObjectByName('envGround')).toBe(dl.env.ground);
    const u = dl.env.sky.material.uniforms;
    const v = dl.sky.material.uniforms;
    expect(u.sunPosition.value.toArray()).toEqual(v.sunPosition.value.toArray());
    expect(u.sunPosition.value.z).toBeLessThan(-0.9); // dusk: the sun on the western horizon
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) expect(u[k].value).toBe(v[k].value);
    expect(u.skyExposure.value).toBeCloseTo(SUN.dusk.exposure * (SUN.dusk.envExposure ?? ENV.exposure), 9);
    expect(u.skySaturation.value).toBe(ENV.saturation);
    expect(v.skyExposure.value).toBe(SUN.dusk.exposure); // the visible dome is untouched
    expect(v.skySaturation.value).toBe(SUN.dusk.saturation);
    expect(u.skyExposure.value).toBeGreaterThan(v.skyExposure.value);
    expect(dl.env.sky.frustumCulled).toBe(false);
    expect(dl.env.sky.renderOrder).toBeLessThan(dl.env.ground.renderOrder); // no depth buffer: the ground draws over the dome
    expect(dl.env.ground.material.side).toBe(THREE.BackSide);
    const g = dl.env.ground.material.color.toArray();
    expect(g).toEqual(Daylight.groundColor(d).map((c) => expect.closeTo(c, 9)));
  });

  it('puts bright panels around the sun that dim and redden with it', () => {
    const scene = sceneWithSky();
    const dl = new Daylight(scene, { pmrem: fakePmrem() });
    const morning = dl.set('morning');
    const { panels, scene: off } = dl.env;
    expect(panels).toHaveLength(ENV_PANELS.length);
    for (const p of panels) {
      expect(off.children).toContain(p);
      expect(p.renderOrder).toBeGreaterThan(dl.env.ground.renderOrder);
      expect(p.material.toneMapped).toBe(false);
      const dir = p.position.clone().normalize();
      const el = (Math.asin(dir.y) * 180) / Math.PI;
      expect(el).toBeCloseTo(p.userData.spec.elevation, 6);
      expect(el).toBeGreaterThanOrEqual(10); // in the band a vertical wall reflects from eye level
      expect(el).toBeLessThanOrEqual(40);
      // Faces the origin: the plane's normal (+z after lookAt) points back along its position.
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(p.quaternion);
      expect(normal.dot(dir)).toBeLessThan(-0.999);
    }
    // The main panel sits at the sun's bearing; the rim panel opposite.
    const sun = sunDirection('morning');
    const bearing = (v) => Math.atan2(v.z, v.x);
    const main = panels.find((p) => p.userData.spec.azimuth === 0);
    const rim = panels.find((p) => p.userData.spec.azimuth === 180);
    expect(bearing(main.position)).toBeCloseTo(bearing(sun), 6);
    expect(Math.cos(bearing(rim.position) - bearing(sun))).toBeCloseTo(-1, 6);
    expect(main.material.color.r).toBeCloseTo(main.userData.spec.radiance * (morning.sunIntensity / ENV.panelSun) * morning.sunColor[0], 6);
    expect(main.material.color.r).toBeGreaterThan(rim.material.color.r * 3);
    const mainMorning = main.material.color.clone();
    const dusk = dl.set('dusk');
    expect(bearing(main.position)).toBeCloseTo(bearing(sunDirection('dusk')), 6); // followed the sun west
    const mainDusk = main.material.color;
    expect(mainDusk.r / mainMorning.r).toBeCloseTo(dusk.sunIntensity / morning.sunIntensity, 6); // dimmer
    expect(mainDusk.r / mainDusk.b).toBeGreaterThan(mainMorning.r / mainMorning.b * 3); // and redder
  });

  it('warms the ground at dawn and dusk and keeps it pale sand at midday', () => {
    const warm = (c) => c[0] / c[2];
    const noon = Daylight.groundColor(daylight('morning'));
    expect(warm(noon)).toBeGreaterThan(1.1); // sand, not grey
    expect(warm(noon)).toBeLessThan(1.5);
    for (const t of ['dawn', 'dusk']) {
      const g = Daylight.groundColor(daylight(t));
      expect(warm(g)).toBeGreaterThan(warm(noon) + 0.3); // the horizon's orange, from below
      expect(Math.max(...g)).toBeGreaterThan(0.1); // not black under the horizon
      expect(Math.max(...g)).toBeLessThan(Math.max(...noon)); // but dimmer than midday
    }
  });
});
