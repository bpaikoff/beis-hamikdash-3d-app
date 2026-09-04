#!/usr/bin/env node
/**
 * Capture fixed camera views of the built app with headless Chromium (SwiftShader).
 *
 *   npm run build && npm run screenshot            # -> screenshots/auto/<name>.png
 *   node scripts/screenshot.mjs --only hero        # one view
 *   node scripts/screenshot.mjs --base http://localhost:5173   # against a dev server
 *
 * Views are addressed with ?cam=x,y,z,yaw,pitch (world metres, degrees; yaw 0 faces -z,
 * positive yaw turns toward +x). Until TempleGame supports ?cam the script captures
 * whatever the start position shows. It prints renderer.info.render when the app exposes
 * window.__mikdash (draw calls, triangles) so before/after runs can be compared.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const VIEWS = [
  { name: 'hero', cam: '0,4,110,0,-4' },              // Har HaBayis, looking west at the complex
  { name: 'ezras_nashim_steps', cam: '0,6,22,0,-6' },  // toward Nicanor and the 15 steps
  { name: 'mizbeach_kevesh', cam: '14,10,-14,45,-8' }, // altar with the ramp on its south
  { name: 'ulam_facade', cam: '0,9,-36,0,4' },         // Ulam entrance
  { name: 'heichal_interior', cam: '0,10,-52,0,0' },   // Menorah, Shulchan, golden altar
  { name: 'kodesh_hakodashim', cam: '0,10,-80,0,0' },
];

// Hard watchdog: SwiftShader can wedge a renderer so that even browser.close() never
// returns; never let a CI job sit for hours.
const WATCHDOG_MS = 15 * 60 * 1000;
setTimeout(() => {
  console.error(`screenshot: watchdog fired after ${WATCHDOG_MS / 60000} min, exiting`);
  process.exit(2);
}, WATCHDOG_MS).unref();
const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const only = opt('--only');
const outDir = opt('--out', 'screenshots/auto');
let base = opt('--base');

let preview;
if (!base) {
  preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    preview.stdout.on('data', (d) => {
      if (String(d).includes('4173')) resolve();
    });
    preview.on('exit', (c) => reject(new Error(`vite preview exited ${c}`)));
    setTimeout(() => reject(new Error('vite preview did not start')), 20000);
  });
  base = 'http://localhost:4173';
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('page error:', e.message));

const results = [];
try {
  for (const v of VIEWS) {
    if (only && v.name !== only) continue;
    log(`view ${v.name}: goto`);
    await page.goto(`${base}/?cam=${v.cam}&autostart=1&shadows=0&bloom=0`, { waitUntil: 'load', timeout: 60000 });
    // Older builds have no ?autostart; click through the start screen if it is there.
    const btn = page.locator('.start-btn');
    if (await btn.count()) await btn.first().click();
    const ready = await page
      .waitForFunction(() => window.__mikdash?.ready === true, null, { timeout: 90000 })
      .then(() => true)
      .catch(() => false);
    log(`view ${v.name}: ready=${ready}`);
    if (!ready) await page.waitForTimeout(5000);
    await page.waitForTimeout(500); // one settled frame
    const info = await page.evaluate(() => {
      const m = window.__mikdash;
      if (!m) return null;
      const snap = { calls: m.info.calls, triangles: m.info.triangles };
      m.paused = true; // stop the render loop so the software rasteriser can composite a frame
      return snap;
    });
    await page.waitForTimeout(300);
    const file = `${outDir}/${v.name}.png`;
    log(`view ${v.name}: capture`);
    await page.screenshot({ path: file, timeout: 90000, animations: 'disabled' });
    await page.evaluate(() => { if (window.__mikdash) window.__mikdash.paused = false; });
    results.push({ view: v.name, file, calls: info?.calls, triangles: info?.triangles });
    console.log(`${v.name.padEnd(20)} ${file}${info ? `  calls=${info.calls} tris=${info.triangles}` : ''}`);
  }
} finally {
  log('closing browser');
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 15000))]);
  preview?.kill('SIGKILL');
}
console.log(JSON.stringify(results));
