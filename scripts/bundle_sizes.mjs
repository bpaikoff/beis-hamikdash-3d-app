#!/usr/bin/env node
/**
 * Print the built bundles with their raw and gzip sizes (dist/assets/*.js and *.css), the
 * way a Lighthouse budget would read them, so CI logs show what a change costs.
 *
 *   npm run build && node scripts/bundle_sizes.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'dist/assets';
const kb = (n) => `${(n / 1024).toFixed(1).padStart(8)} kB`;
let files;
try {
  files = readdirSync(dir).filter((f) => /\.(js|css)$/.test(f)).sort();
} catch {
  console.error(`bundle_sizes: ${dir} not found; run npm run build first`);
  process.exit(1);
}
let raw = 0;
let gz = 0;
console.log(`${'bundle'.padEnd(36)} ${'raw'.padStart(11)} ${'gzip'.padStart(11)}`);
for (const f of files) {
  const buf = readFileSync(join(dir, f));
  const g = gzipSync(buf, { level: 9 }).length;
  raw += buf.length;
  gz += g;
  console.log(`${f.padEnd(36)} ${kb(statSync(join(dir, f)).size)} ${kb(g)}`);
}
console.log(`${'total'.padEnd(36)} ${kb(raw)} ${kb(gz)}`);
