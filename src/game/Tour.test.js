import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { createStore } from 'zustand/vanilla';
import { Tour, Router, NODES, EDGES, speedProfile, lookQuaternion, TOUR_SPEED, RISE_LIMIT, DROP_LIMIT } from './Tour.js';
import { CONFIG } from '../config.js';
import { AMAH, NICANOR_Z, AZARAH_FLOOR_Y, toWorld } from '../content/units.js';
import { byTourId, stopCamera } from '../content/tours/index.js';

/**
 * A stub player over a schematic court in scene metres: a flat floor at the Ezras
 * Kohanim level everywhere except
 *   - the altar, a 5 m solid over its footprint (amos x -16..16, z -22..-54);
 *   - the kevesh, a wedge over its footprint (amos x -46..-16, z -30..-46) rising from
 *     0 at its foot (x -46) to 4.5 m at the altar; its flanks are cliffs;
 *   - the Ezras Yisrael strip east of z -11 amos, 1.25 m lower, reached by a single
 *     0.5 m riser and three quarter-metre steps (the Duchan).
 * probe/floorUnder/insideSolid follow PlayerController's contracts; collides is absent.
 */
const K = AZARAH_FLOOR_Y + 2.5 * AMAH;
const Y = AZARAH_FLOOR_Y;
const amosX = (x) => x * AMAH;
const amosZ = (z) => NICANOR_Z + z * AMAH;
const ALTAR = { minX: amosX(-16), maxX: amosX(16), minZ: amosZ(-54), maxZ: amosZ(-22), top: K + 5 };
const KEVESH = { minX: amosX(-46), maxX: amosX(-16), minZ: amosZ(-46), maxZ: amosZ(-30) };
const inRect = (r, x, z) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
const keveshTop = (x) => K + 4.5 * ((x - KEVESH.minX) / (KEVESH.maxX - KEVESH.minX));

function surfaceAt(x, z) {
  if (inRect(ALTAR, x, z)) return ALTAR.top;
  if (inRect(KEVESH, x, z)) return keveshTop(x);
  const za = (z - NICANOR_Z) / AMAH; // amos
  if (za > -11) return Y; // Ezras Yisrael
  if (za > -12.5) return Y + 0.5; // Duchan platform
  if (za > -13) return Y + 0.75;
  if (za > -13.5) return Y + 1.0;
  return K;
}

class StubPlayer {
  constructor() {
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.moveF = this.moveB = this.moveL = this.moveR = false;
    this.isRun = false;
    this.groundY = 0;
    this.verticalVelocity = 0;
    this.isJumping = false;
    this.onGround = false;
    this.probes = 0;
  }
  insideSolid(x, y, z) {
    if (inRect(ALTAR, x, z)) return y < ALTAR.top;
    if (inRect(KEVESH, x, z)) return y < keveshTop(x);
    return false;
  }
  probe(x, z, fromY) {
    this.probes++;
    const top = surfaceAt(x, z);
    if (this.insideSolid(x, fromY, z)) return { y: top, inside: true };
    return { y: top, inside: false };
  }
  floorUnder(x, z, feetY) {
    let p = this.probe(x, z, feetY + CONFIG.STEP_HEIGHT + 0.05);
    if (p.inside) p = this.probe(x, z, feetY + CONFIG.PLAYER_HEIGHT + 0.3);
    return p;
  }
}

function stubGame() {
  const player = new StubPlayer();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 400);
  camera.position.set(0, K + CONFIG.PLAYER_HEIGHT, amosZ(-17));
  const store = createStore(() => ({ tour: null, tourStop: -1, tourPlaying: 'idle' }));
  return { player, camera, store };
}

const tamid = byTourId.tamid;
const stopIndex = (id) => tamid.stops.findIndex((s) => s.id === id);

/** Run the tour's update loop at 60 Hz until `until()` holds or `maxSeconds` pass. */
function run(tour, until, maxSeconds = 120) {
  const dt = 1 / 60;
  let t = 0;
  while (!until() && t < maxSeconds) {
    tour.update(dt);
    t += dt;
  }
  return t;
}

describe('speedProfile', () => {
  it('covers the whole length, starts and ends at rest and cruises at TOUR_SPEED', () => {
    const p = speedProfile(30);
    expect(p.at(0)).toBe(0);
    expect(p.at(p.duration)).toBeCloseTo(30, 6);
    expect(p.at(p.duration + 5)).toBeCloseTo(30, 6);
    const mid = p.duration / 2;
    const v = (p.at(mid + 0.05) - p.at(mid - 0.05)) / 0.1;
    expect(v).toBeCloseTo(TOUR_SPEED, 3);
    const v0 = (p.at(0.02) - p.at(0)) / 0.02;
    expect(v0).toBeLessThan(0.2);
  });

  it('is monotonic, and short rails become a triangle that still ends exactly at the length', () => {
    for (const L of [0.3, 1, 2.4, 10]) {
      const p = speedProfile(L);
      let last = -1;
      for (let t = 0; t <= p.duration + 1e-9; t += p.duration / 50) {
        const s = p.at(t);
        expect(s).toBeGreaterThanOrEqual(last - 1e-9);
        last = s;
      }
      expect(p.at(p.duration)).toBeCloseTo(L, 6);
    }
  });
});

describe('lookQuaternion', () => {
  it('faces west (yaw 0 looks down -z) and north (+x) as the azarah frame expects', () => {
    const fwd = new THREE.Vector3();
    const q = lookQuaternion({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -10 });
    fwd.set(0, 0, -1).applyQuaternion(q);
    expect(fwd.z).toBeCloseTo(-1, 6);
    lookQuaternion({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, q);
    fwd.set(0, 0, -1).applyQuaternion(q);
    expect(fwd.x).toBeCloseTo(1, 6);
    // Upward pitch for a target above the eye
    lookQuaternion({ x: 0, y: 0, z: 0 }, { x: 0, y: 10, z: -10 }, q);
    fwd.set(0, 0, -1).applyQuaternion(q);
    expect(fwd.y).toBeCloseTo(Math.SQRT1_2, 6);
  });
});

describe('Router', () => {
  let router;
  beforeEach(() => {
    router = new Router(new StubPlayer());
  });

  it('places every node on a floor and keeps every edge of the schematic court', () => {
    for (const name of Object.keys(NODES)) expect(router.nodes[name].feet, name).toBeGreaterThan(0);
    router.graph();
    expect(router.dropped).toEqual([]);
    for (const [a, b] of EDGES) {
      expect(router.adj[a].some((e) => e.to === b), `${a}->${b}`).toBe(true);
      expect(router.adj[b].some((e) => e.to === a), `${b}->${a}`).toBe(true);
    }
  });

  it('blocks a straight walk through the altar and over the kevesh flank, allows the ramp axis and the Duchan', () => {
    const blocked = router.segmentClear(amosX(0), amosZ(-17), K, amosX(0), amosZ(-60));
    expect(blocked.ok).toBe(false);
    expect(['inside', 'body']).toContain(blocked.reason); // the body probe reaches the face a sample early
    // Across the kevesh's east flank halfway up: a cliff
    const flank = router.segmentClear(amosX(-30), amosZ(-24), K, amosX(-30), amosZ(-38));
    expect(flank.ok).toBe(false);
    // Up the ramp along its axis from the foot
    const ramp = router.segmentClear(amosX(-52), amosZ(-38), K, amosX(-20), amosZ(-38));
    expect(ramp.ok).toBe(true);
    expect(ramp.feet).toBeCloseTo(keveshTop(amosX(-20)), 6);
    // The Duchan riser (0.5 m) is within RISE_LIMIT both ways
    expect(RISE_LIMIT).toBeGreaterThan(0.5);
    expect(DROP_LIMIT).toBeGreaterThan(0.5);
    expect(router.segmentClear(amosX(0), amosZ(-5), Y, amosX(0), amosZ(-17)).ok).toBe(true);
    expect(router.segmentClear(amosX(0), amosZ(-17), K, amosX(0), amosZ(-5)).ok).toBe(true);
  });

  it('routes stop 4 -> 5 (terumas hadeshen -> the ma\'aracha on the ramp) via the kevesh foot', () => {
    const c4 = toWorld(stopCamera(tamid.stops[stopIndex('terumas_hadeshen')]));
    const c5 = toWorld(stopCamera(tamid.stops[stopIndex('maaracha')]));
    const start = { x: c4[0], z: c4[2], feet: K };
    const end = { x: c5[0], z: c5[2], feet: keveshTop(c5[0]) };
    const names = router.route(start, end);
    expect(names).not.toBeNull();
    expect(names[names.length - 1]).toBe('kevesh_foot');
    expect(names).not.toContain('south_lane');
  });

  it('returns [] for a clear straight line and a chain around the altar otherwise', () => {
    expect(router.route({ x: amosX(30), z: amosZ(-17), feet: K }, { x: amosX(0), z: amosZ(-17), feet: K })).toEqual([]);
    const start = { x: amosX(30), z: amosZ(-17), feet: K };
    const end = { x: amosX(-30), z: amosZ(-60), feet: K };
    const names = router.route(start, end);
    expect(names.length).toBeGreaterThan(0);
    // Every leg of the chain is a clear straight walk (so nothing crosses the altar).
    let from = start;
    for (const name of names) {
      const n = router.nodes[name];
      expect(router.segmentClear(from.x, from.z, from.feet, n.x, n.z).ok, `${from.name ?? 'start'}->${name}`).toBe(true);
      from = n;
    }
    expect(router.segmentClear(from.x, from.z, from.feet, end.x, end.z).ok).toBe(true);
    // No endpoint can reach the graph: null
    expect(router.route({ x: 500, z: 500, feet: K }, end)).toBeNull();
  });
});

describe('Tour', () => {
  let game;
  let tour;
  beforeEach(() => {
    game = stubGame();
    tour = new Tour(game, tamid);
  });

  it('start() stands at the stop at eye height over the snapped floor, looking at its target, and dwells', () => {
    tour.start(0);
    expect(tour.state).toBe('dwell');
    expect(tour.index).toBe(0);
    const c = toWorld(stopCamera(tamid.stops[0]));
    expect(game.camera.position.x).toBeCloseTo(c[0], 6);
    expect(game.camera.position.z).toBeCloseTo(c[2], 6);
    expect(game.camera.position.y).toBeCloseTo(K + CONFIG.PLAYER_HEIGHT, 6);
    // The look target: stop 1 looks at (67.5, -24) amos from (64, -14): south-west, level
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(game.camera.quaternion);
    expect(fwd.x).toBeGreaterThan(0); // toward +x (north)
    expect(fwd.z).toBeLessThan(0); // and west
    expect(Math.abs(fwd.y)).toBeLessThan(1e-6);
    expect(game.store.getState()).toMatchObject({ tour: 'tamid', tourStop: 0, tourPlaying: 'dwell', tourDwell: 12 });
    expect(game.player.euler.y).toBeCloseTo(new THREE.Euler().setFromQuaternion(game.camera.quaternion, 'YXZ').y, 6);
  });

  it('start(i) snaps the y hint of a stop on the ramp to the ramp surface', () => {
    const i = stopIndex('maaracha');
    tour.start(i);
    const c = toWorld(stopCamera(tamid.stops[i]));
    expect(game.camera.position.y).toBeCloseTo(keveshTop(c[0]) + CONFIG.PLAYER_HEIGHT, 6);
    expect(game.player.groundY).toBeCloseTo(keveshTop(c[0]), 6);
  });

  it('counts the dwell down and auto-advances, holding while hovered or paused', () => {
    tour.start(0);
    tour.update(1);
    expect(tour.dwellLeft).toBeCloseTo(11, 6);
    tour.setHold(true);
    tour.update(5);
    expect(tour.dwellLeft).toBeCloseTo(11, 6);
    tour.setHold(false);
    tour.pause();
    expect(tour.state).toBe('paused');
    tour.update(5);
    expect(tour.dwellLeft).toBeCloseTo(11, 6);
    tour.resume();
    expect(tour.state).toBe('dwell');
    tour.update(11.5);
    expect(tour.state).toBe('travel');
    expect(tour.index).toBe(1);
    expect(tour.auto).toBe(true);
  });

  it('next() travels a rail whose progress is monotonic and whose length matches the route, then dwells', () => {
    tour.start(0);
    expect(tour.next()).toBe(true);
    expect(tour.state).toBe('travel');
    expect(tour.auto).toBe(false); // manual navigation
    const rail = tour.rail;
    const c1 = toWorld(stopCamera(tamid.stops[0]));
    const c2 = toWorld(stopCamera(tamid.stops[1]));
    const straight = Math.hypot(c2[0] - c1[0], c2[2] - c1[2]);
    expect(rail.length).toBeCloseTo(straight, 1);
    expect(rail.profile.duration).toBeCloseTo(speedProfile(straight).duration, 6);
    for (let i = 1; i < rail.cum.length; i++) expect(rail.cum[i]).toBeGreaterThanOrEqual(rail.cum[i - 1]);
    let last = -1;
    const t = run(tour, () => tour.state !== 'travel', 30);
    expect(t).toBeGreaterThan(rail.profile.duration - 0.1);
    for (let s = 0; s <= rail.length; s += 0.1) {
      const d = tour.railAt ? 0 : 0;
      expect(d).toBe(0);
      expect(s).toBeGreaterThan(last);
      last = s;
    }
    expect(tour.state).toBe('paused'); // manual: no countdown until play is pressed
    expect(tour.index).toBe(1);
    expect(game.camera.position.x).toBeCloseTo(c2[0], 6);
    expect(game.camera.position.z).toBeCloseTo(c2[2], 6);
    expect(game.store.getState().tourPlaying).toBe('paused');
  });

  it('moves the camera forward along the rail at every frame and stays on the floor', () => {
    tour.start(stopIndex('shechita_and_blood'));
    tour.goTo(stopIndex('shechita_and_blood') - 1, false); // 8 -> 7, up into the Ulam via the graph
    expect(tour.rail.routed).toBe(true);
    let s = -1;
    let lastPos = game.camera.position.clone();
    let moved = 0;
    while (tour.state === 'travel') {
      tour.update(1 / 60);
      const now = tour.rail.profile.at(tour.t);
      expect(now).toBeGreaterThanOrEqual(s);
      s = now;
      moved += lastPos.distanceTo(game.camera.position);
      lastPos.copy(game.camera.position);
      const feet = game.camera.position.y - CONFIG.PLAYER_HEIGHT;
      const floor = surfaceAt(game.camera.position.x, game.camera.position.z);
      expect(game.player.insideSolid(game.camera.position.x, feet + 0.6, game.camera.position.z)).toBe(false);
      expect(Math.abs(feet - floor)).toBeLessThan(0.7);
    }
    expect(moved).toBeCloseTo(tour.rail.length, 0);
    expect(tour.state).toBe('dwell');
  });

  it('goes 4 -> 5 through the kevesh foot and up the ramp, arriving on the ramp surface', () => {
    const i4 = stopIndex('terumas_hadeshen');
    const i5 = stopIndex('maaracha');
    tour.start(i4);
    tour.goTo(i5);
    const plan = tour.rail.points.length;
    expect(plan).toBeGreaterThanOrEqual(3);
    // The rail passes the kevesh foot node (within a metre of it).
    const foot = tour.router.nodes.kevesh_foot;
    let nearest = Infinity;
    for (let i = 0; i < tour.rail.xs.length; i++) nearest = Math.min(nearest, Math.hypot(tour.rail.xs[i] - foot.x, tour.rail.zs[i] - foot.z));
    expect(nearest).toBeLessThan(1);
    // ... and never enters the kevesh except from its foot: every sample on its footprint is on its surface.
    for (let i = 0; i < tour.rail.xs.length; i++) {
      const x = tour.rail.xs[i];
      const z = tour.rail.zs[i];
      if (inRect(KEVESH, x, z)) expect(Math.abs(tour.rail.feet[i] - keveshTop(x))).toBeLessThan(1e-6);
      expect(inRect(ALTAR, x, z)).toBe(false);
    }
    run(tour, () => tour.state !== 'travel');
    const c5 = toWorld(stopCamera(tamid.stops[i5]));
    expect(game.camera.position.y).toBeCloseTo(keveshTop(c5[0]) + CONFIG.PLAYER_HEIGHT, 6);
  });

  it('prev() at the first stop and next() at the last do nothing; goTo() rejects bad indices', () => {
    tour.start(0);
    expect(tour.prev()).toBe(false);
    expect(tour.goTo(-1)).toBe(false);
    expect(tour.goTo(99)).toBe(false);
    tour.start(tour.length - 1);
    expect(tour.next()).toBe(false);
    expect(tour.state).toBe('dwell');
  });

  it('ends paused after the last stop\'s dwell, and resume() there restarts the countdown', () => {
    tour.start(tour.length - 1);
    run(tour, () => tour.state !== 'dwell', 30);
    expect(tour.state).toBe('paused');
    expect(tour.ended).toBe(true);
    expect(game.store.getState().tourEnded).toBe(true);
    tour.resume();
    expect(tour.state).toBe('dwell');
    expect(tour.dwellLeft).toBe(tamid.stops[tour.length - 1].dwell);
  });

  it('stop() ends the tour where the camera is, hands a standing player back and clears the store', () => {
    tour.start(0);
    tour.next();
    for (let i = 0; i < 20; i++) tour.update(1 / 60);
    const pos = game.camera.position.clone();
    game.player.moveF = true; // a key held during the tour is dropped on hand-over
    tour.stop();
    expect(tour.active).toBe(false);
    expect(game.camera.position.distanceTo(pos)).toBeLessThan(1e-9);
    expect(game.player.verticalVelocity).toBe(0);
    expect(game.player.onGround).toBe(true);
    expect(game.player.euler.y).toBeCloseTo(new THREE.Euler().setFromQuaternion(game.camera.quaternion, 'YXZ').y, 6);
    expect(game.store.getState()).toMatchObject({ tour: null, tourStop: -1, tourPlaying: 'idle' });
    // Updating an idle tour does nothing
    tour.update(1);
    expect(game.camera.position.distanceTo(pos)).toBeLessThan(1e-9);
  });

  it('turns toward the stop\'s look target over the last part of the travel', () => {
    tour.start(0);
    tour.next();
    const rail = tour.rail;
    run(tour, () => rail.profile.at(tour.t) / rail.length >= 0.95, 30);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(game.camera.quaternion);
    const want = new THREE.Vector3(0, 0, -1).applyQuaternion(tour.qTarget);
    expect(fwd.angleTo(want)).toBeLessThan(0.2);
    run(tour, () => tour.state !== 'travel', 30);
    expect(game.camera.quaternion.angleTo(tour.qTarget)).toBeLessThan(1e-6);
  });

  it('caches the graph verification so routing costs no extra probes after the first transition', () => {
    tour.start(0);
    tour.goTo(2);
    const after = game.player.probes;
    tour.router.graph();
    expect(game.player.probes).toBe(after);
  });
});
