#!/usr/bin/env node
/**
 * Walk the Temple with a scripted player and report where the geometry or the controller
 * fails: falling through a floor, getting stuck, clipping into a solid, or never arriving.
 *
 *   npm run build && node scripts/walk.mjs                 # all routes, report to walk-report/
 *   node scripts/walk.mjs --route ladder --base http://localhost:5173   # --route takes a comma-separated list
 *   node scripts/walk.mjs --list
 *
 * Routes are lists of waypoints. A waypoint is a content id (with optional {dx,dz} metres
 * offset and an optional `level` name that sets the expected floor) or {x, z, level}.
 * `expect: 'blocked'` inverts a leg: it passes only if the player is stopped (a closed gate).
 * The player is teleported to the first waypoint, then walks (W held, turning toward the
 * target every sample) until within `reach` metres. Each sample checks:
 *   fell      feet more than 1.5 m below the lower of the start/target floor levels
 *   inside    feet inside a wall/solid collision box
 *   stuck     under 0.25 m of progress in 3 s
 *   timeout   target not reached in time
 * On a failure the frame is rendered once and saved next to the JSON report.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** A waypoint: a content id with optional dx/dz (metres), level name, reach, minY. */
export const at = (id, o = {}) => ({ id, ...o });

// Routes live in scripts/walk-routes/*.mjs (one file per area; each exports `routes`).
const ROUTES = {};
const routesDir = new URL('./walk-routes/', import.meta.url);
for (const f of readdirSync(routesDir).filter((n) => n.endsWith('.mjs')).sort()) {
  const mod = await import(pathToFileURL(new URL(f, routesDir).pathname).href);
  Object.assign(ROUTES, mod.routes);
}

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
if (args.includes('--list')) {
  for (const [k, v] of Object.entries(ROUTES)) console.log(`${k}: ${v.length} waypoints`);
  process.exit(0);
}
const only = opt('--route');
const outDir = opt('--out', 'walk-report');
const port = opt('--port', '4174');
let base = opt('--base');
const SAMPLE_MS = 100;
const STUCK_S = 3;
const STEP_TIMEOUT_S = Number(opt('--timeout', '40'));

setTimeout(() => {
  console.error('walk: watchdog fired, exiting');
  process.exit(2);
}, 30 * 60 * 1000).unref();

let preview;
if (!base) {
  preview = spawn('npx', ['vite', 'preview', '--port', port, '--strictPort'], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    preview.stdout.on('data', (d) => String(d).includes(port) && resolve());
    preview.on('exit', (c) => reject(new Error(`vite preview exited ${c}`)));
    setTimeout(() => reject(new Error('vite preview did not start')), 20000);
  });
  base = `http://localhost:${port}`;
}
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('page error:', e.message));

const report = { base, routes: {} };
try {
  const routes = Object.entries(ROUTES).filter(([k]) => !only || only.split(',').includes(k));
  await page.goto(`${base}/?autostart=1&render=0&shadows=0&bloom=0&step=0.0166`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__mikdash?.ready === true, null, { timeout: 120000 });
  await page.evaluate(() => window.__mikdash.lock());
  // Resolve every waypoint to world coordinates inside the page (content is the source of truth).
  const resolve = (wp) =>
    page.evaluate((w) => {
      const m = window.__mikdash;
      let x = w.x ?? 0;
      let z = w.z ?? 0;
      if (w.id) {
        const e = m.entries[w.id];
        if (!e) throw new Error(`unknown id ${w.id}`);
        const [ex, , ez] = m.worldPos(e);
        x = ex + (w.dx ?? 0);
        z = ez + (w.dz ?? 0);
      }
      const level = w.level ? m.levelWorldY(w.level) : null;
      return { x, z, level, floor: m.floorAt(x, z) };
    }, wp);

  for (const [name, waypoints] of routes) {
    const steps = [];
    let ok = true;
    const start = await resolve(waypoints[0]);
    const startY = (start.level ?? start.floor) + 1.7;
    await page.evaluate(({ x, y, z }) => window.__mikdash.teleport(x, y, z), { x: start.x, y: startY, z: start.z });
    await page.waitForTimeout(400);
    for (let i = 1; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const target = await resolve(wp);
      const label = wp.id ? `${wp.id}${wp.dx || wp.dz ? `(${wp.dx ?? 0},${wp.dz ?? 0})` : ''}` : `(${wp.x},${wp.z})`;
      const reach = wp.reach ?? 1.2;
      const t0 = Date.now();
      let lastProgressT = t0;
      let lastDist = Infinity;
      let result = 'timeout';
      let detail = '';
      const startPos = await page.evaluate(() => { const c = window.__mikdash.camera.position; return { x: c.x, y: c.y, z: c.z }; });
      const lowerLevel = Math.min(startPos.y - 1.7, target.level ?? target.floor);
      await page.keyboard.down('KeyW');
      while (Date.now() - t0 < STEP_TIMEOUT_S * 1000) {
        await page.evaluate(({ x, z }) => window.__mikdash.lookAt(x, z), target);
        await page.waitForTimeout(SAMPLE_MS);
        const s = await page.evaluate(() => {
          const m = window.__mikdash;
          const c = m.camera.position;
          return { x: c.x, y: c.y, z: c.z, inside: m.insideSolid(), floor: m.floorAt(c.x, c.z) };
        });
        const feet = s.y - 1.7;
        const dist = Math.hypot(target.x - s.x, target.z - s.z);
        if (dist < lastDist - 0.25) { lastDist = dist; lastProgressT = Date.now(); }
        if (feet < lowerLevel - 1.5) { result = 'fell'; detail = `feet ${feet.toFixed(2)} below level ${lowerLevel.toFixed(2)}`; break; }
        if (s.inside) { result = 'inside'; detail = `feet inside a solid at (${s.x.toFixed(1)}, ${feet.toFixed(2)}, ${s.z.toFixed(1)})`; break; }
        if (dist < reach) {
          result = 'ok';
          if (wp.minY != null) {
            if (feet < (target.level ?? 0) + wp.minY - 0.5) { result = 'low'; detail = `arrived but feet ${feet.toFixed(2)} (expected >= ${((target.level ?? 0) + wp.minY).toFixed(2)})`; }
          } else if (target.level != null && Math.abs(feet - target.level) > 0.6) { result = 'wrong_level'; detail = `feet ${feet.toFixed(2)}, expected ${target.level.toFixed(2)}`; }
          break;
        }
        if (Date.now() - lastProgressT > STUCK_S * 1000) { result = 'stuck'; detail = `${dist.toFixed(1)} m short at (${s.x.toFixed(1)}, ${feet.toFixed(2)}, ${s.z.toFixed(1)})`; break; }
      }
      await page.keyboard.up('KeyW');
      const pos = await page.evaluate(() => { const c = window.__mikdash.camera.position; return [c.x, c.y - 1.7, c.z].map((v) => Number(v.toFixed(2))); });
      if (wp.expect === 'blocked') {
        // A closed gate: the leg must end against the leaves, without clipping or falling.
        if (result === 'stuck') { result = 'ok'; detail = `blocked, ${detail}`; }
        else if (result === 'ok') { result = 'passed'; detail = 'walked through where the player should be stopped'; }
      }
      const step = { to: label, result, detail, pos, seconds: Number(((Date.now() - t0) / 1000).toFixed(1)) };
      if (result !== 'ok') {
        ok = false;
        const file = `${outDir}/${name}-${i}-${result}.png`;
        await page.evaluate(() => window.__mikdash.renderOnce());
        await page.waitForTimeout(200);
        await page.screenshot({ path: file, timeout: 60000 }).catch(() => {});
        step.screenshot = file;
        // Continue the route from the intended waypoint so later steps are still exercised.
        await page.evaluate(({ x, y, z }) => window.__mikdash.teleport(x, y, z), { x: target.x, y: (target.level ?? target.floor) + 1.7, z: target.z });
        await page.waitForTimeout(300);
      }
      steps.push(step);
      console.log(`${name.padEnd(16)} -> ${label.padEnd(34)} ${result.padEnd(11)} ${detail}`);
    }
    report.routes[name] = { ok, steps };
  }
} finally {
  await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 10000))]);
  preview?.kill('SIGKILL');
}
writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 1));
const bad = Object.values(report.routes).flatMap((r) => r.steps.filter((s) => s.result !== 'ok'));
console.log(`\n${bad.length} failing step(s); report in ${outDir}/report.json`);
process.exit(bad.length ? 1 : 0);
