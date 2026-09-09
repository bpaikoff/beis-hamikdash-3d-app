#!/usr/bin/env node
/**
 * Bake the procedural canvas textures to public/textures/<name>.webp so the app loads
 * images instead of blocking the main thread for seconds generating them.
 *
 *   npm run bake                 # all 22 textures
 *   node scripts/bake_textures.mjs --only jerusalemStone
 *   node scripts/bake_textures.mjs --quality 0.9
 *
 * Runs TextureFactory in Playwright's Chromium via a throwaway Vite dev server (the
 * generators need a 2D canvas and three). The canvas path is seeded, so re-baking gives
 * byte-identical output for unchanged generators. When Chromium cannot launch (no system
 * libraries, CI without browsers) the script says so and exits 0: the runtime falls back
 * to the canvas generators for any missing file, so the build is never blocked.
 */
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const only = opt('--only');
const quality = Number(opt('--quality', '0.85'));
const outDir = resolve(root, opt('--out', 'public/textures'));

let browser;
try {
  const { chromium } = await import('@playwright/test');
  browser = await chromium.launch();
} catch (e) {
  const first = String(e.message).split('\n')[0];
  console.warn(`bake_textures: Chromium could not start (${first}).`);
  console.warn('Skipping: the app regenerates any missing texture on the canvas at runtime.');
  console.warn('Run `npx playwright install --with-deps chromium` on a machine with a desktop stack to bake.');
  process.exit(0);
}

const { createServer } = await import('vite');
const server = await createServer({ root, configFile: resolve(root, 'vite.config.js'), server: { port: 0 }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');

mkdirSync(outDir, { recursive: true });
let failed = 0;
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`${base}/scripts/bake/bake.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__bakeReady === true, null, { timeout: 30000 });
  const names = await page.evaluate(() => window.__bake.names);
  for (const name of names) {
    if (only && name !== only) continue;
    const q = name === 'normalMap' || name === 'clothFolds' ? Math.max(quality, 0.95) : quality; // normals hate lossy artifacts
    const { width, height, dataUrl } = await page.evaluate(([n, qq]) => window.__bake.render(n, qq), [name, q]);
    if (!dataUrl.startsWith('data:image/webp')) {
      console.error(`${name}: browser did not encode WebP`);
      failed++;
      continue;
    }
    const file = resolve(outDir, `${name}.webp`);
    writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log(`${name.padEnd(16)} ${width}x${height}  ${(statSync(file).size / 1024).toFixed(0)} KB`);
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
