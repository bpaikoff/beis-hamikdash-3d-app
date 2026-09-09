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
 * POST for a download page, then a POST per file; no account needed) or, for a spec with
 * a `url`, one file from Poly Pizza's static host, takes the one file the app uses out of
 * each zip and reduces it with three's own loaders/exporter (node):
 * the human is the Universal Base Characters male body (a .gltf + .bin in the zip) with
 * the three clips the kohanim play taken from the Universal Animation Library GLB (same
 * 65-joint rig, checked by name before the clips are retargeted), its textures stripped
 * from the glb and written next to it as small JPEG/PNG files resized with Python PIL
 * (scripts/resize_textures.py, run through child_process: no npm dependency); the
 * farm-animal FBX files become GLBs scaled to metres with the feet on y 0 and their
 * material groups merged (two or three draw calls per animal). Output goes to
 * public/assets/characters/<name>.glb (+ the texture files) with its own manifest.json.
 *   node scripts/fetch_assets.mjs --characters --only kohen   # one character
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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
 *
 * The human is a two-pack spec: `entry` is the .gltf body (its .bin is the sibling zip
 * entry; the image entries are not loaded, the textures leave the glb), `animations` the
 * pack/zip/entry the clips come from (the two rigs must have identical joint names, in
 * order; the script refuses otherwise), `meshes` renames the primitives by their material
 * name, and `textures` are written as separate files: `source` is a PNG in the entry's
 * directory, `size` the output width (square), `quality` JPEG quality (a .png output keeps
 * its alpha), `channel` picks one channel of a packed map (the glTF metallic-roughness
 * texture carries roughness in G, which is the channel three's roughnessMap reads).
 */
export const CHARACTERS = {
  kohen: {
    pack: 'universal-base-characters',
    zip: 'Universal Base Characters[Standard].zip',
    entry: 'Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf',
    // Material name -> primitive name the app uses. MI_Hair_1 is the pack's eyebrow strip
    // (646 vertices on the brow, no hair cap comes with the body); the app calls it Hair.
    meshes: { MI_Superhero_Male: 'Body', MI_Hair_1: 'Hair', MI_Eyes: 'Eyes' },
    animations: {
      pack: 'universal-animation-library',
      zip: 'Universal Animation Library[Standard].zip',
      entry: 'Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb',
    },
    clips: ['Idle_Loop', 'Idle_Talking_Loop', 'Walk_Loop'],
    textures: {
      'kohen_skin.jpg': { source: 'T_Superhero_Male_Dark.png', size: 1024, quality: 85 },
      'kohen_skin_normal.jpg': { source: 'T_Superhero_Male_Normal.png', size: 1024, quality: 85 },
      'kohen_skin_rough.jpg': { source: 'T_Superhero_Male_Roughness.png', size: 512, quality: 85, channel: 'G' },
      'kohen_hair.jpg': { source: 'T_Hair_1_BaseColor.png', size: 512, quality: 85 },
      'kohen_eyes.png': { source: 'T_Eye_Brown.png', size: 256 },
    },
    use: 'rigged human (the Universal Base Characters male body on the Universal Animation Library rig, 1.8 m, 8.5k vertices): every kohen, the Kohen Gadol and the Yisraelim, skin textured from the files beside it and the garments painted by vertex colour at load',
  },
  sheep: {
    pack: 'lowpoly-animated-animals',
    zip: 'Farm Animals Animated  by Quaternius.zip',
    entry: 'FBX/Sheep.fbx',
    clips: ['Idle'],
    height: 0.95,
    use: 'sheep at the Tamid pen; also the goats (narrowed, in hide colours, horns and a beard hung on the head bone at load: no CC0 rigged goat exists)',
  },
  bull: {
    // The Ultimate Animated Animal Pack is not on itch.io: quaternius.com hands out a Google
    // Drive folder, so the file comes from Poly Pizza's mirror of the pack (CC0 1.0, the
    // model page below), one GLB per animal. Seven flat-coloured primitives (hide, light
    // patches, muzzle, hooves, eyes, horns) on one skeleton: the colours are baked to vertex
    // colours and the primitives merged into one, so a bull is one draw call.
    pack: 'ultimate-animated-animals',
    page: 'https://poly.pizza/m/a8PIIYwF7r',
    url: 'https://static.poly.pizza/5704ef69-2c27-4de8-a942-70a29458af21.glb',
    entry: 'Bull.glb',
    clips: ['Idle'],
    height: 1.5,
    merge: true,
    use: 'bull (the Ultimate Animated Animal Pack\'s Bull, horns and all, its seven flat-coloured primitives merged into one with vertex colours) at the Tamid pen; no CC0 rigged goat exists in the Quaternius, Kenney or Poly Pizza catalogues, so the goats stay the sheep model with horns and a beard hung on the head bone',
  },
};
const itchPage = (pack) => `https://quaternius.itch.io/${pack}`;
/** Where a spec's pack lives: its own `page` (a Poly Pizza model page) or the itch.io project. */
const packPage = (spec) => spec.page ?? itchPage(spec.pack);

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
  const link = (f) => `[${f.pack}](${f.page})`;
  const rows = files.map(([file, f]) => {
    const packs = f.animations ? `${link(f)} (body), ${link(f.animations)} (clips)` : link(f);
    const entries = f.animations ? `\`${f.entry}\` + \`${f.animations.entry}\`` : f.url ? `[${f.entry}](${f.url})` : `\`${f.entry}\``;
    return `| \`${file}\` | ${packs} | ${entries} | ${f.clips.join(', ')} | ${(f.bytes / 1024).toFixed(0)} KB | ${f.use} |`;
  });
  const textures = Object.entries(chars.textures ?? {});
  const texRows = textures.map(([file, t]) => `| \`${file}\` | [${t.pack}](${itchPage(t.pack)}) | \`${t.source}\` | ${t.size}² | ${(t.bytes / 1024).toFixed(0)} KB |`);
  const texTotal = textures.reduce((n, [, t]) => n + t.bytes, 0);
  const total = files.reduce((n, [, f]) => n + f.bytes, 0);
  const texSection = textures.length ? `
The textures the human is drawn with are the pack's own PNGs, resized (Python PIL,
\`scripts/resize_textures.py\`, Lanczos) and re-encoded; the roughness map is the G channel
of the pack's packed metallic-roughness texture. Nothing was repainted.

| File | Pack (itch.io) | Source entry | Size | Bytes |
|---|---|---|---|---|
${texRows.join('\n')}

Textures: ${(texTotal / 1024).toFixed(0)} KB.
` : '';
  return `## Rigged characters (\`public/assets/characters/\`)

The animated figures are by [Quaternius](https://quaternius.com), released under
**CC0 1.0 Universal** (<https://creativecommons.org/publicdomain/zero/1.0/>); the packs'
own License.txt reads "CC0 1.0 Universal (CC0 1.0) Public Domain Dedication. Models by
@Quaternius". No attribution is required; Quaternius asks for support on Patreon
(<https://www.patreon.com/quaternius>).

Each file is one model taken out of the pack's zip (or, for the Ultimate Animated Animal
Pack, which quaternius.com hands out as a Google Drive folder, the per-model GLB on
[Poly Pizza](https://poly.pizza)'s CC0 mirror of it) and reduced with
\`node scripts/fetch_assets.mjs --characters\` (three's loaders and GLTFExporter in node):
the human is the Universal Base Characters body carrying only the clips listed from the
Universal Animation Library (same rig), with its textures moved out of the glb into the
files below; the FBX animals are converted to GLB, scaled to metres and their material
groups merged; the bull's flat-coloured primitives are merged into one with the colours
as vertex colours. Nothing was resculpted or re-animated. \`manifest.json\` records the
pack page, the zip's (or the file's) sha256, the source entry and the sha256 of every
output file; \`--verify\` checks them.

| File | Pack | Source entry | Clips kept | Size | Used for |
|---|---|---|---|---|---|
${rows.join('\n')}

Models: ${(total / 1024 / 1024).toFixed(1)} MB. Fetched ${chars.fetchedAt ?? 'n/a'}.
${texSection}
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
  for (const [file, t] of Object.entries(chars.textures ?? {})) check(resolve(charDir, file), t, `characters/${file}`);
  console.log(`${Object.keys(manifest.sets).length} sets, ${Object.keys(chars.files ?? {}).length} character files, ${Object.keys(chars.textures ?? {}).length} character textures, ${(total / 1024 / 1024).toFixed(1)} MB, ${bad} problem(s)`);
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
  // itch occasionally serves the download page with no file list (seen right after a large
  // download); a fresh request a few seconds later has it.
  let dlHtml = '', uploads = [];
  for (let attempt = 0; attempt < 4 && !uploads.length; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 3000 * attempt));
    dlHtml = await (await get(dl.url)).text();
    uploads = [...dlHtml.matchAll(/data-upload_id="(\d+)"[\s\S]*?<strong title="([^"]+)"/g)].map((m) => ({ id: m[1], name: m[2] }));
  }
  const up = uploads.find((u) => u.name === zipName);
  if (!up) throw new Error(`${pack}: zip "${zipName}" not offered; found ${uploads.map((u) => u.name).join(', ') || 'no files'}`);
  const file = await (await get(`${page}/file/${up.id}?source=view_game&as_prop=1`, { ...form(csrfOf(dlHtml)), headers: { ...form('').headers, Referer: dl.url } })).json();
  if (!file.url) throw new Error(`${pack}: no file url (${JSON.stringify(file)})`);
  const res = await fetch(file.url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${file.url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Vertex attributes the app reads; the rest (extra UV sets, the pack's vertex colours) leave the glb. */
const KEEP_ATTRIBUTES = new Set(['position', 'normal', 'uv', 'skinIndex', 'skinWeight']);

/**
 * Reduce a source model to what the app loads, with three in node. Returns the GLB bytes.
 * All paths export with GLTFExporter (binary), so the file on disk is plain glTF 2.0 with
 * no extensions (no Draco, no KTX2). `entries` is the zip the entry came from (a .gltf
 * needs its sibling .bin) and `clipBytes` the GLB the clips are taken from when the spec
 * has `animations`.
 */
async function reduceModel(spec, bytes, { entries, clipBytes } = {}) {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  // The examples loaders/exporter expect a browser: `self` and ProgressEvent for the loaders, FileReader for GLTFExporter's GLB packing.
  globalThis.self ??= globalThis;
  globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, init, { type }); } };
  globalThis.FileReader ??= class {
    readAsArrayBuffer(blob) { blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); }); }
  };
  const toAB = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  const ab = toAB(bytes);
  const exportGlb = (root, animations) => new Promise((res, rej) => new GLTFExporter().parse(root, (out) => res(Buffer.from(out)), rej, { binary: true, animations }));
  const parseGlb = (buf) => new Promise((res, rej) => new GLTFLoader().parse(toAB(buf), '', res, rej));
  const pickClips = (all, names, label) => names.map((n) => {
    const c = all.find((a) => a.name === n || a.name === `Armature|${n}`);
    if (!c) throw new Error(`${label}: no clip "${n}" in ${all.map((a) => a.name).join(', ')}`);
    c.name = n;
    return c;
  });
  const skinnedMeshes = (root) => { const out = []; root.traverse((o) => { if (o.isSkinnedMesh) out.push(o); }); return out; };

  if (spec.entry.endsWith('.glb')) {
    const g = await parseGlb(bytes);
    const clips = pickClips(g.animations, spec.clips, spec.entry);
    if (!spec.merge) return exportGlb(g.scene, clips);
    // Flat-coloured primitives on one skeleton -> one vertex-coloured primitive: the material
    // colour goes into a `color` attribute, the geometries merge, and one SkinnedMesh binds
    // to the shared skeleton in the first primitive's place.
    const { mergeGeometries, mergeVertices } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
    const meshes = skinnedMeshes(g.scene);
    const first = meshes[0];
    if (!meshes.every((m) => m.skeleton === first.skeleton && m.parent === first.parent && m.bindMatrix.equals(first.bindMatrix))) {
      throw new Error(`${spec.entry}: primitives do not share one skeleton and bind matrix; cannot merge`);
    }
    const parts = meshes.map((m) => {
      const geo = m.geometry.toNonIndexed();
      for (const a of Object.keys(geo.attributes)) if (!KEEP_ATTRIBUTES.has(a)) geo.deleteAttribute(a);
      const n = geo.attributes.position.count;
      const col = new Float32Array(n * 3);
      const c = m.material.color;
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return geo;
    });
    const joined = mergeGeometries(parts, false);
    if (!joined) throw new Error(`${spec.entry}: primitives have different attributes; cannot merge`);
    const merged = mergeVertices(joined); // back to an index (toNonIndexed tripled the vertices)
    const mesh = new THREE.SkinnedMesh(merged, Object.assign(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }), { name: 'Painted' }));
    mesh.name = spec.entry.replace(/\.glb$/i, '');
    const parent = first.parent;
    for (const m of meshes) parent.remove(m);
    parent.add(mesh);
    mesh.bind(first.skeleton, first.bindMatrix);
    process.stdout.write(`${meshes.length} primitives -> 1 (${merged.attributes.position.count}v, ${first.skeleton.bones.length} bones) -> `);
    // Scale to `height` with the feet on y 0 and centred in x/z, like the FBX animals.
    const mixer = new THREE.AnimationMixer(g.scene);
    mixer.clipAction(clips[0]).play();
    mixer.update(0);
    g.scene.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) box.expandByPoint(mesh.applyBoneTransform(i, v.fromBufferAttribute(pos, i)).applyMatrix4(mesh.matrixWorld));
    const s = spec.height / (box.max.y - box.min.y);
    const root = new THREE.Group();
    root.name = mesh.name.toLowerCase();
    root.scale.setScalar(s);
    root.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
    root.add(g.scene);
    return exportGlb(root, clips);
  }

  if (spec.entry.endsWith('.gltf')) {
    // A .gltf whose buffers and images are sibling zip entries. The .bin is served to the
    // loader as a data: URL through the LoadingManager; the images are dropped from the
    // JSON before parsing (node cannot decode them and the textures leave the glb anyway).
    const dir = spec.entry.replace(/[^/]*$/, '');
    const json = JSON.parse(Buffer.from(ab).toString('utf8'));
    for (const m of json.materials ?? []) {
      delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture;
      delete m.pbrMetallicRoughness?.baseColorTexture; delete m.pbrMetallicRoughness?.metallicRoughnessTexture;
    }
    delete json.images; delete json.textures; delete json.samplers;
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      const data = entries.get(dir + url);
      if (!data) throw new Error(`${spec.entry}: references ${url}, not in the zip`);
      return `data:application/octet-stream;base64,${data.toString('base64')}`;
    });
    const body = await new Promise((res, rej) => new GLTFLoader(manager).parse(JSON.stringify(json), '', res, rej));
    const meshes = skinnedMeshes(body.scene);
    let prims = 0;
    body.scene.traverse((o) => { if (o.isMesh) prims++; });
    if (prims !== meshes.length) throw new Error(`${spec.entry}: ${prims - meshes.length} unskinned mesh(es)`);
    for (const m of meshes) {
      const name = spec.meshes?.[m.material.name];
      if (!name) throw new Error(`${spec.entry}: mesh ${m.name} has material ${m.material.name}, not in spec.meshes`);
      m.name = name;
      for (const a of Object.keys(m.geometry.attributes)) if (!KEEP_ATTRIBUTES.has(a)) m.geometry.deleteAttribute(a);
      m.geometry.deleteAttribute('color');
      m.material.vertexColors = false;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) m.material[k] = null;
    }
    const found = Object.values(spec.meshes ?? {}).filter((n) => !meshes.find((m) => m.name === n));
    if (found.length) throw new Error(`${spec.entry}: no mesh for ${found.join(', ')}`);
    // Clips from the animation pack: the rigs must be the same skeleton, joint for joint.
    const anim = await parseGlb(clipBytes);
    const jointNames = (root) => skinnedMeshes(root)[0].skeleton.bones.map((b) => b.name);
    const bodyJoints = jointNames(body.scene), clipJoints = jointNames(anim.scene);
    if (JSON.stringify(bodyJoints) !== JSON.stringify(clipJoints)) {
      const diff = bodyJoints.filter((n, i) => clipJoints[i] !== n).slice(0, 5);
      throw new Error(`${spec.entry}: skeleton (${bodyJoints.length} joints) differs from ${spec.animations.entry} (${clipJoints.length}): ${diff.join(', ')}...`);
    }
    const clips = pickClips(anim.animations, spec.clips, spec.animations.entry);
    for (const c of clips) {
      const missing = c.tracks.map((t) => t.name.split('.')[0]).filter((n) => !bodyJoints.includes(n));
      if (missing.length) throw new Error(`${c.name}: tracks on nodes the body lacks: ${[...new Set(missing)].join(', ')}`);
    }
    process.stdout.write(`${bodyJoints.length} joints match, ${meshes.map((m) => `${m.name} ${m.geometry.attributes.position.count}v`).join(', ')} -> `);
    return exportGlb(body.scene, clips);
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

/**
 * Resize the spec's texture PNGs (zip entries next to the model) with Python PIL, in one
 * python3 call over a temp directory, and write them to public/assets/characters/.
 * Returns manifest entries keyed by file name.
 */
function writeTextures(spec, entries) {
  const dir = spec.entry.replace(/[^/]*$/, '');
  const tmp = mkdtempSync(join(tmpdir(), 'bhm-textures-'));
  try {
    const jobs = Object.entries(spec.textures).map(([file, t]) => {
      const source = dir + t.source;
      const png = entries.get(source);
      if (!png) throw new Error(`${spec.zip}: no texture entry ${source}`);
      writeFileSync(join(tmp, t.source), png);
      return { src: join(tmp, t.source), dst: join(tmp, file), size: t.size, quality: t.quality ?? 85, channel: t.channel ?? null, source };
    });
    const py = spawnSync('python3', [resolve(root, 'scripts/resize_textures.py')], { input: JSON.stringify(jobs), encoding: 'utf8' });
    if (py.status !== 0) throw new Error(`resize_textures.py failed (python3 with Pillow is required):\n${py.stderr || py.error}`);
    const out = {};
    for (const [file, t] of Object.entries(spec.textures)) {
      const data = readFileSync(join(tmp, file));
      writeFileSync(resolve(charDir, file), data);
      out[file] = { pack: spec.pack, source: dir + t.source, size: t.size, bytes: data.length, sha256: sha256(data) };
    }
    return out;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** A plain file download (Poly Pizza's static host); the sha256 goes into the manifest as `sourceSha256`. */
async function download(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fetchCharacters(chars, only = null) {
  const zips = new Map();
  const getZip = async (pack, zipName) => {
    const key = `${pack}/${zipName}`;
    if (!zips.has(key)) {
      process.stdout.write(`${pack.padEnd(28)} ${zipName} downloading... `);
      const zip = await itchDownload(pack, zipName);
      console.log(`${(zip.length / 1024 / 1024).toFixed(1)} MB`);
      zips.set(key, { zip, entries: readZip(zip) });
    }
    return zips.get(key);
  };
  const entryOf = (entries, zipName, entry) => {
    const src = entries.get(entry);
    if (!src) throw new Error(`${zipName}: no entry ${entry}; has ${[...entries.keys()].slice(0, 20).join(', ')}`);
    return src;
  };
  mkdirSync(charDir, { recursive: true });
  chars.textures ??= {};
  for (const [name, spec] of Object.entries(CHARACTERS)) {
    if (only && name !== only) continue;
    let zip = null, entries = null, src;
    if (spec.url) {
      process.stdout.write(`${spec.pack.padEnd(28)} ${spec.url} downloading... `);
      src = await download(spec.url);
      console.log(`${(src.length / 1024).toFixed(0)} KB`);
    } else {
      ({ zip, entries } = await getZip(spec.pack, spec.zip));
      src = entryOf(entries, spec.zip, spec.entry);
    }
    let animations = null, clipBytes = null;
    if (spec.animations) {
      const a = await getZip(spec.animations.pack, spec.animations.zip);
      clipBytes = entryOf(a.entries, spec.animations.zip, spec.animations.entry);
      animations = { pack: spec.animations.pack, page: itchPage(spec.animations.pack), license: 'CC0-1.0', zip: spec.animations.zip, zipSha256: sha256(a.zip), entry: spec.animations.entry };
    }
    process.stdout.write(`  ${name.padEnd(8)} ${spec.entry} (${(src.length / 1024).toFixed(0)} KB) -> `);
    const glb = await reduceModel(spec, src, { entries, clipBytes });
    const file = `${name}.glb`;
    writeFileSync(resolve(charDir, file), glb);
    console.log(`${file} ${(glb.length / 1024).toFixed(0)} KB, clips ${spec.clips.join(', ')}`);
    chars.files[file] = {
      pack: spec.pack, page: packPage(spec), license: 'CC0-1.0',
      ...(spec.url ? { url: spec.url, sourceSha256: sha256(src) } : { zip: spec.zip, zipSha256: sha256(zip) }),
      entry: spec.entry, ...(spec.meshes ? { meshes: spec.meshes } : {}), ...(animations ? { animations } : {}),
      clips: spec.clips, height: spec.height ?? null, ...(spec.merge ? { merged: true } : {}), use: spec.use, bytes: glb.length, sha256: sha256(glb),
    };
    if (spec.textures) {
      const tex = writeTextures(spec, entries);
      for (const [f, t] of Object.entries(tex)) {
        chars.textures[f] = t;
        console.log(`  ${''.padEnd(8)} ${t.source.replace(/^.*\//, '')} -> ${f} ${t.size}² ${(t.bytes / 1024).toFixed(0)} KB`);
      }
    }
  }
  if (!only) {
    for (const file of Object.keys(chars.files)) if (!CHARACTERS[file.replace(/\.glb$/, '')]) delete chars.files[file];
    const wanted = new Set(Object.values(CHARACTERS).flatMap((c) => Object.keys(c.textures ?? {})));
    for (const file of Object.keys(chars.textures)) if (!wanted.has(file)) delete chars.textures[file];
  }
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
    await fetchCharacters(chars, only);
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
