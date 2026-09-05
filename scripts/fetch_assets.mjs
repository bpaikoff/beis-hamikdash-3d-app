#!/usr/bin/env node
/**
 * Fetch the CC0 PBR texture sets from ambientCG and unpack the four maps the app uses
 * into public/assets/textures/<set>/{color,normal,roughness,ao}.jpg.
 *
 *   node scripts/fetch_assets.mjs              # download every set in SETS
 *   node scripts/fetch_assets.mjs --only cedar # one set
 *   node scripts/fetch_assets.mjs --verify     # no network: check files against manifest.json
 *
 * The maps are committed, so this only needs to run when a set is added or swapped. It
 * writes public/assets/textures/manifest.json (asset id, download URL, sha256 of the zip
 * and of every extracted file) and regenerates public/assets/LICENSES.md from it, so the
 * download is reproducible and the attribution list never drifts from what is on disk.
 * No dependencies: Node's fetch plus a minimal zip reader on zlib.inflateRawSync.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/assets/textures');
const manifestPath = resolve(outDir, 'manifest.json');
const licensesPath = resolve(root, 'public/assets/LICENSES.md');

/**
 * Set name (as used by TextureFactory.pbrSet) -> ambientCG asset id. All are 1K JPG.
 * Chosen for how they read in the Beis HaMikdash, not for their catalogue names:
 * the "onyx" is the closest CC0 match to a rose/red-veined marble, the "travertine"
 * is a plain fine-grained limestone.
 */
export const SETS = {
  ashlar: { id: 'Tiles143', use: 'Jerusalem limestone ashlar: court and chamber walls (stone)' },
  limestone: { id: 'Travertine009', use: 'fine dressed limestone: altar, kiyor, steps, gate frames (stoneFine, stonePolished)' },
  limestoneTiles: { id: 'Tiles139', use: 'limestone floor slabs (floor)' },
  marbleWhite: { id: 'Marble021', use: 'white marble: Ulam, Heichal, chamber floors (marbleW)' },
  marbleRose: { id: 'Onyx010', use: 'rose / red-veined marble (marbleR)' },
  cedar: { id: 'Wood030', use: 'cedar panelling, doors, beams (cedar)' },
  acacia: { id: 'Wood023', use: 'acacia wood: Aron, Shulchan cores (acacia)' },
  sand: { id: 'Ground093C', use: 'dusty ground on Har HaBayis (ground)' },
  gold: { id: 'Metal048C', use: 'burnished gold: normal + roughness only, the albedo stays procedural (gold, goldEng)' },
};

/** ambientCG file suffix -> our file name. Displacement/Metalness are not fetched. */
const MAPS = { Color: 'color.jpg', NormalGL: 'normal.jpg', Roughness: 'roughness.jpg', AmbientOcclusion: 'ao.jpg' };

const downloadUrl = (id) => `https://ambientcg.com/get?file=${id}_1K-JPG.zip`;
const pageUrl = (id) => `https://ambientcg.com/view?id=${id}`;
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** Minimal zip reader: returns Map<name, Buffer> for stored (0) and deflated (8) entries. */
export function readZip(buf) {
  const EOCD = 0x06054b50, CEN = 0x02014b50, LOC = 0x04034b50;
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== EOCD) eocd--;
  if (eocd < 0) throw new Error('not a zip file (no end-of-central-directory record)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== CEN) throw new Error('bad central directory entry');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (buf.readUInt32LE(local) !== LOC) throw new Error(`bad local header for ${name}`);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + csize);
    if (method === 0) files.set(name, data);
    else if (method === 8) files.set(name, inflateRawSync(data));
    else throw new Error(`${name}: unsupported compression method ${method}`);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function loadManifest() {
  return existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { sets: {} };
}

function writeLicenses(manifest) {
  const rows = Object.entries(manifest.sets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([set, s]) => {
      const kb = Object.values(s.files).reduce((n, f) => n + f.bytes, 0) / 1024;
      return `| \`${set}/\` | [${s.assetId}](${s.page}) | ${Object.keys(s.files).length} | ${kb.toFixed(0)} KB | ${s.use} |`;
    });
  const total = Object.values(manifest.sets).reduce((n, s) => n + Object.values(s.files).reduce((m, f) => m + f.bytes, 0), 0);
  const md = `# Third-party assets

## PBR textures (\`public/assets/textures/\`)

All texture sets in this directory come from [ambientCG](https://ambientcg.com) and are
released under the **Creative Commons CC0 1.0 Universal** licence
(<https://creativecommons.org/publicdomain/zero/1.0/>): they may be used, modified and
redistributed for any purpose, commercial or not, without attribution. ambientCG asks
(but does not require) that projects mention it; we do so here.

Each set is the 1K JPG download of the asset, reduced to the four maps the app reads
(Color, NormalGL, Roughness, AmbientOcclusion), renamed \`color.jpg\`, \`normal.jpg\`,
\`roughness.jpg\`, \`ao.jpg\`. Nothing else was edited. \`manifest.json\` records the asset
id, the download URL and the sha256 of the zip and of every extracted file;
\`node scripts/fetch_assets.mjs --verify\` checks the files on disk against it and
\`node scripts/fetch_assets.mjs\` reproduces the download.

| Directory | ambientCG asset | Maps | Size | Used for |
|---|---|---|---|---|
${rows.join('\n')}

Total: ${(total / 1024 / 1024).toFixed(1)} MB. Fetched ${manifest.fetchedAt ?? 'n/a'}.

## Procedural textures (\`public/textures/\`)

Generated by \`src/game/TextureFactory.js\` and baked with \`npm run bake\`; part of this
project, same licence as the code.
`;
  writeFileSync(licensesPath, md);
}

async function fetchSet(set, { id, use }, manifest) {
  const url = downloadUrl(id);
  process.stdout.write(`${set.padEnd(15)} ${id.padEnd(14)} downloading... `);
  const res = await fetch(url, { headers: { 'User-Agent': 'bhm-wt fetch_assets (https://github.com/bpaikoff)' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const zip = Buffer.from(await res.arrayBuffer());
  const entries = readZip(zip);
  const dir = resolve(outDir, set);
  mkdirSync(dir, { recursive: true });
  const files = {};
  for (const [suffix, target] of Object.entries(MAPS)) {
    const name = [...entries.keys()].find((n) => n.endsWith(`_${suffix}.jpg`));
    if (!name) {
      console.warn(`\n  ${id}: no ${suffix} map in the zip (skipped)`);
      continue;
    }
    const data = entries.get(name);
    writeFileSync(resolve(dir, target), data);
    files[target] = { source: name, bytes: data.length, sha256: sha256(data) };
  }
  const kb = Object.values(files).reduce((n, f) => n + f.bytes, 0) / 1024;
  console.log(`${(zip.length / 1024 / 1024).toFixed(1)} MB zip -> ${Object.keys(files).length} maps, ${kb.toFixed(0)} KB`);
  manifest.sets[set] = { assetId: id, page: pageUrl(id), url, license: 'CC0-1.0', zipSha256: sha256(zip), use, files };
}

function verify(manifest) {
  let bad = 0, total = 0;
  for (const [set, s] of Object.entries(manifest.sets)) {
    for (const [file, f] of Object.entries(s.files)) {
      const p = resolve(outDir, set, file);
      total += f.bytes;
      if (!existsSync(p)) { console.error(`missing: ${set}/${file}`); bad++; continue; }
      if (sha256(readFileSync(p)) !== f.sha256) { console.error(`sha256 mismatch: ${set}/${file}`); bad++; }
    }
  }
  console.log(`${Object.keys(manifest.sets).length} sets, ${(total / 1024 / 1024).toFixed(1)} MB, ${bad} problem(s)`);
  return bad === 0;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
  const manifest = loadManifest();
  if (args.includes('--verify')) {
    process.exit(verify(manifest) ? 0 : 1);
  }
  for (const [set, spec] of Object.entries(SETS)) {
    if (only && set !== only) continue;
    await fetchSet(set, spec, manifest);
  }
  if (!only) for (const set of Object.keys(manifest.sets)) if (!SETS[set]) delete manifest.sets[set];
  manifest.fetchedAt = new Date().toISOString().slice(0, 10);
  manifest.source = 'https://ambientcg.com (CC0 1.0)';
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  writeLicenses(manifest);
  console.log(`wrote ${manifestPath} and ${licensesPath}`);
}
