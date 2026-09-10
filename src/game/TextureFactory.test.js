import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { TextureFactory, TEXTURE_NAMES, BAKED_PATH, CLOTH_FOLDS, BEDROCK, clothFoldsHeight, heightToNormal, bedrockHeight, bedrockPixels } from './TextureFactory.js';
import { mulberry32 } from './random.js';

/** Stub the image loader: returns a bare Texture and settles on the next tick. */
function stubLoader(factory, { fail = [] } = {}) {
  const requested = [];
  factory.loader.load = (url, onLoad, _onProgress, onError) => {
    requested.push(url);
    const tex = new THREE.Texture();
    const name = url.slice(BAKED_PATH.length, -'.webp'.length);
    setTimeout(() => (fail.includes(name) ? onError(new Error('404')) : onLoad(tex)), 0);
    return tex;
  };
  return requested;
}

describe('TextureFactory (baked path)', () => {
  it('lists 25 bakeable textures, each backed by a generator method', () => {
    expect(TEXTURE_NAMES).toHaveLength(25);
    for (const n of TEXTURE_NAMES) expect(typeof TextureFactory.prototype[n], n).toBe('function');
    expect(new Set(TEXTURE_NAMES).size).toBe(25);
  });

  it('bedrock is a seeded, tileable height field whose maps are darker and rougher in the cracks', () => {
    const size = 64;
    const h = bedrockHeight(mulberry32(3), size);
    expect(h).toHaveLength(size * size);
    expect(bedrockHeight(mulberry32(3), size)).toEqual(h);
    expect(bedrockHeight(mulberry32(4), size)).not.toEqual(h);
    // Tileable: the wrapped neighbours across each edge differ no more than neighbours inside.
    let edge = 0, inner = 0;
    for (let i = 0; i < size; i++) {
      edge = Math.max(edge, Math.abs(h[i * size] - h[i * size + size - 1]), Math.abs(h[i] - h[(size - 1) * size + i]));
      inner = Math.max(inner, Math.abs(h[i * size + 1] - h[i * size + 2]), Math.abs(h[size + i] - h[2 * size + i]));
    }
    expect(edge).toBeLessThanOrEqual(inner * 1.5 + 1e-3);
    // Relief: a real spread of heights, with cracks cutting well below the body.
    const sorted = Array.from(h).sort((a, b) => a - b);
    expect(sorted[Math.floor(size * size * 0.95)] - sorted[Math.floor(size * size * 0.05)]).toBeGreaterThan(0.25);
    const { color, rough } = bedrockPixels(h, size, mulberry32(5));
    expect(color).toHaveLength(size * size * 4);
    expect(rough).toHaveLength(size * size * 4);
    // Dark, warm grey-brown: mean luminance well under mid grey, red >= green >= blue.
    let r = 0, g = 0, b = 0, lumLow = 0, lumHigh = 0, nLow = 0, nHigh = 0, rLow = 0, rHigh = 0;
    for (let i = 0; i < size * size; i++) {
      r += color[i * 4]; g += color[i * 4 + 1]; b += color[i * 4 + 2];
      expect(color[i * 4 + 3]).toBe(255);
      expect(rough[i * 4]).toBe(rough[i * 4 + 1]);
      const lum = color[i * 4] * 0.3 + color[i * 4 + 1] * 0.59 + color[i * 4 + 2] * 0.11;
      if (h[i] < 0.35) { lumLow += lum; rLow += rough[i * 4]; nLow++; } else if (h[i] > 0.8) { lumHigh += lum; rHigh += rough[i * 4]; nHigh++; }
    }
    const n = size * size;
    expect((r + g + b) / (3 * n)).toBeLessThan(110);
    expect(r / n).toBeGreaterThan(g / n);
    expect(g / n).toBeGreaterThan(b / n);
    expect(nLow).toBeGreaterThan(0);
    expect(nHigh).toBeGreaterThan(0);
    expect(lumLow / nLow).toBeLessThan(lumHigh / nHigh - 20); // cracks darker than the worn tops
    expect(rLow / nLow).toBeGreaterThan(rHigh / nHigh + 20); // and rougher: the sheen sits on the tops
    expect(rHigh / nHigh).toBeGreaterThan(150); // but never glossy
    const px = heightToNormal(h, size, BEDROCK.depth);
    let rMean = 0, gMean = 0, bMin = 255, rVar = 0;
    for (let i = 0; i < px.length; i += 4) { rMean += px[i]; gMean += px[i + 1]; bMin = Math.min(bMin, px[i + 2]); }
    rMean /= n; gMean /= n;
    for (let i = 0; i < px.length; i += 4) rVar += (px[i] - rMean) ** 2;
    expect(Math.abs(rMean - 127.5)).toBeLessThan(3);
    expect(Math.abs(gMean - 127.5)).toBeLessThan(3);
    expect(Math.sqrt(rVar / n)).toBeGreaterThan(12); // a strong normal map, not a faint one
    expect(bMin).toBeGreaterThan(127);
  });

  it('clothFolds is a seeded, tileable tangent-space map whose folds run along v', () => {
    const size = 64;
    const p = { ...CLOTH_FOLDS, size };
    const h = clothFoldsHeight(mulberry32(7), p);
    expect(h).toHaveLength(size * size);
    expect(clothFoldsHeight(mulberry32(7), p)).toEqual(h);
    expect(clothFoldsHeight(mulberry32(8), p)).not.toEqual(h);
    // Tileable: the wrapped neighbours across each edge differ no more than neighbours inside.
    let edge = 0, inner = 0;
    for (let i = 0; i < size; i++) {
      edge = Math.max(edge, Math.abs(h[i * size] - h[i * size + size - 1]), Math.abs(h[i] - h[(size - 1) * size + i]));
      inner = Math.max(inner, Math.abs(h[i * size + 1] - h[i * size + 2]), Math.abs(h[size + i] - h[2 * size + i]));
    }
    expect(edge).toBeLessThanOrEqual(inner * 1.5 + 1e-3);
    // Ridges along v: the height varies far more across u than along v, and there are `folds` of them.
    let du = 0, dv = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      du += Math.abs(h[y * size + (x + 1) % size] - h[y * size + x]);
      dv += Math.abs(h[((y + 1) % size) * size + x] - h[y * size + x]);
    }
    expect(du).toBeGreaterThan(dv * 2.5);
    const row = Array.from(h.subarray(0, size));
    const peaks = row.filter((v, x) => v > row[(x + size - 1) % size] && v >= row[(x + 1) % size] && v > 0.3).length;
    expect(peaks).toBe(p.folds);
    const px = heightToNormal(h, size, p.depth);
    expect(px).toHaveLength(size * size * 4);
    let r = 0, g = 0, rVar = 0, gVar = 0, bMin = 255, aMin = 255;
    for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; bMin = Math.min(bMin, px[i + 2]); aMin = Math.min(aMin, px[i + 3]); }
    r /= size * size; g /= size * size;
    for (let i = 0; i < px.length; i += 4) { rVar += (px[i] - r) ** 2; gVar += (px[i + 1] - g) ** 2; }
    expect(Math.abs(r - 127.5)).toBeLessThan(3); // slopes cancel over a tile
    expect(Math.abs(g - 127.5)).toBeLessThan(3);
    expect(rVar).toBeGreaterThan(gVar * 3); // the perturbation is mostly across u
    expect(Math.sqrt(rVar / (size * size))).toBeGreaterThan(20); // and not faint
    expect(bMin).toBeGreaterThan(127); // never a normal below the surface
    expect(aMin).toBe(255);
  });

  it('requests /textures/<name>.webp once, caches the texture and reports progress', async () => {
    const f = new TextureFactory({ maxAnisotropy: 8 });
    const requested = stubLoader(f);
    const progress = [];
    f.onProgress((n, total) => progress.push([n, total]));

    const a = f.get('jerusalemStone');
    const b = f.get('jerusalemStone');
    const n = f.get('normalMap');
    expect(a).toBe(b);
    expect(requested).toEqual([`${BAKED_PATH}jerusalemStone.webp`, `${BAKED_PATH}normalMap.webp`]);
    expect(a.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(n.colorSpace).toBe(THREE.NoColorSpace);
    expect(a.wrapS).toBe(THREE.RepeatWrapping);
    expect(a.anisotropy).toBe(8);
    expect(f.total).toBe(2);

    await f.whenLoaded();
    expect(f.loaded).toBe(2);
    expect(progress).toEqual([[1, 2], [2, 2]]);
    expect(f.get('unknownTexture')).toBeUndefined();
  });

  it('falls back to the canvas generator when the file is missing', async () => {
    const f = new TextureFactory();
    stubLoader(f, { fail: ['copper'] });
    const fakeImage = { width: 4, height: 4 };
    let generated = 0;
    f.generate = () => { generated++; const t = new THREE.Texture(fakeImage); return t; };
    const tex = f.get('copper');
    expect(tex.image).toBeNull();
    await f.whenLoaded();
    expect(generated).toBe(1);
    expect(tex.image).toBe(fakeImage);
    expect(f.get('copper')).toBe(tex);
  });

  it('whenLoaded resolves immediately with nothing pending and with baked off', async () => {
    const f = new TextureFactory({ baked: false });
    await expect(f.whenLoaded()).resolves.toBeUndefined();
    expect(f.total).toBe(0);
  });
});

describe('TextureFactory.pbrSet', () => {
  /** Stub for PBR urls too: settles every request on the next tick unless it matches `fail`. */
  function stubPbrLoader(factory, { fail = [] } = {}) {
    const requested = [];
    factory.loader.load = (url, onLoad, _onProgress, onError) => {
      requested.push(url);
      const tex = new THREE.Texture();
      setTimeout(() => (fail.some((f) => url.includes(f)) ? onError(new Error('404')) : onLoad(tex)), 0);
      return tex;
    };
    return requested;
  }

  it('loads the maps a set has, tags colour spaces, caches, and counts toward progress', async () => {
    const f = new TextureFactory({ maxAnisotropy: 16 });
    const requested = stubPbrLoader(f);
    const a = f.pbrSet('limestone'); // ships ao.jpg
    const b = f.pbrSet('ashlar'); // no ao.jpg in the manifest
    expect(f.pbrSet('limestone')).toBe(a);
    expect(Object.keys(a).sort()).toEqual(['aoMap', 'map', 'normalMap', 'roughnessMap']);
    expect(Object.keys(b).sort()).toEqual(['map', 'normalMap', 'roughnessMap']);
    expect(requested).toHaveLength(7);
    expect(requested[0]).toMatch(/^\/assets\/textures\/limestone\/color\.jpg\?v=[0-9a-f]{8}$/);
    expect(a.map.colorSpace).toBe(THREE.SRGBColorSpace);
    for (const k of ['normalMap', 'roughnessMap', 'aoMap']) expect(a[k].colorSpace, k).toBe(THREE.NoColorSpace);
    expect(a.map.wrapS).toBe(THREE.RepeatWrapping);
    expect(a.map.anisotropy).toBe(16);
    expect(f.total).toBe(7);
    await f.whenLoaded();
    expect(f.loaded).toBe(7);
  });

  it('shares the progress counter with the baked textures', async () => {
    const f = new TextureFactory();
    stubPbrLoader(f);
    const progress = [];
    f.onProgress((n, total) => progress.push([n, total]));
    f.get('copper');
    f.pbrSet('cedar');
    expect(f.total).toBe(4);
    await f.whenLoaded();
    expect(progress.at(-1)).toEqual([4, 4]);
  });

  it('returns null with pbr off and for unknown sets, and requests nothing', () => {
    const off = new TextureFactory({ pbr: false });
    const requested = stubPbrLoader(off);
    expect(off.pbrSet('ashlar')).toBeNull();
    expect(requested).toEqual([]);
    expect(off.total).toBe(0);
    const on = new TextureFactory();
    stubPbrLoader(on);
    expect(on.pbrSet('noSuchSet')).toBeNull();
  });

  it('a failed map still settles and gets a flat stand-in when a canvas exists', async () => {
    const f = new TextureFactory();
    stubPbrLoader(f, { fail: ['sand/normal.jpg'] });
    const px = { width: 1, height: 1 };
    f.neutralPixel = () => px;
    const warn = console.warn;
    const warned = [];
    console.warn = (m) => warned.push(m);
    try {
      const s = f.pbrSet('sand');
      await f.whenLoaded();
      expect(s.normalMap.image).toBe(px);
      expect(s.map.image).toBeNull();
      expect(warned).toHaveLength(1);
      expect(f.loaded).toBe(f.total);
    } finally {
      console.warn = warn;
    }
  });

  it('dispose releases the set textures too', () => {
    const f = new TextureFactory();
    stubPbrLoader(f);
    const s = f.pbrSet('cedar');
    let disposed = 0;
    for (const t of Object.values(s)) t.addEventListener('dispose', () => disposed++);
    f.dispose();
    expect(disposed).toBe(3);
    expect(f.pbrSet('cedar')).not.toBe(s);
  });
});
