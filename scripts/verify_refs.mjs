#!/usr/bin/env node
/**
 * verify_refs.mjs - check that every Sefaria ref in src/content/temple.json and in the
 * tours (src/content/tours/*.json) resolves.
 *
 * Collects every `sources[]` string, every `dimensions[].source`, every `position.source`
 * (and the same fields on `children[]`) from the entries, and `sources[]` on each tour and
 * on each of its `stops[]`; dedupes them, and asks Sefaria's v3 texts API for each one with
 * a 300 ms gap between requests. A ref is bad on HTTP 404 or when the JSON body carries an
 * `error` key. Bad refs are printed and the process exits 1 if there are any.
 *
 *   node scripts/verify_refs.mjs                       # verify everything (entries + tours)
 *   node scripts/verify_refs.mjs --cache .refs-cache.json   # skip refs already verified
 *   node scripts/verify_refs.mjs --file path/to.json   # one content or tour file only
 *
 * Node 22, no dependencies (uses global fetch).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const contentDir = resolve(here, '../src/content');
const toursDir = join(contentDir, 'tours');
const files = argValue('--file')
  ? [resolve(argValue('--file'))]
  : [join(contentDir, 'temple.json'), ...(existsSync(toursDir) ? readdirSync(toursDir).filter((f) => f.endsWith('.json')).sort().map((f) => join(toursDir, f)) : [])];
const cachePath = argValue('--cache') ? resolve(argValue('--cache')) : null;
const gapMs = Number(argValue('--gap') ?? 300);
const API = 'https://www.sefaria.org/api/v3/texts/';

/** Collect refs from one entry-shaped object (entries and their children share the shape). */
function collect(obj, where, out) {
  for (const s of obj.sources ?? []) out.push([s, `${where}.sources`]);
  for (const d of obj.dimensions ?? []) if (d.source) out.push([d.source, `${where}.dimensions[${d.label}]`]);
  if (obj.position?.source) out.push([obj.position.source, `${where}.position`]);
  for (const c of obj.children ?? []) collect(c, `${where}.children[${c.id ?? '?'}]`, out);
}
/** A tour file: `sources[]` on the tour and on each stop. */
function collectTour(tour, where, out) {
  for (const s of tour.sources ?? []) out.push([s, `${where}.sources`]);
  for (const st of tour.stops ?? []) for (const s of st.sources ?? []) out.push([s, `${where}.stops[${st.id ?? '?'}].sources`]);
}
const found = [];
for (const file of files) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const tag = basename(file, '.json');
  if (Array.isArray(data.entries)) for (const e of data.entries) collect(e, e.id, found);
  if (Array.isArray(data.stops)) collectTour(data, `tour:${tag}`, found);
}

const refs = new Map(); // ref -> [where...]
for (const [ref, where] of found) {
  const r = ref.trim();
  if (!r) continue;
  if (!refs.has(r)) refs.set(r, []);
  refs.get(r).push(where);
}

let cache = {};
if (cachePath && existsSync(cachePath)) {
  try {
    cache = JSON.parse(readFileSync(cachePath, 'utf8'));
  } catch {
    cache = {};
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One request. Transient failures (network errors, HTTP 5xx) are retried up to `retries` times. */
async function check(ref, retries = 2) {
  const url = `${API}${encodeURIComponent(ref)}?version=hebrew`;
  let res;
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } });
  } catch (err) {
    if (retries > 0) return sleep(1000).then(() => check(ref, retries - 1));
    return { ok: false, reason: `network: ${err.message}` };
  }
  if (res.status === 404) return { ok: false, reason: 'HTTP 404' };
  if (res.status >= 500 && retries > 0) {
    await sleep(1000);
    return check(ref, retries - 1);
  }
  let body;
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: `HTTP ${res.status}, non-JSON body` };
  }
  if (body && typeof body === 'object' && 'error' in body) return { ok: false, reason: `error: ${body.error}` };
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  return { ok: true };
}

const bad = [];
let checked = 0;
let skipped = 0;
const all = [...refs.keys()].sort();
console.log(`${all.length} distinct refs in ${files.map((f) => basename(f)).join(', ')}`);
for (const ref of all) {
  if (cache[ref] === true) {
    skipped++;
    continue;
  }
  const result = await check(ref);
  checked++;
  if (result.ok) {
    cache[ref] = true;
    process.stdout.write(`ok   ${ref}\n`);
  } else {
    bad.push({ ref, reason: result.reason, where: refs.get(ref) });
    process.stdout.write(`BAD  ${ref}  (${result.reason})\n`);
  }
  await sleep(gapMs);
}

if (cachePath) writeFileSync(cachePath, JSON.stringify(cache, null, 2) + '\n');

console.log(`\nverified ${checked} refs (${skipped} from cache), ${bad.length} bad`);
if (bad.length) {
  console.log('\nBad refs:');
  for (const b of bad) console.log(`  ${b.ref}  [${b.reason}]\n    used in: ${b.where.join(', ')}`);
  process.exit(1);
}
