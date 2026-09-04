import * as THREE from 'three';
import { mulberry32 } from './random.js';

// ============================================================================
// TEXTURE FACTORY - 30 REALISTIC TEXTURES
// ============================================================================
export class TextureFactory {
  /** @param {{maxAnisotropy?: number}} [opts] renderer.capabilities.getMaxAnisotropy() */
  constructor(opts = {}) {
    this.cache = new Map();
    this.size = 1024;
    this.maxAnisotropy = opts.maxAnisotropy ?? 4;
    this.rand = mulberry32(1);
  }

  /**
   * Every colour texture is authored in sRGB; telling three so keeps the colours from
   * washing out under the sRGB output. Anisotropy keeps the 8x-repeated floors sharp at
   * grazing angles. Normal maps are linear data and skip the colour-space tag.
   */
  finish(tex, { srgb = true } = {}) {
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = this.maxAnisotropy;
    tex.needsUpdate = true;
    return tex;
  }

  perlin(w, h, scale = 1, octaves = 4, persistence = 0.5) {
    const perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) perm[i] = perm[i + 256] = Math.floor(this.rand() * 256);
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (a, b, t) => a + t * (b - a);
    const grad = (h, x, y) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
    const noise = new Float32Array(w * h);
    let amp = 1, freq = scale, max = 0;
    for (let o = 0; o < octaves; o++) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const nx = x / w * freq, ny = y / h * freq;
          const X = Math.floor(nx) & 255, Y = Math.floor(ny) & 255;
          const xf = nx - Math.floor(nx), yf = ny - Math.floor(ny);
          const u = fade(xf), v = fade(yf);
          const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1];
          const ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
          noise[y * w + x] += lerp(lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u), lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u), v) * amp;
        }
      }
      max += amp; amp *= persistence; freq *= 2;
    }
    for (let i = 0; i < noise.length; i++) noise[i] = (noise[i] / max + 1) / 2;
    return noise;
  }

  createCanvas(w = this.size, h = this.size) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  jerusalemStone() {
    const c = this.createCanvas(), ctx = c.getContext('2d');
    const noise = this.perlin(this.size, this.size, 8, 5, 0.6);
    const img = ctx.createImageData(this.size, this.size);
    for (let i = 0; i < noise.length; i++) {
      const n = noise[i], v = (n - 0.5) * 50;
      img.data[i*4] = Math.min(255, Math.max(0, 228 + v + this.rand() * 10));
      img.data[i*4+1] = Math.min(255, Math.max(0, 215 + v + this.rand() * 8));
      img.data[i*4+2] = Math.min(255, Math.max(0, 195 + v + this.rand() * 6));
      img.data[i*4+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const bh = 80, bw = 160;
    for (let y = 0; y < this.size; y += bh) {
      const off = (Math.floor(y / bh) % 2) * (bw / 2);
      for (let x = -bw; x < this.size + bw; x += bw) {
        const bx = x + off;
        ctx.fillStyle = 'rgba(90,80,65,0.7)';
        ctx.fillRect(bx - 3, y - 3, bw + 6, 6);
        ctx.fillRect(bx - 3, y - 3, 6, bh + 6);
        for (let s = 0; s < 4; s++) {
          const sx = bx + 15 + this.rand() * (bw - 30), sy = y + 15 + this.rand() * (bh - 30), sr = this.rand() * 12 + 4;
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
          g.addColorStop(0, `rgba(${160+this.rand()*40},${150+this.rand()*40},${130+this.rand()*40},0.35)`);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
        }
      }
    }
    const tex = this.finish(new THREE.CanvasTexture(c));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  goldPolished() {
    const c = this.createCanvas(512, 512), ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 512, 512);
    g.addColorStop(0, '#FFE14D'); g.addColorStop(0.25, '#FFD700');
    g.addColorStop(0.5, '#FFC125'); g.addColorStop(0.75, '#DAA520');
    g.addColorStop(1, '#CD950C');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y++) {
      ctx.strokeStyle = `rgba(255,240,180,${0.03 + this.rand() * 0.04})`;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y + (this.rand() - 0.5) * 2); ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const x = this.rand() * 512, y = this.rand() * 512, r = this.rand() * 60 + 20;
      const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, 'rgba(255,255,230,0.4)');
      gg.addColorStop(1, 'transparent');
      ctx.fillStyle = gg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const tex = this.finish(new THREE.CanvasTexture(c));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  goldEngraved() {
    const c = this.createCanvas(512, 512), ctx = c.getContext('2d');
    ctx.fillStyle = '#DAA520';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(180,140,20,0.5)';
    ctx.lineWidth = 2;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const cx = 32 + col * 64, cy = 32 + row * 64;
        if ((row + col) % 2 === 0) {
          ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx - 4, cy - 16); ctx.lineTo(cx, cy - 22); ctx.lineTo(cx + 4, cy - 16); ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(cx - 10, cy - 12);
          ctx.quadraticCurveTo(cx, cy - 20, cx + 10, cy - 12);
          ctx.lineTo(cx + 12, cy + 8);
          ctx.quadraticCurveTo(cx, cy + 14, cx - 12, cy + 8);
          ctx.closePath(); ctx.stroke();
        }
      }
    }
    const tex = this.finish(new THREE.CanvasTexture(c));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  copper() {
    const c = this.createCanvas(512, 512), ctx = c.getContext('2d');
    const noise = this.perlin(512, 512, 6, 4, 0.5);
    const img = ctx.createImageData(512, 512);
    for (let i = 0; i < noise.length; i++) {
      const n = noise[i];
      img.data[i*4] = 190 + n * 40;
      img.data[i*4+1] = 110 + n * 30;
      img.data[i*4+2] = 70 + n * 20;
      img.data[i*4+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 80; i++) {
      const x = this.rand() * 512, y = this.rand() * 512;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 12);
      g.addColorStop(0, 'rgba(230,150,100,0.25)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
    }
    const tex = this.finish(new THREE.CanvasTexture(c));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  copperPatina() {
    const c = this.createCanvas(512, 512), ctx = c.getContext('2d');
    const base = this.perlin(512, 512, 8, 4, 0.5);
    const patina = this.perlin(512, 512, 4, 3, 0.6);
    const img = ctx.createImageData(512, 512);
    for (let i = 0; i < base.length; i++) {
      const b = base[i], p = patina[i];
      if (p > 0.55) {
        img.data[i*4] = 70 + (p - 0.55) * 120;
        img.data[i*4+1] = 120 + (p - 0.55) * 160 + this.rand() * 20;
        img.data[i*4+2] = 90 + (p - 0.55) * 120;
      } else {
        img.data[i*4] = 160 + b * 40;
        img.data[i*4+1] = 90 + b * 30;
        img.data[i*4+2] = 55 + b * 20;
      }
      img.data[i*4+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const tex = this.finish(new THREE.CanvasTexture(c));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  cedarWood() {
    const c = this.createCanvas(512, 512), ctx = c.getContext('2d');
    ctx.fillStyle = '#8B4226';
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y++) {
      const l = 30 + Math.sin(y * 0.02) * 15 + Math.sin(y * 0.07) * 8 + Math.sin(y * 0.15) * 4;
      ctx.strokeStyle = `hsl(${15 + Math.sin(y * 0.01) * 5}, 70%, ${l + this.rand() * 5}%)`;
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x < 512; x += 8) ctx.lineTo(x, y + (this.rand() - 0.5) * 1.5);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(50,25,10,0.12)';
    ctx.lineWidth = 2;
    for (let r = 0; r < 5; r++) {
      ctx.beginPath();
      ctx.arc(256 + (this.rand() - 0.5) * 300, -200 + r * 180, 350 + r * 60, 0.4, 2.7);
      ctx.stroke();
    }
    for (let k = 0; k < 2; k++) {
      const kx = 100 + this.rand() * 312, ky = 100 + this.rand() * 312;
      const g = ctx.createRadialGradient(kx, ky, 0, kx, ky, 20);
      g.addColorStop(0, '#1A0A05');
      g.addColorStop(0.4, '#3D1A0D');
      g.addColorStop(1, '#8B4226');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(kx, ky, 20, 12, this.rand() * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = this.finish(new THREE.CanvasTexture(c));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  acaciaWood() {
    const c = this.createCanvas(512, 512), ctx = c.getContext('2d');
    ctx.fillStyle = '#6B4423';
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y++) {
      const l = 28 + Math.sin(y * 0.025) * 12 + Math.sin(y * 0.1) * 6;
      ctx.strokeStyle = `hsl(25, 60%, ${l + this.rand() * 4}%)`;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y + (this.rand() - 0.5)); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(30,15,5,0.35)';
    ctx.lineWidth = 3;
    for (let s = 0; s < 6; s++) {
      ctx.beginPath();
      let x = this.rand() * 512, y = 0;
      ctx.moveTo(x, y);
      while (y < 512) { y += this.rand() * 30 + 10; x += (this.rand() - 0.5) * 20; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    const tex = this.finish(new THREE.CanvasTexture(c));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  marbleWhite() {
    const c = this.createCanvas(), ctx = c.getContext('2d');
    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, this.size, this.size);
    const drawVeins = (color, width, count) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      for (let v = 0; v < count; v++) {
        ctx.beginPath();
        let x = this.rand() * this.size, y = this.rand() * this.size;
        ctx.moveTo(x, y);
        for (let s = 0; s < 20; s++) { x += (this.rand() - 0.5) * 45; y += (this.rand() - 0.5) * 45; ctx.lineTo(x, y); }
        ctx.stroke();
      }
    };
    drawVeins('rgba(160,155,165,0.25)', 3, 6);
    drawVeins('rgba(140,135,145,0.2)', 2, 12);
    drawVeins('rgba(180,175,185,0.15)', 1, 15);
    const tex = this.finish(new THREE.CanvasTexture(c));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  marbleRose() {
    const c = this.createCanvas(), ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, this.size, this.size);
    g.addColorStop(0, '#F5E6E8'); g.addColorStop(0.5, '#EDD5D8'); g.addColorStop(1, '#F0E0E2');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.size, this.size);
    ctx.strokeStyle = 'rgba(180,140,150,0.25)';
    ctx.lineWidth = 2;
    for (let v = 0; v < 15; v++) {
      ctx.beginPath();
      let x = this.rand() * this.size, y = this.rand() * this.size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 15; s++) { x += (this.rand() - 0.5) * 35; y += (this.rand() - 0.5) * 35; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    const tex = this.finish(new THREE.CanvasTexture(c));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  techeiles() {
    const c = this.createCanvas(256, 256), ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 256, 256);
    g.addColorStop(0, '#1E4D7B'); g.addColorStop(0.5, '#2A5F8F'); g.addColorStop(1, '#1E4D7B');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 2) {
      for (let x = 0; x < 256; x += 2) {
        ctx.fillStyle = `rgba(255,255,255,${((x+y)%4===0)?0.06:0.015})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    const tex = this.finish(new THREE.CanvasTexture(c));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  argaman() {
    const c = this.createCanvas(256, 256), ctx = c.getContext('2d');
    ctx.fillStyle = '#4A1942';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 2) {
      for (let x = 0; x < 256; x += 2) {
        ctx.fillStyle = `rgba(255,255,255,${((x+y)%4===0)?0.05:0.015})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    const tex = this.finish(new THREE.CanvasTexture(c));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  whiteLinen() {
    const c = this.createCanvas(256, 256), ctx = c.getContext('2d');
    ctx.fillStyle = '#F8F8F0';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(220,220,210,0.4)';
    ctx.lineWidth = 1;
    for (let y = 0; y < 256; y += 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
    for (let x = 0; x < 256; x += 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
    const tex = this.finish(new THREE.CanvasTexture(c));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  paroches() {
    const c = this.createCanvas(512, 512), ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#1E3A5F'); g.addColorStop(0.3, '#3D2052'); g.addColorStop(0.5, '#4A2A5E');
    g.addColorStop(0.7, '#3D2052'); g.addColorStop(1, '#1E3A5F');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 3) {
      for (let x = 0; x < 512; x += 3) {
        ctx.fillStyle = `rgba(255,255,255,${((x+y)%6===0)?0.04:0.01})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
    ctx.strokeStyle = 'rgba(218,165,32,0.45)';
    ctx.fillStyle = 'rgba(218,165,32,0.18)';
    ctx.lineWidth = 2;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const cx = 64 + col * 128, cy = 64 + row * 128;
        ctx.beginPath();
        ctx.moveTo(cx - 40, cy);
        ctx.quadraticCurveTo(cx - 50, cy - 30, cx - 18, cy - 45);
        ctx.quadraticCurveTo(cx, cy - 35, cx, cy - 22);
        ctx.quadraticCurveTo(cx, cy - 35, cx + 18, cy - 45);
        ctx.quadraticCurveTo(cx + 50, cy - 30, cx + 40, cy);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy - 12, 10, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx, cy + 12, 15, 25, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(218,165,32,0.5)';
    ctx.lineWidth = 5;
    ctx.strokeRect(18, 18, 476, 476);
    const tex = this.finish(new THREE.CanvasTexture(c));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  groundSand() {
    const c = this.createCanvas(), ctx = c.getContext('2d');
    const noise = this.perlin(this.size, this.size, 8, 5, 0.6);
    const img = ctx.createImageData(this.size, this.size);
    for (let i = 0; i < noise.length; i++) {
      const n = noise[i];
      img.data[i*4] = 200 + n * 40 + this.rand() * 10;
      img.data[i*4+1] = 180 + n * 35 + this.rand() * 8;
      img.data[i*4+2] = 140 + n * 30 + this.rand() * 6;
      img.data[i*4+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 150; i++) {
      const x = this.rand() * this.size, y = this.rand() * this.size, s = this.rand() * 5 + 2;
      ctx.fillStyle = `hsl(30,${20+this.rand()*20}%,${40+this.rand()*30}%)`;
      ctx.beginPath();
      ctx.ellipse(x, y, s, s * 0.7, this.rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = this.finish(new THREE.CanvasTexture(c));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);
    return tex;
  }

  floorTiles() {
    const c = this.createCanvas(), ctx = c.getContext('2d');
    ctx.fillStyle = '#D0C4B0';
    ctx.fillRect(0, 0, this.size, this.size);
    const ts = this.size / 4;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const x = col * ts, y = row * ts, v = this.rand() * 20 - 10;
        ctx.fillStyle = `rgb(${208+v},${196+v},${176+v})`;
        ctx.fillRect(x + 4, y + 4, ts - 8, ts - 8);
        ctx.strokeStyle = '#8B8070';
        ctx.lineWidth = 4;
        ctx.strokeRect(x + 2, y + 2, ts - 4, ts - 4);
        ctx.strokeStyle = 'rgba(255,250,240,0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 6, y + ts - 6); ctx.lineTo(x + 6, y + 6); ctx.lineTo(x + ts - 6, y + 6);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(100,90,75,0.2)';
        ctx.beginPath();
        ctx.moveTo(x + 6, y + ts - 6); ctx.lineTo(x + ts - 6, y + ts - 6); ctx.lineTo(x + ts - 6, y + 6);
        ctx.stroke();
      }
    }
    const tex = this.finish(new THREE.CanvasTexture(c));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  mosaic() {
    const c = this.createCanvas(512, 512), ctx = c.getContext('2d');
    ctx.fillStyle = '#2A2520';
    ctx.fillRect(0, 0, 512, 512);
    const colors = ['#D4C4A8', '#C9B896', '#E8DCC8', '#BFA88A', '#FFFFFF', '#1E3A5F', '#8B0000'];
    const ts = 8;
    for (let y = 0; y < 512; y += ts) {
      for (let x = 0; x < 512; x += ts) {
        const dist = Math.sqrt((x - 256) ** 2 + (y - 256) ** 2);
        ctx.fillStyle = colors[Math.floor(dist / 40) % colors.length];
        ctx.fillRect(x + 1, y + 1, ts - 2, ts - 2);
      }
    }
    const tex = this.finish(new THREE.CanvasTexture(c));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  water() {
    const c = this.createCanvas(256, 256), ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 256, 256);
    g.addColorStop(0, '#3A7CA5'); g.addColorStop(0.5, '#4A8CB5'); g.addColorStop(1, '#3A7CA5');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    for (let i = 0; i < 15; i++) {
      ctx.beginPath();
      const y = this.rand() * 256;
      ctx.moveTo(0, y);
      for (let x = 0; x < 256; x += 10) ctx.lineTo(x, y + Math.sin(x * 0.1) * 3);
      ctx.stroke();
    }
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = `rgba(255,255,255,${this.rand() * 0.35})`;
      ctx.beginPath(); ctx.arc(this.rand() * 256, this.rand() * 256, 2, 0, Math.PI * 2); ctx.fill();
    }
    const tex = this.finish(new THREE.CanvasTexture(c));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  sheepWool() {
    const c = this.createCanvas(128, 128), ctx = c.getContext('2d');
    ctx.fillStyle = '#F5F5DC';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = `rgba(${240+this.rand()*15},${235+this.rand()*15},${215+this.rand()*20},0.75)`;
      ctx.beginPath();
      ctx.arc(this.rand() * 128, this.rand() * 128, this.rand() * 7 + 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = this.finish(new THREE.CanvasTexture(c));
    return tex;
  }

  bullHide() {
    const c = this.createCanvas(256, 256), ctx = c.getContext('2d');
    ctx.fillStyle = '#5C4033';
    ctx.fillRect(0, 0, 256, 256);
    const noise = this.perlin(256, 256, 8, 3, 0.5);
    for (let i = 0; i < noise.length; i++) {
      const x = i % 256, y = Math.floor(i / 256);
      if (noise[i] > 0.55) { ctx.fillStyle = '#2D1F15'; ctx.fillRect(x, y, 2, 2); }
    }
    const tex = this.finish(new THREE.CanvasTexture(c));
    return tex;
  }

  goatHide() {
    const c = this.createCanvas(256, 256), ctx = c.getContext('2d');
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(0, 0, 256, 256);
    const noise = this.perlin(256, 256, 12, 3, 0.6);
    for (let i = 0; i < noise.length; i++) {
      const x = i % 256, y = Math.floor(i / 256);
      if (noise[i] > 0.6) { ctx.fillStyle = '#3D2B1F'; ctx.fillRect(x, y, 3, 3); }
      else if (noise[i] < 0.4) { ctx.fillStyle = '#C9B896'; ctx.fillRect(x, y, 2, 2); }
    }
    const tex = this.finish(new THREE.CanvasTexture(c));
    return tex;
  }

  normalMap() {
    const c = this.createCanvas(256, 256), ctx = c.getContext('2d');
    const noise = this.perlin(256, 256, 8, 4, 0.5);
    const img = ctx.createImageData(256, 256);
    for (let y = 1; y < 255; y++) {
      for (let x = 1; x < 255; x++) {
        const i = y * 256 + x;
        const dx = (noise[i - 1] - noise[i + 1]) * 2;
        const dy = (noise[i - 256] - noise[i + 256]) * 2;
        img.data[i*4] = Math.floor((dx + 1) * 127.5);
        img.data[i*4+1] = Math.floor((dy + 1) * 127.5);
        img.data[i*4+2] = 255;
        img.data[i*4+3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return this.finish(new THREE.CanvasTexture(c), { srgb: false });
  }

  get(name) {
    if (this.cache.has(name)) return this.cache.get(name);
    // Seed per texture name so each texture is identical on every load, in any order.
    let seed = 0;
    for (const ch of name) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    this.rand = mulberry32(seed || 1);
    const tex = this[name]?.();
    if (tex) this.cache.set(name, tex);
    return tex;
  }
}
