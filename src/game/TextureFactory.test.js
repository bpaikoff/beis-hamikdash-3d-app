import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { TextureFactory, TEXTURE_NAMES, BAKED_PATH } from './TextureFactory.js';

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
  it('lists 21 bakeable textures, each backed by a generator method', () => {
    expect(TEXTURE_NAMES).toHaveLength(21);
    for (const n of TEXTURE_NAMES) expect(typeof TextureFactory.prototype[n], n).toBe('function');
    expect(new Set(TEXTURE_NAMES).size).toBe(21);
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
