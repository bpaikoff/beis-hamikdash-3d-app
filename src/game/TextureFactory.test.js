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
