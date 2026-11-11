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

function drawTank(c, v, x, y, a, ta, o) {
  const L0 = v.look, r = v.r, L = r * L0.L, Wd = r * L0.Wd;
  const wreck = o.wreck, color = wreck ? "#3a3936" : (o.color || (o.camo && o.camo.colors ? o.camo.colors[0] : L0.color));
  c.save(); c.translate(x, y); c.rotate(a);
  // shadow
  if (!wreck) { c.fillStyle = "rgba(0,0,0,.25)"; rr(c, -L + 3, -Wd - 1, L * 2, Wd * 2 + 6, 5); c.fill(); }
  // tracks
  c.fillStyle = wreck ? "#262624" : "#2b2f2d";
  rr(c, -L, -Wd - 3, L * 2, 8, 3); c.fill(); rr(c, -L, Wd - 5, L * 2, 8, 3); c.fill();
  if (!wreck) {
    c.fillStyle = "#4a504c"; const off = (((o.track || 0) % 7) + 7) % 7;
    for (let i = -L + 2 + off; i < L - 2; i += 7) { c.fillRect(i, -Wd - 3, 2, 8); c.fillRect(i, Wd - 5, 2, 8); }
  }
  if (L0.skirts && !wreck) { c.fillStyle = shade(color, -25); c.fillRect(-L + 4, -Wd - 3, L * 2 - 8, 3); c.fillRect(-L + 4, Wd + 1, L * 2 - 8, 3); }
  // hull
  rr(c, -L + 2, -Wd + 3, L * 2 - 4, Wd * 2 - 6, 4); camoFill(c, color, wreck ? null : o.camo, L * 2, Wd * 2, 3);
  c.fillStyle = "rgba(0,0,0,.2)"; c.beginPath(); c.moveTo(L - 2, -Wd + 3); c.lineTo(L - 9, -Wd + 6); c.lineTo(L - 9, Wd - 6); c.lineTo(L - 2, Wd - 3); c.closePath(); c.fill();
  c.fillStyle = "rgba(255,255,255,.07)"; c.fillRect(-L + 4, -Wd + 4, L * 2 - 14, 3);
  c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(-L + 4, -Wd * 0.35, 5, Wd * 0.7); // engine deck
  c.restore();
  // turret
  const tx = x + Math.cos(a) * r * L0.tPos, ty = y + Math.sin(a) * r * L0.tPos;
  c.save(); c.translate(tx, ty); c.rotate(ta);
  const tr = r * L0.tR, bl = r * L0.bL, tcol = wreck ? "#2e2d2a" : shade(color, -14);
  c.fillStyle = wreck ? "#252422" : shade(color, -40);
  c.fillRect(tr * 0.4, -L0.bW / 2, bl, L0.bW);
  if (L0.brake) c.fillRect(tr * 0.4 + bl - 4, -L0.bW / 2 - 1.5, 5, L0.bW + 3);
  c.fillStyle = tcol;
  if (L0.turret === "round") { c.beginPath(); c.arc(0, 0, tr, 0, TAU); camoFill(c, tcol, wreck ? null : o.camo, tr * 2, tr * 2, 11); }
  else if (L0.turret === "dome") { c.beginPath(); c.ellipse(-tr * 0.05, 0, tr * 1.05, tr * 0.95, 0, 0, TAU); camoFill(c, tcol, wreck ? null : o.camo, tr * 2, tr * 2, 11); }
  else if (L0.turret === "box") { rr(c, -tr * 0.9, -tr * 0.85, tr * 1.75, tr * 1.7, 3); camoFill(c, tcol, wreck ? null : o.camo, tr * 2, tr * 2, 11); }
  else if (L0.turret === "wedge") { c.beginPath(); c.moveTo(tr * 0.95, -tr * 0.55); c.lineTo(tr * 0.95, tr * 0.55); c.lineTo(-tr * 0.9, tr * 0.85); c.lineTo(-tr * 0.9, -tr * 0.85); c.closePath(); camoFill(c, tcol, wreck ? null : o.camo, tr * 2, tr * 2, 11); }
  else { c.beginPath(); c.moveTo(tr * 1.05, -tr * 0.5); c.lineTo(tr * 0.7, -tr * 0.9); c.lineTo(-tr * 1.2, -tr * 0.9); c.lineTo(-tr * 1.2, tr * 0.9); c.lineTo(tr * 0.7, tr * 0.9); c.lineTo(tr * 1.05, tr * 0.5); c.closePath(); camoFill(c, tcol, wreck ? null : o.camo, tr * 2, tr * 2, 11); }
  c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.arc(-tr * 0.25, -tr * 0.3, tr * 0.22, 0, TAU); c.fill(); // hatch
  c.fillStyle = "rgba(255,255,255,.1)"; c.beginPath(); c.arc(-tr * 0.2, tr * 0.25, tr * 0.18, 0, TAU); c.fill();
  if (o.flash > 0) { c.fillStyle = "#ffe29a"; c.beginPath(); c.arc(tr * 0.4 + bl + 5, 0, 7, 0, TAU); c.fill(); c.fillStyle = "#fff6d0"; c.beginPath(); c.arc(tr * 0.4 + bl + 4, 0, 3.5, 0, TAU); c.fill(); }
  c.restore();
}

function planeShape(c, v, r, wing, L0) {
  const len = r * L0.len, span = r * L0.span * (wing || 1);
  const pts = [];
  if (L0.wing === "straight") { c.beginPath(); c.moveTo(r * 0.25, -span); c.lineTo(r * 0.55, -span); c.lineTo(r * 0.55, span); c.lineTo(r * 0.25, span); c.closePath(); }
  else if (L0.wing === "elliptic") { c.beginPath(); c.ellipse(r * 0.35, 0, r * 0.32, span, 0, 0, TAU); }
  else if (L0.wing === "swept") { c.beginPath(); c.moveTo(r * 0.5, -r * 0.15); c.lineTo(-r * 0.25, -span); c.lineTo(-r * 0.05, -span); c.lineTo(r * 0.6, 0); c.lineTo(-r * 0.05, span); c.lineTo(-r * 0.25, span); c.lineTo(r * 0.5, r * 0.15); c.closePath(); }
  else { c.beginPath(); c.moveTo(len * 0.55, 0); c.lineTo(-len * 0.55, -span); c.lineTo(-len * 0.7, -span); c.lineTo(-len * 0.7, span); c.lineTo(-len * 0.55, span); c.closePath(); }
  return pts;
}
function drawPlane(c, v, x, y, a, o) {
  const L0 = v.look, r = v.r, len = r * L0.len;
  const color = o.color || (o.camo && o.camo.colors ? o.camo.colors[0] : L0.color);
  const wingK = 1 - Math.abs(o.bank || 0) * 0.25;
  if (o.shadow !== false) {
    c.save(); c.translate(x + 18, y + 26); c.rotate(a); c.globalAlpha = 0.22; c.fillStyle = "#000";
    planeShape(c, v, r, wingK, L0); c.fill(); rr(c, -len, -3, len * 2, 6, 3); c.fill();
    c.restore();
  }
  c.save(); c.translate(x, y); c.rotate(a);
  // tail
  c.fillStyle = shade(color, -25);
  if (L0.tail === "twin") { c.fillRect(-len * 0.95, -r * 0.55, r * 0.35, r * 0.3); c.fillRect(-len * 0.95, r * 0.25, r * 0.35, r * 0.3); }
  if (L0.wing !== "delta") { c.beginPath(); c.moveTo(-len * 0.7, 0); c.lineTo(-len * 1.0, -r * 0.5); c.lineTo(-len * 1.05, -r * 0.5); c.lineTo(-len * 0.98, 0); c.lineTo(-len * 1.05, r * 0.5); c.lineTo(-len * 1.0, r * 0.5); c.closePath(); c.fill(); }
  // wings
  planeShape(c, v, r, wingK, L0); camoFill(c, shade(color, -12), o.camo, r * 2, r * 3, 5);
  // engines
  if (L0.engines === 2) { c.fillStyle = shade(color, -40); rr(c, -r * 0.1, -r * 0.75, r * 0.75, r * 0.2, 3); c.fill(); rr(c, -r * 0.1, r * 0.55, r * 0.75, r * 0.2, 3); c.fill(); }
  // fuselage
  rr(c, -len, -3.8, len * 2, 7.6, 3.8); camoFill(c, color, o.camo, len * 2, 8, 9);
  if (L0.engines === "jet") { c.fillStyle = "#1e2226"; c.beginPath(); c.arc(-len, 0, 2.6, 0, TAU); c.fill(); }
  c.fillStyle = "#26313a"; c.beginPath(); c.ellipse(len * 0.35, 0, 4, 2.4, 0, 0, TAU); c.fill(); // canopy
  c.fillStyle = "rgba(170,210,235,.5)"; c.beginPath(); c.ellipse(len * 0.4, -0.6, 2, 1, 0, 0, TAU); c.fill();
  if (L0.engines !== "jet" && L0.engines !== 2) { c.fillStyle = "rgba(255,255,255,.3)"; c.fillRect(len + 1, -r * 0.55, 1.6, r * 1.1); }
  c.fillStyle = o.team === "enemy" ? "#c2553f" : o.team === "ally" ? "#d9a441" : "rgba(0,0,0,0)"; // roundels
  const sp = r * L0.span * wingK * 0.7;
  if (o.team) { c.beginPath(); c.arc(r * 0.2, -sp, 2.4, 0, TAU); c.arc(r * 0.2, sp, 2.4, 0, TAU); c.fill(); }
  if (o.flash > 0) { c.fillStyle = "#ffe29a"; c.fillRect(len * 0.2, -sp * 0.8 - 1, 8, 2); c.fillRect(len * 0.2, sp * 0.8 - 1, 8, 2); }
  c.restore();
}

function drawShip(c, v, x, y, a, ta, o) {
  const L0 = v.look, r = v.r, L = r * L0.len, Wd = r * L0.beam;
  const wreck = o.wreck, color = wreck ? "#3a3936" : (o.color || (o.camo && o.camo.colors ? o.camo.colors[0] : L0.color));
  c.save(); c.translate(x, y); c.rotate(a);
  // hull outline
  c.beginPath(); c.moveTo(L + r * 0.25, 0); c.quadraticCurveTo(L * 0.55, -Wd * 1.05, L * 0.1, -Wd); c.lineTo(-L * 0.9, -Wd * 0.92); c.quadraticCurveTo(-L * 1.02, 0, -L * 0.9, Wd * 0.92); c.lineTo(L * 0.1, Wd); c.quadraticCurveTo(L * 0.55, Wd * 1.05, L + r * 0.25, 0); c.closePath();
  c.fillStyle = wreck ? "#2c2b28" : shade(color, -38); c.fill();
  // deck
  c.beginPath(); c.moveTo(L, 0); c.quadraticCurveTo(L * 0.55, -Wd * 0.85, L * 0.1, -Wd * 0.82); c.lineTo(-L * 0.86, -Wd * 0.75); c.quadraticCurveTo(-L * 0.96, 0, -L * 0.86, Wd * 0.75); c.lineTo(L * 0.1, Wd * 0.82); c.quadraticCurveTo(L * 0.55, Wd * 0.85, L, 0); c.closePath();
  camoFill(c, wreck ? "#3d3c38" : shade(color, 6), wreck ? null : o.camo, L * 2, Wd * 2, 13);
  c.strokeStyle = "rgba(0,0,0,.15)"; c.lineWidth = 1; c.beginPath(); c.moveTo(L * 0.8, 0); c.lineTo(-L * 0.8, 0); c.stroke();
  // superstructure
  const bw = r * L0.bridge;
  c.fillStyle = wreck ? "#2e2d2a" : shade(color, 22); rr(c, -bw * 0.5, -Wd * 0.48, bw, Wd * 0.96, 3); c.fill();
  c.fillStyle = wreck ? "#2e2d2a" : shade(color, 34); rr(c, -bw * 0.2, -Wd * 0.3, bw * 0.45, Wd * 0.6, 2); c.fill();
  for (let i = 0; i < L0.funnels; i++) { c.fillStyle = wreck ? "#222" : "#3a4044"; c.beginPath(); c.ellipse(-bw * 0.6 - i * r * 0.42, 0, r * 0.17, Wd * 0.32, 0, 0, TAU); c.fill(); c.fillStyle = "#15181a"; c.beginPath(); c.ellipse(-bw * 0.6 - i * r * 0.42, 0, r * 0.1, Wd * 0.2, 0, 0, TAU); c.fill(); }
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
