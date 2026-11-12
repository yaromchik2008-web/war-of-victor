// War of Victor: vehicle renderers. Every model is drawn from its own "look" parameters.
(function () {
"use strict";
const WOV = (window.WOV = window.WOV || {});
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function shade(col, amt) {
  let r, g, b;
  if (col[0] === "#") { const n = parseInt(col.slice(1), 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255; }
  else { const m = col.match(/\d+/g); r = +m[0]; g = +m[1]; b = +m[2]; }
  const f = v => clamp(Math.round(v + amt), 0, 255);
  return "rgb(" + f(r) + "," + f(g) + "," + f(b) + ")";
}
WOV.shade = shade;
function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
WOV.rr = rr;

// paint camo blotches inside the current path
function camoFill(c, base, camo, w, h, seed) {
  c.fillStyle = base; c.fill();
  if (!camo || !camo.colors) return;
  c.save(); c.clip();
  let s = seed || 7; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 7; i++) {
    c.fillStyle = camo.colors[1 + (i % 2)];
    c.beginPath(); c.ellipse((rnd() - 0.5) * w, (rnd() - 0.5) * h, w * (0.12 + rnd() * 0.18), h * (0.12 + rnd() * 0.2), rnd() * 3, 0, TAU); c.fill();
  }
  c.restore();
}

// soft top-light: lighter on the left (north-west light), darker on the right side of the hull
function sideGrad(c, col, w, amt) {
  const g = c.createLinearGradient(0, -w, 0, w);
  g.addColorStop(0, shade(col, amt || 22)); g.addColorStop(0.45, col); g.addColorStop(1, shade(col, -(amt || 22) * 1.3));
  return g;
}
function drawTank(c, v, x, y, a, ta, o) {
  const L0 = v.look, r = v.r, L = r * L0.L, Wd = r * L0.Wd;
  const wreck = o.wreck, color = wreck ? "#3a3936" : (o.color || (o.camo && o.camo.colors ? o.camo.colors[0] : L0.color));
  const modern = L0.turret === "modern" || L0.turret === "dome";
  c.save(); c.translate(x, y); c.rotate(a);
  // shadow
  if (!wreck) { c.fillStyle = "rgba(0,0,0,.28)"; rr(c, -L + 4, -Wd + 1, L * 2, Wd * 2 + 5, 6); c.fill(); }
  // tracks with road wheels and moving links
  for (const sy of [-Wd - 3, Wd - 5]) {
    c.fillStyle = wreck ? "#262624" : "#25292a"; rr(c, -L, sy, L * 2, 8, 3.5); c.fill();
    if (!wreck) {
      c.fillStyle = "#4a504c"; const off = (((o.track || 0) % 5) + 5) % 5;
      for (let i = -L + 1.5 + off; i < L - 1.5; i += 5) c.fillRect(i, sy, 1.6, 8);
      c.fillStyle = "#3a403d"; const n = Math.max(4, Math.round(L / 5));
      for (let k = 0; k < n; k++) { c.beginPath(); c.arc(-L + 4 + k * (L * 2 - 8) / (n - 1), sy + 4, 2.4, 0, TAU); c.fill(); }
    }
  }
  if (L0.skirts && !wreck) {
    c.fillStyle = shade(color, -22); c.fillRect(-L + 3, -Wd - 3.5, L * 2 - 6, 3.5); c.fillRect(-L + 3, Wd + 0.5, L * 2 - 6, 3.5);
    c.fillStyle = "rgba(0,0,0,.25)"; for (let i = -L + 3; i < L - 3; i += 7) { c.fillRect(i, -Wd - 3.5, 0.8, 3.5); c.fillRect(i, Wd + 0.5, 0.8, 3.5); }
  }
  // hull: sloped front plate, rear deck
  c.beginPath();
  if (L0.pike) { c.moveTo(L + 2, 0); c.lineTo(L - 6, -Wd + 3); c.lineTo(-L + 2, -Wd + 3); c.lineTo(-L + 2, Wd - 3); c.lineTo(L - 6, Wd - 3); c.closePath(); }
  else rr(c, -L + 2, -Wd + 3, L * 2 - 4, Wd * 2 - 6, modern ? 2.5 : 4);
  camoFill(c, wreck ? color : sideGrad(c, color, Wd), wreck ? null : o.camo, L * 2, Wd * 2, 3);
  c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = 1; c.stroke();
  c.fillStyle = "rgba(255,255,255,.1)"; c.beginPath(); c.moveTo(L - 2, -Wd + 3); c.lineTo(L - 10, -Wd + 6); c.lineTo(L - 10, Wd - 6); c.lineTo(L - 2, Wd - 3); c.closePath(); c.fill(); // glacis
  c.strokeStyle = "rgba(0,0,0,.22)"; c.beginPath(); c.moveTo(L - 10, -Wd + 6); c.lineTo(L - 10, Wd - 6); c.stroke();
  if (!wreck) {
    // engine deck grilles and exhausts
    c.fillStyle = "rgba(0,0,0,.28)"; rr(c, -L + 4, -Wd * 0.55, L * 0.42, Wd * 1.1, 2); c.fill();
    c.strokeStyle = "rgba(255,255,255,.08)"; c.beginPath();
    for (let i = 0; i < 5; i++) { const gx = -L + 6 + i * L * 0.08; c.moveTo(gx, -Wd * 0.48); c.lineTo(gx, Wd * 0.48); }
    c.stroke();
    c.fillStyle = "#1c1e1d"; c.fillRect(-L + 1, -Wd * 0.7, 3, 3); c.fillRect(-L + 1, Wd * 0.7 - 3, 3, 3);
    // tools and spare track links on the fenders
    c.fillStyle = shade(color, -35); c.fillRect(L * 0.1, -Wd + 3.5, L * 0.45, 2); c.fillRect(-L * 0.2, Wd - 5.5, L * 0.5, 2);
    if (L0.era) { c.fillStyle = shade(color, -12); for (let i = 0; i < 5; i++) { c.fillRect(L - 9 + (i % 2), -Wd + 4 + i * (Wd * 2 - 8) / 5, 5, (Wd * 2 - 8) / 5 - 1); } }
  }
  c.restore();
  // turret
  const tx = x + Math.cos(a) * r * L0.tPos, ty = y + Math.sin(a) * r * L0.tPos;
  c.save(); c.translate(tx, ty); c.rotate(ta);
  const tr = r * L0.tR, bl = r * L0.bL, tcol = wreck ? "#2e2d2a" : shade(color, -10);
  // barrel: tapered, with fume extractor and muzzle brake
  c.fillStyle = wreck ? "#252422" : shade(color, -42);
  c.beginPath(); c.moveTo(tr * 0.4, -L0.bW / 2 - 0.4); c.lineTo(tr * 0.4 + bl, -L0.bW / 2 + 0.5); c.lineTo(tr * 0.4 + bl, L0.bW / 2 - 0.5); c.lineTo(tr * 0.4, L0.bW / 2 + 0.4); c.closePath(); c.fill();
  if (!wreck) {
    c.fillStyle = "rgba(255,255,255,.12)"; c.fillRect(tr * 0.4, -L0.bW / 2 + 0.3, bl, 0.9);
    c.fillStyle = shade(color, -50); if (bl > r * 1.4) c.fillRect(tr * 0.4 + bl * 0.55, -L0.bW / 2 - 0.9, bl * 0.12, L0.bW + 1.8);
    if (modern) { c.fillStyle = shade(color, -30); c.fillRect(tr * 0.4 + bl * 0.15, -L0.bW / 2 - 1, bl * 0.4, L0.bW + 2); } // thermal sleeve
  }
  if (L0.brake) { c.fillStyle = wreck ? "#252422" : shade(color, -48); c.fillRect(tr * 0.4 + bl - 4, -L0.bW / 2 - 1.5, 5, L0.bW + 3); }
  c.fillStyle = tcol;
  const tg = wreck ? tcol : sideGrad(c, tcol, tr, 26);
  if (L0.turret === "round") { c.beginPath(); c.arc(0, 0, tr, 0, TAU); }
  else if (L0.turret === "dome") { c.beginPath(); c.ellipse(-tr * 0.05, 0, tr * 1.05, tr * 0.95, 0, 0, TAU); }
  else if (L0.turret === "box") { rr(c, -tr * 0.9, -tr * 0.85, tr * 1.75, tr * 1.7, 3); }
  else if (L0.turret === "wedge") { c.beginPath(); c.moveTo(tr * 0.95, -tr * 0.55); c.lineTo(tr * 0.95, tr * 0.55); c.lineTo(-tr * 0.9, tr * 0.85); c.lineTo(-tr * 0.9, -tr * 0.85); c.closePath(); }
  else { c.beginPath(); c.moveTo(tr * 1.05, -tr * 0.5); c.lineTo(tr * 0.7, -tr * 0.9); c.lineTo(-tr * 1.2, -tr * 0.9); c.lineTo(-tr * 1.2, tr * 0.9); c.lineTo(tr * 0.7, tr * 0.9); c.lineTo(tr * 1.05, tr * 0.5); c.closePath(); }
  camoFill(c, tg, wreck ? null : o.camo, tr * 2, tr * 2, 11);
  c.strokeStyle = "rgba(0,0,0,.4)"; c.lineWidth = 1; c.stroke();
  // mantlet
  c.fillStyle = wreck ? "#262522" : shade(color, -26); rr(c, tr * 0.55, -L0.bW / 2 - 2, tr * 0.5, L0.bW + 4, 1.5); c.fill();
  // hatches, periscopes, machine gun
  c.fillStyle = "rgba(0,0,0,.35)"; c.beginPath(); c.arc(-tr * 0.3, -tr * 0.32, tr * 0.24, 0, TAU); c.fill();
  c.fillStyle = "rgba(255,255,255,.12)"; c.beginPath(); c.arc(-tr * 0.32, -tr * 0.35, tr * 0.12, 0, TAU); c.fill();
  c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.arc(-tr * 0.25, tr * 0.32, tr * 0.18, 0, TAU); c.fill();
  if (!wreck) {
    c.fillStyle = "#1d2020"; c.fillRect(-tr * 0.35, tr * 0.28, tr * 0.6, 1.4);
    if (modern) { c.fillStyle = "#2b3133"; rr(c, tr * 0.1, -tr * 0.75, tr * 0.32, tr * 0.28, 1); c.fill(); c.fillStyle = "rgba(140,200,230,.5)"; c.fillRect(tr * 0.32, -tr * 0.7, 1.4, tr * 0.18); }
    c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(-tr * 0.95, -tr * 0.5, 1.6, tr); // rear bustle line
  }
  if (o.flash > 0) { c.fillStyle = "#ffe29a"; c.beginPath(); c.arc(tr * 0.4 + bl + 5, 0, 7, 0, TAU); c.fill(); c.fillStyle = "#fff6d0"; c.beginPath(); c.arc(tr * 0.4 + bl + 4, 0, 3.5, 0, TAU); c.fill(); }
  c.restore();
}

function planeShape(c, v, r, wing, L0) {
  const len = r * L0.len, span = r * L0.span * (wing || 1);
  const pts = [];
  if (L0.wing === "straight") { c.beginPath(); c.moveTo(r * 0.62, 0); c.lineTo(r * 0.52, -span); c.quadraticCurveTo(r * 0.42, -span * 1.04, r * 0.3, -span); c.lineTo(r * 0.08, 0); c.lineTo(r * 0.3, span); c.quadraticCurveTo(r * 0.42, span * 1.04, r * 0.52, span); c.closePath(); }
  else if (L0.wing === "elliptic") { c.beginPath(); c.ellipse(r * 0.35, 0, r * 0.32, span, 0, 0, TAU); }
  else if (L0.wing === "swept") { c.beginPath(); c.moveTo(r * 0.7, 0); c.lineTo(-r * 0.15, -span); c.lineTo(-r * 0.42, -span); c.lineTo(-r * 0.12, -r * 0.1); c.lineTo(-r * 0.12, r * 0.1); c.lineTo(-r * 0.42, span); c.lineTo(-r * 0.15, span); c.closePath(); }
  else { c.beginPath(); c.moveTo(len * 0.55, 0); c.lineTo(-len * 0.55, -span); c.lineTo(-len * 0.7, -span); c.lineTo(-len * 0.7, span); c.lineTo(-len * 0.55, span); c.closePath(); }
  return pts;
}
function drawPlane(c, v, x, y, a, o) {
  const L0 = v.look, r = v.r, len = r * L0.len;
  const color = o.color || (o.camo && o.camo.colors ? o.camo.colors[0] : L0.color);
  const wingK = 1 - Math.abs(o.bank || 0) * 0.25, jet = L0.engines === "jet";
  if (o.shadow !== false) {
    c.save(); c.translate(x + 18, y + 26); c.rotate(a); c.globalAlpha = 0.22; c.fillStyle = "#000";
    planeShape(c, v, r, wingK, L0); c.fill(); rr(c, -len, -3, len * 2, 6, 3); c.fill();
    c.restore();
  }
  c.save(); c.translate(x, y); c.rotate(a);
  // tail planes
  c.fillStyle = shade(color, -22);
  if (L0.boom) { c.fillStyle = shade(color, -8); rr(c, -len * 0.95, -r * 0.62, len * 1.35, 3.2, 1.6); c.fill(); rr(c, -len * 0.95, r * 0.62 - 3.2, len * 1.35, 3.2, 1.6); c.fill(); c.fillStyle = shade(color, -22); c.fillRect(-len * 0.98, -r * 0.65, 3, r * 1.3); }
  else if (L0.tail === "twin") { c.fillRect(-len * 0.95, -r * 0.55, r * 0.35, r * 0.3); c.fillRect(-len * 0.95, r * 0.25, r * 0.35, r * 0.3); }
  if (L0.wing !== "delta" && !L0.boom) { c.beginPath(); c.moveTo(-len * 0.7, 0); c.lineTo(-len * 1.0, -r * 0.5); c.lineTo(-len * 1.05, -r * 0.5); c.lineTo(-len * 0.98, 0); c.lineTo(-len * 1.05, r * 0.5); c.lineTo(-len * 1.0, r * 0.5); c.closePath(); c.fill(); }
  if (L0.canard) { c.beginPath(); c.moveTo(len * 0.62, -2); c.lineTo(len * 0.4, -r * 0.42); c.lineTo(len * 0.34, -r * 0.42); c.lineTo(len * 0.42, 0); c.lineTo(len * 0.34, r * 0.42); c.lineTo(len * 0.4, r * 0.42); c.lineTo(len * 0.62, 2); c.closePath(); c.fill(); }
  // wings with a light leading edge and panel lines
  const wcol = shade(color, -10);
  planeShape(c, v, r, wingK, L0);
  const wg = c.createLinearGradient(r * 0.6, 0, -r * 0.3, 0); wg.addColorStop(0, shade(wcol, 22)); wg.addColorStop(0.35, wcol); wg.addColorStop(1, shade(wcol, -18));
  camoFill(c, wg, o.camo, r * 2, r * 3, 5);
  c.strokeStyle = "rgba(0,0,0,.28)"; c.lineWidth = 0.8; c.stroke();
  const sp = r * L0.span * wingK * 0.7;
  c.strokeStyle = "rgba(0,0,0,.14)"; c.beginPath(); c.moveTo(r * 0.38, -sp * 1.25); c.lineTo(r * 0.38, sp * 1.25); c.stroke();
  if (L0.biplane) { c.globalAlpha = 0.9; c.fillStyle = shade(wcol, 14); rr(c, r * 0.32, -r * L0.span * wingK * 0.95, r * 0.34, r * L0.span * wingK * 1.9, 3); c.fill(); c.globalAlpha = 1; c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(r * 0.4, -sp, 1.2, 1.2); c.fillRect(r * 0.4, sp, 1.2, 1.2); }
  // engines
  if (L0.engines === 2) {
    for (const ey of [-r * 0.65, r * 0.65]) {
      c.fillStyle = shade(color, -30); rr(c, -r * 0.15, ey - r * 0.11, r * 0.85, r * 0.22, 3); c.fill();
      if (L0.wing !== "swept") { c.fillStyle = "rgba(255,255,255,.28)"; c.fillRect(r * 0.72, ey - r * 0.32, 1.4, r * 0.64); }
      else { c.fillStyle = "#1e2226"; c.beginPath(); c.arc(-r * 0.15, ey, 1.8, 0, TAU); c.fill(); }
    }
  }
  // fuselage with shading
  const fg = c.createLinearGradient(0, -4, 0, 4); fg.addColorStop(0, shade(color, 28)); fg.addColorStop(0.5, color); fg.addColorStop(1, shade(color, -30));
  c.beginPath(); c.moveTo(len + (jet ? 3 : 0), 0); c.quadraticCurveTo(len * 0.8, -3.9, len * 0.3, -3.9); c.lineTo(-len * 0.85, -2.4); c.lineTo(-len, -1.5); c.lineTo(-len, 1.5); c.lineTo(-len * 0.85, 2.4); c.lineTo(len * 0.3, 3.9); c.quadraticCurveTo(len * 0.8, 3.9, len + (jet ? 3 : 0), 0); c.closePath();
  camoFill(c, fg, o.camo, len * 2, 8, 9);
  c.strokeStyle = "rgba(0,0,0,.3)"; c.lineWidth = 0.8; c.stroke();
  if (jet) { c.fillStyle = "#1e2226"; c.beginPath(); c.arc(-len, 0, 2.4, 0, TAU); c.fill(); c.fillStyle = "rgba(255,150,60,.35)"; c.beginPath(); c.arc(-len - 1, 0, 1.4, 0, TAU); c.fill(); }
  else if (L0.radial) { c.fillStyle = shade(color, -45); c.beginPath(); c.arc(len - 1, 0, 4.2, -Math.PI / 2, Math.PI / 2); c.fill(); }
  // canopy glass with frame
  c.fillStyle = "#1f2a33"; c.beginPath(); c.ellipse(len * 0.32, 0, 4.4, 2.5, 0, 0, TAU); c.fill();
  c.fillStyle = "rgba(170,215,240,.55)"; c.beginPath(); c.ellipse(len * 0.36, -0.7, 2.4, 1.1, 0, 0, TAU); c.fill();
  c.strokeStyle = "rgba(0,0,0,.4)"; c.lineWidth = 0.6; c.beginPath(); c.moveTo(len * 0.32, -2.4); c.lineTo(len * 0.32, 2.4); c.stroke();
  // propeller disc
  if (!jet && L0.engines !== 2) { c.fillStyle = "rgba(255,255,255,.18)"; c.beginPath(); c.ellipse(len + 1.5, 0, 1.4, r * 0.6, 0, 0, TAU); c.fill(); c.fillStyle = "#2a2d30"; c.beginPath(); c.arc(len + 1, 0, 1.6, 0, TAU); c.fill(); }
  // roundels
  c.fillStyle = o.team === "enemy" ? "#c2553f" : o.team === "ally" ? "#d9a441" : "rgba(0,0,0,0)";
  if (o.team) { c.beginPath(); c.arc(r * 0.2, -sp, 2.4, 0, TAU); c.arc(r * 0.2, sp, 2.4, 0, TAU); c.fill(); c.fillStyle = "rgba(255,255,255,.7)"; c.beginPath(); c.arc(r * 0.2, -sp, 0.9, 0, TAU); c.arc(r * 0.2, sp, 0.9, 0, TAU); c.fill(); }
  if (o.flash > 0) { c.fillStyle = "#ffe29a"; c.fillRect(len * 0.2, -sp * 0.8 - 1, 8, 2); c.fillRect(len * 0.2, sp * 0.8 - 1, 8, 2); }
  c.restore();
}

function drawShip(c, v, x, y, a, ta, o) {
  const L0 = v.look, r = v.r, L = r * L0.len, Wd = r * L0.beam;
  const wreck = o.wreck, color = wreck ? "#3a3936" : (o.color || (o.camo && o.camo.colors ? o.camo.colors[0] : L0.color));
  c.save(); c.translate(x, y); c.rotate(a);
  // hull outline with a dark waterline
  c.beginPath(); c.moveTo(L + r * 0.25, 0); c.quadraticCurveTo(L * 0.55, -Wd * 1.05, L * 0.1, -Wd); c.lineTo(-L * 0.9, -Wd * 0.92); c.quadraticCurveTo(-L * 1.02, 0, -L * 0.9, Wd * 0.92); c.lineTo(L * 0.1, Wd); c.quadraticCurveTo(L * 0.55, Wd * 1.05, L + r * 0.25, 0); c.closePath();
  c.fillStyle = wreck ? "#2c2b28" : shade(color, -40); c.fill();
  c.strokeStyle = wreck ? "rgba(0,0,0,.3)" : "rgba(120,30,25,.55)"; c.lineWidth = 1.2; c.stroke();
  // deck
  c.beginPath(); c.moveTo(L, 0); c.quadraticCurveTo(L * 0.55, -Wd * 0.85, L * 0.1, -Wd * 0.82); c.lineTo(-L * 0.86, -Wd * 0.75); c.quadraticCurveTo(-L * 0.96, 0, -L * 0.86, Wd * 0.75); c.lineTo(L * 0.1, Wd * 0.82); c.quadraticCurveTo(L * 0.55, Wd * 0.85, L, 0); c.closePath();
  const deckCol = wreck ? "#3d3c38" : v.role === "battleship" || v.role === "cruiser" ? "#9a8a68" : shade(color, 6);
  camoFill(c, wreck ? deckCol : sideGrad(c, deckCol, Wd, 14), wreck ? null : o.camo, L * 2, Wd * 2, 13);
  if (!wreck) {
    c.save(); c.clip(); c.strokeStyle = "rgba(0,0,0,.1)"; c.lineWidth = 0.7; c.beginPath();
    for (let k = -3; k <= 3; k++) { c.moveTo(L, k * Wd * 0.22); c.lineTo(-L, k * Wd * 0.22); }
    c.stroke(); c.restore();
    // grey steel side strips (the deck edge) on wooden decks
    if (v.role === "battleship" || v.role === "cruiser") { c.strokeStyle = shade(color, -5); c.lineWidth = 2; c.beginPath(); c.moveTo(L * 0.9, -Wd * 0.3); c.quadraticCurveTo(L * 0.5, -Wd * 0.8, L * 0.1, -Wd * 0.78); c.lineTo(-L * 0.84, -Wd * 0.7); c.moveTo(L * 0.9, Wd * 0.3); c.quadraticCurveTo(L * 0.5, Wd * 0.8, L * 0.1, Wd * 0.78); c.lineTo(-L * 0.84, Wd * 0.7); c.stroke(); }
  }
  // superstructure: layered blocks, mast, radar
  const bw = r * L0.bridge;
  c.fillStyle = wreck ? "#2e2d2a" : shade(color, 16); rr(c, -bw * 0.55, -Wd * 0.5, bw * 1.1, Wd, 3); c.fill();
  c.strokeStyle = "rgba(0,0,0,.3)"; c.lineWidth = 0.8; c.stroke();
  c.fillStyle = wreck ? "#2e2d2a" : shade(color, 30); rr(c, -bw * 0.15, -Wd * 0.34, bw * 0.55, Wd * 0.68, 2); c.fill();
  if (!wreck) {
    c.fillStyle = "rgba(160,205,230,.45)"; c.fillRect(bw * 0.36, -Wd * 0.26, 1.3, Wd * 0.52); // bridge windows
    c.strokeStyle = "#2a2f33"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(bw * 0.05, -Wd * 0.75); c.lineTo(bw * 0.05, Wd * 0.75); c.stroke(); // yard of the mast
    c.fillStyle = "#2a2f33"; c.beginPath(); c.arc(bw * 0.05, 0, 2, 0, TAU); c.fill();
    if (v.tier >= 4) { c.strokeStyle = "rgba(220,230,235,.7)"; c.lineWidth = 1; c.beginPath(); c.arc(bw * 0.05, 0, 3.6, -0.6, 0.6); c.stroke(); }
    // light anti-aircraft guns along the sides
    if (v.role !== "boat") { c.fillStyle = "#3a4044"; const n = Math.min(6, 1 + v.tier); for (let k = 0; k < n; k++) { const ax = L * 0.35 - k * (L * 0.85 / n); c.beginPath(); c.arc(ax, -Wd * 0.62, 1.6, 0, TAU); c.arc(ax, Wd * 0.62, 1.6, 0, TAU); c.fill(); } }
    // lifeboats
    if (v.role === "battleship" || v.role === "cruiser") { c.fillStyle = "#c9c6b8"; for (const sy of [-1, 1]) { rr(c, -bw * 1.25, sy * Wd * 0.45 - 1.5, r * 0.32, 3, 1.5); c.fill(); } }
    if (L0.missiles) { c.fillStyle = shade(color, -20); for (let k = 0; k < 4; k++) { rr(c, L * 0.12 + k * 0.1 * L, -Wd * 0.5, L * 0.08, Wd * 0.32, 1); c.fill(); rr(c, L * 0.12 + k * 0.1 * L, Wd * 0.18, L * 0.08, Wd * 0.32, 1); c.fill(); } }
  }
  for (let i = 0; i < L0.funnels; i++) { const fx = -bw * 0.65 - i * r * 0.42; c.fillStyle = wreck ? "#222" : "#3a4044"; c.beginPath(); c.ellipse(fx, 0, r * 0.18, Wd * 0.33, 0, 0, TAU); c.fill(); c.fillStyle = "#15181a"; c.beginPath(); c.ellipse(fx, 0, r * 0.1, Wd * 0.2, 0, 0, TAU); c.fill(); if (!wreck) { c.fillStyle = "rgba(0,0,0,.6)"; c.fillRect(fx - r * 0.18, -Wd * 0.05, r * 0.36, Wd * 0.1); } }
  c.restore();
  // gun turrets: spread along the deck, all aim the same way
  const n = L0.turrets, ts = [];
  if (n === 1) ts.push(0.62);
  else if (n === 2) ts.push(0.62, -0.62);
  else if (n === 3) ts.push(0.7, 0.42, -0.65);
  else ts.push(0.72, 0.46, -0.5, -0.74);
  for (let i = 0; i < ts.length; i++) {
    const k = ts[i], tx = x + Math.cos(a) * L * k, ty = y + Math.sin(a) * L * k;
    c.save(); c.translate(tx, ty); c.rotate(ta);
    const tr = r * (v.role === "battleship" ? 0.32 : v.role === "boat" ? 0.22 : 0.26), bl = r * (v.role === "battleship" ? 0.95 : 0.7);
    c.fillStyle = wreck ? "#252422" : shade(color, -45);
    const barrels = v.role === "battleship" ? 3 : v.role === "boat" ? 1 : 2;
    for (let b = 0; b < barrels; b++) c.fillRect(tr * 0.5, (b - (barrels - 1) / 2) * 3.2 - 1.1, bl, 2.2);
    c.fillStyle = wreck ? "#2e2d2a" : shade(color, -18);
    c.beginPath(); c.moveTo(tr * 1.0, -tr * 0.7); c.lineTo(tr * 1.0, tr * 0.7); c.lineTo(-tr * 0.8, tr * 0.95); c.lineTo(-tr * 0.8, -tr * 0.95); c.closePath(); c.fill();
    if (o.flash > 0 && i === 0) { c.fillStyle = "#ffe29a"; c.beginPath(); c.arc(tr * 0.5 + bl + 5, 0, 8, 0, TAU); c.fill(); }
    c.restore();
  }
}

// main entry: draw any vehicle
WOV.drawVehicle = function (c, v, x, y, a, ta, o) {
  o = o || {};
  if (v.kind === "tank") drawTank(c, v, x, y, a, ta, o);
  else if (v.kind === "ship") drawShip(c, v, x, y, a, ta, o);
  else drawPlane(c, v, x, y, a, o);
};
// gun muzzle position in world coordinates (for firing)
WOV.muzzle = function (u) {
  const v = u.v, L0 = v.look;
  if (v.kind === "plane") return { x: u.x + Math.cos(u.angle) * v.r * 1.3, y: u.y + Math.sin(u.angle) * v.r * 1.3, a: u.angle };
  if (v.kind === "ship") {
    const L = v.r * L0.len, tx = u.x + Math.cos(u.angle) * L * 0.65, ty = u.y + Math.sin(u.angle) * L * 0.65, bl = v.r * 0.9;
    return { x: tx + Math.cos(u.tAngle) * bl, y: ty + Math.sin(u.tAngle) * bl, a: u.tAngle };
  }
  const tx = u.x + Math.cos(u.angle) * v.r * L0.tPos, ty = u.y + Math.sin(u.angle) * v.r * L0.tPos;
  const bl = v.r * (L0.tR * 0.4 + L0.bL);
  return { x: tx + Math.cos(u.tAngle) * bl, y: ty + Math.sin(u.tAngle) * bl, a: u.tAngle };
};

// preview into a small canvas (cards, hangar, tree)
WOV.preview = function (canvas, v, opts) {
  opts = opts || {};
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
  if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const c = canvas.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  const ext = v.kind === "ship" ? v.r * v.look.len * 2.05 : v.kind === "plane" ? v.r * Math.max(v.look.span * 2.4, v.look.len * 2.3) : v.r * Math.max(v.look.L * 2, v.look.bL + 1) * 1.6;
  const s = (opts.fill || 0.8) * Math.min(w, h) / ext;
  c.translate(w / 2, h / 2); c.scale(s, s);
  const a = opts.angle !== undefined ? opts.angle : -Math.PI / 2;
  const ta = opts.tAngle !== undefined ? opts.tAngle : a + 0.35;
  WOV.drawVehicle(c, v, 0, 0, a, ta, { camo: opts.camo, shadow: v.kind === "plane", color: opts.color });
};
})();
