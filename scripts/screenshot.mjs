#!/usr/bin/env node
/**
 * Capture fixed camera views of the built app with headless Chromium (SwiftShader).
 *
 *   npm run build && npm run screenshot            # -> screenshots/auto/<name>.png
 *   node scripts/screenshot.mjs --only hero        # one view (or a comma-separated list)
 *   node scripts/screenshot.mjs --only tour_1,tour_5 --out shots   # guided-tour stops
 *   node scripts/screenshot.mjs --base http://localhost:5173   # against a dev server
 *   node scripts/screenshot.mjs --mobile --only hero,mizbeach_kevesh   # 390x844, touch controls
 *   node scripts/screenshot.mjs --mobile --card                          # keep the hotspot card open
 *   node scripts/screenshot.mjs --budget hero=1200            # exit 1 when a view draws more calls
 *   node scripts/screenshot.mjs --time dusk                    # ?time= for every view
 *
 * Views are addressed with ?cam=x,y,z,yaw,pitch (world metres, degrees; yaw 0 faces -z,
 * positive yaw turns toward +x). Until TempleGame supports ?cam the script captures
 * whatever the start position shows. It prints renderer.info.render when the app exposes
 * window.__mikdash (draw calls, triangles) so before/after runs can be compared.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium, devices } from '@playwright/test';

const VIEWS = [
  // `at` spawns just east of a content entry, facing west (follows the JSON when geometry moves);
  // `cam` is x,y,z,yaw,pitch in metres/degrees for free placement.
  { name: 'hero', at: 'ezras_nashim_gate' },        // Har HaBayis, facing the Ezras Nashim gate
  { name: 'ezras_nashim_steps', at: 'maalos_shir' }, // the 15 steps up to Nicanor
  { name: 'mizbeach_kevesh', at: 'mizbeach' },       // the altar from the east
  { name: 'ulam_facade', at: 'maalos_ulam' },        // the 12 steps and the Ulam front
  { name: 'heichal_interior', at: 'heichal' },       // looking west across the Heichal
  { name: 'kodesh_hakodashim', at: 'even_hashtiya' },
  // The altar fire from the south-east of the Ezras Kohanim, ~25 m from the ma'aracha,
  // with bloom on (the flame core is tuned to cross the bloom threshold).
  { name: 'altar_fire', cam: '-22,9.75,0,-63,9', bloom: true },
  // Guided tour stops (`?tour=<id>&stop=N`, N 1-based): the rail stands the camera at the
  // stop and the script waits for the tour to dwell there, so the card is in the frame.
  { name: 'tour_1', tour: 'tamid', stop: 1 },   // Beis HaMoked at night
  { name: 'tour_5', tour: 'tamid', stop: 5 },   // the ma'aracha from the kevesh
  { name: 'tour_9', tour: 'tamid', stop: 9 },   // the limbs on the kevesh, from the south-west
  { name: 'tour_13', tour: 'tamid', stop: 13 }, // the Levites' song, the Duchan from the Ezras Yisrael
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
// Phone: a 390x844 portrait viewport with touch (pointer: coarse), so TouchControls mounts
// and the HUD takes its small-screen layout. Frames are suffixed _mobile.
const mobile = args.includes('--mobile');
const keepCard = args.includes('--card'); // mobile: leave the ?at= card open instead of closing it
const timeOfDay = opt('--time'); // dawn | morning | afternoon | dusk
// `--budget hero=1200,heichal_interior=300`: soft draw-call budgets; the run fails when exceeded.
const budget = Object.fromEntries(
  (opt('--budget', '') || '')
    .split(',')
    .filter(Boolean)
    .map((kv) => kv.split('='))
    .map(([k, v]) => [k, Number(v)])
);
const port = opt('--port', '4173'); // pick another when several runs share a machine
let base = opt('--base');

let preview;
if (!base) {
  // Own process group so the kill below reaches vite itself, not only the npx wrapper.
  preview = spawn('npx', ['vite', 'preview', '--port', port, '--strictPort'], {
    stdio: ['ignore', 'pipe', 'inherit'],
    detached: true,
  });
  await new Promise((resolve, reject) => {
    preview.stdout.on('data', (d) => {
      if (String(d).includes(port)) resolve();
    });
    preview.on('exit', (c) => reject(new Error(`vite preview exited ${c}`)));
    setTimeout(() => reject(new Error('vite preview did not start')), 20000);
  });
  base = `http://localhost:${port}`;
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage(
  mobile
    ? { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }
    : { viewport: { width: 1280, height: 720 } }
);
page.on('pageerror', (e) => console.error('page error:', e.message));

const results = [];
try {
  for (const v of VIEWS) {
    if (only && !only.split(',').includes(v.name)) continue;
    log(`view ${v.name}: goto`);
    const where = v.tour
      ? `tour=${encodeURIComponent(v.tour)}&stop=${v.stop ?? 1}`
      : v.at
        ? `at=${encodeURIComponent(v.at)}`
        : `cam=${v.cam}`;
    // Bloom is off by default (the software rasteriser is slow); a view can opt in with `bloom: true`.
    const bloom = v.bloom ? '' : '&bloom=0';
    const time = timeOfDay ? `&time=${encodeURIComponent(timeOfDay)}` : '';
    await page.goto(`${base}/?${where}&autostart=1&shadows=0${bloom}${time}`, { waitUntil: 'load', timeout: 60000 });
    // Older builds have no ?autostart; click through the start screen if it is there.
    const btn = page.locator('.start-btn');
    if (await btn.count()) await btn.first().click();
    const ready = await page
      .waitForFunction(() => window.__mikdash?.ready === true, null, { timeout: 90000 })
      .then(() => true)
      .catch(() => false);
    log(`view ${v.name}: ready=${ready}`);
    if (!ready) await page.waitForTimeout(5000);
    if (v.tour) {
      // The tour teleports to the stop and dwells there; capture only once it does.
      const dwelling = await page
        .waitForFunction(() => window.__mikdash?.tour?.state === 'dwell', null, { timeout: 30000 })
        .then(() => true)
        .catch(() => false);
      log(`view ${v.name}: tour dwelling=${dwelling}`);
    }
    await page.waitForTimeout(500); // one settled frame
    if (mobile) {
      // A phone user closes the card before walking; the frame then shows the whole HUD
      // around the touch controls (--card keeps it open instead).
      if (!keepCard) await page.evaluate(() => window.__mikdash?.game?.store?.setState({ selected: null }));
      // Hold a thumb on the left half: TouchControls shows the joystick on pointerdown and
      // hides it on release, so the touch stays down through the capture.
      const vp = page.viewportSize();
      const cdp = await page.context().newCDPSession(page);
      await cdp
        .send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: vp.width * 0.25, y: vp.height * 0.72 }] })
        .catch(() => {});
      await page.waitForTimeout(250);
    }
    const info = await page.evaluate(() => {
      const m = window.__mikdash;
      if (!m) return null;
      const snap = {
        calls: m.info.calls,
        triangles: m.info.triangles,
        culled: m.culler?.hidden ?? null,
        touch: Boolean(document.querySelector('.touch-controls')),
        joystick: Boolean(document.querySelector('.joystick.active')),
      };
      m.paused = true; // stop the render loop so the software rasteriser can composite a frame
      return snap;
    });
    await page.waitForTimeout(300);
    const suffix = `${mobile ? '_mobile' : ''}${mobile && keepCard ? '_card' : ''}${timeOfDay ? `_${timeOfDay}` : ''}`;
    const file = `${outDir}/${v.name}${suffix}.png`;
    log(`view ${v.name}: capture`);
    await page.screenshot({ path: file, timeout: 90000, animations: 'disabled' });
    // Do not talk to the page again: after a capture the software renderer can wedge and any
    // further page call hangs. The next view navigates away anyway.
    results.push({ view: v.name, file, calls: info?.calls, triangles: info?.triangles, culled: info?.culled, touch: info?.touch });
    const extra = info ? `  calls=${info.calls} tris=${info.triangles}${info.culled != null ? ` culled=${info.culled}` : ''}${mobile ? ` touch=${info.touch} joystick=${info.joystick}` : ''}` : '';
    console.log(`${v.name.padEnd(20)} ${file}${extra}`);
  }
} finally {
  log('closing browser');
  await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 10000))]);
  if (preview) {
    try { process.kill(-preview.pid, 'SIGKILL'); } catch { preview.kill('SIGKILL'); }
  }
}
console.log(JSON.stringify(results));
// Draw-call budgets (soft: generous enough to catch a regression, not a tuning target).
let over = 0;
for (const [view, max] of Object.entries(budget)) {
  const r = results.find((x) => x.view === view);
  if (!r) continue;
  const ok = typeof r.calls === 'number' && r.calls <= max;
  console.log(`budget ${view}: calls=${r.calls} max=${max} ${ok ? 'ok' : 'EXCEEDED'}`);
  if (!ok) over++;
}
if (over) {
  console.error(`screenshot: ${over} view(s) over the draw-call budget`);
  process.exit(1);
}
process.exit(results.length ? 0 : 1);
