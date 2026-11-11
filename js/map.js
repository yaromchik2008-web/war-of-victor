// War of Victor: procedural battlefield (land, sea, islands, villages, rocks, forests)
// Terrain is painted at full resolution in 512 px tiles, generated on demand and cached.
// Tank tracks and fallen trees are stamped into those tiles as permanent marks.
(function () {
"use strict";
const WOV = (window.WOV = window.WOV || {});
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function makeNoise(seed) {
  const R = rng(seed), perm = new Uint8Array(512), vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = R(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const sm = t => t * t * (3 - 2 * t);
  const n2 = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
    const a = vals[perm[X + perm[Y]]], b = vals[perm[X + 1 + perm[Y]]], c = vals[perm[X + perm[Y + 1]]], d = vals[perm[X + 1 + perm[Y + 1]]];
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x, y, oct) => { let s = 0, amp = 1, f = 1, norm = 0; for (let i = 0; i < (oct || 4); i++) { s += n2(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; } return s / norm; };
}
// tileable 256x256 detail texture (values 0..1), cheap to sample per pixel
function detailTex(seed, cell, oct) {
  const R = rng(seed), out = new Float32Array(256 * 256);
  let amp = 1, norm = 0;
  for (let o = 0; o < oct; o++) {
    const n = Math.max(1, Math.round(256 / cell)), lat = new Float32Array(n * n);
    for (let i = 0; i < lat.length; i++) lat[i] = R();
    const sc = n / 256;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const fx = x * sc, fy = y * sc, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = lat[(iy % n) * n + ix % n], b = lat[(iy % n) * n + (ix + 1) % n], c = lat[((iy + 1) % n) * n + ix % n], d = lat[((iy + 1) % n) * n + (ix + 1) % n];
      out[y * 256 + x] += (lerp(lerp(a, b, sx), lerp(c, d, sx), sy)) * amp;
    }
    norm += amp; amp *= 0.5; cell /= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}
let DET = null;
function details() {
  if (!DET) DET = { fine: detailTex(11, 4, 2), mid: detailTex(23, 32, 3), grain: (() => { const R = rng(5), a = new Float32Array(65536); for (let i = 0; i < a.length; i++) a[i] = R(); return a; })() };
  return DET;
}

WOV.generateMap = function (size, seed) {
  seed = seed || Math.floor(Math.random() * 1e9);
  const R = rng(seed), noise = makeNoise(seed), noise2 = makeNoise(seed + 77), D = details();
  const seaSouth = R() < 0.5;
  const coast = size * (seaSouth ? 0.64 + R() * 0.06 : 0.3 + R() * 0.06);
  const isles = [];
  for (let i = 0; i < 3 + Math.floor(R() * 3); i++) {
    const x = size * (0.2 + R() * 0.6), y = seaSouth ? coast + size * (0.12 + R() * 0.18) : coast - size * (0.12 + R() * 0.18);
    isles.push({ x, y, r: size * (0.03 + R() * 0.04) });
  }
  // height (>0 land, <0 water) and moisture on a coarse grid
  const G = 10, N = Math.ceil(size / G) + 2, hf = new Float32Array(N * N), mf = new Float32Array(N * N), df = new Float32Array(N * N);
  for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
    const x = gx * G, y = gy * G;
    let h = (seaSouth ? coast - y : y - coast) / (size * 0.16);
    h += (noise(x / 520, y / 520, 4) - 0.5) * 2.2;
    for (const s of isles) { const d = Math.hypot(x - s.x, y - s.y) / s.r; if (d < 1.4) h += (1.4 - d) * 1.3 + (noise2(x / 120, y / 120, 2) - 0.5) * 0.6; }
    hf[gy * N + gx] = h;
    mf[gy * N + gx] = noise2(x / 900 + 3, y / 900 + 7, 3);   // meadow / dry grass
    df[gy * N + gx] = noise(x / 260 + 11, y / 260 + 5, 3);   // dirt patches
  }
  const samp = (f, x, y) => {
    x = clamp(x, 0, size); y = clamp(y, 0, size);
    const fx = x / G, fy = y / G, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, i = iy * N + ix;
    return (f[i] * (1 - tx) + f[i + 1] * tx) * (1 - ty) + (f[i + N] * (1 - tx) + f[i + N + 1] * tx) * ty;
  };
  const h = (x, y) => (x < 0 || y < 0 || x > size || y > size) ? 99 : samp(hf, x, y);
  const isWater = (x, y) => h(x, y) < 0;

  // ---------- obstacles ----------
  const walls = [], trees = [], spawnZones = [size * 0.12, size * 0.88];
  const nearSpawn = x => Math.abs(x - spawnZones[0]) < size * 0.1 || Math.abs(x - spawnZones[1]) < size * 0.1;
  const fitsLand = (x, y, w, hh) => h(x, y) > 0.35 && h(x + w, y) > 0.35 && h(x, y + hh) > 0.35 && h(x + w, y + hh) > 0.35;
  const overlaps = (x, y, w, hh) => walls.some(o => x < o.x + o.w + 18 && x + w + 18 > o.x && y < o.y + o.h + 18 && y + hh + 18 > o.y);
  const villages = Math.round(size / 900) + 1, houses = [];
  for (let v = 0; v < villages; v++) {
    for (let t = 0; t < 40; t++) {
      const cx = size * (0.25 + R() * 0.5), cy = R() * size;
      if (h(cx, cy) < 0.8) continue;
      const n = 4 + Math.floor(R() * 6);
      for (let i = 0; i < n; i++) {
        const horiz = R() < 0.5, w = horiz ? 50 + R() * 40 : 36 + R() * 20, hh = horiz ? 34 + R() * 16 : 48 + R() * 36;
        const x = cx + (R() - 0.5) * 320, y = cy + (R() - 0.5) * 320;
        if (fitsLand(x, y, w, hh) && !overlaps(x, y, w, hh)) { const o = { x, y, w, h: hh, type: "house", roof: Math.floor(R() * 3), v }; walls.push(o); houses.push(o); }
      }
      break;
    }
  }
  for (let i = 0; i < size / 90; i++) {
    const w = 30 + R() * 70, hh = 26 + R() * 60, x = R() * size, y = R() * size;
    if (nearSpawn(x)) continue;
    if (fitsLand(x, y, w, hh) && !overlaps(x, y, w, hh)) walls.push({ x, y, w, h: hh, type: R() < 0.65 ? "rock" : "ruin", seed: Math.floor(R() * 1e6) });
  }
  for (const s of isles) if (h(s.x, s.y) > 0.4) walls.push({ x: s.x - 28, y: s.y - 22, w: 56, h: 44, type: "rock", seed: Math.floor(R() * 1e6) });
  // forests: dynamic trees that tanks can knock down
  const inWall = (x, y, m) => walls.some(o => x > o.x - m && x < o.x + o.w + m && y > o.y - m && y < o.y + o.h + m);
  for (let f = 0; f < size / 160; f++) {
    const cx = R() * size, cy = R() * size; if (h(cx, cy) < 0.5) continue;
    const pine = R() < 0.45, cnt = 10 + Math.floor(R() * 22), rad = 120 + R() * 200;
    for (let i = 0; i < cnt; i++) {
      const a = R() * TAU, d = Math.sqrt(R()) * rad, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      if (h(x, y) > 0.3 && !inWall(x, y, 14) && !(nearSpawn(x) && R() < 0.6)) trees.push({ x, y, r: 9 + R() * 11, pine: pine ? R() < 0.85 : R() < 0.15, alive: true, fall: 0, seed: R() });
    }
  }
  const B = 200, BN = Math.ceil(size / B) + 1;
  const bucketize = (items, ext) => {
    const b = Array.from({ length: BN * BN }, () => []);
    for (const w of items) {
      const x0 = ext ? w.x : w.x - w.r, y0 = ext ? w.y : w.y - w.r, x1 = ext ? w.x + w.w : w.x + w.r, y1 = ext ? w.y + w.h : w.y + w.r;
      for (let by = Math.max(0, Math.floor(y0 / B)); by <= Math.min(BN - 1, Math.floor(y1 / B)); by++) for (let bx = Math.max(0, Math.floor(x0 / B)); bx <= Math.min(BN - 1, Math.floor(x1 / B)); bx++) b[by * BN + bx].push(w);
    }
    return b;
  };
  const wallB = bucketize(walls, true), treeB = bucketize(trees, false);
  const near = (buckets, x, y) => { const bx = Math.floor(x / B), by = Math.floor(y / B); if (bx < 0 || by < 0 || bx >= BN || by >= BN) return []; return buckets[by * BN + bx]; };
  const pointInWalls = (x, y) => { for (const w of near(wallB, x, y)) if (x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h) return w; return null; };
  const circleFree = (x, y, r) => {
    const seen = new Set();
    for (const [dx, dy] of [[0, 0], [-r, -r], [r, -r], [-r, r], [r, r]]) for (const w of near(wallB, x + dx, y + dy)) {
      if (seen.has(w)) continue; seen.add(w);
      const cx = clamp(x, w.x, w.x + w.w), cy = clamp(y, w.y, w.y + w.h);
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return false;
    }
    return true;
  };
  const lineOfSight = (x1, y1, x2, y2) => {
    const d = Math.hypot(x2 - x1, y2 - y1), steps = Math.ceil(d / 16);
    for (let i = 1; i < steps; i++) { const t = i / steps; if (pointInWalls(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false; }
    return true;
  };
  // wade: tanks may drive into shallow water (they stall there); bots plan with wade=false
  const passable = (kind, x, y, r, a, wade) => {
    if (kind === "plane") return true;
    if (x < r || y < r || x > size - r || y > size - r) return false;
    a = a || 0;
    if (kind === "tank") {
      const lim = wade ? -0.32 : 0.02;
      if (h(x, y) < lim) return false;
      for (let k = 0; k < 4; k++) { const b = a + k * Math.PI / 2; if (h(x + Math.cos(b) * r, y + Math.sin(b) * r) < (wade ? lim : 0)) return false; }
      return circleFree(x, y, r);
    }
    const L = r * 1.5, c = Math.cos(a), s = Math.sin(a);
    for (const [px, py] of [[0, 0], [L, 0], [-L, 0], [0, r * 0.6], [0, -r * 0.6]]) if (h(x + px * c - py * s, y + px * s + py * c) > -0.04) return false;
    return circleFree(x, y, r * 0.8);
  };
  const findSpot = (kind, team, r) => {
    const x0 = spawnZones[team];
    for (let i = 0; i < 400; i++) {
      const spread = i < 200 ? size * 0.08 : size * 0.2;
      const x = clamp(x0 + (R() - 0.5) * 2 * spread, 60, size - 60), y = 60 + R() * (size - 120);
      if (kind === "plane") return { x, y };
      if (passable(kind, x, y, r + 10, team === 0 ? 0 : Math.PI) && !trees.some(t => Math.hypot(t.x - x, t.y - y) < r + t.r + 6)) return { x, y };
    }
    return null;
  };

  // ---------- terrain painting ----------
  const LX = -0.62, LY = -0.78; // light from the north-west
  // smooth per-area values (hill light, meadow, dirt) are sampled once per 4x4 block; detail stays per pixel
  function blockParams(x, y, o) {
    const gx = h(x + 6, y) - h(x - 6, y), gy = h(x, y + 6) - h(x, y - 6);
    o.light = clamp(1 + (gx * LX + gy * LY) * 5.5, 0.72, 1.25); o.m = samp(mf, x, y); o.dirt = samp(df, x, y);
  }
  const tmpBlk = { light: 1, m: 0, dirt: 0 };
  function pixel(x, y, out, blk) {
    if (!blk) { blockParams(x, y, tmpBlk); blk = tmpBlk; }
    const v = h(x, y), xi = x & 255, yi = y & 255, fine = D.fine[yi * 256 + xi], mid = D.mid[yi * 256 + xi], gr = D.grain[yi * 256 + xi];
    let r, g, b;
    if (v < 0) {
      const d = clamp(-v / 1.5, 0, 1), sh = clamp(-v / 0.3, 0, 1);
      r = lerp(78, lerp(30, 16, d), sh); g = lerp(150, lerp(86, 52, d), sh); b = lerp(150, lerp(104, 78, d), sh);
      const rip = (D.mid[((y * 2) & 255) * 256 + ((x + (y >> 1)) & 255)] - 0.5);
      r += rip * 14; g += rip * 18; b += rip * 18;
      if (v > -0.06) { const f = clamp((v + 0.06) / 0.06, 0, 1) * (fine > 0.45 ? 1 : 0.55); r = lerp(r, 214, f * 0.75); g = lerp(g, 232, f * 0.75); b = lerp(b, 228, f * 0.75); }
    } else {
      const light = blk.light;
      if (v < 0.12) {
        const wet = clamp(1 - v / 0.05, 0, 1);
        r = lerp(206, 160, wet); g = lerp(186, 142, wet); b = lerp(134, 100, wet);
        const j = (gr - 0.5) * 22 + (fine - 0.5) * 16; r += j; g += j; b += j * 0.8;
        if (v > 0.09) { const t = (v - 0.09) / 0.03; r = lerp(r, 120, t); g = lerp(g, 132, t); b = lerp(b, 72, t); }
      } else {
        const m = blk.m, dirt = blk.dirt;
        r = lerp(124, 66, m); g = lerp(132, 98, m); b = lerp(70, 46, m);
        const p = (mid - 0.5) * 26; r += p; g += p * 1.1; b += p * 0.6;
        const j = (fine - 0.5) * 20 + (gr - 0.5) * 12; r += j; g += j * 1.15; b += j * 0.6;
        if (gr > 0.985) { r += 40; g += 42; b += 18; }          // light grass tips
        else if (gr < 0.012) { r -= 30; g -= 26; b -= 18; }     // dark tufts
        if (dirt > 0.66) { const t = clamp((dirt - 0.66) / 0.12, 0, 1) * (0.6 + fine * 0.4); r = lerp(r, 128 + (gr - 0.5) * 20, t); g = lerp(g, 108 + (gr - 0.5) * 18, t); b = lerp(b, 76, t); }
        if (v > 1.6) { const t = clamp((v - 1.6) / 1.2, 0, 0.5); r = lerp(r, 112, t); g = lerp(g, 112, t); b = lerp(b, 92, t); }
      }
      r *= light; g *= light; b *= light;
    }
    out[0] = r; out[1] = g; out[2] = b;
  }

  function drawStatic(c, x0, y0, T) {
    // houses, rocks, ruins inside this tile (with a margin for shadows)
    for (const w of walls) {
      if (w.x > x0 + T + 20 || w.x + w.w < x0 - 30 || w.y > y0 + T + 20 || w.y + w.h < y0 - 30) continue;
      c.save(); c.translate(-x0, -y0);
      c.fillStyle = "rgba(0,0,0,.28)"; WOV.rr(c, w.x + 8, w.y + 10, w.w, w.h, w.type === "rock" ? 14 : 2); c.fill();
      if (w.type === "house") {
        const pal = [["#9a5440", "#b8684f", "#7a3f30"], ["#6e6a62", "#86827a", "#55524c"], ["#7b5a3a", "#946e48", "#5e442b"]][w.roof];
        const horiz = w.w >= w.h;
        c.fillStyle = pal[2]; c.fillRect(w.x, w.y, w.w, w.h);
        c.fillStyle = pal[1];
        if (horiz) c.fillRect(w.x, w.y, w.w, w.h / 2); else c.fillRect(w.x, w.y, w.w / 2, w.h);
        c.fillStyle = pal[0];
        if (horiz) c.fillRect(w.x, w.y + w.h / 2, w.w, w.h / 2); else c.fillRect(w.x + w.w / 2, w.y, w.w / 2, w.h);
        c.strokeStyle = "rgba(0,0,0,.18)"; c.lineWidth = 1;
        for (let i = 4; i < (horiz ? w.w : w.h); i += 5) { c.beginPath(); if (horiz) { c.moveTo(w.x + i, w.y); c.lineTo(w.x + i, w.y + w.h); } else { c.moveTo(w.x, w.y + i); c.lineTo(w.x + w.w, w.y + i); } c.stroke(); }
        c.strokeStyle = "rgba(255,255,255,.18)"; c.lineWidth = 2; c.beginPath();
        if (horiz) { c.moveTo(w.x + 2, w.y + w.h / 2); c.lineTo(w.x + w.w - 2, w.y + w.h / 2); } else { c.moveTo(w.x + w.w / 2, w.y + 2); c.lineTo(w.x + w.w / 2, w.y + w.h - 2); }
        c.stroke();
        c.fillStyle = "#4a4440"; c.fillRect(w.x + w.w * 0.7, w.y + w.h * 0.2, 6, 6); // chimney
        c.strokeStyle = "rgba(0,0,0,.4)"; c.lineWidth = 1.5; c.strokeRect(w.x, w.y, w.w, w.h);
      } else if (w.type === "rock") {
        const S = rng(w.seed), pts = [], cx = w.x + w.w / 2, cy = w.y + w.h / 2;
        for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, k = 0.82 + S() * 0.22; pts.push([cx + Math.cos(a) * w.w / 2 * k, cy + Math.sin(a) * w.h / 2 * k]); }
        const gr = c.createLinearGradient(w.x, w.y, w.x + w.w, w.y + w.h); gr.addColorStop(0, "#a3a196"); gr.addColorStop(0.55, "#7c7a70"); gr.addColorStop(1, "#56554e");
        c.fillStyle = gr; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill();
        c.strokeStyle = "rgba(40,40,36,.45)"; c.lineWidth = 1.2;
        for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(cx + (S() - 0.5) * w.w * 0.6, cy + (S() - 0.5) * w.h * 0.6); c.lineTo(cx + (S() - 0.5) * w.w * 0.7, cy + (S() - 0.5) * w.h * 0.7); c.stroke(); }
        c.fillStyle = "rgba(110,130,70,.35)"; c.beginPath(); c.ellipse(cx - w.w * 0.15, cy - w.h * 0.2, w.w * 0.18, w.h * 0.12, 0.4, 0, TAU); c.fill(); // moss
      } else {
        c.fillStyle = "#6a655b"; c.fillRect(w.x, w.y, w.w, w.h);
        c.fillStyle = "#4c4840"; c.fillRect(w.x + 6, w.y + 6, w.w - 12, w.h - 12);
        c.fillStyle = "#857f73"; c.fillRect(w.x, w.y, w.w, 5); c.fillRect(w.x, w.y, 5, w.h);
        c.fillStyle = "rgba(60,55,48,.8)"; for (let i = 0; i < 6; i++) c.fillRect(w.x + 8 + (i * 13) % (w.w - 14), w.y + 8 + (i * 7) % (w.h - 14), 5, 4); // rubble
      }
      c.restore();
    }
    // village dirt roads drawn under houses would need ordering; we keep them as faint paths
  }

  // decals: tank tracks, fallen trees (replayed when a tile is regenerated)
  const decals = [];
  function drawDecal(c, d, x0, y0) {
    c.save(); c.translate(d.x - x0, d.y - y0); c.rotate(d.a);
    if (d.t === "track") {
      c.fillStyle = d.wet ? "rgba(35,28,18,.30)" : "rgba(45,38,24,.22)";
      c.fillRect(-2.5, -d.w - 3, 5, 5); c.fillRect(-2.5, d.w - 2, 5, 5);
    } else if (d.t === "log") {
      c.fillStyle = "rgba(0,0,0,.18)"; c.beginPath(); c.ellipse(d.r * 1.3, 4, d.r * 1.2, d.r * 0.8, 0, 0, TAU); c.fill();
      c.fillStyle = "#5a4630"; c.fillRect(0, -2.5, d.r * 1.6, 5);
      c.fillStyle = d.pine ? "#2c4024" : "#3c5a2c"; c.beginPath(); c.ellipse(d.r * 1.7, 0, d.r * 0.95, d.r * 0.7, 0, 0, TAU); c.fill();
      c.fillStyle = d.pine ? "#36502c" : "#4c6e36"; c.beginPath(); c.ellipse(d.r * 1.55, -2, d.r * 0.5, d.r * 0.35, 0, 0, TAU); c.fill();
    } else if (d.t === "crater") {
      c.fillStyle = "rgba(40,32,22,.35)"; c.beginPath(); c.arc(0, 0, d.r, 0, TAU); c.fill();
      c.fillStyle = "rgba(20,16,10,.35)"; c.beginPath(); c.arc(0, 0, d.r * 0.55, 0, TAU); c.fill();
    }
    c.restore();
  }

  const T = 512, TN = Math.ceil(size / T), cache = new Map(), order = [];
  const MAXT = 16, BS = 4, blocks = Array.from({ length: T / BS }, () => ({ light: 1, m: 0, dirt: 0 }));
  // a tile is painted a few rows at a time so the game never freezes while new ground appears
  const jobs = [];
  function newJob(tx, ty) {
    const cv = document.createElement("canvas"); cv.width = T; cv.height = T;
    const c = cv.getContext("2d");
    return { tx, ty, k: ty * TN + tx, cv, c, id: c.createImageData(T, T), row: 0 };
  }
  function work(job, rows) {
    const px = job.id.data, x0 = job.tx * T, y0 = job.ty * T, out = [0, 0, 0];
    const end = Math.min(T, job.row + rows);
    for (let y = job.row; y < end; y++) {
      if ((y & (BS - 1)) === 0) for (let b = 0; b < blocks.length; b++) blockParams(x0 + b * BS + 2, y0 + y + 2, blocks[b]);
      for (let x = 0; x < T; x++) {
        pixel(x0 + x, y0 + y, out, blocks[x >> 2]);
        const o = (y * T + x) * 4; px[o] = out[0]; px[o + 1] = out[1]; px[o + 2] = out[2]; px[o + 3] = 255;
      }
    }
    job.row = end;
    if (job.row >= T) {
      job.c.putImageData(job.id, 0, 0); job.id = null;
      drawStatic(job.c, x0, y0, T);
      for (const d of decals) if (d.x > x0 - 40 && d.x < x0 + T + 40 && d.y > y0 - 40 && d.y < y0 + T + 40) drawDecal(job.c, d, x0, y0);
      cache.set(job.k, job.cv); order.push(job.k);
      while (order.length > MAXT) cache.delete(order.shift());
      return true;
    }
    return false;
  }
  function enqueue(tx, ty, urgent) {
    if (tx < 0 || ty < 0 || tx >= TN || ty >= TN) return;
    const k = ty * TN + tx;
    if (cache.has(k)) return;
    const i = jobs.findIndex(j => j.k === k);
    if (i >= 0) { if (urgent && i > 0) jobs.unshift(jobs.splice(i, 1)[0]); return; }
    const j = newJob(tx, ty);
    if (urgent) jobs.unshift(j); else jobs.push(j);
    if (jobs.length > 12) jobs.length = 12;
  }
  function pump(ms) {
    const t0 = performance.now();
    while (jobs.length && performance.now() - t0 < ms) { if (work(jobs[0], 16)) jobs.shift(); }
  }
  function tile(tx, ty, create) {
    const k = ty * TN + tx;
    const t = cache.get(k);
    if (t) { const i = order.indexOf(k); if (i >= 0 && i < order.length - 1) { order.splice(i, 1); order.push(k); } return t; }
    if (create) { const j = newJob(tx, ty); while (!work(j, 64)); return cache.get(k); }
    return null;
  }
  function stamp(d) {
    decals.push(d); if (decals.length > 12000) decals.splice(0, 2000);
    const tx0 = Math.floor((d.x - 40) / T), tx1 = Math.floor((d.x + 40) / T), ty0 = Math.floor((d.y - 40) / T), ty1 = Math.floor((d.y + 40) / T);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (tx < 0 || ty < 0 || tx >= TN || ty >= TN) continue;
      const t = cache.get(ty * TN + tx); if (t) drawDecal(t.getContext("2d"), d, tx * T, ty * T);
    }
  }

  // low-res overview for the minimap and as a stand-in while a tile is being painted
  const OK = Math.min(0.12, 480 / size), over = document.createElement("canvas");
  over.width = Math.ceil(size * OK); over.height = Math.ceil(size * OK);
  { const c = over.getContext("2d"), id = c.createImageData(over.width, over.height), out = [0, 0, 0];
    for (let y = 0; y < over.height; y++) for (let x = 0; x < over.width; x++) { pixel(Math.floor(x / OK), Math.floor(y / OK), out); const o = (y * over.width + x) * 4; id.data[o] = out[0]; id.data[o + 1] = out[1]; id.data[o + 2] = out[2]; id.data[o + 3] = 255; }
    c.putImageData(id, 0, 0);
    c.save(); c.scale(OK, OK); c.fillStyle = "#6a6458"; for (const w of walls) c.fillRect(w.x, w.y, w.w, w.h);
    c.fillStyle = "#2f4626"; for (const t of trees) { c.beginPath(); c.arc(t.x, t.y, t.r + 6, 0, TAU); c.fill(); } c.restore(); }
  const mini = document.createElement("canvas"); mini.width = mini.height = 160;
  mini.getContext("2d").drawImage(over, 0, 0, 160, 160);

  // draw the ground for the view; missing tiles show the low-res map until they are painted
  function drawGround(ctx, sx, sy, W, H) {
    const tx0 = Math.max(0, Math.floor(sx / T)), ty0 = Math.max(0, Math.floor(sy / T)), tx1 = Math.min(TN - 1, Math.floor((sx + W) / T)), ty1 = Math.min(TN - 1, Math.floor((sy + H) / T));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = tile(tx, ty, false);
      if (t) ctx.drawImage(t, tx * T - sx, ty * T - sy);
      else { enqueue(tx, ty, true); ctx.drawImage(over, tx * T * OK, ty * T * OK, T * OK, T * OK, tx * T - sx, ty * T - sy, T, T); }
    }
    if (!jobs.length) for (let ty = ty0 - 1; ty <= ty1 + 1; ty++) for (let tx = tx0 - 1; tx <= tx1 + 1; tx++) enqueue(tx, ty, false);
    pump(5);
  }
  function warmup(x, y, w, h) { // paint only the tiles under the first screen, queue the ring around it
    w = w || T; h = h || T;
    const x0 = Math.floor((x - w / 2) / T), x1 = Math.floor((x + w / 2) / T), y0 = Math.floor((y - h / 2) / T), y1 = Math.floor((y + h / 2) / T);
    for (let j = y0 - 1; j <= y1 + 1; j++) for (let i = x0 - 1; i <= x1 + 1; i++) if (i >= 0 && j >= 0 && i < TN && j < TN) {
      if (i >= x0 && i <= x1 && j >= y0 && j <= y1) tile(i, j, true); else enqueue(i, j, false);
    }
  }

  // ---------- trees ----------
  const treesNear = (x, y) => near(treeB, x, y);
  let falling = [];
  function knockTree(t, dir) {
    if (!t.alive || t.fall) return;
    t.fall = 0.001; t.dir = dir; falling.push(t);
  }
  function updateTrees(dt) {
    for (const t of falling) if (t.alive && t.fall) {
      t.fall += dt * 2.2;
      if (t.fall >= 1) { t.alive = false; stamp({ t: "log", x: t.x, y: t.y, a: t.dir, r: t.r, pine: t.pine }); }
    }
    if (falling.length > 30) falling = falling.filter(t => t.alive);
  }
  function visibleTrees(sx, sy, W, H) {
    const out = [], seen = new Set();
    for (let by = Math.max(0, Math.floor((sy - 60) / B)); by <= Math.min(BN - 1, Math.floor((sy + H + 60) / B)); by++)
      for (let bx = Math.max(0, Math.floor((sx - 60) / B)); bx <= Math.min(BN - 1, Math.floor((sx + W + 60) / B)); bx++)
        for (const t of treeB[by * BN + bx]) if (!seen.has(t)) { seen.add(t); out.push(t); }
    return out;
  }
  let vis = [];
  function drawTreeShadows(c, sx, sy, W, H) {
    vis = visibleTrees(sx, sy, W, H);
    c.fillStyle = "rgba(0,0,0,.22)";
    for (const t of vis) { if (!t.alive || t.x < sx - 60 || t.x > sx + W + 60 || t.y < sy - 60 || t.y > sy + H + 60) continue; c.beginPath(); c.ellipse(t.x + t.r * 0.6, t.y + t.r * 0.8, t.r * 1.05, t.r * 0.9, 0, 0, TAU); c.fill(); }
  }
  function drawTrees(c, sx, sy, W, H) {
    for (const t of vis) {
      if (!t.alive || t.x < sx - 60 || t.x > sx + W + 60 || t.y < sy - 60 || t.y > sy + H + 60) continue;
      c.save(); c.translate(t.x, t.y);
      if (t.fall) { c.rotate(t.dir); const k = t.fall; c.translate(t.r * 1.6 * k, 0); c.scale(1 + 0.3 * k, 1 - 0.25 * k); }
      if (t.pine) {
        const n = 8, r = t.r;
        c.fillStyle = "#24361f"; c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU + t.seed * 3, rr = i % 2 ? r * 0.62 : r * 1.08; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill();
        c.fillStyle = "#30482a"; c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU + t.seed * 3 + 0.2, rr = i % 2 ? r * 0.4 : r * 0.72; c.lineTo(Math.cos(a) * rr - 1, Math.sin(a) * rr - 1); } c.closePath(); c.fill();
        c.fillStyle = "#3d5a34"; c.beginPath(); c.arc(-1.5, -1.5, r * 0.22, 0, TAU); c.fill();
      } else {
        const r = t.r;
        c.fillStyle = "#2f4a26"; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        c.fillStyle = "#3e5f30"; for (let i = 0; i < 4; i++) { const a = i * 1.7 + t.seed * 6; c.beginPath(); c.arc(Math.cos(a) * r * 0.45 - 1, Math.sin(a) * r * 0.45 - 1, r * 0.55, 0, TAU); c.fill(); }
        c.fillStyle = "#56783e"; c.beginPath(); c.arc(-r * 0.3, -r * 0.35, r * 0.35, 0, TAU); c.fill();
      }
      c.restore();
    }
  }

  const waves = [];
  for (let i = 0; i < size / 10; i++) { const x = R() * size, y = R() * size; if (h(x, y) < -0.2) waves.push({ x, y, l: 10 + R() * 18, p: R() * TAU }); }

  return { size, seed, seaSouth, h, isWater, walls, trees, waves, pointInWalls, circleFree, lineOfSight, passable, findSpot, mini, spawnZones,
    drawGround, warmup, stamp, treesNear, knockTree, updateTrees, drawTrees, drawTreeShadows, houses };
};
})();
