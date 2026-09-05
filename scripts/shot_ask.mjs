#!/usr/bin/env node
/**
 * Screenshot the Ask panel in a given state against a running dev server.
 *
 *   npx vite --port 5190 --strictPort &        # with VITE_TZADEK_GUEST_PASSCODE unset
 *   node scripts/shot_ask.mjs --base http://localhost:5190 --out shots/ask_unavailable.png
 *
 * Opens the altar card, clicks its first question button and captures the panel. With no
 * passcode in the build the panel shows its "unavailable" state (message + tzadek.ai link),
 * so the run never talks to tzadek.ai. `--mobile` uses a 390x844 viewport, `--wide` 1920x1080.
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const base = opt('--base', 'http://localhost:5190');
const out = opt('--out', 'shots/ask_unavailable.png');
const mobile = args.includes('--mobile');
const wide = args.includes('--wide'); // 1920x1080: the panel sits beside the card

mkdirSync(dirname(out), { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({
  viewport: mobile ? { width: 390, height: 844 } : wide ? { width: 1920, height: 1080 } : { width: 1280, height: 720 },
  hasTouch: mobile,
  isMobile: mobile,
});
page.on('pageerror', (e) => console.error('page error:', e.message));
page.on('request', (r) => {
  if (/tzadek\.ai/.test(r.url())) console.error('UNEXPECTED network call:', r.url());
});
try {
  await page.goto(`${base}/?at=mizbeach&autostart=1&shadows=0&bloom=0`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__mikdash?.ready === true, null, { timeout: 90000 });
  await page.waitForSelector('.hotspot-card .question-btn', { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.locator('.hotspot-card .question-btn').first().click();
  await page.waitForSelector('.ask-panel', { timeout: 10000 });
  const status = await page.evaluate(() => document.querySelector('.ask-panel')?.className);
  console.log('panel:', status);
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    if (window.__mikdash) window.__mikdash.paused = true;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out, timeout: 90000, animations: 'disabled' });
  console.log(out);
} finally {
  await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 10000))]);
}
