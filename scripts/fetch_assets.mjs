#!/usr/bin/env node
/**
 * Fetch the CC0 PBR texture sets from ambientCG and unpack the four maps the app uses
 * into public/assets/textures/<set>/{color,normal,roughness,ao}.jpg.
 *
 *   node scripts/fetch_assets.mjs              # download every set in SETS
 *   node scripts/fetch_assets.mjs --only cedar # one set
 *   node scripts/fetch_assets.mjs --characters # the rigged characters (CHARACTERS) instead
 *   node scripts/fetch_assets.mjs --verify     # no network: check files against the manifests
 *
 * The maps are committed, so this only needs to run when a set is added or swapped. It
 * writes public/assets/textures/manifest.json (asset id, download URL, sha256 of the zip
 * and of every extracted file) and regenerates public/assets/LICENSES.md from it, so the
 * download is reproducible and the attribution list never drifts from what is on disk.
 * No dependencies: Node's fetch plus a minimal zip reader on zlib.inflateRawSync.
 *
 * --characters fetches the CC0 Quaternius packs from itch.io (their "download" flow is a
 * POST for a download page, then a POST per file; no account needed), takes the one file
 * the app uses out of each zip and reduces it with three's own loaders/exporter (node):
 * the Universal Animation Library GLB keeps only the three clips the kohanim play (7.6 MB
 * -> 1.4 MB), and the farm-animal FBX files become GLBs scaled to metres with the feet on
 * y 0 and their material groups merged (two or three draw calls per animal). Output goes
 * to public/assets/characters/<name>.glb with its own manifest.json.
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
const charDir = resolve(root, 'public/assets/characters');
const charManifestPath = resolve(charDir, 'manifest.json');

/**
 * Rigged characters (see src/game/CharacterSystem.js). All by Quaternius, CC0 1.0, from
 * the itch.io pages below. `entry` is the file taken out of the zip; `clips` the animation
 * clips kept (by name, as they appear in the source); `height` the height in metres the
 * FBX animals are scaled to (they come in Blender's centimetre units and the loader's
 * scale is not trustworthy), with the feet on y 0 and the model facing +z.
 */
export const CHARACTERS = {
  kohen: {
    pack: 'universal-animation-library',
    zip: 'Universal Animation Library[Standard].zip',
    entry: 'Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb',
    clips: ['Idle_Loop', 'Idle_Talking_Loop', 'Walk_Loop'],
    use: 'rigged human (the UAL mannequin, 1.8 m, 8.5k vertices): every kohen, the Kohen Gadol and the Yisraelim, with the materials replaced at load',
  },
  sheep: {
    pack: 'lowpoly-animated-animals',
    zip: 'Farm Animals Animated  by Quaternius.zip',
    entry: 'FBX/Sheep.fbx',
    clips: ['Idle'],
    height: 0.95,
    use: 'sheep (also the goats, recoloured and narrowed) at the Tamid pen',
  },
  bull: {
    pack: 'lowpoly-animated-animals',
    zip: 'Farm Animals Animated  by Quaternius.zip',
    entry: 'FBX/Cow.fbx',
    clips: ['Idle'],
    height: 1.5,
    use: 'bull (the pack\'s cow, recoloured dark) at the Tamid pen',
  },
};
const itchPage = (pack) => `https://quaternius.itch.io/${pack}`;

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

function loadCharManifest() {
  return existsSync(charManifestPath) ? JSON.parse(readFileSync(charManifestPath, 'utf8')) : { files: {} };
}

function writeLicenses(manifest, chars = loadCharManifest()) {
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

${charactersSection(chars)}## Procedural textures (\`public/textures/\`)

Generated by \`src/game/TextureFactory.js\` and baked with \`npm run bake\`; part of this
project, same licence as the code.
`;
  writeFileSync(licensesPath, md);
}

function charactersSection(chars) {
  const files = Object.entries(chars.files ?? {});
  if (!files.length) return '';
  const rows = files.map(([file, f]) => `| \`${file}\` | [${f.pack}](${f.page}) | \`${f.entry}\` | ${f.clips.join(', ')} | ${(f.bytes / 1024).toFixed(0)} KB | ${f.use} |`);
  const total = files.reduce((n, [, f]) => n + f.bytes, 0);
  return `## Rigged characters (\`public/assets/characters/\`)

The animated figures are by [Quaternius](https://quaternius.com), released under
**CC0 1.0 Universal** (<https://creativecommons.org/publicdomain/zero/1.0/>); the packs'
own License.txt reads "CC0 1.0 Universal (CC0 1.0) Public Domain Dedication. Models by
@Quaternius". No attribution is required; Quaternius asks for support on Patreon
(<https://www.patreon.com/quaternius>).

Each file is one model taken out of the pack's zip and reduced with
\`node scripts/fetch_assets.mjs --characters\` (three's loaders and GLTFExporter in node):
the human keeps only the clips listed, the FBX animals are converted to GLB, scaled to
metres and their material groups merged. Nothing was resculpted or re-animated.
\`manifest.json\` records the itch.io page, the zip's sha256, the source entry and the
sha256 of every output file; \`--verify\` checks them.

| File | Pack (itch.io) | Source entry | Clips kept | Size | Used for |
|---|---|---|---|---|---|
${rows.join('\n')}

Total: ${(total / 1024 / 1024).toFixed(1)} MB. Fetched ${chars.fetchedAt ?? 'n/a'}.

`;
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

function verify(manifest, chars = loadCharManifest()) {
  let bad = 0, total = 0;
  const check = (p, f, label) => {
    total += f.bytes;
    if (!existsSync(p)) { console.error(`missing: ${label}`); bad++; return; }
    if (sha256(readFileSync(p)) !== f.sha256) { console.error(`sha256 mismatch: ${label}`); bad++; }
  };
  for (const [set, s] of Object.entries(manifest.sets)) {
    for (const [file, f] of Object.entries(s.files)) check(resolve(outDir, set, file), f, `${set}/${file}`);
  }
  for (const [file, f] of Object.entries(chars.files ?? {})) check(resolve(charDir, file), f, `characters/${file}`);
  console.log(`${Object.keys(manifest.sets).length} sets, ${Object.keys(chars.files ?? {}).length} character files, ${(total / 1024 / 1024).toFixed(1)} MB, ${bad} problem(s)`);
  return bad === 0;
}

// ---------------------------------------------------------------------------------------
// Characters: itch.io download + reduction with three in node
// ---------------------------------------------------------------------------------------

const UA = 'Mozilla/5.0 (X11; Linux x86_64) bhm-wt fetch_assets (https://github.com/bpaikoff)';

/** fetch() with a cookie jar: itch.io keys the "skip the donation" download page to the session cookie. */
function makeSession() {
  const jar = new Map();
  return async (url, init = {}) => {
    const headers = { 'User-Agent': UA, ...(init.headers ?? {}) };
    if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(url, { ...init, headers, redirect: 'follow' });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
    }
    return res;
  };
}

const csrfOf = (html) => html.match(/name="csrf_token" value="([^"]+)"/)?.[1] ?? '';

/** Download one zip of a free itch.io project (the "No thanks, just take me to the downloads" path). */
async function itchDownload(pack, zipName) {
  const get = makeSession();
  const page = itchPage(pack);
  const html = await (await get(page)).text();
  const form = (csrf) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrf_token: csrf }) });
  const dl = await (await get(`${page}/download_url`, form(csrfOf(html)))).json();
  if (!dl.url) throw new Error(`${pack}: no download page (${JSON.stringify(dl)})`);
  const dlHtml = await (await get(dl.url)).text();
  const uploads = [...dlHtml.matchAll(/data-upload_id="(\d+)"[\s\S]*?<strong title="([^"]+)"/g)].map((m) => ({ id: m[1], name: m[2] }));
  const up = uploads.find((u) => u.name === zipName);
  if (!up) throw new Error(`${pack}: zip "${zipName}" not offered; found ${uploads.map((u) => u.name).join(', ')}`);
  const file = await (await get(`${page}/file/${up.id}?source=view_game&as_prop=1`, { ...form(csrfOf(dlHtml)), headers: { ...form('').headers, Referer: dl.url } })).json();
  if (!file.url) throw new Error(`${pack}: no file url (${JSON.stringify(file)})`);
  const res = await fetch(file.url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${file.url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Reduce a source model to what the app loads, with three in node. Returns the GLB bytes
 * and the clip names it holds. Both paths export with GLTFExporter (binary), so the file
 * on disk is plain glTF 2.0 with no extensions (no Draco, no KTX2).
 */
async function reduceModel(spec, bytes) {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  // The examples loaders/exporter expect a browser: `self` for the loaders, FileReader for GLTFExporter's GLB packing.
  globalThis.self ??= globalThis;
  globalThis.FileReader ??= class {
    readAsArrayBuffer(blob) { blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); }); }
  };
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const exportGlb = (root, animations) => new Promise((res, rej) => new GLTFExporter().parse(root, (out) => res(Buffer.from(out)), rej, { binary: true, animations }));
  const pickClips = (all, names, label) => names.map((n) => {
    const c = all.find((a) => a.name === n || a.name === `Armature|${n}`);
    if (!c) throw new Error(`${label}: no clip "${n}" in ${all.map((a) => a.name).join(', ')}`);
    c.name = n;
    return c;
  });

  if (spec.entry.endsWith('.glb')) {
    const g = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
    return exportGlb(g.scene, pickClips(g.animations, spec.clips, spec.entry));
  }

  const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
  const { mergeGroups } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
  const warn = console.warn;
  console.warn = (m, ...r) => { if (!String(m).includes('skinning weights')) warn(m, ...r); }; // one line per vertex otherwise
  let obj;
  try { obj = new FBXLoader().parse(ab, ''); } finally { console.warn = warn; }
  const clips = pickClips(obj.animations, spec.clips, spec.entry);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    // The FBX comes with one group per polygon run: sort them so each material is one primitive.
    o.geometry = mergeGroups(o.geometry);
    const conv = (m) => Object.assign(new THREE.MeshStandardMaterial({ color: m.color, roughness: 0.9, metalness: 0 }), { name: m.name });
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
  });
  // Skinned bounds in the first frame of the first clip -> scale to `height`, feet on y 0, centred in x/z.
  const mixer = new THREE.AnimationMixer(obj);
  mixer.clipAction(clips[0]).play();
  mixer.update(0);
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  obj.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) box.expandByPoint(o.applyBoneTransform(i, v.fromBufferAttribute(pos, i)).applyMatrix4(o.matrixWorld));
  });
  const s = spec.height / (box.max.y - box.min.y);
  const root = new THREE.Group();
  root.name = spec.entry.replace(/^.*\//, '').replace(/\.fbx$/i, '').toLowerCase();
  root.scale.setScalar(s);
  root.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
  root.add(obj);
  return exportGlb(root, clips);
}

async function fetchCharacters(chars) {
  const zips = new Map();
  mkdirSync(charDir, { recursive: true });
  for (const [name, spec] of Object.entries(CHARACTERS)) {
    const key = `${spec.pack}/${spec.zip}`;
    if (!zips.has(key)) {
      process.stdout.write(`${spec.pack.padEnd(28)} ${spec.zip} downloading... `);
      const zip = await itchDownload(spec.pack, spec.zip);
      console.log(`${(zip.length / 1024 / 1024).toFixed(1)} MB`);
      zips.set(key, { zip, entries: readZip(zip) });
    }
    const { zip, entries } = zips.get(key);
    const src = entries.get(spec.entry);
    if (!src) throw new Error(`${spec.zip}: no entry ${spec.entry}; has ${[...entries.keys()].slice(0, 20).join(', ')}`);
    process.stdout.write(`  ${name.padEnd(8)} ${spec.entry} (${(src.length / 1024).toFixed(0)} KB) -> `);
    const glb = await reduceModel(spec, src);
    const file = `${name}.glb`;
    writeFileSync(resolve(charDir, file), glb);
    console.log(`${file} ${(glb.length / 1024).toFixed(0)} KB, clips ${spec.clips.join(', ')}`);
    chars.files[file] = {
      pack: spec.pack, page: itchPage(spec.pack), license: 'CC0-1.0', zip: spec.zip, zipSha256: sha256(zip),
      entry: spec.entry, clips: spec.clips, height: spec.height ?? null, use: spec.use, bytes: glb.length, sha256: sha256(glb),
    };
  }
  for (const file of Object.keys(chars.files)) if (!CHARACTERS[file.replace(/\.glb$/, '')]) delete chars.files[file];
  chars.fetchedAt = new Date().toISOString().slice(0, 10);
  chars.source = 'https://quaternius.itch.io (CC0 1.0)';
  writeFileSync(charManifestPath, JSON.stringify(chars, null, 2) + '\n');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
  const manifest = loadManifest();
  if (args.includes('--verify')) {
    process.exit(verify(manifest) ? 0 : 1);
  }
  if (args.includes('--characters')) {
    const chars = loadCharManifest();
    await fetchCharacters(chars);
    writeLicenses(manifest, chars);
    console.log(`wrote ${charManifestPath} and ${licensesPath}`);
    process.exit(0);
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
