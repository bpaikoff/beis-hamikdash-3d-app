import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
  PLAYER_HEIGHT: 1.7,
  PLAYER_RADIUS: 0.3,
  MOVE_SPEED: 4.5,
  RUN_SPEED: 7,
  LOOK_SPEED: 0.002,
  STEP_HEIGHT: 0.5,
  FOV: 72,
  RENDER_DISTANCE: 400,
  SHADOW_MAP_SIZE: 4096
};

// ============================================================================
// HEBREW CALENDAR
// ============================================================================
const HebrewCalendar = {
  months: ['ניסן','אייר','סיון','תמוז','אב','אלול','תשרי','חשון','כסלו','טבת','שבט','אדר'],
  monthsLeap: ['ניסן','אייר','סיון','תמוז','אב','אלול','תשרי','חשון','כסלו','טבת','שבט','אדר א׳','אדר ב׳'],
  days: ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'],
  toHebrew(n) {
    const o = ['', 'א','ב','ג','ד','ה','ו','ז','ח','ט'], t = ['', 'י','כ','ל','מ','נ','ס','ע','פ','צ'];
    if (n < 10) return o[n];
    if (n === 15) return 'ט״ו';
    if (n === 16) return 'ט״ז';
    return t[Math.floor(n/10)] + (n%10 ? '״' + o[n%10] : '');
  },
  isLeapYear(y) {
    return (y % 19 === 0 || y % 19 === 3 || y % 19 === 6 || y % 19 === 8 || y % 19 === 11 || y % 19 === 14 || y % 19 === 17);
  },
  getDate(date = new Date()) {
    const ref = new Date(2023, 8, 16); // Tishrei 1, 5784
    let y = 5784, m = 7, d = 1 + Math.floor((date - ref) / 86400000);
    let ml = [29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30];
    const isLeap = this.isLeapYear(y);
    if (isLeap) ml.splice(11, 0, 30); // Add Adar I
    while (d > ml[m-1]) { d -= ml[m-1]; m++; if (m > (isLeap ? 13 : 12)) { m = 1; y++; ml = [29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30]; if (this.isLeapYear(y)) ml.splice(11, 0, 30); } }
    while (d < 1) { m--; if (m < 1) { m = this.isLeapYear(y-1) ? 13 : 12; y--; } d += ml[m-1]; }
    const dow = date.getDay();
    let special = null;
    const monthName = isLeap ? this.monthsLeap[m-1] : this.months[m-1];
    if (m===7 && d<=2) special = 'ראש השנה';
    else if (m===7 && d===10) special = 'יום הכיפורים';
    else if (m===7 && d>=15 && d<=22) special = 'סוכות';
    else if (m===1 && d>=15 && d<=22) special = 'פסח';
    else if (m===3 && (d===6||d===7)) special = 'שבועות';
    return {
      year: y, month: m, day: d,
      monthName,
      dayName: 'יום ' + this.days[dow],
      isShabbos: dow === 6,
      isRoshChodesh: d === 1 || d === 30,
      formatted: this.toHebrew(d) + ' ' + monthName + ' ' + y,
      special
    };
  }
};

const Korbanos = {
  getDaily(hd) {
    const list = [
      { name: 'תמיד של שחר', en: 'Morning Tamid', desc: 'כבש בן שנתו עולה', type: 'עולה' },
      { name: 'קטורת הבוקר', en: 'Morning Ketores', desc: 'על מזבח הזהב', type: 'קטורת' },
      { name: 'תמיד של בין הערביים', en: 'Afternoon Tamid', desc: 'כבש בן שנתו עולה', type: 'עולה' },
      { name: 'קטורת בין הערביים', en: 'Afternoon Ketores', desc: 'על מזבח הזהב', type: 'קטורת' }
    ];
    if (hd.isShabbos) list.push({ name: 'מוסף שבת', en: 'Shabbos Musaf', desc: 'ב׳ כבשים בני שנה', type: 'עולה' });
    if (hd.isRoshChodesh) list.push({ name: 'מוסף ראש חודש', en: 'Rosh Chodesh Musaf', desc: 'ב׳ פרים, איל, ז׳ כבשים', type: 'עולה' });
    if (hd.special === 'יום הכיפורים') {
      list.push({ name: 'פר כהן גדול', en: "Kohen Gadol's Bull", desc: 'חטאת לכפרה', type: 'חטאת' });
      list.push({ name: 'שעיר לה׳', en: 'Goat for Hashem', desc: 'הגורל עלה לה׳', type: 'חטאת' });
    }
    return list;
  }
};

// ============================================================================
// TEXTURE FACTORY - 30 REALISTIC TEXTURES
// ============================================================================
class TextureFactory {
  constructor() {
    this.cache = new Map();
    this.size = 1024;
  }

  perlin(w, h, scale = 1, octaves = 4, persistence = 0.5) {
    const perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) perm[i] = perm[i + 256] = Math.floor(Math.random() * 256);
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
      img.data[i*4] = Math.min(255, Math.max(0, 228 + v + Math.random() * 10));
      img.data[i*4+1] = Math.min(255, Math.max(0, 215 + v + Math.random() * 8));
      img.data[i*4+2] = Math.min(255, Math.max(0, 195 + v + Math.random() * 6));
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
          const sx = bx + 15 + Math.random() * (bw - 30), sy = y + 15 + Math.random() * (bh - 30), sr = Math.random() * 12 + 4;
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
          g.addColorStop(0, `rgba(${160+Math.random()*40},${150+Math.random()*40},${130+Math.random()*40},0.35)`);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
        }
      }
    }
    const tex = new THREE.CanvasTexture(c);
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
      ctx.strokeStyle = `rgba(255,240,180,${0.03 + Math.random() * 0.04})`;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y + (Math.random() - 0.5) * 2); ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * 512, y = Math.random() * 512, r = Math.random() * 60 + 20;
      const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, 'rgba(255,255,230,0.4)');
      gg.addColorStop(1, 'transparent');
      ctx.fillStyle = gg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const tex = new THREE.CanvasTexture(c);
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
    const tex = new THREE.CanvasTexture(c);
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
      const x = Math.random() * 512, y = Math.random() * 512;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 12);
      g.addColorStop(0, 'rgba(230,150,100,0.25)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
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
        img.data[i*4+1] = 120 + (p - 0.55) * 160 + Math.random() * 20;
        img.data[i*4+2] = 90 + (p - 0.55) * 120;
      } else {
        img.data[i*4] = 160 + b * 40;
        img.data[i*4+1] = 90 + b * 30;
        img.data[i*4+2] = 55 + b * 20;
      }
      img.data[i*4+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  cedarWood() {
    const c = this.createCanvas(512, 512), ctx = c.getContext('2d');
    ctx.fillStyle = '#8B4226';
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y++) {
      const l = 30 + Math.sin(y * 0.02) * 15 + Math.sin(y * 0.07) * 8 + Math.sin(y * 0.15) * 4;
      ctx.strokeStyle = `hsl(${15 + Math.sin(y * 0.01) * 5}, 70%, ${l + Math.random() * 5}%)`;
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x < 512; x += 8) ctx.lineTo(x, y + (Math.random() - 0.5) * 1.5);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(50,25,10,0.12)';
    ctx.lineWidth = 2;
    for (let r = 0; r < 5; r++) {
      ctx.beginPath();
      ctx.arc(256 + (Math.random() - 0.5) * 300, -200 + r * 180, 350 + r * 60, 0.4, 2.7);
      ctx.stroke();
    }
    for (let k = 0; k < 2; k++) {
      const kx = 100 + Math.random() * 312, ky = 100 + Math.random() * 312;
      const g = ctx.createRadialGradient(kx, ky, 0, kx, ky, 20);
      g.addColorStop(0, '#1A0A05');
      g.addColorStop(0.4, '#3D1A0D');
      g.addColorStop(1, '#8B4226');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(kx, ky, 20, 12, Math.random() * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  acaciaWood() {
    const c = this.createCanvas(512, 512), ctx = c.getContext('2d');
    ctx.fillStyle = '#6B4423';
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y++) {
      const l = 28 + Math.sin(y * 0.025) * 12 + Math.sin(y * 0.1) * 6;
      ctx.strokeStyle = `hsl(25, 60%, ${l + Math.random() * 4}%)`;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y + (Math.random() - 0.5)); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(30,15,5,0.35)';
    ctx.lineWidth = 3;
    for (let s = 0; s < 6; s++) {
      ctx.beginPath();
      let x = Math.random() * 512, y = 0;
      ctx.moveTo(x, y);
      while (y < 512) { y += Math.random() * 30 + 10; x += (Math.random() - 0.5) * 20; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
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
        let x = Math.random() * this.size, y = Math.random() * this.size;
        ctx.moveTo(x, y);
        for (let s = 0; s < 20; s++) { x += (Math.random() - 0.5) * 45; y += (Math.random() - 0.5) * 45; ctx.lineTo(x, y); }
        ctx.stroke();
      }
    };
    drawVeins('rgba(160,155,165,0.25)', 3, 6);
    drawVeins('rgba(140,135,145,0.2)', 2, 12);
    drawVeins('rgba(180,175,185,0.15)', 1, 15);
    const tex = new THREE.CanvasTexture(c);
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
      let x = Math.random() * this.size, y = Math.random() * this.size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 15; s++) { x += (Math.random() - 0.5) * 35; y += (Math.random() - 0.5) * 35; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
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
    const tex = new THREE.CanvasTexture(c);
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
    const tex = new THREE.CanvasTexture(c);
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
    const tex = new THREE.CanvasTexture(c);
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
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  groundSand() {
    const c = this.createCanvas(), ctx = c.getContext('2d');
    const noise = this.perlin(this.size, this.size, 8, 5, 0.6);
    const img = ctx.createImageData(this.size, this.size);
    for (let i = 0; i < noise.length; i++) {
      const n = noise[i];
      img.data[i*4] = 200 + n * 40 + Math.random() * 10;
      img.data[i*4+1] = 180 + n * 35 + Math.random() * 8;
      img.data[i*4+2] = 140 + n * 30 + Math.random() * 6;
      img.data[i*4+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 150; i++) {
      const x = Math.random() * this.size, y = Math.random() * this.size, s = Math.random() * 5 + 2;
      ctx.fillStyle = `hsl(30,${20+Math.random()*20}%,${40+Math.random()*30}%)`;
      ctx.beginPath();
      ctx.ellipse(x, y, s, s * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
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
        const x = col * ts, y = row * ts, v = Math.random() * 20 - 10;
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
    const tex = new THREE.CanvasTexture(c);
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
    const tex = new THREE.CanvasTexture(c);
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
      const y = Math.random() * 256;
      ctx.moveTo(0, y);
      for (let x = 0; x < 256; x += 10) ctx.lineTo(x, y + Math.sin(x * 0.1) * 3);
      ctx.stroke();
    }
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.35})`;
      ctx.beginPath(); ctx.arc(Math.random() * 256, Math.random() * 256, 2, 0, Math.PI * 2); ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  sheepWool() {
    const c = this.createCanvas(128, 128), ctx = c.getContext('2d');
    ctx.fillStyle = '#F5F5DC';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = `rgba(${240+Math.random()*15},${235+Math.random()*15},${215+Math.random()*20},0.75)`;
      ctx.beginPath();
      ctx.arc(Math.random() * 128, Math.random() * 128, Math.random() * 7 + 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
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
    const tex = new THREE.CanvasTexture(c);
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
    const tex = new THREE.CanvasTexture(c);
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
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  get(name) {
    if (this.cache.has(name)) return this.cache.get(name);
    const tex = this[name]?.();
    if (tex) this.cache.set(name, tex);
    return tex;
  }
}

// ============================================================================
// CHARACTER SYSTEM
// ============================================================================
class CharacterSystem {
  constructor(scene, tex) {
    this.scene = scene;
    this.tex = tex;
    this.kohanim = [];
    this.animals = [];
    this.time = 0;
  }

  createKohen(x, y, z, isKG = false) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ map: this.tex.get('whiteLinen'), roughness: 0.8 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xE8C4A0, roughness: 0.7 });

    // Torso
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.9, 8), bodyMat));
    g.children[0].position.y = 1.1;

    // Head
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), skinMat));
    g.children[1].position.y = 1.75;

    // Hat (Migba'as)
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.2, 12), bodyMat));
    g.children[2].position.y = 1.95;

    // Belt (Avnet)
    const beltMat = new THREE.MeshStandardMaterial({ color: isKG ? 0xFFD700 : 0xFFFFFF, roughness: 0.6 });
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 12), beltMat));
    g.children[3].position.y = 0.75;

    // Legs
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.7, 8), bodyMat));
    g.children[4].position.y = 0.35;

    // Arms
    [-0.35, 0.35].forEach(side => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6), bodyMat);
      arm.position.set(side, 1.1, 0);
      arm.rotation.z = side > 0 ? -0.3 : 0.3;
      g.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), skinMat);
      hand.position.set(side * 1.2, 0.9, 0);
      g.add(hand);
    });

    if (isKG) {
      // Me'il (blue robe)
      const meilMat = new THREE.MeshStandardMaterial({ map: this.tex.get('techeiles'), roughness: 0.8 });
      const meil = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.2, 12), meilMat);
      meil.position.y = 0.6;
      g.add(meil);

      // Ephod
      const ephodMat = new THREE.MeshStandardMaterial({ map: this.tex.get('goldEngraved'), roughness: 0.3, metalness: 0.7 });
      const ephod = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.1), ephodMat);
      ephod.position.set(0, 1.2, 0.2);
      g.add(ephod);

      // Choshen
      const choshen = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05),
        new THREE.MeshStandardMaterial({ map: this.tex.get('goldPolished'), roughness: 0.2, metalness: 0.9 }));
      choshen.position.set(0, 1.15, 0.28);
      g.add(choshen);

      // 12 stones
      const stoneColors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF, 0xFFA500, 0x800080, 0x008000, 0x000080, 0x808000, 0x800000];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 3; c++) {
          const stone = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02),
            new THREE.MeshStandardMaterial({ color: stoneColors[r * 3 + c], roughness: 0.2, metalness: 0.3 }));
          stone.position.set(-0.08 + c * 0.08, 1.22 - r * 0.07, 0.31);
          g.add(stone);
        }
      }

      // Tzitz
      const tzitz = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.02),
        new THREE.MeshStandardMaterial({ map: this.tex.get('goldPolished'), roughness: 0.1, metalness: 0.95 }));
      tzitz.position.set(0, 1.88, 0.15);
      g.add(tzitz);

      // Mitznefes (turban)
      const turban = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat);
      turban.position.y = 1.9;
      g.add(turban);
    }

    g.position.set(x, y, z);
    g.userData = { type: 'kohen', isKG, baseX: x, baseY: y, baseZ: z, phase: Math.random() * Math.PI * 2, walkRadius: Math.random() * 3 + 2 };
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    this.scene.add(g);
    this.kohanim.push(g);
    return g;
  }

  createAnimal(type, x, z) {
    const g = new THREE.Group();
    let color, size, legH;
    switch(type) {
      case 'sheep': color = 0xF5F5DC; size = { x: 0.5, y: 0.35, z: 0.8 }; legH = 0.3; break;
      case 'goat': color = 0x8B7355; size = { x: 0.45, y: 0.4, z: 0.75 }; legH = 0.35; break;
      case 'bull': color = 0x5C4033; size = { x: 0.8, y: 0.6, z: 1.4 }; legH = 0.5; break;
      default: return null;
    }
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const bodyMat = type === 'sheep' ? new THREE.MeshStandardMaterial({ map: this.tex.get('sheepWool'), roughness: 0.95 }) : mat;

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), bodyMat);
    body.position.y = legH + size.y / 2;
    g.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(size.x * 0.5, size.y * 0.6, size.z * 0.3), mat);
    head.position.set(0, legH + size.y * 0.8, size.z * 0.55);
    g.add(head);

    // Legs
    const legGeo = new THREE.CylinderGeometry(size.x * 0.1, size.x * 0.08, legH, 6);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = new THREE.Mesh(legGeo, mat);
      leg.position.set(sx * size.x * 0.35, legH / 2, sz * size.z * 0.35);
      g.add(leg);
    });

    // Horns for goat/bull
    if (type === 'goat' || type === 'bull') {
      const hornMat = new THREE.MeshStandardMaterial({ color: 0x3D3D3D, roughness: 0.6 });
      [-1, 1].forEach(side => {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, type === 'bull' ? 0.3 : 0.2, 6), hornMat);
        horn.position.set(side * size.x * 0.25, legH + size.y + 0.1, size.z * 0.45);
        horn.rotation.x = type === 'bull' ? 0.5 : -0.3;
        horn.rotation.z = side * 0.3;
        g.add(horn);
      });
    }

    // Tail
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.01, 0.25, 6), mat);
    tail.position.set(0, legH + size.y * 0.3, -size.z * 0.5);
    tail.rotation.x = 0.5;
    g.add(tail);

    g.position.set(x, 0, z);
    g.userData = { type: 'animal', animalType: type, baseX: x, baseZ: z, phase: Math.random() * Math.PI * 2, wanderRadius: 2 + Math.random() * 3 };
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    this.scene.add(g);
    this.animals.push(g);
    return g;
  }

  createDove(x, y, z) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xE8E8E8, roughness: 0.7 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mat);
    body.scale.set(1, 0.8, 1.3);
    g.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), mat);
    head.position.set(0, 0.05, 0.1);
    g.add(head);

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.04, 4), new THREE.MeshStandardMaterial({ color: 0xFFA500 }));
    beak.position.set(0, 0.04, 0.14);
    beak.rotation.x = Math.PI / 2;
    g.add(beak);

    [-1, 1].forEach(side => {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.01, 0.1), mat);
      wing.position.set(side * 0.1, 0, 0);
      wing.rotation.z = side * 0.3;
      wing.userData.isWing = true;
      wing.userData.side = side;
      g.add(wing);
    });

    g.position.set(x, y, z);
    g.userData = { type: 'dove', baseY: y, phase: Math.random() * Math.PI * 2, circleRadius: 3 + Math.random() * 5, circleSpeed: 0.3 + Math.random() * 0.3 };
    this.scene.add(g);
    this.animals.push(g);
    return g;
  }

  update(delta) {
    this.time += delta;

    this.kohanim.forEach(k => {
      const d = k.userData, t = this.time * 0.3 + d.phase;
      k.position.x = d.baseX + Math.sin(t) * d.walkRadius * 0.3;
      k.position.z = d.baseZ + Math.cos(t * 0.7) * d.walkRadius * 0.3;
      k.rotation.y = Math.atan2(Math.cos(t) * 0.3, -Math.sin(t * 0.7) * 0.3);
      k.position.y = d.baseY + Math.sin(t * 4) * 0.02;
    });

    this.animals.forEach(a => {
      const d = a.userData;
      if (d.type === 'dove') {
        const t = this.time * d.circleSpeed + d.phase;
        a.position.x = d.baseY + Math.cos(t) * d.circleRadius;
        a.position.z = Math.sin(t) * d.circleRadius;
        a.position.y = d.baseY + Math.sin(t * 2) * 0.5;
        a.rotation.y = -t + Math.PI / 2;
        a.children.forEach(c => { if (c.userData.isWing) c.rotation.z = c.userData.side * (0.3 + Math.sin(this.time * 15) * 0.4); });
      } else {
        const t = this.time * 0.2 + d.phase;
        a.position.x = d.baseX + Math.sin(t) * d.wanderRadius;
        a.position.z = d.baseZ + Math.cos(t * 0.8) * d.wanderRadius;
        a.rotation.y = Math.atan2(Math.cos(t), -Math.sin(t * 0.8));
      }
    });
  }
}

// ============================================================================
// PARTICLE SYSTEM
// ============================================================================
class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.systems = [];
  }

  createFire(x, y, z, size = 1) {
    const count = 80;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const vel = [];

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * size;
      pos[i * 3 + 1] = Math.random() * size * 2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * size;
      const t = pos[i * 3 + 1] / (size * 2);
      col[i * 3] = 1;
      col[i * 3 + 1] = 0.5 - t * 0.3;
      col[i * 3 + 2] = 0;
      vel.push(new THREE.Vector3((Math.random() - 0.5) * 0.5, 1 + Math.random() * 2, (Math.random() - 0.5) * 0.5));
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({ size: 0.25, vertexColors: true, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    pts.position.set(x, y, z);
    pts.userData = { vel, size };
    this.scene.add(pts);
    this.systems.push({ type: 'fire', mesh: pts });

    const light = new THREE.PointLight(0xFF6622, 2, 20);
    light.position.set(x, y + size, z);
    this.scene.add(light);
    this.systems.push({ type: 'fireLight', mesh: light, baseIntensity: 2 });
    return pts;
  }

  createSmoke(x, y, z, size = 0.5) {
    const count = 25;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * size;
      pos[i * 3 + 1] = Math.random() * size * 3;
      pos[i * 3 + 2] = (Math.random() - 0.5) * size;
      vel.push(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.2));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ size: 0.35, color: 0x888888, transparent: true, opacity: 0.25, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    pts.position.set(x, y, z);
    pts.userData = { vel, size };
    this.scene.add(pts);
    this.systems.push({ type: 'smoke', mesh: pts });
    return pts;
  }

  update(delta) {
    this.systems.forEach(s => {
      if (s.type === 'fire') {
        const pos = s.mesh.geometry.attributes.position.array;
        const col = s.mesh.geometry.attributes.color.array;
        const { vel, size } = s.mesh.userData;
        for (let i = 0; i < vel.length; i++) {
          pos[i * 3] += vel[i].x * delta;
          pos[i * 3 + 1] += vel[i].y * delta;
          pos[i * 3 + 2] += vel[i].z * delta;
          if (pos[i * 3 + 1] > size * 3) { pos[i * 3] = (Math.random() - 0.5) * size; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = (Math.random() - 0.5) * size; }
          const t = pos[i * 3 + 1] / (size * 3);
          col[i * 3] = 1; col[i * 3 + 1] = Math.max(0, 0.5 - t * 0.5); col[i * 3 + 2] = 0;
        }
        s.mesh.geometry.attributes.position.needsUpdate = true;
        s.mesh.geometry.attributes.color.needsUpdate = true;
      }
      if (s.type === 'fireLight') s.mesh.intensity = s.baseIntensity + Math.sin(Date.now() * 0.01) * 0.5;
      if (s.type === 'smoke') {
        const pos = s.mesh.geometry.attributes.position.array;
        const { vel, size } = s.mesh.userData;
        for (let i = 0; i < vel.length; i++) {
          pos[i * 3] += vel[i].x * delta + (Math.random() - 0.5) * 0.1;
          pos[i * 3 + 1] += vel[i].y * delta;
          pos[i * 3 + 2] += vel[i].z * delta + (Math.random() - 0.5) * 0.1;
          if (pos[i * 3 + 1] > size * 6) { pos[i * 3] = (Math.random() - 0.5) * size; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = (Math.random() - 0.5) * size; }
        }
        s.mesh.geometry.attributes.position.needsUpdate = true;
      }
    });
  }
}

// ============================================================================
// TEMPLE BUILDER
// ============================================================================
class TempleBuilder {
  constructor(scene, tex) {
    this.scene = scene;
    this.tex = tex;
    this.floors = [];
    this.walls = [];
    this.createMaterials();
  }

  createMaterials() {
    this.mat = {
      stone: new THREE.MeshStandardMaterial({ map: this.tex.get('jerusalemStone'), normalMap: this.tex.normalMap(), roughness: 0.85, metalness: 0.05 }),
      stonePolished: new THREE.MeshStandardMaterial({ map: this.tex.get('jerusalemStone'), roughness: 0.4, metalness: 0.1 }),
      gold: new THREE.MeshStandardMaterial({ map: this.tex.get('goldPolished'), roughness: 0.15, metalness: 0.95 }),
      goldEng: new THREE.MeshStandardMaterial({ map: this.tex.get('goldEngraved'), roughness: 0.25, metalness: 0.9 }),
      copper: new THREE.MeshStandardMaterial({ map: this.tex.get('copper'), roughness: 0.35, metalness: 0.85 }),
      copperP: new THREE.MeshStandardMaterial({ map: this.tex.get('copperPatina'), roughness: 0.5, metalness: 0.7 }),
      cedar: new THREE.MeshStandardMaterial({ map: this.tex.get('cedarWood'), roughness: 0.7, metalness: 0.05 }),
      acacia: new THREE.MeshStandardMaterial({ map: this.tex.get('acaciaWood'), roughness: 0.65, metalness: 0.05 }),
      marbleW: new THREE.MeshStandardMaterial({ map: this.tex.get('marbleWhite'), roughness: 0.2, metalness: 0.1 }),
      marbleR: new THREE.MeshStandardMaterial({ map: this.tex.get('marbleRose'), roughness: 0.25, metalness: 0.1 }),
      paroches: new THREE.MeshStandardMaterial({ map: this.tex.get('paroches'), roughness: 0.85, metalness: 0.1, side: THREE.DoubleSide }),
      ground: new THREE.MeshStandardMaterial({ map: this.tex.get('groundSand'), roughness: 0.95 }),
      floor: new THREE.MeshStandardMaterial({ map: this.tex.get('floorTiles'), roughness: 0.6 }),
      mosaic: new THREE.MeshStandardMaterial({ map: this.tex.get('mosaic'), roughness: 0.5 }),
      water: new THREE.MeshStandardMaterial({ map: this.tex.get('water'), roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.8 }),
      altar: new THREE.MeshStandardMaterial({ color: 0x5A4A40, roughness: 0.9 })
    };
    this.tex.get('jerusalemStone').repeat.set(4, 4);
    this.tex.get('floorTiles').repeat.set(8, 8);
    this.tex.get('marbleWhite').repeat.set(4, 4);
  }

  addFloor(x, y, z, w, d, mat, name) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), mat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.userData = { isFloor: true, name };
    this.scene.add(m);
    this.floors.push(m);
    return m;
  }

  addWall(x, y, z, w, h, d, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h/2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData = { isWall: true };
    this.scene.add(m);
    this.walls.push(m);
    return m;
  }

  addStairs(x, y, z, w, totalH, d, steps, mat, dir = 'north') {
    const sh = totalH / steps, sd = d / steps;
    for (let i = 0; i < steps; i++) {
      const sy = y + i * sh + sh/2, sz = dir === 'north' ? z - i * sd : z + i * sd;
      const step = new THREE.Mesh(new THREE.BoxGeometry(w, sh, sd), mat);
      step.position.set(x, sy, sz);
      step.receiveShadow = true;
      step.castShadow = true;
      step.userData = { isFloor: true, isStep: true };
      this.scene.add(step);
      this.floors.push(step);
    }
  }

  addColumn(x, y, z, r, h, mat) {
    const g = new THREE.Group();
    // Base
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(r*1.3, r*1.4, h*0.06, 16), mat));
    g.children[0].position.y = h * 0.03;
    // Shaft with entasis
    const pts = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector2(r * (1 + Math.sin(t * Math.PI) * 0.04) * (1 - t * 0.08), t * h * 0.88)); }
    g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 16), mat));
    g.children[1].position.y = h * 0.06;
    // Capital
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(r*1.2, r*0.95, h*0.06, 16), mat));
    g.children[2].position.y = h * 0.94;
    g.position.set(x, y, z);
    g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    this.scene.add(g);
    return g;
  }

  build() {
    this.buildEnv();
    this.buildHarHaBayis();
    this.buildOuterWalls();
    this.buildEzrasNashim();
    this.buildAzaros();
    this.buildHeichal();
    this.buildKodeshHakodashim();
    this.buildKeilim();
    this.buildLighting();
    return { floors: this.floors, walls: this.walls };
  }

  buildEnv() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500, 50, 50), this.mat.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData = { isFloor: true };
    this.scene.add(ground);
    this.floors.push(ground);

    const skyGeo = new THREE.SphereGeometry(CONFIG.RENDER_DISTANCE, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: { topColor: { value: new THREE.Color(0x4A90C8) }, bottomColor: { value: new THREE.Color(0xD4E4F4) }, sunPos: { value: new THREE.Vector3(0.5, 0.3, 0.5).normalize() } },
      vertexShader: `varying vec3 vPos; void main() { vPos = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 topColor, bottomColor, sunPos; varying vec3 vPos; void main() { vec3 dir = normalize(vPos); float h = dir.y * 0.5 + 0.5; vec3 sky = mix(bottomColor, topColor, pow(h, 0.6)); float sun = max(0.0, dot(dir, sunPos)); sky += vec3(1.0,0.98,0.9) * pow(sun, 32.0) * 0.5 + pow(sun, 4.0) * 0.2; gl_FragColor = vec4(sky, 1.0); }`,
      side: THREE.BackSide
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2, dist = 180 + Math.random() * 40, height = 15 + Math.random() * 25;
      const m = new THREE.Mesh(new THREE.ConeGeometry(30 + Math.random() * 20, height, 6), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.1, 0.2, 0.5 + Math.random() * 0.1), roughness: 0.9 }));
      m.position.set(Math.cos(angle) * dist, height/2 - 5, Math.sin(angle) * dist);
      m.rotation.y = Math.random() * Math.PI;
      this.scene.add(m);
    }
  }

  buildHarHaBayis() {
    // Main platform - the Temple Mount floor
    // This is the large plaza inside the outer walls
    this.addFloor(0, 1.8, 22, 140, 88, this.mat.floor, 'har-habayis');

    // Fill underneath the platform to make it solid (not floating)
    const platformFill = new THREE.Mesh(
      new THREE.BoxGeometry(140, 1.8, 88),
      this.mat.stone
    );
    platformFill.position.set(0, 0.9, 22);
    platformFill.receiveShadow = true;
    this.scene.add(platformFill);
    
    // Stairs from ground (y=0) up to Har HaBayis (y=1.8) through the Chuldah Gates
    // Left gate stairs (centered at x=-27)
    this.addStairs(-27, 0, 74, 12, 1.8, 8, 9, this.mat.stone, 'north');
    // Right gate stairs (centered at x=27)
    this.addStairs(27, 0, 74, 12, 1.8, 8, 9, this.mat.stone, 'north');
  }

  buildOuterWalls() {
    const wallH = 24;
    const wallThick = 5;
    const southZ = 68; // South wall position
    const northZ = -22; // North wall position
    const eastX = 72;
    const westX = -72;
    
    // === SOUTH WALL with two Chuldah Gate openings ===
    // Gate openings: 10 units wide, 6 units tall (walkable height)
    // Left gate centered at x=-27, Right gate centered at x=27
    
    // Far left section (from west to left gate)
    this.addWall(-50, 0, southZ, 44, wallH, wallThick, this.mat.stone);
    
    // Section between gates
    this.addWall(0, 0, southZ, 44, wallH, wallThick, this.mat.stone);
    
    // Far right section (from right gate to east)
    this.addWall(50, 0, southZ, 44, wallH, wallThick, this.mat.stone);
    
    // Gate lintels (above the openings)
    this.addWall(-27, 6, southZ, 10, wallH - 6, wallThick, this.mat.stone);
    this.addWall(27, 6, southZ, 10, wallH - 6, wallThick, this.mat.stone);
    
    // === NORTH WALL - solid ===
    this.addWall(0, 0, northZ, 144, wallH, wallThick, this.mat.stone);
    
    // === EAST WALL - solid ===
    this.addWall(eastX, 0, 23, wallThick, wallH, 90, this.mat.stone);
    
    // === WEST WALL - solid ===
    this.addWall(westX, 0, 23, wallThick, wallH, 90, this.mat.stone);
    
    // === Crenellations on top ===
    for (let i = -68; i <= 68; i += 8) {
      if (Math.abs(Math.abs(i) - 27) > 6) { // Skip over gate areas
        this.addWall(i, wallH, southZ, 3, 3, wallThick + 0.5, this.mat.stone);
      }
      this.addWall(i, wallH, northZ, 3, 3, wallThick + 0.5, this.mat.stone);
    }
    for (let z = northZ + 5; z <= southZ - 5; z += 8) {
      this.addWall(eastX, wallH, z, wallThick + 0.5, 3, 3, this.mat.stone);
      this.addWall(westX, wallH, z, wallThick + 0.5, 3, 3, this.mat.stone);
    }
    
    // === Guard towers at corners ===
    [[westX, southZ], [eastX, southZ], [westX, northZ], [eastX, northZ]].forEach(([tx, tz]) => {
      // Tower base - solid from ground
      const tower = new THREE.Mesh(new THREE.BoxGeometry(10, wallH + 8, 10), this.mat.stone);
      tower.position.set(tx, (wallH + 8) / 2, tz);
      tower.castShadow = true;
      tower.receiveShadow = true;
      this.scene.add(tower);
      // Tower roof
      const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 5, 4), this.mat.stonePolished);
      roof.position.set(tx, wallH + 8 + 2.5, tz);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      this.scene.add(roof);
    });
  }

  buildEzrasNashim() {
    // Court of the Women - based on historical layout
    const floorY = 3.8;
    const harHaBayisY = 1.8;
    const wallH = 14;
    const courtWidth = 66;  // 135 amos
    const courtDepth = 50;
    const southZ = 58;
    const northZ = southZ - courtDepth; // 8
    const centerZ = (southZ + northZ) / 2;
    
    // === MAIN FLOOR ===
    this.addFloor(0, floorY, centerZ, courtWidth, courtDepth, this.mat.mosaic, 'ezras-nashim');
    
    // Solid fill under floor
    const floorFill = new THREE.Mesh(
      new THREE.BoxGeometry(courtWidth, floorY - harHaBayisY, courtDepth),
      this.mat.stone
    );
    floorFill.position.set(0, harHaBayisY + (floorY - harHaBayisY) / 2, centerZ);
    floorFill.receiveShadow = true;
    this.scene.add(floorFill);
    
    // === ENTRANCE STAIRS (Beautiful Gate / Sha'ar HaYafeh) ===
    this.addStairs(0, harHaBayisY, southZ + 4, 16, floorY - harHaBayisY, 6, 12, this.mat.stone, 'north');
    
    // === WALLS ===
    // South wall with Beautiful Gate
    this.addWall(-24, floorY, southZ, 18, wallH, 2, this.mat.stonePolished);
    this.addWall(24, floorY, southZ, 18, wallH, 2, this.mat.stonePolished);
    this.addWall(0, floorY + 8, southZ, 12, wallH - 8, 2, this.mat.stonePolished);
    // Gate decorative frame
    this.addGateFrame(0, floorY, southZ, 12, 8, this.mat.copperP, 'Beautiful Gate');
    
    // Side walls with gates
    // East wall
    this.addWall(33, floorY, 45, 2, wallH, 24, this.mat.stonePolished);
    this.addWall(33, floorY, 21, 2, wallH, 24, this.mat.stonePolished);
    this.addWall(33, floorY + 5, 33, 2, wallH - 5, 5, this.mat.stonePolished); // lintel
    // West wall  
    this.addWall(-33, floorY, 45, 2, wallH, 24, this.mat.stonePolished);
    this.addWall(-33, floorY, 21, 2, wallH, 24, this.mat.stonePolished);
    this.addWall(-33, floorY + 5, 33, 2, wallH - 5, 5, this.mat.stonePolished); // lintel

    // === FOUR CORNER CHAMBERS ===
    const chambers = [
      { pos: [-27, 52], name: 'לשכת השמנים', nameEn: 'Chamber of Oils' },      // SW
      { pos: [27, 52], name: 'לשכת המצורעים', nameEn: 'Chamber of Lepers' },   // SE
      { pos: [-27, 14], name: 'לשכת הנזירים', nameEn: 'Chamber of Nazarites' }, // NW
      { pos: [27, 14], name: 'לשכת העצים', nameEn: 'Chamber of Wood' }          // NE
    ];
    
    chambers.forEach(ch => {
      // Chamber building
      const chamber = new THREE.Mesh(new THREE.BoxGeometry(12, 10, 12), this.mat.stonePolished);
      chamber.position.set(ch.pos[0], floorY + 5, ch.pos[1]);
      chamber.castShadow = true;
      chamber.receiveShadow = true;
      chamber.userData = { name: ch.name, nameEn: ch.nameEn };
      this.scene.add(chamber);
      
      // Roof
      const roof = new THREE.Mesh(new THREE.ConeGeometry(9, 4, 4), this.mat.stone);
      roof.position.set(ch.pos[0], floorY + 12, ch.pos[1]);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      this.scene.add(roof);
      
      // Doorway cutout (visual)
      const door = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1), this.mat.cedar);
      const doorZ = ch.pos[1] > 30 ? ch.pos[1] - 6 : ch.pos[1] + 6;
      door.position.set(ch.pos[0], floorY + 2, doorZ);
      this.scene.add(door);
    });
    
    // === COLONNADE around the court ===
    for (let x = -24; x <= 24; x += 6) {
      this.addColumn(x, floorY, southZ - 3, 0.5, 10, this.mat.marbleW);
    }
    for (let z = 16; z <= 50; z += 6) {
      this.addColumn(-30, floorY, z, 0.5, 10, this.mat.marbleW);
      this.addColumn(30, floorY, z, 0.5, 10, this.mat.marbleW);
    }
    
    // === NICANOR GATE (north wall with 15 steps) ===
    // Bronze-plated gates from Alexandria
    this.addWall(-26, floorY, northZ, 20, wallH, 2, this.mat.stonePolished);
    this.addWall(26, floorY, northZ, 20, wallH, 2, this.mat.stonePolished);
    this.addWall(0, floorY + 10, northZ, 14, wallH - 10, 2, this.mat.stonePolished);
    
    // Nicanor Gate frame (copper/bronze)
    this.addGateFrame(0, floorY, northZ, 14, 10, this.mat.copper, 'Nicanor Gate');
    
    // === 15 SEMICIRCULAR STEPS (Shir HaMaalos) ===
    const stepsRise = 3.0;
    for (let i = 0; i < 15; i++) {
      const stepY = floorY + (i / 15) * stepsRise;
      const stepZ = northZ - 1 - i;
      const stepWidth = 44 - i * 0.5; // Slightly narrower as we go up
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(stepWidth, 0.2, 1),
        this.mat.marbleW
      );
      stepMesh.position.set(0, stepY + 0.1, stepZ);
      stepMesh.receiveShadow = true;
      stepMesh.userData = { isFloor: true, isStep: true, stepNum: i + 1 };
      this.scene.add(stepMesh);
      this.floors.push(stepMesh);
    }
  }
  
  addGateFrame(x, y, z, width, height, mat, name) {
    // Decorative gate frame
    const frameThick = 0.8;
    // Left pillar
    const left = new THREE.Mesh(new THREE.BoxGeometry(frameThick, height, frameThick), mat);
    left.position.set(x - width/2 + frameThick/2, y + height/2, z - 0.5);
    left.castShadow = true;
    this.scene.add(left);
    // Right pillar
    const right = new THREE.Mesh(new THREE.BoxGeometry(frameThick, height, frameThick), mat);
    right.position.set(x + width/2 - frameThick/2, y + height/2, z - 0.5);
    right.castShadow = true;
    this.scene.add(right);
    // Top beam
    const top = new THREE.Mesh(new THREE.BoxGeometry(width, frameThick, frameThick), mat);
    top.position.set(x, y + height - frameThick/2, z - 0.5);
    top.castShadow = true;
    this.scene.add(top);
  }

  buildAzaros() {
    // COMPLETE LAYOUT - all coordinates connect seamlessly:
    // 15 steps end at z=-7, y=6.8
    // Azaras Yisrael: z=-7 to z=-11 (4 units)
    // Duchan: z=-11 to z=-13 (2 units)  
    // Azaras Kohanim: z=-13 to z=-45 (32 units)
    // North wall at z=-45, gate leads to 12 steps up to Ulam
    // Ulam starts at z=-45 (12 steps from z=-45 to z=-48)
    
    const yisraelY = 6.8;
    const duchanY = 7.0;
    const kohanimY = 7.3;
    const baseY = 3.8; // Ezras Nashim level
    const wallH = 14;
    const innerWidth = 52;
    
    // === AZARAS YISRAEL (Court of Israelites) ===
    // z=-7 to z=-11 (4 units deep)
    this.addFloor(0, yisraelY, -9, innerWidth, 4, this.mat.marbleW, 'azaras-yisrael');
    this.addSolidFill(0, baseY, yisraelY, -9, innerWidth, 4);
    
    // === DUCHAN (Levite Platform) ===
    // z=-11 to z=-13 (2 units deep), slightly raised
    this.addFloor(0, duchanY, -12, innerWidth - 6, 2, this.mat.marbleR, 'duchan');
    this.addStepRow(0, yisraelY, -11, innerWidth - 6, duchanY - yisraelY);
    
    // === AZARAS KOHANIM (Priests' Court) ===
    // z=-13 to z=-45 (32 units deep)
    const kohanimDepth = 32;
    const kohanimCenterZ = -13 - kohanimDepth/2; // -29
    this.addFloor(0, kohanimY, kohanimCenterZ, innerWidth, kohanimDepth, this.mat.floor, 'azaras-kohanim');
    this.addSolidFill(0, baseY, kohanimY, kohanimCenterZ, innerWidth, kohanimDepth);
    this.addStepRow(0, duchanY, -13, innerWidth - 6, kohanimY - duchanY);
    
    // === SIDE WALLS (East and West) with Gates ===
    const wallStartZ = -7;
    const wallEndZ = -45;
    
    // West wall with gates
    this.buildSideWallWithGates(-26, baseY, wallH, wallStartZ, wallEndZ, [
      { z: -18, name: 'שער הדלק', nameEn: 'Kindling Gate' },
      { z: -29, name: 'שער המים', nameEn: 'Water Gate' },
      { z: -40, name: 'שער הבכורות', nameEn: 'Gate of Firstlings' }
    ]);
    
    // East wall with gates
    this.buildSideWallWithGates(26, baseY, wallH, wallStartZ, wallEndZ, [
      { z: -18, name: 'שער בית המוקד', nameEn: 'Hearth Gate' },
      { z: -29, name: 'שער הניצוץ', nameEn: 'Flame Gate' },
      { z: -40, name: 'שער הקרבן', nameEn: 'Sacrifice Gate' }
    ]);
    
    // === NO NORTH WALL - opens directly to 12 steps to Ulam ===
    // The 12 steps are built in buildHeichal, starting at z=-45
    
    // === SLAUGHTER AREA (northeast corner) ===
    this.buildSlaughterArea(14, kohanimY, -38);
    
    // === CHAMBERS ===
    this.addChamber(-21, kohanimY, -35, 8, 6, 10, 'לשכת הגזית', 'Chamber of Hewn Stone');
    this.addChamber(21, kohanimY, -20, 8, 6, 8, 'בית המוקד', 'Chamber of the Hearth');
  }
  
  addSolidFill(x, bottomY, topY, z, width, depth) {
    const height = topY - bottomY;
    const fill = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      this.mat.stone
    );
    fill.position.set(x, bottomY + height/2, z);
    fill.receiveShadow = true;
    this.scene.add(fill);
  }
  
  addStepRow(x, baseY, z, width, rise) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(width, rise, 1),
      this.mat.marbleW
    );
    step.position.set(x, baseY + rise/2, z);
    step.userData = { isFloor: true, isStep: true };
    step.receiveShadow = true;
    this.scene.add(step);
    this.floors.push(step);
  }
  
  buildSideWallWithGates(x, baseY, wallH, startZ, endZ, gates) {
    const gateWidth = 4;
    const gateHeight = 5;
    
    // Sort gates by z position
    gates.sort((a, b) => b.z - a.z);
    
    let currentZ = startZ;
    gates.forEach((gate, i) => {
      // Wall segment before this gate
      const segmentStart = currentZ;
      const segmentEnd = gate.z + gateWidth/2;
      if (segmentStart > segmentEnd) {
        const segDepth = segmentStart - segmentEnd;
        const segCenterZ = (segmentStart + segmentEnd) / 2;
        this.addWall(x, baseY, segCenterZ, 2, wallH, segDepth, this.mat.stonePolished);
      }
      
      // Gate lintel
      this.addWall(x, baseY + gateHeight, gate.z, 2, wallH - gateHeight, gateWidth, this.mat.stonePolished);
      this.addGateFrame(x, 7.3, gate.z, gateWidth, gateHeight, this.mat.copperP, gate.nameEn);
      
      currentZ = gate.z - gateWidth/2;
    });
    
    // Final wall segment after last gate
    if (currentZ > endZ) {
      const segDepth = currentZ - endZ;
      const segCenterZ = (currentZ + endZ) / 2;
      this.addWall(x, baseY, segCenterZ, 2, wallH, segDepth, this.mat.stonePolished);
    }
  }
  
  buildSlaughterArea(centerX, baseY, centerZ) {
    // 8 marble slaughter tables
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        const table = new THREE.Mesh(
          new THREE.BoxGeometry(1.8, 0.5, 1.2),
          this.mat.marbleW
        );
        table.position.set(centerX - 4 + col * 2.5, baseY + 0.25, centerZ - row * 2);
        table.castShadow = true;
        table.receiveShadow = true;
        this.scene.add(table);
      }
    }
    
    // Slaughter rings (in ground)
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.12, 0.025, 8, 16),
          this.mat.copper
        );
        ring.position.set(centerX - 6 + col * 2, baseY + 0.01, centerZ + 3 - row * 1.2);
        ring.rotation.x = Math.PI / 2;
        this.scene.add(ring);
      }
    }
    
    // Hanging pillars
    [centerX - 8, centerX + 8].forEach(px => {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 6, 8),
        this.mat.cedar
      );
      pillar.position.set(px, baseY + 3, centerZ + 2);
      pillar.castShadow = true;
      this.scene.add(pillar);
      
      const bar = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 0.2), this.mat.cedar);
      bar.position.set(px, baseY + 5.5, centerZ + 2);
      this.scene.add(bar);
    });
  }
  
  addChamber(x, baseY, z, w, h, d, nameHeb, nameEn) {
    const chamber = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      this.mat.stonePolished
    );
    chamber.position.set(x, baseY + h/2, z);
    chamber.castShadow = true;
    chamber.receiveShadow = true;
    chamber.userData = { name: nameHeb, nameEn: nameEn };
    this.scene.add(chamber);
    
    // Simple roof
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.5, 0.5, d + 0.5),
      this.mat.stone
    );
    roof.position.set(x, baseY + h + 0.25, z);
    this.scene.add(roof);
  }

  buildHeichal() {
    // LAYOUT - All coordinates connect seamlessly:
    // Azaras Kohanim ends at z=-45, y=7.3
    // 12 steps: z=-45 to z=-48, rising y=7.3 to y=8.0
    // Ulam: z=-48 to z=-58, y=8.0
    // Heichal: z=-58 to z=-78, y=8.3
    // Kodesh HaKodashim: z=-78 to z=-88, y=8.3
    
    const kohanimY = 7.3;
    const ulamY = 8.0;
    const heichalY = 8.3;
    const wallH = 20; // Reduced wall height for better proportions
    const groundY = 3.8; // Ezras Nashim ground level for solid base
    
    // === 12 STEPS from Azara (z=-45) up to Ulam (z=-48) ===
    const stepDepth = 0.25;
    const totalStepDepth = 3; // z=-45 to z=-48
    const risePerStep = (ulamY - kohanimY) / 12;
    
    for (let i = 0; i < 12; i++) {
      const stepY = kohanimY + i * risePerStep;
      const stepZ = -45 - (i * totalStepDepth / 12);
      
      // Step surface
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(12, 0.1, stepDepth),
        this.mat.marbleW
      );
      stepMesh.position.set(0, stepY + 0.05, stepZ - stepDepth/2);
      stepMesh.receiveShadow = true;
      stepMesh.userData = { isFloor: true, isStep: true };
      this.scene.add(stepMesh);
      this.floors.push(stepMesh);
      
      // Step riser (vertical face)
      if (i > 0) {
        const riser = new THREE.Mesh(
          new THREE.BoxGeometry(12, risePerStep, 0.1),
          this.mat.stone
        );
        riser.position.set(0, stepY - risePerStep/2, stepZ);
        this.scene.add(riser);
      }
    }
    
    // Solid base under steps (not visible from inside)
    const stepsBase = new THREE.Mesh(
      new THREE.BoxGeometry(12, kohanimY - groundY, totalStepDepth),
      this.mat.stone
    );
    stepsBase.position.set(0, groundY + (kohanimY - groundY)/2, -46.5);
    this.scene.add(stepsBase);
    
    // === ULAM (Porch/Entrance Hall) ===
    // z=-48 to z=-58 (10 units deep)
    const ulamWidth = 20;
    const ulamDepth = 10;
    const ulamCenterZ = -53;
    
    // Ulam floor
    this.addFloor(0, ulamY, ulamCenterZ, ulamWidth, ulamDepth, this.mat.marbleW, 'ulam');
    
    // Solid base under Ulam (below floor, not visible from inside)
    const ulamBase = new THREE.Mesh(
      new THREE.BoxGeometry(ulamWidth, ulamY - groundY, ulamDepth),
      this.mat.stone
    );
    ulamBase.position.set(0, groundY + (ulamY - groundY)/2, ulamCenterZ);
    this.scene.add(ulamBase);
    
    // Ulam side walls (start at floor level, not below)
    this.addWall(-10, ulamY, ulamCenterZ, 2, wallH, ulamDepth + 2, this.mat.stonePolished);
    this.addWall(10, ulamY, ulamCenterZ, 2, wallH, ulamDepth + 2, this.mat.stonePolished);
    
    // === YACHIN AND BOAZ PILLARS ===
    [[-5, 'יכין', 'Yachin'], [5, 'בועז', 'Boaz']].forEach(([px, heb, eng]) => {
      const pillar = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 2, 16), this.mat.copper);
      base.position.y = 1;
      pillar.add(base);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 14, 16), this.mat.copper);
      shaft.position.y = 9;
      pillar.add(shaft);
      const capital = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 0.9, 3, 16), this.mat.copperP);
      capital.position.y = 17.5;
      pillar.add(capital);
      
      pillar.position.set(px, ulamY, -49);
      pillar.traverse(c => { if (c.isMesh) c.castShadow = true; });
      pillar.userData = { name: heb, nameEn: eng };
      this.scene.add(pillar);
    });
    
    // === HEICHAL (Holy Place) ===
    // z=-58 to z=-78 (20 units deep)
    const heichalWidth = 10;
    const heichalDepth = 20;
    const heichalCenterZ = -68;
    
    // Heichal floor
    this.addFloor(0, heichalY, heichalCenterZ, heichalWidth, heichalDepth, this.mat.cedar, 'heichal');
    
    // Step from Ulam to Heichal at z=-58
    const ulamToHeichalStep = new THREE.Mesh(
      new THREE.BoxGeometry(heichalWidth, heichalY - ulamY, 1),
      this.mat.marbleW
    );
    ulamToHeichalStep.position.set(0, ulamY + (heichalY - ulamY)/2, -58);
    ulamToHeichalStep.userData = { isFloor: true, isStep: true };
    this.scene.add(ulamToHeichalStep);
    this.floors.push(ulamToHeichalStep);
    
    // Solid base under Heichal (below floor level)
    const heichalBase = new THREE.Mesh(
      new THREE.BoxGeometry(heichalWidth, heichalY - groundY, heichalDepth),
      this.mat.stone
    );
    heichalBase.position.set(0, groundY + (heichalY - groundY)/2, heichalCenterZ);
    this.scene.add(heichalBase);
    
    // Heichal walls - gold plated (start at floor level)
    this.addWall(-5, heichalY, heichalCenterZ, 1, wallH, heichalDepth + 2, this.mat.goldEng);
    this.addWall(5, heichalY, heichalCenterZ, 1, wallH, heichalDepth + 2, this.mat.goldEng);
    
    // Back wall between Ulam and Heichal (with doorway)
    this.addWall(-7.5, ulamY, -58.5, 5, wallH, 1, this.mat.stonePolished);
    this.addWall(7.5, ulamY, -58.5, 5, wallH, 1, this.mat.stonePolished);
    this.addWall(0, ulamY + 8, -58.5, 10, wallH - 8, 1, this.mat.stonePolished); // Lintel above doorway
    
    // Heichal ceiling
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(heichalWidth, 1, heichalDepth), this.mat.cedar);
    ceiling.position.set(0, heichalY + wallH, heichalCenterZ);
    this.scene.add(ceiling);
    
    // === TA'IM (Side Chambers) - outside the main walls ===
    [-8, 8].forEach(side => {
      for (let story = 0; story < 3; story++) {
        const storyH = 4;
        const storyY = heichalY + story * storyH;
        for (let zOff = 0; zOff < 3; zOff++) {
          const cell = new THREE.Mesh(
            new THREE.BoxGeometry(3, storyH - 0.5, 5),
            this.mat.stonePolished
          );
          cell.position.set(side, storyY + storyH/2, -60 - zOff * 7);
          cell.castShadow = true;
          this.scene.add(cell);
        }
      }
    });
  }

  buildKodeshHakodashim() {
    // z=-78 to z=-88 (10 units = 20 amos square)
    const groundY = 3.8;
    const floorY = 8.3;
    const wallH = 20;
    
    // === PAROCHES (Double Curtain) at z=-78 ===
    const parochesGeo = new THREE.PlaneGeometry(10, wallH);
    [0, 0.3].forEach(offset => {
      const paroches = new THREE.Mesh(parochesGeo, this.mat.paroches);
      paroches.position.set(0, floorY + wallH/2, -78 - offset);
      this.scene.add(paroches);
    });
    
    // === KODESH HAKODASHIM FLOOR ===
    this.addFloor(0, floorY, -83, 10, 10, this.mat.gold, 'kodesh-hakodashim');
    
    // Solid base under floor (not visible from inside)
    const kkBase = new THREE.Mesh(
      new THREE.BoxGeometry(10, floorY - groundY, 10),
      this.mat.stone
    );
    kkBase.position.set(0, groundY + (floorY - groundY)/2, -83);
    this.scene.add(kkBase);
    
    // === WALLS - solid gold (start at floor level) ===
    this.addWall(-5, floorY, -83, 1, wallH, 12, this.mat.gold);
    this.addWall(5, floorY, -83, 1, wallH, 12, this.mat.gold);
    this.addWall(0, floorY, -88.5, 11, wallH, 1, this.mat.gold);
    
    // === CEILING ===
    const kkCeiling = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 10), this.mat.gold);
    kkCeiling.position.set(0, floorY + wallH, -83);
    this.scene.add(kkCeiling);
    
    // === EVEN HASHTIYA (Foundation Stone) ===
    const even = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.5, 0.8, 16), this.mat.altar);
    even.position.set(0, floorY + 0.4, -83);
    even.castShadow = true;
    even.userData = { name: 'אבן השתיה', nameEn: 'Foundation Stone' };
    this.scene.add(even);
  }

  buildKeilim() {
    this.buildMizbeiach();
    this.buildKiyor();
    this.buildMenorah();
    this.buildShulchan();
    this.buildMizbeiachHazahav();
    this.buildAron();
  }

  buildMizbeiach() {
    const baseY = 7.3; // Azaras Kohanim floor level
    const g = new THREE.Group();
    
    // Altar is between z=-20 and z=-40 area, positioned at z=-30
    // Historical dimensions: 32x32 amos base, scaled appropriately
    
    // === YESOD (Foundation) - 32 amos square, 1 amah high ===
    const yesod = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 14), this.mat.altar);
    yesod.position.y = 0.5;
    g.add(yesod);
    
    // === SOVEV (Ledge) - 30 amos, 5 amos high ===
    const sovev = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 12), this.mat.altar);
    sovev.position.y = 3.5;
    g.add(sovev);
    
    // === MA'ARACHA (Top) - 28 amos, 3 amos high ===
    const maaracha = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 10), this.mat.altar);
    maaracha.position.y = 7.5;
    g.add(maaracha);
    
    // === KERANOS (Horns) at corners ===
    [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]].forEach(([kx, kz]) => {
      const keren = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 1), this.mat.altar);
      keren.position.set(kx, 9.75, kz);
      g.add(keren);
    });
    
    // === CHUT HASIKRA (Red Line) - marks upper/lower blood application ===
    const redLine = new THREE.Mesh(
      new THREE.BoxGeometry(12.2, 0.1, 12.2), 
      new THREE.MeshStandardMaterial({ color: 0x8B0000 })
    );
    redLine.position.y = 5;
    g.add(redLine);
    
    // Position altar in center of Azaras Kohanim
    g.position.set(0, baseY, -28);
    g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    g.userData = { name: 'מזבח העולה', nameEn: 'Altar of Burnt Offering' };
    this.scene.add(g);
    
    // === KEVESH (Ramp) - goes SOUTH from altar ===
    // 32 amos long, 16 amos wide, rises to the sovev
    const rampLength = 14;
    const rampHeight = 6;
    const rampWidth = 5;
    
    // Create walkable ramp steps
    const rampSteps = 20;
    for (let i = 0; i < rampSteps; i++) {
      const progress = i / rampSteps;
      const stepY = baseY + rampHeight * (1 - progress);
      const stepZ = -30 + 7 + progress * rampLength;
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(rampWidth, 0.4, rampLength / rampSteps + 0.1),
        this.mat.stone
      );
      stepMesh.position.set(0, stepY + 0.2, stepZ);
      stepMesh.receiveShadow = true;
      stepMesh.userData = { isFloor: true };
      this.scene.add(stepMesh);
      this.floors.push(stepMesh);
    }
    
    // Ramp side walls
    const rampSideGeo = new THREE.BoxGeometry(0.3, 1, rampLength);
    [-rampWidth/2 - 0.15, rampWidth/2 + 0.15].forEach(sx => {
      const side = new THREE.Mesh(rampSideGeo, this.mat.stone);
      side.position.set(sx, baseY + rampHeight/2, -30 + 7 + rampLength/2);
      side.castShadow = true;
      this.scene.add(side);
    });
  }

  buildKiyor() {
    const g = new THREE.Group();
    // Stand
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1.3, 3, 12), this.mat.copper)); 
    g.children[0].position.y = 1.5;
    // Basin
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(2, 1.5, 2, 16), this.mat.copperP)); 
    g.children[1].position.y = 4;
    // Water
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.3, 16), this.mat.water);
    water.position.y = 4.8; 
    g.add(water);
    // 12 spouts
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6), this.mat.copper);
      spout.position.set(Math.cos(angle) * 1.9, 4, Math.sin(angle) * 1.9);
      spout.rotation.z = Math.PI / 2; 
      spout.rotation.y = -angle; 
      g.add(spout);
    }
    // Position between altar and sanctuary
    g.position.set(-8, 7.3, -38);
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    g.userData = { name: 'כיור', nameEn: 'Laver' };
    this.scene.add(g);
  }

  buildMenorah() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.7), this.mat.gold);
      leg.position.set(Math.cos(angle) * 0.3, 0.04, Math.sin(angle) * 0.3);
      leg.rotation.y = -angle; g.add(leg);
    }
    for (let i = 0; i < 4; i++) {
      const y = 0.2 + i * 0.6;
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), this.mat.gold)); g.children[g.children.length-1].position.y = y;
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), this.mat.goldEng)); g.children[g.children.length-1].position.y = y + 0.18;
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.05, 0.1, 8), this.mat.gold)); g.children[g.children.length-1].position.y = y + 0.32;
    }
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.6, 8), this.mat.gold)); g.children[g.children.length-1].position.y = 2.9;
    const branchH = [2.6, 2.8, 3.0, 3.3, 3.0, 2.8, 2.6], branchX = [-0.8, -0.53, -0.27, 0, 0.27, 0.53, 0.8];
    branchX.forEach((bx, i) => {
      const bh = branchH[i];
      if (i !== 3) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), this.mat.gold);
        arm.position.set(bx * 0.5, 1.4, 0); arm.rotation.z = Math.atan2(bx, 0.6); g.add(arm);
      }
      const vert = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, bh - 1.8, 8), this.mat.gold);
      vert.position.set(bx, 1.8 + (bh - 1.8) / 2, 0); g.add(vert);
      const ner = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.15, 8), this.mat.gold);
      ner.position.set(bx, bh + 0.08, 0); g.add(ner);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 8), new THREE.MeshBasicMaterial({ color: 0xFFDD44 }));
      flame.position.set(bx, bh + 0.26, 0); g.add(flame);
      const light = new THREE.PointLight(0xFFBB44, 0.4, 4);
      light.position.set(bx, bh + 0.3, 0); g.add(light);
    });
    g.position.set(-3, 8.3, -68);
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    g.userData = { name: 'מנורה', nameEn: 'Golden Menorah' };
    this.scene.add(g);
  }

  buildShulchan() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.75), this.mat.gold)); g.children[0].position.y = 1.1;
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.85), this.mat.goldEng)); g.children[1].position.y = 1.2;
    [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1), this.mat.gold);
      leg.position.set(lx, 0.5, lz); g.add(leg);
    });
    const breadMat = new THREE.MeshStandardMaterial({ color: 0xD4A862, roughness: 0.85 });
    [-0.4, 0.4].forEach(sx => {
      for (let i = 0; i < 6; i++) {
        const bread = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.25), breadMat);
        bread.position.set(sx, 1.32 + i * 0.09, 0); g.add(bread);
      }
    });
    [-0.55, 0.55].forEach(bx => {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.06, 8), this.mat.gold);
      bowl.position.set(bx, 1.88, 0); g.add(bowl);
      const lev = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshStandardMaterial({ color: 0xFFFFF0, roughness: 0.9 }));
      lev.position.set(bx, 1.9, 0); g.add(lev);
    });
    g.position.set(3, 8.3, -68);
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    g.userData = { name: 'שולחן הפנים', nameEn: 'Showbread Table' };
    this.scene.add(g);
  }

  buildMizbeiachHazahav() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.6), this.mat.gold)); g.children[0].position.y = 0.6;
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.7), this.mat.goldEng)); g.children[1].position.y = 1.25;
    [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]].forEach(([kx, kz]) => {
      const keren = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), this.mat.gold);
      keren.position.set(kx, 1.4, kz); g.add(keren);
    });
    [-0.35, 0.35].forEach(rx => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 8, 16), this.mat.gold);
      ring.position.set(rx, 0.8, 0.32); ring.rotation.y = Math.PI / 2; g.add(ring);
    });
    const glow = new THREE.PointLight(0xFFEEDD, 0.6, 5);
    glow.position.y = 1.8; g.add(glow);
    g.position.set(0, 8.3, -75);
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    g.userData = { name: 'מזבח הזהב', nameEn: 'Golden Altar' };
    this.scene.add(g);
  }

  buildAron() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 0.85), this.mat.gold)); g.children[0].position.y = 0.5;
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.95), this.mat.goldEng)); g.children[1].position.y = 1.05;
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.15, 0.9), this.mat.gold)); g.children[2].position.y = 1.15;
    [[-0.45, false], [0.45, true]].forEach(([kx, mirror]) => {
      const keruv = new THREE.Group();
      keruv.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), this.mat.gold)); keruv.children[0].position.y = 0.18;
      keruv.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), this.mat.gold)); keruv.children[1].position.y = 0.45;
      const wingGeo = new THREE.BoxGeometry(0.45, 0.45, 0.03);
      const innerWing = new THREE.Mesh(wingGeo, this.mat.gold);
      innerWing.position.set(mirror ? 0.18 : -0.18, 0.5, 0);
      innerWing.rotation.z = mirror ? -0.5 : 0.5; innerWing.rotation.y = mirror ? -0.3 : 0.3;
      keruv.add(innerWing);
      const outerWing = new THREE.Mesh(wingGeo.clone(), this.mat.gold);
      outerWing.position.set(mirror ? -0.22 : 0.22, 0.45, 0);
      outerWing.rotation.z = mirror ? 0.55 : -0.55;
      keruv.add(outerWing);
      keruv.position.set(kx, 1.25, 0); g.add(keruv);
    });
    [-0.6, 0.6].forEach(px => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.5, 8), this.mat.gold);
      pole.position.set(px, 0.5, 0); pole.rotation.x = Math.PI / 2; g.add(pole);
    });
    const divineLight = new THREE.PointLight(0xFFFFFF, 1.5, 15);
    divineLight.position.y = 2.5; g.add(divineLight);
    const glowSphere = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16), new THREE.MeshBasicMaterial({ color: 0xFFFFEE, transparent: true, opacity: 0.15 }));
    glowSphere.position.y = 2.2; g.add(glowSphere);
    g.position.set(0, 8.3, -83);
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    g.userData = { name: 'ארון הקודש', nameEn: 'Holy Ark' };
    this.scene.add(g);
  }

  buildLighting() {
    this.scene.add(new THREE.AmbientLight(0xFFF8F0, 0.4));
    const sun = new THREE.DirectionalLight(0xFFFAF0, 1.5);
    sun.position.set(60, 120, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.width = CONFIG.SHADOW_MAP_SIZE;
    sun.shadow.mapSize.height = CONFIG.SHADOW_MAP_SIZE;
    sun.shadow.camera.near = 10; sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -120; sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120;
    sun.shadow.bias = -0.0002;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xB0C4DE, 0.35);
    fill.position.set(-50, 80, -40);
    this.scene.add(fill);
    this.scene.add(new THREE.HemisphereLight(0x88AACC, 0xD4C4A8, 0.5));
    const heichalLight = new THREE.PointLight(0xFFDD88, 2, 40);
    heichalLight.position.set(0, 25, -68);
    this.scene.add(heichalLight);
  }
}

// ============================================================================
// PLAYER CONTROLLER
// ============================================================================
class PlayerController {
  constructor(camera, floors, walls) {
    this.camera = camera;
    this.floors = floors;
    this.walls = walls;
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.moveF = false; this.moveB = false; this.moveL = false; this.moveR = false;
    this.isRun = false; this.isLocked = false;
    this.groundY = 0;
    this.verticalVelocity = 0;
    this.isJumping = false;
    this.debugMode = false; // Noclip mode
    this.raycaster = new THREE.Raycaster();
    this.downVec = new THREE.Vector3(0, -1, 0);
  }

  toggleDebug(callback) {
    this.debugMode = !this.debugMode;
    console.log('Debug mode:', this.debugMode ? 'ON (noclip)' : 'OFF');
    if (callback) callback(this.debugMode);
  }

  jump() {
    if (!this.isJumping && this.isLocked && !this.debugMode) {
      this.verticalVelocity = 7;
      this.isJumping = true;
    }
  }

  getFloorHeight(x, z) {
    this.raycaster.set(new THREE.Vector3(x, 100, z), this.downVec);
    this.raycaster.far = 200;
    const hits = this.raycaster.intersectObjects(this.floors, false);
    let highest = -Infinity;
    for (const hit of hits) if (hit.point.y > highest && hit.point.y < 100) highest = hit.point.y;
    return highest > -Infinity ? highest : 0;
  }

  checkWallCollision(newPos) {
    for (const wall of this.walls) {
      if (!wall.userData?.isWall) continue;
      const box = new THREE.Box3().setFromObject(wall);
      const sphere = new THREE.Sphere(newPos, CONFIG.PLAYER_RADIUS);
      if (box.intersectsSphere(sphere)) return true;
    }
    return false;
  }

  update(delta) {
    if (!this.isLocked) return;
    const speed = (this.isRun ? CONFIG.RUN_SPEED : CONFIG.MOVE_SPEED) * delta;
    
    // Debug mode: free flight, no collisions
    if (this.debugMode) {
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      const move = new THREE.Vector3();
      if (this.moveF) move.add(forward.clone().multiplyScalar(speed * 2));
      if (this.moveB) move.add(forward.clone().multiplyScalar(-speed * 2));
      if (this.moveR) move.add(right.clone().multiplyScalar(speed * 2));
      if (this.moveL) move.add(right.clone().multiplyScalar(-speed * 2));
      this.camera.position.add(move);
      return;
    }
    
    const dir = new THREE.Vector3(Number(this.moveR) - Number(this.moveL), 0, Number(this.moveF) - Number(this.moveB)).normalize();
    const forward = new THREE.Vector3(); this.camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
    const move = new THREE.Vector3().addScaledVector(forward, dir.z * speed).addScaledVector(right, dir.x * speed);
    const newPos = this.camera.position.clone().add(move);
    const currentFloorY = this.getFloorHeight(this.camera.position.x, this.camera.position.z);
    const newFloorY = this.getFloorHeight(newPos.x, newPos.z);
    const heightDiff = newFloorY - currentFloorY;
    
    // Horizontal movement with step climbing
    if (Math.abs(heightDiff) <= CONFIG.STEP_HEIGHT || heightDiff < 0 || this.isJumping) {
      if (!this.checkWallCollision(newPos)) {
        this.camera.position.x = newPos.x;
        this.camera.position.z = newPos.z;
        this.groundY = newFloorY;
      }
    }
    
    // Vertical movement (jumping/gravity)
    const gravity = 20;
    this.verticalVelocity -= gravity * delta;
    
    const currentY = this.camera.position.y - CONFIG.PLAYER_HEIGHT;
    const newY = currentY + this.verticalVelocity * delta;
    const floorY = this.getFloorHeight(this.camera.position.x, this.camera.position.z);
    
    if (newY <= floorY) {
      // Hit the ground
      this.camera.position.y = floorY + CONFIG.PLAYER_HEIGHT;
      this.verticalVelocity = 0;
      this.isJumping = false;
      this.groundY = floorY;
    } else {
      this.camera.position.y = newY + CONFIG.PLAYER_HEIGHT;
    }
    
    // Boundaries
    this.camera.position.x = Math.max(-100, Math.min(100, this.camera.position.x));
    this.camera.position.z = Math.max(-86, Math.min(120, this.camera.position.z));
  }

  onMouseMove(e) {
    if (!this.isLocked) return;
    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= (e.movementX || 0) * CONFIG.LOOK_SPEED;
    this.euler.x -= (e.movementY || 0) * CONFIG.LOOK_SPEED;
    this.euler.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  }

  getElevation() { return this.groundY.toFixed(1); }
}

// ============================================================================
// MAIN GAME
// ============================================================================
class TempleGame {
  constructor(container, callbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CONFIG.FOV, window.innerWidth / window.innerHeight, 0.1, CONFIG.RENDER_DISTANCE);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.clock = new THREE.Clock();
    this.tex = new TextureFactory();
    this.currentArea = null;
    this.nearbyKli = null;
    this.init();
  }

  init() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);
    this.camera.position.set(0, CONFIG.PLAYER_HEIGHT + 1.8, 62);

    this.callbacks.onLoad('Generating 30+ textures...');
    this.callbacks.onLoad('Building Beis Hamikdash...');
    const builder = new TempleBuilder(this.scene, this.tex);
    const { floors, walls } = builder.build();
    this.player = new PlayerController(this.camera, floors, walls);

    this.callbacks.onLoad('Creating Kohanim & animals...');
    this.characters = new CharacterSystem(this.scene, this.tex);
    // Kohen Gadol in Heichal
    this.characters.createKohen(0, 8.3, -68, true);
    // Kohanim in various areas with correct floor heights
    // Azaras Kohanim (y=7.3): z=-13 to z=-45
    [[10, -18], [-10, -18], [8, -28], [-8, -28], [12, -36], [-12, -36], [15, -42], [-15, -42]].forEach(([x, z]) => 
      this.characters.createKohen(x, 7.3, z));
    // Azaras Yisrael (y=6.8): z=-7 to z=-11
    [[8, -9], [-8, -9], [0, -9]].forEach(([x, z]) => 
      this.characters.createKohen(x, 6.8, z));
    // Ezras Nashim (y=3.8)
    [[0, 30], [15, 35], [-15, 35], [10, 20], [-10, 20]].forEach(([x, z]) => 
      this.characters.createKohen(x, 3.8, z));
    for (let i = 0; i < 8; i++) this.characters.createAnimal('sheep', 20 + (Math.random() - 0.5) * 10 * (i % 2 === 0 ? 1 : -1), 30 + (Math.random() - 0.5) * 10);
    for (let i = 0; i < 4; i++) this.characters.createAnimal('goat', 25 + (Math.random() - 0.5) * 8 * (i % 2 === 0 ? 1 : -1), 35 + (Math.random() - 0.5) * 8);
    for (let i = 0; i < 2; i++) this.characters.createAnimal('bull', 30 + i * 5, 45);
    for (let i = 0; i < 12; i++) this.characters.createDove((Math.random() - 0.5) * 60, 25 + Math.random() * 15, (Math.random() - 0.5) * 60);

    this.callbacks.onLoad('Adding fire & smoke...');
    this.particles = new ParticleSystem(this.scene);
    this.particles.createFire(0, 17, -28, 4);
    this.particles.createSmoke(0, 10, -75, 0.3);

    this.setupControls();
    this.callbacks.onLoad(null);
    this.animate();
  }

  setupControls() {
    document.addEventListener('keydown', e => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.player.moveF = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.player.moveB = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.player.moveL = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.player.moveR = true;
      if (e.code === 'ShiftLeft') this.player.isRun = true;
      if (e.code === 'Space') { e.preventDefault(); this.player.jump(); }
      if (e.code === 'KeyG') { this.player.toggleDebug(this.callbacks.onDebug); } // G for ghost/debug mode
    });
    document.addEventListener('keyup', e => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.player.moveF = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.player.moveB = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.player.moveL = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.player.moveR = false;
      if (e.code === 'ShiftLeft') this.player.isRun = false;
    });
    document.addEventListener('mousemove', e => this.player.onMouseMove(e));
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    this.container.addEventListener('click', () => this.container.requestPointerLock());
    document.addEventListener('pointerlockchange', () => { this.player.isLocked = document.pointerLockElement === this.container; });
  }

  checkLocation() {
    const p = this.camera.position;
    const AREAS = {
      'outside': { name: 'מחוץ לחומות', nameEn: 'Outside the Walls', desc: 'The steps lead up through the Chuldah Gates into the Temple.', bounds: { minX: -100, maxX: 100, minZ: 60, maxZ: 150 } },
      'har-habayis': { name: 'הר הבית', nameEn: 'Temple Mount', desc: 'The vast plaza of Har HaBayis, where all of Israel gathers.', bounds: { minX: -70, maxX: 70, minZ: 58, maxZ: 70 } },
      'ezras-nashim': { name: 'עזרת נשים', nameEn: "Women's Court", desc: "The outer court. Levi'im sing on the 15 steps.", bounds: { minX: -32, maxX: 32, minZ: -7, maxZ: 58 } },
      'azaras-yisrael': { name: 'עזרת ישראל', nameEn: 'Israelites Court', desc: 'Men bringing Korbanos stand here to observe.', bounds: { minX: -26, maxX: 26, minZ: -12, maxZ: -7 } },
      'azaras-kohanim': { name: 'עזרת כהנים', nameEn: 'Kohanim Court', desc: 'The inner courtyard. The Mizbeiach burns eternally.', bounds: { minX: -26, maxX: 26, minZ: -45, maxZ: -12 } },
      'heichal': { name: 'היכל', nameEn: 'Sanctuary', desc: 'The golden hall. Menorah, Shulchan, and Golden Altar.', bounds: { minX: -9, maxX: 9, minZ: -78, maxZ: -45 } },
      'kodesh-hakodashim': { name: 'קודש הקודשים', nameEn: 'Holy of Holies', desc: 'The Aron HaKodesh rests upon the Even HaShtiya.', bounds: { minX: -5, maxX: 5, minZ: -90, maxZ: -78 } }
    };
    let newArea = 'outside';
    for (const [id, area] of Object.entries(AREAS)) {
      if (id === 'outside') continue;
      const b = area.bounds;
      if (p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ) newArea = id;
    }
    if (newArea !== this.currentArea) { this.currentArea = newArea; const a = AREAS[newArea]; this.callbacks.onLoc({ name: a.name, nameEn: a.nameEn, desc: a.desc }); }

    const KEILIM = {
      menorah: { name: 'מנורה', nameEn: 'Golden Menorah', icon: '🕎', desc: 'Seven branches, 18 tefachim tall, pure beaten gold.', pos: { x: -3, z: -65 } },
      shulchan: { name: 'שולחן הפנים', nameEn: 'Showbread Table', icon: '🍞', desc: '12 loaves arranged in two stacks, changed every Shabbos.', pos: { x: 3, z: -65 } },
      mizbeiachHazahav: { name: 'מזבח הזהב', nameEn: 'Golden Altar', icon: '✨', desc: 'For the Ketores, offered morning and afternoon.', pos: { x: 0, z: -75 } },
      mizbeiach: { name: 'מזבח העולה', nameEn: 'Great Altar', icon: '🔥', desc: '32 amos square. The eternal fire burns here.', pos: { x: 0, z: -30 } },
      kiyor: { name: 'כיור', nameEn: 'Copper Laver', icon: '💧', desc: 'Kohanim sanctify hands and feet before Avodah.', pos: { x: -10, z: -40 } },
      aron: { name: 'ארון הקודש', nameEn: 'Holy Ark', icon: '📦', desc: 'Contains the Luchos. Keruvim spread wings above.', pos: { x: 0, z: -83 } }
    };
    let closest = null, minDist = 8;
    for (const [id, kli] of Object.entries(KEILIM)) {
      const d = Math.sqrt((p.x - kli.pos.x) ** 2 + (p.z - kli.pos.z) ** 2);
      if (d < minDist) { minDist = d; closest = { id, ...kli }; }
    }
    if (closest?.id !== this.nearbyKli?.id) { this.nearbyKli = closest; this.callbacks.onKli(closest); }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.player.update(delta);
    this.characters.update(delta);
    this.particles.update(delta);
    this.checkLocation();
    this.callbacks.onUpd({ position: this.camera.position, rotation: this.player.euler.y, elevation: this.player.getElevation() });
    this.renderer.render(this.scene, this.camera);
  }

  dispose() { this.renderer.dispose(); }
}

// ============================================================================
// CSS STYLES
// ============================================================================
const styles = `
@import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700&family=Cormorant+Garamond:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{overflow:hidden;font-family:'Cormorant Garamond',serif;background:#000}
.game-container{width:100vw;height:100vh;position:relative}
canvas{display:block}
.overlay{position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none}
.crosshair{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)}
.crosshair::before,.crosshair::after{content:'';position:absolute;background:rgba(255,255,255,0.6)}
.crosshair::before{width:2px;height:24px;left:11px;top:0}
.crosshair::after{width:24px;height:2px;top:11px;left:0}
.crosshair-dot{position:absolute;width:4px;height:4px;background:rgba(255,255,255,0.8);border-radius:50%;top:10px;left:10px}
.hud-top{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:flex-start;padding:20px}
.hud-bottom{position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:space-between;align-items:flex-end;padding:20px}
.panel{background:linear-gradient(135deg,rgba(20,35,60,0.93),rgba(40,30,55,0.9));backdrop-filter:blur(12px);border:1px solid rgba(218,165,32,0.35);border-radius:14px;color:#F5E6C8;box-shadow:0 10px 40px rgba(0,0,0,0.5)}
.date-panel{padding:18px 26px;min-width:220px}
.date-hebrew{font-family:'Frank Ruhl Libre',serif;font-size:1.6rem;color:#FFD700;text-shadow:0 2px 15px rgba(218,165,32,0.5)}
.date-day{font-size:1rem;opacity:0.85;margin-top:3px}
.date-special{margin-top:12px;padding-top:12px;border-top:1px solid rgba(218,165,32,0.25);color:#FFD700;font-weight:600;font-size:1.15rem}
.compass{background:rgba(0,0,0,0.8);padding:12px 30px;border-radius:30px;color:#DAA520;font-size:1rem;letter-spacing:0.15em;border:1px solid rgba(218,165,32,0.35)}
.debug-indicator{background:rgba(255,50,50,0.9);padding:10px 20px;border-radius:20px;color:#fff;font-size:0.9rem;font-weight:bold;letter-spacing:0.1em;animation:pulse 1s infinite}
.minimap{width:190px;height:190px;background:rgba(0,0,0,0.85);border-radius:14px;border:1px solid rgba(218,165,32,0.35);padding:14px}
.minimap svg{width:100%;height:100%}
.player-marker{fill:#FFD700;filter:drop-shadow(0 0 8px #FFD700)}
.location-panel{padding:22px 30px;max-width:480px}
.location-hebrew{font-family:'Frank Ruhl Libre',serif;font-size:2.4rem;font-weight:700;color:#FFD700;text-shadow:0 3px 25px rgba(218,165,32,0.5);line-height:1.2}
.location-english{font-size:1.05rem;letter-spacing:0.2em;text-transform:uppercase;opacity:0.85;margin:8px 0 14px}
.location-desc{font-size:1.1rem;line-height:1.65;opacity:0.9}
.elevation-display{font-size:0.9rem;opacity:0.7;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1)}
.controls-hint{background:rgba(0,0,0,0.85);padding:16px 22px;border-radius:12px;color:#aaa;font-size:0.9rem}
.controls-hint kbd{background:#333;padding:5px 12px;border-radius:6px;margin:0 5px;border:1px solid #555;font-family:monospace;color:#ddd}
.kli-panel{position:absolute;top:110px;right:20px;padding:24px;max-width:360px;animation:slideIn 0.35s ease;pointer-events:auto}
@keyframes slideIn{from{opacity:0;transform:translateX(35px)}to{opacity:1;transform:translateX(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
.kli-panel .icon{font-size:3.5rem;margin-bottom:12px}
.kli-panel .name-heb{font-family:'Frank Ruhl Libre',serif;font-size:2rem;color:#FFD700}
.kli-panel .name-en{font-size:1rem;opacity:0.75;margin-bottom:14px}
.kli-panel .desc{font-size:1.05rem;line-height:1.65}
.korbanos-panel{position:absolute;bottom:110px;right:20px;padding:24px;max-width:420px;max-height:450px;overflow-y:auto;background:linear-gradient(135deg,rgba(65,30,20,0.95),rgba(45,20,15,0.93));animation:slideIn 0.35s ease;pointer-events:auto}
.korbanos-panel h3{font-family:'Frank Ruhl Libre',serif;font-size:1.5rem;color:#FFD700;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid rgba(218,165,32,0.3)}
.korban-item{padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.08)}
.korban-item:last-child{border-bottom:none}
.korban-name{font-family:'Frank Ruhl Libre',serif;font-size:1.2rem;color:#FFD700}
.korban-name-en{font-size:0.9rem;opacity:0.65}
.korban-desc{font-size:0.95rem;margin-top:7px;opacity:0.85}
.korban-type{display:inline-block;background:rgba(218,165,32,0.2);padding:4px 12px;border-radius:14px;font-size:0.85rem;margin-top:10px}
.start-screen{position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg,#0a0f1a 0%,#151525 50%,#080810 100%);display:flex;align-items:center;justify-content:center;pointer-events:auto}
.start-panel{background:linear-gradient(145deg,rgba(25,45,80,0.96),rgba(55,40,85,0.92));padding:60px 80px;border-radius:28px;border:2px solid rgba(218,165,32,0.45);text-align:center;max-width:750px;box-shadow:0 50px 120px rgba(0,0,0,0.65),inset 0 1px 0 rgba(255,255,255,0.1)}
.start-panel h1{font-family:'Frank Ruhl Libre',serif;font-size:5rem;color:#FFD700;text-shadow:0 5px 50px rgba(218,165,32,0.6);margin-bottom:10px}
.start-panel h2{font-size:1.6rem;color:#E8DCC8;letter-spacing:0.35em;text-transform:uppercase;margin-bottom:35px;font-weight:400}
.start-panel p{color:#C4B8A8;font-size:1.25rem;line-height:1.85;margin-bottom:20px}
.start-panel .features{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin:30px 0;text-align:left}
.start-panel .feature{background:rgba(218,165,32,0.1);padding:12px 18px;border-radius:10px;border:1px solid rgba(218,165,32,0.2);font-size:1.05rem;color:#E8DCC8}
.start-panel .date-info{background:rgba(218,165,32,0.12);padding:22px 30px;border-radius:14px;margin:30px 0;border:1px solid rgba(218,165,32,0.25)}
.start-panel .date-info .heb{font-family:'Frank Ruhl Libre',serif;font-size:1.8rem;color:#FFD700}
.start-panel .date-info .day{color:#E8DCC8;font-size:1.1rem;margin-top:5px}
.start-btn{background:linear-gradient(135deg,#DAA520 0%,#B8860B 100%);border:none;color:#fff;padding:22px 65px;font-size:1.45rem;font-family:'Cormorant Garamond',serif;border-radius:14px;cursor:pointer;margin-top:35px;transition:all 0.3s;text-transform:uppercase;letter-spacing:0.2em;font-weight:600;box-shadow:0 10px 35px rgba(218,165,32,0.4)}
.start-btn:hover{transform:translateY(-4px) scale(1.02);box-shadow:0 18px 55px rgba(218,165,32,0.55)}
.start-panel .footer{margin-top:35px;font-size:1rem;color:#8A8070}
.loading{color:#FFD700;font-size:1.6rem;text-align:center}
.loading-bar{width:300px;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;margin-top:20px;overflow:hidden}
.loading-bar-inner{height:100%;background:linear-gradient(90deg,#DAA520,#FFD700);animation:loadPulse 1.5s ease infinite}
@keyframes loadPulse{0%,100%{width:20%}50%{width:80%}}
`;

// ============================================================================
// REACT UI
// ============================================================================
const Minimap = ({ pos, rot }) => {
  const sc = 1.2, cx = 95, cy = 105;
  const px = cx + (pos?.x || 0) * sc * 0.55;
  const py = cy + (pos?.z || 100) * sc * 0.4;
  const r = ((rot || 0) * 57.3 + 180) % 360;
  return (
    <div className="minimap">
      <svg viewBox="0 0 190 190">
        <defs><linearGradient id="goldG" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#FFD700"/><stop offset="100%" stopColor="#DAA520"/></linearGradient></defs>
        <rect x="5" y="5" width="180" height="180" fill="#B8A080" rx="4"/>
        <rect x="15" y="40" width="160" height="110" fill="#C9B896"/>
        <rect x="40" y="80" width="110" height="50" fill="#DED0B8"/>
        <rect x="40" y="55" width="110" height="25" fill="#E8DCC8"/>
        <rect x="75" y="62" width="40" height="12" fill="#6B5A4A"/>
        <rect x="70" y="30" width="50" height="25" fill="url(#goldG)"/>
        <rect x="78" y="15" width="34" height="15" fill="#FFD700"/>
        <g transform={`translate(${px},${py}) rotate(${-r})`}><polygon points="0,-9 6,6 -6,6" className="player-marker"/></g>
      </svg>
    </div>
  );
};

export default function BeisHamikdash3D() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(null);
  const [location, setLocation] = useState(null);
  const [nearbyKli, setNearbyKli] = useState(null);
  const [playerState, setPlayerState] = useState({ position: { x: 0, z: 62 }, rotation: 0, elevation: '0' });
  const [showKorbanos, setShowKorbanos] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const hebrewDate = useMemo(() => HebrewCalendar.getDate(), []);
  const korbanos = useMemo(() => Korbanos.getDaily(hebrewDate), [hebrewDate]);

  useEffect(() => {
    if (!started || !containerRef.current || gameRef.current) return;
    gameRef.current = new TempleGame(containerRef.current, {
      onLoc: setLocation,
      onKli: kli => { setNearbyKli(kli); setShowKorbanos(kli?.id === 'mizbeiach'); },
      onUpd: setPlayerState,
      onLoad: setLoading,
      onDebug: setDebugMode
    });
    return () => { if (gameRef.current) { gameRef.current.dispose(); gameRef.current = null; } };
  }, [started]);

  const getCompass = () => {
    const deg = ((playerState.rotation * 57.3) + 180) % 360;
    if (deg >= 315 || deg < 45) return 'צפון • N';
    if (deg >= 45 && deg < 135) return 'מערב • W';
    if (deg >= 135 && deg < 225) return 'דרום • S';
    return 'מזרח • E';
  };

  return (
    <>
      <style>{styles}</style>
      <div className="game-container" ref={containerRef}>
        {started && !loading && (
          <div className="overlay">
            <div className="crosshair"><div className="crosshair-dot"></div></div>
            <div className="hud-top">
              <div className="panel date-panel">
                <div className="date-hebrew">{hebrewDate.formatted}</div>
                <div className="date-day">{hebrewDate.dayName}</div>
                {hebrewDate.special && <div className="date-special">{hebrewDate.special}</div>}
                {hebrewDate.isRoshChodesh && !hebrewDate.special && <div className="date-special">ראש חודש</div>}
              </div>
              <div className="compass">{getCompass()}</div>
              {debugMode && <div className="debug-indicator">GHOST MODE</div>}
              <Minimap pos={playerState.position} rot={playerState.rotation} />
            </div>
            {nearbyKli && (
              <div className="panel kli-panel">
                <div className="icon">{nearbyKli.icon}</div>
                <div className="name-heb">{nearbyKli.name}</div>
                <div className="name-en">{nearbyKli.nameEn}</div>
                <div className="desc">{nearbyKli.desc}</div>
              </div>
            )}
            {showKorbanos && (
              <div className="panel korbanos-panel">
                <h3>קרבנות היום</h3>
                {korbanos.map((k, i) => (
                  <div key={i} className="korban-item">
                    <div className="korban-name">{k.name}</div>
                    <div className="korban-name-en">{k.en}</div>
                    <div className="korban-desc">{k.desc}</div>
                    <span className="korban-type">{k.type}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="hud-bottom">
              <div className="panel location-panel">
                {location && (
                  <>
                    <div className="location-hebrew">{location.name}</div>
                    <div className="location-english">{location.nameEn}</div>
                    <div className="location-desc">{location.desc}</div>
                    <div className="elevation-display">Elevation: {playerState.elevation}m above ground</div>
                  </>
                )}
              </div>
              <div className="controls-hint">
                <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move • <kbd>Space</kbd> Jump • <kbd>Shift</kbd> Run • <kbd>G</kbd> Ghost • <kbd>Mouse</kbd> Look
              </div>
            </div>
          </div>
        )}
        {started && loading && (
          <div className="start-screen">
            <div>
              <div className="loading">{loading}</div>
              <div className="loading-bar"><div className="loading-bar-inner"></div></div>
            </div>
          </div>
        )}
        {!started && (
          <div className="start-screen">
            <div className="start-panel">
              <h1>בית המקדש</h1>
              <h2>Beis Hamikdash Explorer</h2>
              <p>Experience the Holy Temple with unprecedented detail. Walk through historically accurate architecture from the Chuldah Gates to the Kodesh HaKodashim.</p>
              <div className="features">
                <div className="feature">🏛️ 30+ Realistic Textures</div>
                <div className="feature">👳 Animated Kohanim & Kohen Gadol</div>
                <div className="feature">🐑 Sheep, Goats, Bulls & Doves</div>
                <div className="feature">🔥 Dynamic Fire & Smoke</div>
                <div className="feature">📜 Daily Korbanos Display</div>
                <div className="feature">🗓️ Hebrew Calendar Integration</div>
              </div>
              <div className="date-info">
                <div className="heb">{hebrewDate.formatted}</div>
                <div className="day">{hebrewDate.dayName}</div>
                {hebrewDate.special && <div className="heb" style={{marginTop:'8px'}}>{hebrewDate.special}</div>}
              </div>
              <button className="start-btn" onClick={() => setStarted(true)}>Enter the Temple</button>
              <div className="footer">Based on Maseches Middos, Rambam Hilchos Beis HaBechirah & Mishna Yoma</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
