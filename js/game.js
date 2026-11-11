// War of Victor: battle engine (team battles with bots, tanks/planes/ships)
(function () {
"use strict";
const WOV = (window.WOV = window.WOV || {});
const TAU = Math.PI * 2;
const angNorm = a => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };
const approachAng = (a, t, m) => { const d = angNorm(t - a); return Math.abs(d) <= m ? t : a + Math.sign(d) * m; };
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const SFX = (n, o) => WOV.Audio && WOV.Audio.sfx(n, o);
const CALLSIGNS = ["IronFox", "Kozak77", "SkyWolf", "Grizzly", "Taifun", "Mamont", "Viper", "Orel_12", "LeoMax", "Burya", "Delta7", "Rysak", "Kraken", "Shtorm", "Barsik", "NightOwl", "Hetman", "Bison", "Sapsan", "Vikhor", "Granit", "Komar", "Ataman", "Stepovyk"];
const TEAM_COL = ["#d9a441", "#e0604a"];

const cv = document.getElementById("game"), ctx = cv.getContext("2d");
let W = 0, H = 0, DPR = 1, lowFx = false;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, lowFx ? 1 : 1.5);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize); resize();
if (WOV.tg) WOV.tg.onEvent("viewportChanged", resize);

// ---------- input ----------
const keys = {};
window.addEventListener("keydown", e => {
  keys[e.code] = true; if (e.code === "Space" && B) e.preventDefault();
  if (!B || B.over || B.player.dead || e.repeat) return;
  const n = { Digit1: 0, Digit2: 1, Digit3: 2 }[e.code];
  if (n !== undefined && AMMO[B.player.kind][n]) setAmmo(B.player, AMMO[B.player.kind][n].id);
  if (e.code === "KeyR") useRepair(B.player);
});
window.addEventListener("keyup", e => { keys[e.code] = false; });
const mouse = { x: 0, y: 0, down: false, active: false };
cv.addEventListener("mousemove", e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; });
cv.addEventListener("mousedown", e => { mouse.active = true; if (B && pressButton(e.clientX, e.clientY, null)) return; mouse.down = true; });
window.addEventListener("mouseup", () => { mouse.down = false; });
const sticks = { L: { id: null, ox: 0, oy: 0, dx: 0, dy: 0 }, R: { id: null, ox: 0, oy: 0, dx: 0, dy: 0 } };
const STICK_R = 60;
const fireBtn = { id: null };
let usingTouch = !!((window.matchMedia && matchMedia("(pointer: coarse)").matches) || ("ontouchstart" in window && navigator.maxTouchPoints > 0));
cv.addEventListener("touchstart", e => {
  e.preventDefault(); usingTouch = true; mouse.active = false;
  for (const t of e.changedTouches) {
    if (B && pressButton(t.clientX, t.clientY, t.identifier)) continue;
    const s = t.clientX < W / 2 ? sticks.L : sticks.R; if (s.id !== null) continue; s.id = t.identifier; s.ox = t.clientX; s.oy = t.clientY; s.dx = s.dy = 0;
  }
}, { passive: false });
cv.addEventListener("touchmove", e => {
  e.preventDefault();
  for (const t of e.changedTouches) for (const s of [sticks.L, sticks.R]) if (s.id === t.identifier) {
    let dx = t.clientX - s.ox, dy = t.clientY - s.oy; const d = Math.hypot(dx, dy);
    if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
    s.dx = dx / STICK_R; s.dy = dy / STICK_R;
  }
}, { passive: false });
const endTouch = e => { e.preventDefault(); for (const t of e.changedTouches) { if (fireBtn.id === t.identifier) fireBtn.id = null; for (const s of [sticks.L, sticks.R]) if (s.id === t.identifier) { s.id = null; s.dx = s.dy = 0; } } };

// on-screen buttons: fire (touch), ammo types and repair kit, arranged around the bottom-right corner
function safeBottom() { const tg = WOV.tg; return (tg && tg.safeAreaInset && tg.safeAreaInset.bottom) || 0; }
function controls() {
  const p = B.player, fx = W - (usingTouch ? 76 : 56), fy = H - (usingTouch ? 96 : 56) - safeBottom(), R = usingTouch ? 90 : 78, list = [];
  if (usingTouch) list.push({ k: "fire", x: fx, y: fy, r: 44 });
  AMMO[p.kind].forEach((a, i) => { const ang = Math.PI + i * 0.55; list.push({ k: "ammo", a, i, x: fx + Math.cos(ang) * R, y: fy + Math.sin(ang) * R, r: 23 }); });
  const ang = Math.PI + 3 * 0.55; list.push({ k: "repair", x: fx + Math.cos(ang) * R, y: fy + Math.sin(ang) * R, r: 21 });
  return list;
}
function pressButton(x, y, touchId) {
  const p = B.player; if (p.dead || B.over) return false;
  for (const b of controls()) {
    if ((x - b.x) ** 2 + (y - b.y) ** 2 > (b.r + 8) ** 2) continue;
    if (b.k === "fire") { if (touchId !== null) fireBtn.id = touchId; }
    else if (b.k === "ammo") setAmmo(p, b.a.id);
    else useRepair(p);
    return true;
  }
  return false;
}
cv.addEventListener("touchend", endTouch, { passive: false });
cv.addEventListener("touchcancel", endTouch, { passive: false });

// ---------- battle state ----------
let B = null; // current battle
// a battle also ends early when nobody has dealt damage for 30 s (e.g. last tank vs last ship far apart)
let last = 0, raf = 0;
const perf = { n: 0, acc: 0 };

function makeUnit(v, team, pos, name, isPlayer, camo) {
  const a = team === 0 ? 0 : Math.PI;
  return { v, kind: v.kind, team, x: pos.x, y: pos.y, r: v.r, angle: a, tAngle: a, vel: v.kind === "plane" ? v.speed * 0.8 : 0,
    hp: v.hp, maxHp: v.hp, cd: rnd(0.5, 1.5), aaCd: 0, flash: 0, track: 0, bank: 0, name, isPlayer, camo,
    kills: 0, dmgDone: 0, mods: {}, fire: 0, ammo: AMMO[v.kind][0].id, limited: {}, repairUsed: false, stall: 0, wet: false, trackAcc: 0, S: null, ai: { wx: pos.x, wy: pos.y, retarget: 0, stuck: 0, pass: 0, target: null, think: 0 } };
}

// fair matchmaking: mostly the player's own tier, sometimes one lower, rarely one higher; both teams get the same tiers
function slotTier(tier) { const r = Math.random(); return clamp(r < 0.8 ? tier : r < 0.95 ? tier - 1 : tier + 1, 1, 7); }
function pickBotVehicle(kind, tier) {
  const t = clamp(tier, 1, 7);
  const pool = WOV.VEHICLES.filter(v => v.kind === kind && v.tier === t && !v.prem);
  return pick(pool.length ? pool : WOV.VEHICLES.filter(v => v.kind === kind && v.tier === 1));
}

function start(modeId, onEnd) {
  const mode = WOV.MODES[modeId], prof = WOV.profile, pv = WOV.currentVehicle();
  const map = WOV.generateMap(mode.size);
  const n = mode.team;
  const kinds = n <= 4 ? ["tank", "tank", "plane", "ship"] : ["tank", "tank", "tank", "plane", "plane", "ship", "ship"];
  const names = CALLSIGNS.slice().sort(() => Math.random() - 0.5);
  const friendNames = prof.friends.map(f => f.name).sort(() => Math.random() - 0.5);
  const units = [];
  // slot list: the player's slot first (enemy mirror of it gets the player's tier), then the rest with shared tiers
  const rest = kinds.slice(); rest.splice(rest.indexOf(pv.kind), 1);
  const slotTiers = rest.map(() => slotTier(pv.tier));
  for (let team = 0; team < 2; team++) {
    if (team === 0) { const pos = map.findSpot(pv.kind, 0, pv.r) || { x: map.size * 0.1, y: map.size / 2 }; units.push(makeUnit(pv, 0, pos, prof.name, true, WOV.camoOf(pv))); }
    const slots = team === 0 ? rest.map((k, i) => [k, slotTiers[i]]) : [[pv.kind, pv.tier]].concat(rest.map((k, i) => [k, slotTiers[i]]));
    for (const [k, tier] of slots) {
      const v = pickBotVehicle(k, tier);
      const pos = map.findSpot(k, team, v.r);
      if (!pos) continue;
      const name = team === 0 && friendNames.length ? friendNames.pop() : names.pop() || "Bot";
      units.push(makeUnit(v, team, pos, name, false, null));
    }
  }
  B = { mode, modeId, map, units, shells: [], parts: [], texts: [], wrecks: [], feed: [], time: mode.time, over: false,
    player: units[0], cam: { x: 0, y: 0, shake: 0 }, spectate: null, onEnd, startedAt: performance.now(), banner: { text: mode.name.toUpperCase(), sub: "Знищ усіх ворогів", t: 2.5 } };
  B.cam.x = B.player.x - W / 2; B.cam.y = B.player.y - H / 2;
  setAmmo(B.player, prof.ammoSel[pv.kind] || "", true);
  for (const u of units) if (!u.isPlayer && u.kind !== "plane" && Math.random() < (u.kind === "ship" ? 0.35 : 0.25)) u.ammo = "he";
  fireBtn.id = null; sticks.L.id = sticks.R.id = null; sticks.L.dx = sticks.L.dy = sticks.R.dx = sticks.R.dy = 0;
  map.warmup(B.player.x, B.player.y, W, H);
  if (WOV.Audio) WOV.Audio.music("battle");
  perf.n = 0; perf.acc = 0;
  B.alerts = [];
  cv.style.display = "block";
  document.getElementById("battleUi").classList.remove("hidden");
  last = performance.now();
  cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}

function stop() { if (WOV.Audio) { WOV.Audio.engine(null); WOV.Audio.music("menu"); } B = null; cancelAnimationFrame(raf); cv.style.display = "none"; document.getElementById("battleUi").classList.add("hidden"); }

// ---------- ammunition ----------
const AMMO = WOV.AMMO;
const ammoDef = u => AMMO[u.kind].find(a => a.id === u.ammo) || AMMO[u.kind][0];
function ammoLeft(u, a) { // shots left for this ammo type (Infinity = unlimited)
  if (a.limit) return u.limited[a.id] !== undefined ? u.limited[a.id] : a.limit;
  if (a.stock && u.isPlayer) return WOV.profile.ammo[a.stock] || 0;
  return Infinity;
}
function setAmmo(u, id, quiet) {
  const a = AMMO[u.kind].find(x => x.id === id); if (!a || u.ammo === id) return;
  if (ammoLeft(u, a) <= 0) { if (u.isPlayer && !quiet) { B.ammoNote = { text: a.name + ": немає в запасі", t: 1.6, col: "#e0604a" }; WOV.haptic("error"); } return; }
  u.ammo = id;
  if (u.kind !== "plane") u.cd = Math.max(u.cd, u.S ? u.S.reload * 0.7 : 1);
  if (u.isPlayer && !quiet) { B.ammoNote = { text: "Заряджено: " + a.name, t: 1.4, col: a.col }; WOV.haptic("select"); SFX("click"); }
}
function consume(u, a) {
  if (a.limit) u.limited[a.id] = ammoLeft(u, a) - 1;
  else if (a.stock && u.isPlayer) WOV.profile.ammo[a.stock] = Math.max(0, (WOV.profile.ammo[a.stock] || 0) - 1);
  else return;
  if (ammoLeft(u, a) <= 0) { u.ammo = AMMO[u.kind][0].id; if (u.isPlayer) B.ammoNote = { text: a.name + " закінчились", t: 2, col: "#e0604a" }; }
}
function useRepair(p) {
  if (p.dead || B.over) return;
  const prof = WOV.profile;
  if (p.repairUsed) { B.ammoNote = { text: "Ремкомплект уже використано в цьому бою", t: 1.8, col: "#e0604a" }; return; }
  if (!(prof.ammo.repair > 0)) { B.ammoNote = { text: "Немає ремкомплектів, купи в магазині", t: 1.8, col: "#e0604a" }; WOV.haptic("error"); return; }
  prof.ammo.repair--; p.repairUsed = true;
  p.mods = {}; p.fire = 0; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.2); p.S = effective(p);
  alert("Ремонт виконано", "good"); WOV.haptic("success");
}
// HE shells and rockets: blast damages everyone nearby on the ground or water
function blast(s, except) {
  const R = s.splash; spark(s.x, s.y, "#ffb060", 14, 200); spark(s.x, s.y, "#ffe0a0", 6, 90);
  for (const t of B.units) {
    if (t.dead || t === except || t.team === s.team || t.kind === "plane") continue;
    const d = Math.max(0, Math.hypot(t.x - s.x, t.y - s.y) - t.r); if (d > R) continue;
    const dmg = Math.min(t.hp, s.dmg * 0.4 * (1 - d / R)); if (dmg < 1) continue;
    t.hp -= dmg; s.owner.dmgDone += dmg; B.lastDmg = B.time; s.hitT = t;
    if (s.owner.isPlayer || t.isPlayer) floatText(t.x, t.y - t.r - 10, "-" + Math.round(dmg), t.isPlayer ? "#ff8a70" : "#ffc07a");
    if (t.hp <= 0.5) destroy(t, s.owner);
  }
}

// ---------- weapons ----------
function fireRocket(u, A) {
  const left = ammoLeft(u, A), side = left % 2 ? 1 : -1, a = u.angle + rnd(-0.02, 0.02), sp = 470 + u.vel;
  const ox = Math.cos(a + Math.PI / 2) * u.r * 0.6 * side, oy = Math.sin(a + Math.PI / 2) * u.r * 0.6 * side;
  B.shells.push({ x: u.x + ox, y: u.y + oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, team: u.team, dmg: 45 + u.v.tier * 22, life: 1.3, owner: u, air: true, ground: true, rocket: true,
    splash: 55, mod: 2, fireK: 2, noRico: true, pen: 0.3, col: A.col });
  consume(u, A); u.cd = 0.7;
  SFX("cannon", { x: u.x, y: u.y, k: 0.15, vol: u.isPlayer ? 0.8 : 0.5 });
  if (u.isPlayer) WOV.haptic("medium");
}
function fire(u, angOverride) {
  const v = u.v, m = WOV.muzzle(u), air = u.kind === "plane", A = ammoDef(u);
  if (A.rocket) return fireRocket(u, A);
  if (!air && B.map.pointInWalls(m.x, m.y)) { u.cd = v.reload * 0.4; return; }
  const spread = air ? rnd(-0.035, 0.035) : u.isPlayer ? rnd(-0.015, 0.015) : rnd(-0.045, 0.045);
  const a = (angOverride !== undefined ? angOverride : m.a) + spread;
  const sp = v.shell * (A.speed || 1) + (air ? u.vel : 0);
  B.shells.push({ x: m.x, y: m.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, team: u.team, dmg: v.dmg * (A.dmg || 1), life: v.range / (A.speed || 1), owner: u, air, small: air,
    pen: A.pen || 0, splash: A.splash || 0, mod: A.mod || 1, fireK: A.fire || 1, noRico: !!A.noRico, rico: A.rico !== undefined ? A.rico : 1, col: A.col });
  consume(u, A);
  u.cd = u.S.reload * (u.isPlayer ? 1 : air ? 1.5 : 1.35); u.flash = air ? 0.04 : 0.09;
  if (!air) SFX("cannon", { x: m.x, y: m.y, k: clamp((v.dmg - 30) / 300, 0, 1), vol: u.isPlayer ? 1 : 0.8 });
  else SFX("mg", { x: m.x, y: m.y, vol: u.isPlayer ? 0.7 : 0.5 });
  if (!air) {
    for (let i = 0; i < 7; i++) B.parts.push({ x: m.x, y: m.y, vx: Math.cos(a + rnd(-0.5, 0.5)) * rnd(40, 150), vy: Math.sin(a + rnd(-0.5, 0.5)) * rnd(40, 150), life: rnd(0.15, 0.35), max: 0.35, c: "#f0d38a", s: rnd(2, 4) });
    for (let i = 0; i < 3; i++) B.parts.push({ x: m.x, y: m.y, vx: rnd(-20, 20), vy: rnd(-20, 20), life: rnd(0.4, 0.8), max: 0.8, c: "rgba(200,200,190,.5)", s: rnd(5, 9), smoke: true });
    if (u.isPlayer) { WOV.haptic("light"); B.cam.shake = Math.max(B.cam.shake, 2.5); }
  } else if (u.isPlayer && Math.random() < 0.12) WOV.haptic("soft");
}
function autoAA(u, dt) {
  const A = u.v.aa; if (!A || u.mods.aa) return;
  u.aaCd -= dt; if (u.aaCd > 0) return;
  let tgt = null, bd = A.range;
  for (const o of B.units) if (!o.dead && o.kind === "plane" && o.team !== u.team) { const d = Math.hypot(o.x - u.x, o.y - u.y); if (d < bd) { bd = d; tgt = o; } }
  if (!tgt) return;
  const sp = 820, tt = bd / sp, lx = tgt.x + Math.cos(tgt.angle) * tgt.vel * tt, ly = tgt.y + Math.sin(tgt.angle) * tgt.vel * tt;
  const a = Math.atan2(ly - u.y, lx - u.x) + rnd(-0.13, 0.13);
  B.shells.push({ x: u.x, y: u.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, team: u.team, dmg: A.dmg * (u.isPlayer ? 1 : 0.7), life: A.range / sp + 0.05, owner: u, air: true, small: true, aa: true });
  u.aaCd = A.reload * (u.isPlayer ? 1 : 1.4);
  SFX("aa", { x: u.x, y: u.y, vol: 0.45 });
}
function floatText(x, y, s, c) { B.texts.push({ x, y, s, c, life: 1 }); }
function spark(x, y, c, n, sp) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(30, sp || 180); B.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.2, 0.55), max: 0.55, c, s: rnd(1.5, 3.5) }); } }

// ---------- modules: damage to parts of the vehicle ----------
const MODS = {
  tank: { engine: "двигун", trackL: "ліва гусениця", trackR: "права гусениця", turret: "поворот башти", gun: "гармата" },
  plane: { engine: "двигун", wingL: "ліве крило", wingR: "праве крило", tail: "хвостове оперення", guns: "кулемети" },
  ship: { engine: "машинне відділення", rudder: "кермо", battery: "головний калібр", aa: "зенітка" },
};
const REPAIR = 14;
function alert(text, kind) {
  B.alerts.unshift({ text, kind: kind || "bad", t: 2.6 });
  SFX(kind === "good" ? "good" : "alert", { vol: 0.8 });
  if (B.alerts.length > 3) B.alerts.pop();
}
function pickModule(t, impact) {
  const rel = angNorm(impact - t.angle), ar = Math.abs(rel), right = rel > 0;
  if (t.kind === "tank") return ar < Math.PI / 4 ? (Math.random() < 0.5 ? "gun" : "turret") : ar > 3 * Math.PI / 4 ? "engine" : right ? "trackR" : "trackL";
  if (t.kind === "plane") return ar < 0.9 ? (Math.random() < 0.6 ? "engine" : "guns") : ar > 2.3 ? "tail" : right ? "wingR" : "wingL";
  return ar < Math.PI / 4 ? "battery" : ar > 3 * Math.PI / 4 ? (Math.random() < 0.6 ? "rudder" : "engine") : pick(["engine", "aa", "battery"]);
}
function damageModule(t, s, impact) {
  const chance = (s.small ? (t.kind === "plane" ? 0.05 : 0.02) : 0.42) * (s.mod || 1);
  if (Math.random() < chance) {
    const m = pickModule(t, impact);
    const fresh = !t.mods[m];
    t.mods[m] = REPAIR;
    if (fresh) {
      if (t.isPlayer) { alert("Пошкоджено: " + MODS[t.kind][m]); WOV.haptic("warning"); }
      else if (s.owner.isPlayer) floatText(t.x, t.y + t.r + 18, MODS[t.kind][m] + "!", "#ffcf6a");
    }
  }
  const fireChance = (s.small ? 0.008 : (t.kind === "tank" && Math.abs(angNorm(impact - t.angle)) > 2.35 ? 0.25 : 0.07)) * (s.fireK || 1);
  if (!t.fire && Math.random() < fireChance) {
    t.fire = 6; t.fireBy = s.owner;
    if (t.isPlayer) { alert("Пожежа! Техніка горить", "fire"); WOV.haptic("error"); }
    else if (s.owner.isPlayer) floatText(t.x, t.y + t.r + 18, "ПІДПАЛ!", "#ff8a50");
  }
}
// effective stats after damage: broken parts and low health make the vehicle harder to handle
function effective(u) {
  const v = u.v, m = u.mods, hpr = clamp(u.hp / u.maxHp, 0, 1);
  let speed = v.speed, turn = v.turn, tturn = v.tturn || 0, reload = v.reload, minSpeed = v.minSpeed || 0, bias = 0;
  if (u.kind === "tank") {
    if (m.engine) speed *= 0.5;
    if (m.trackL || m.trackR) { speed *= 0.6; turn *= 0.55; bias = (m.trackR ? 0.5 : 0) - (m.trackL ? 0.5 : 0); }
    if (m.turret) tturn *= 0.35;
    if (m.gun) reload *= 1.7;
  } else if (u.kind === "plane") {
    if (m.engine) { speed *= 0.72; minSpeed *= 0.8; }
    if (m.wingL || m.wingR) { turn *= 0.62; bias = (m.wingR ? 0.55 : 0) - (m.wingL ? 0.55 : 0); }
    if (m.tail) turn *= 0.6;
    if (m.guns) reload *= 1.9;
  } else {
    if (m.engine) speed *= 0.5;
    if (m.rudder) turn *= 0.4;
    if (m.battery) reload *= 1.7;
  }
  speed *= 0.72 + 0.28 * hpr; turn *= 0.7 + 0.3 * hpr; minSpeed *= 0.85 + 0.15 * hpr;
  return { speed, turn, tturn, reload, minSpeed, bias, shell: v.shell, range: v.range };
}
function updateModules(u, dt) {
  for (const k in u.mods) {
    u.mods[k] -= dt;
    if (u.mods[k] <= 0) { delete u.mods[k]; if (u.isPlayer) alert("Відремонтовано: " + MODS[u.kind][k], "good"); }
  }
  if (u.fire > 0) {
    u.fire -= dt;
    const d = Math.min(u.hp, u.maxHp * 0.025 * dt);
    u.hp -= d; if (u.fireBy && u.fireBy !== u) u.fireBy.dmgDone += d;
    if (Math.random() < 0.5) B.parts.push({ x: u.x + rnd(-6, 6), y: u.y + rnd(-6, 6), vx: rnd(-10, 10), vy: rnd(-10, 10), life: 0.5, max: 0.5, c: pick(["#ff9a3a", "#ffcf6a", "#e0502a"]), s: rnd(3, 6) });
    if (u.fire <= 0 && u.isPlayer) alert("Пожежу загашено", "good");
    if (u.hp <= 0.5) destroy(u, u.fireBy);
  }
  u.S = effective(u);
}

function hit(s, t) {
  const impact = Math.atan2(s.y - t.y, s.x - t.x);
  let mult = 1, zone = 1;
  if (t.kind !== "plane") {
    if (s.owner.kind === "plane") mult = s.rocket ? 1 : 0.75; // strafing from above
    else {
      const rel = Math.abs(angNorm(impact - t.angle));
      zone = rel < Math.PI / 4 ? 0 : rel > 3 * Math.PI / 4 ? 2 : 1;
      mult = t.v.armor[zone];
      if (s.pen > 0 && mult < 1) mult += (1 - mult) * s.pen;
      else if (s.pen < 0) mult *= 1 + s.pen * (mult < 1 ? 1.4 : 0.4);
      const inc = Math.abs(angNorm(Math.atan2(-s.vy, -s.vx) - impact));
      if (!s.noRico && inc > 1.15 && Math.random() < 0.7 * (s.rico !== undefined ? s.rico : 1)) {
        floatText(t.x, t.y - t.r - 10, "РИКОШЕТ", "#cfcab8"); SFX("ricochet", { x: t.x, y: t.y });
        const nx = Math.cos(impact), ny = Math.sin(impact), dot = s.vx * nx + s.vy * ny;
        s.vx = (s.vx - 2 * dot * nx) * 0.6; s.vy = (s.vy - 2 * dot * ny) * 0.6; s.team = -1; s.life = 0.25;
        spark(s.x, s.y, "#e8e4d8", 6); return;
      }
    }
  }
  const dmg = Math.min(t.hp, s.dmg * mult * rnd(0.9, 1.1));
  t.hp -= dmg; s.life = 0; s.owner.dmgDone += dmg; B.lastDmg = B.time;
  if (t.hp > 0.5) damageModule(t, s, impact);
  const mine = s.owner.isPlayer, me = t.isPlayer;
  if (s.small) {
    t.acc = (t.acc || 0) + dmg;
    if ((mine || me) && t.acc >= 12) { floatText(t.x + rnd(-8, 8), t.y - t.r - 10, "-" + Math.round(t.acc), me ? "#ff8a70" : "#ffe29a"); t.acc = 0; }
    spark(s.x, s.y, "#f0c070", 3, 120); SFX("tick", { x: t.x, y: t.y, vol: 0.5 });
  } else {
    if (mine || me) floatText(t.x, t.y - t.r - 10, (zone === 2 ? "КОРМА " : zone === 0 ? "" : "БОРТ ") + "-" + Math.round(dmg), me ? "#ff8a70" : "#ffe29a");
    spark(s.x, s.y, "#f0a050", 12); SFX("hit", { x: t.x, y: t.y, vol: me || mine ? 1 : 0.7 });
  }
  if (me) { if (!s.small || Math.random() < 0.25) WOV.haptic(s.small ? "light" : "heavy"); B.cam.shake = Math.max(B.cam.shake, s.small ? 2 : 8); }
  if (mine && !s.small) WOV.haptic("rigid");
  if (t.hp <= 0.5) destroy(t, s.owner);
}
function destroy(t, by) {
  t.dead = true; t.hp = 0;
  SFX("boom", { x: t.x, y: t.y });
  spark(t.x, t.y, "#f0a050", 30, 220); spark(t.x, t.y, "#ffdf8a", 12, 120);
  for (let i = 0; i < 14; i++) B.parts.push({ x: t.x + rnd(-10, 10), y: t.y + rnd(-10, 10), vx: rnd(-30, 30), vy: rnd(-30, 30), life: rnd(1, 2.2), max: 2.2, c: "rgba(40,40,40,.55)", s: rnd(8, 16), smoke: true });
  if (t.kind !== "plane") B.wrecks.push({ x: t.x, y: t.y, a: t.angle, ta: t.tAngle, v: t.v, life: 60 });
  if (by && by !== t) by.kills++;
  B.feed.unshift({ a: by ? by.name : "?", at: by ? by.team : 0, b: t.name, bt: t.team, t: 6, mine: by && by.isPlayer });
  if (B.feed.length > 5) B.feed.pop();
  if (by && by.isPlayer) { WOV.haptic("success"); floatText(t.x, t.y - 26, "ЗНИЩЕНО", "#d9a441"); }
  if (t.isPlayer) { WOV.haptic("error"); B.spectate = by && !by.dead ? by : null; B.deadAt = B.time; }
}

// ---------- movement ----------
function moveSurface(u, dt) {
  const ox = u.x, oy = u.y, map = B.map, rr = u.kind === "tank" ? u.r * 0.8 : u.r, wade = u.kind === "tank";
  if (u.stall > 0) { u.vel = 0; return; }
  u.x += Math.cos(u.angle) * u.vel * dt; u.y += Math.sin(u.angle) * u.vel * dt;
  u.track += u.vel * dt;
  if (u.S && u.S.bias) u.angle += u.S.bias * dt * (u.vel / u.v.speed); // broken track drags the hull aside
  if (!map.passable(u.kind, u.x, u.y, rr, u.angle, wade)) {
    if (map.passable(u.kind, u.x, oy, rr, u.angle, wade)) u.y = oy;
    else if (map.passable(u.kind, ox, u.y, rr, u.angle, wade)) u.x = ox;
    else { u.x = ox; u.y = oy; u.vel *= u.kind === "ship" ? -0.2 : 0.2; }
    u.bumped = true;
  }
}
function drive(u, dt, dir, mag, reverse) {
  const v = u.S, ship = u.kind === "ship";
  if (u.stall > 0) { u.vel = 0; return; }
  if (mag > 0.05) {
    const target = reverse ? dir + Math.PI : dir;
    u.angle = approachAng(u.angle, target, v.turn * dt * (ship ? 0.45 + 0.55 * Math.min(1, Math.abs(u.vel) / v.speed + 0.3) : 1));
    const align = Math.cos(angNorm(target - u.angle));
    const want = v.speed * mag * Math.max(ship ? 0.3 : 0, align) * (reverse ? -0.55 : 1);
    u.vel += (want - u.vel) * Math.min(1, dt * (ship ? 0.8 : 4));
  } else u.vel *= Math.max(0, 1 - dt * (ship ? 0.6 : 5));
  moveSurface(u, dt);
}
function fly(u, dt, dir, mag) {
  const v = u.S, S = B.map.size, m = 80;
  if (u.x < m || u.y < m || u.x > S - m || u.y > S - m) { dir = Math.atan2(S / 2 - u.y, S / 2 - u.x); mag = Math.max(mag, 0.6); }
  const prev = u.angle;
  if (dir !== null) u.angle = approachAng(u.angle, dir, v.turn * dt);
  // a damaged wing pulls the plane to one side, a damaged tail makes it wobble
  u.angle += v.bias * dt + (u.mods.tail ? Math.sin(performance.now() / 140) * 0.35 * dt : 0);
  u.bank = clamp(angNorm(u.angle - prev) / (v.turn * dt + 1e-6), -1, 1);
  const want = v.minSpeed + (v.speed - v.minSpeed) * clamp(mag, 0, 1);
  u.vel += (want - u.vel) * Math.min(1, dt * 1.5);
  u.x = clamp(u.x + Math.cos(u.angle) * u.vel * dt, -40, S + 40); u.y = clamp(u.y + Math.sin(u.angle) * u.vel * dt, -40, S + 40);
}
const canGunHit = () => true; // every main gun can hit planes now (tanks and ships too), it is just harder
// nearest enemy the gun can reach (with lead), as an angle; null if nobody is in range
function autoTarget(p) {
  let best = null, bd = p.v.shell * p.v.range * 0.95;
  for (const e of B.units) {
    if (e.dead || e.team === p.team || !canGunHit(p, e)) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    const w = e.kind === "plane" ? d * 1.5 : d; // ground targets first, planes when nothing else is near
    if (w < bd && B.map.lineOfSight(p.x, p.y, e.x, e.y)) { bd = w; best = e; }
  }
  if (!best) return null;
  const tt = Math.hypot(best.x - p.x, best.y - p.y) / (p.v.shell * (ammoDef(p).speed || 1));
  return Math.atan2(best.y + Math.sin(best.angle) * best.vel * tt - p.y, best.x + Math.cos(best.angle) * best.vel * tt - p.x);
}
function aimAssist(p, aim, cone) {
  let bt = null, bd = cone;
  for (const e of B.units) {
    if (e.dead || e.team === p.team || !canGunHit(p, e)) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y); if (d > p.v.shell * p.v.range) continue;
    const off = Math.abs(angNorm(Math.atan2(e.y - p.y, e.x - p.x) - aim));
    if (off < bd && (p.kind === "plane" || B.map.lineOfSight(p.x, p.y, e.x, e.y))) { bd = off; bt = e; }
  }
  if (!bt) return aim;
  const tt = Math.hypot(bt.x - p.x, bt.y - p.y) / (p.v.shell * (ammoDef(p).speed || 1));
  return Math.atan2(bt.y + Math.sin(bt.angle) * bt.vel * tt - p.y, bt.x + Math.cos(bt.angle) * bt.vel * tt - p.x);
}

function updatePlayer(dt) {
  const p = B.player, v = p.S, cam = B.cam;
  const anyKey = keys.KeyW || keys.ArrowUp || keys.KeyS || keys.ArrowDown || keys.KeyA || keys.ArrowLeft || keys.KeyD || keys.ArrowRight;
  const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const rot = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const L = sticks.L, R = sticks.R, lmag = Math.min(1, Math.hypot(L.dx, L.dy)), ldir = Math.atan2(L.dy, L.dx);
  if (p.kind === "plane") {
    let dir = null, mag = 0.45;
    if (L.id !== null && lmag > 0.2) { dir = ldir; mag = lmag; }
    else if (anyKey) { dir = p.angle + rot * 1.2; mag = fwd > 0 ? 1 : fwd < 0 ? 0 : 0.45; }
    else if (!usingTouch && mouse.active) { const dx = mouse.x + cam.x - p.x, dy = mouse.y + cam.y - p.y; dir = Math.atan2(dy, dx); mag = clamp(Math.hypot(dx, dy) / 300, 0.2, 1); }
    fly(p, dt, dir, mag);
    if ((fireBtn.id !== null || R.id !== null || mouse.down || keys.Space) && p.cd <= 0) fire(p, ammoDef(p).rocket ? undefined : aimAssist(p, p.angle, 0.1));
    return;
  }
  if (anyKey) {
    const ship = p.kind === "ship";
    p.angle += (p.stall > 0 ? 0 : 1) * rot * v.turn * dt * (fwd < 0 ? -1 : 1) * (ship ? 0.5 + 0.5 * Math.min(1, Math.abs(p.vel) / v.speed + 0.2) : 1);
    const want = fwd > 0 ? v.speed : fwd < 0 ? -v.speed * 0.5 : 0;
    p.vel += (want - p.vel) * Math.min(1, dt * (ship ? 0.8 : 4));
    moveSurface(p, dt);
  } else {
    const reverse = lmag > 0.05 && Math.abs(angNorm(ldir - p.angle)) > 2.4;
    drive(p, dt, ldir, L.id !== null ? lmag : 0, reverse);
  }
  let aim = null, manual = false;
  const want = fireBtn.id !== null || mouse.down || keys.Space;
  if (R.id !== null && Math.hypot(R.dx, R.dy) > 0.25) { aim = Math.atan2(R.dy, R.dx); manual = true; }
  else if (!usingTouch && mouse.active) aim = Math.atan2(mouse.y + cam.y - p.y, mouse.x + cam.x - p.x);
  else if (usingTouch) { const t = autoTarget(p); if (t) aim = t; } // touch: the turret follows the nearest enemy by itself
  p.autoAim = usingTouch && !manual && aim !== null;
  if (aim !== null) { aim = aimAssist(p, aim, 0.22); p.tAngle = approachAng(p.tAngle, aim, v.tturn * dt); }
  else p.tAngle = approachAng(p.tAngle, p.angle, v.tturn * dt * 0.3);
  if (want && p.cd <= 0 && (fireBtn.id !== null || aim === null || Math.abs(angNorm(aim - p.tAngle)) < 0.25)) fire(p);
}

// ---------- bots ----------
function chooseTarget(u) {
  let best = null, bd = 1e9;
  for (const o of B.units) {
    if (o.dead || o.team === u.team || !canGunHit(u, o)) continue;
    let d = Math.hypot(o.x - u.x, o.y - u.y);
    if (u.kind === "plane" && o.kind === "plane") d *= 0.7; // fighters love dogfights
    if (u.kind !== "plane" && o.kind === "plane") d *= 1.8;  // ground guns prefer ground targets
    if (o.isPlayer) d *= 0.9;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
function waypointToward(u, tx, ty, pref) {
  const map = B.map;
  for (let i = 0; i < 12; i++) {
    const a = Math.atan2(u.y - ty, u.x - tx) + rnd(-1.2, 1.2), d = pref * rnd(0.75, 1.25);
    const wx = tx + Math.cos(a) * d, wy = ty + Math.sin(a) * d;
    if (map.passable(u.kind, wx, wy, u.r + 8, u.angle)) return { x: wx, y: wy };
  }
  // move part of the way along the line
  for (let f = 0.7; f > 0.05; f -= 0.15) {
    const wx = u.x + (tx - u.x) * f + rnd(-120, 120), wy = u.y + (ty - u.y) * f + rnd(-120, 120);
    if (map.passable(u.kind, wx, wy, u.r + 8, u.angle)) return { x: wx, y: wy };
  }
  for (let i = 0; i < 20; i++) { const wx = u.x + rnd(-300, 300), wy = u.y + rnd(-300, 300); if (map.passable(u.kind, wx, wy, u.r + 6, u.angle)) return { x: wx, y: wy }; }
  return { x: u.x, y: u.y };
}
function updateBot(u, dt) {
  const v = u.v, ai = u.ai, range = v.shell * v.range * 0.85;
  ai.think -= dt;
  if (ai.think <= 0 || !ai.target || ai.target.dead) { ai.target = chooseTarget(u); ai.think = rnd(0.6, 1.2); }
  const t = ai.target;
  const enemyX = B.map.spawnZones[1 - u.team];
  if (u.kind === "plane") {
    ai.pass -= dt;
    let dir;
    if (!t) dir = Math.atan2(B.map.size / 2 - u.y, enemyX - u.x);
    else if (ai.pass > 0) dir = u.angle;
    else {
      const d = Math.hypot(t.x - u.x, t.y - u.y), tt = d / v.shell;
      dir = Math.atan2(t.y + Math.sin(t.angle) * t.vel * tt * 0.6 - u.y, t.x + Math.cos(t.angle) * t.vel * tt * 0.6 - u.x);
      if (d < 120) ai.pass = rnd(1, 1.8);
      if (u.cd <= 0 && d < range && Math.abs(angNorm(dir - u.angle)) < 0.12) fire(u);
    }
    fly(u, dt, dir, t && t.kind === "plane" ? 0.85 : 0.65);
    return;
  }
  ai.retarget -= dt;
  if (ai.retarget <= 0 || Math.hypot(ai.wx - u.x, ai.wy - u.y) < 40 || ai.stuck > 1) {
    let w;
    if (ai.stuck > 1) w = waypointToward(u, u.x + rnd(-300, 300), u.y + rnd(-300, 300), 50);
    else if (t) w = waypointToward(u, t.x, t.y, u.kind === "ship" ? range * 0.7 : range * 0.55);
    else w = waypointToward(u, enemyX, u.y + rnd(-400, 400), 200);
    ai.wx = w.x; ai.wy = w.y; ai.retarget = rnd(3, 6); ai.stuck = 0;
  }
  const near = Math.hypot(ai.wx - u.x, ai.wy - u.y) < 40;
  drive(u, dt, Math.atan2(ai.wy - u.y, ai.wx - u.x), near ? 0 : 0.85, false);
  if (t) {
    const d = Math.hypot(t.x - u.x, t.y - u.y);
    if (d < range && B.map.lineOfSight(u.x, u.y, t.x, t.y)) {
      const tt = d / v.shell, lead = 0.55;
      const aim = Math.atan2(t.y + Math.sin(t.angle) * t.vel * tt * lead - u.y, t.x + Math.cos(t.angle) * t.vel * tt * lead - u.x);
      u.tAngle = approachAng(u.tAngle, aim, u.S.tturn * dt * 0.8);
      if (u.cd <= 0 && Math.abs(angNorm(aim - u.tAngle)) < 0.08) fire(u);
      return;
    }
  }
  u.tAngle = approachAng(u.tAngle, u.angle, u.S.tturn * dt * 0.4);
}

// tanks: tracks in the dirt, knocking down trees, stalling in water
function tankGround(u, dt) {
  const map = B.map, inWater = map.h(u.x, u.y) < -0.02;
  if (u.stall > 0) {
    u.stall -= dt;
    if (Math.random() < 0.3) B.parts.push({ x: u.x + rnd(-u.r, u.r), y: u.y + rnd(-u.r, u.r), vx: rnd(-15, 15), vy: rnd(-15, 15), life: 0.7, max: 0.7, c: "#dbeef0", s: rnd(2, 4), wake: true });
    if (u.stall <= 0 && u.isPlayer) alert("Двигун запущено", "good");
  }
  if (inWater && !u.wet) {
    u.wet = true; u.stall = 5; u.vel = 0;
    for (let i = 0; i < 18; i++) { const a = rnd(0, TAU); B.parts.push({ x: u.x, y: u.y, vx: Math.cos(a) * rnd(40, 120), vy: Math.sin(a) * rnd(40, 120), life: rnd(0.4, 0.8), max: 0.8, c: "#e4f2f4", s: rnd(2, 4) }); }
    SFX("splash", { x: u.x, y: u.y });
    if (u.isPlayer) { alert("Двигун заглох у воді!", "water"); WOV.haptic("warning"); }
  } else if (!inWater && u.wet && u.stall <= 0) u.wet = false;
  // track marks
  u.trackAcc += Math.abs(u.vel) * dt;
  if (u.trackAcc > 7 && !inWater) {
    u.trackAcc = 0;
    map.stamp({ t: "track", x: u.x - Math.cos(u.angle) * u.r * 0.9, y: u.y - Math.sin(u.angle) * u.r * 0.9, a: u.angle, w: u.r * u.v.look.Wd * 0.95, wet: map.h(u.x, u.y) < 0.12 });
  }
  // trees in the way get flattened
  for (const t of map.treesNear(u.x, u.y)) {
    if (!t.alive || t.fall) continue;
    if (Math.hypot(t.x - u.x, t.y - u.y) < u.r + t.r * 0.45) {
      map.knockTree(t, Math.atan2(t.y - u.y, t.x - u.x)); SFX("tree", { x: t.x, y: t.y });
      u.vel *= 0.8;
      for (let i = 0; i < 10; i++) { const a = rnd(0, TAU); B.parts.push({ x: t.x, y: t.y, vx: Math.cos(a) * rnd(20, 90), vy: Math.sin(a) * rnd(20, 90), life: rnd(0.5, 1), max: 1, c: pick(["#3e5f30", "#56783e", "#2f4a26"]), s: rnd(2, 4) }); }
      if (u.isPlayer) { WOV.haptic("light"); B.cam.shake = Math.max(B.cam.shake, 2); }
    }
  }
}

// ---------- main update ----------
function update(dt) {
  const b = B;
  if (!b.over) b.time -= dt;
  for (const u of b.units) { u.cd -= dt; u.flash -= dt; u.bumped = false; if (!u.dead) updateModules(u, dt); else u.S = u.S || effective(u); }
  for (const a of b.alerts) a.t -= dt;
  b.alerts = b.alerts.filter(a => a.t > 0);
  b.map.updateTrees(dt);
  for (const u of b.units) if (!u.dead && u.kind === "tank") tankGround(u, dt);
  const p = b.player;
  if (!p.dead) updatePlayer(dt);
  for (const u of b.units) if (!u.dead && !u.isPlayer) updateBot(u, dt);
  for (const u of b.units) if (!u.dead) autoAA(u, dt);
  // surface units push each other apart
  for (let i = 0; i < b.units.length; i++) for (let j = i + 1; j < b.units.length; j++) {
    const a = b.units[i], c = b.units[j]; if (a.dead || c.dead || a.kind === "plane" || c.kind === "plane") continue;
    const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), m = a.r + c.r;
    if (d < m && d > 0) { const k = (m - d) / 2 / d; a.x -= dx * k; a.y -= dy * k; c.x += dx * k; c.y += dy * k; }
  }
  for (const u of b.units) if (!u.dead && u.kind !== "plane") {
    if (!u.isPlayer) { if (u.bumped || Math.abs(u.vel) < 6) u.ai.stuck += dt; else u.ai.stuck = Math.max(0, u.ai.stuck - dt); }
    if (u.kind === "ship" && Math.abs(u.vel) > 15 && Math.random() < 0.6) {
      const L = u.r * u.v.look.len; b.parts.push({ x: u.x - Math.cos(u.angle) * L + rnd(-4, 4), y: u.y - Math.sin(u.angle) * L + rnd(-4, 4), vx: rnd(-12, 12), vy: rnd(-12, 12), life: 1.6, max: 1.6, c: "#d8e6ea", s: rnd(2, 5), wake: true });
    }
    if (u.kind === "tank" && Math.abs(u.vel) > 30 && Math.random() < 0.15) b.parts.push({ x: u.x - Math.cos(u.angle) * u.r, y: u.y - Math.sin(u.angle) * u.r, vx: rnd(-10, 10), vy: rnd(-10, 10), life: 0.8, max: 0.8, c: "rgba(150,140,110,.35)", s: rnd(5, 9), smoke: true });
  }
  for (const u of b.units) if (!u.dead && u.hp / u.maxHp < 0.35 && Math.random() < 0.25) b.parts.push({ x: u.x + rnd(-5, 5), y: u.y + rnd(-5, 5), vx: rnd(-8, 8) + 15, vy: rnd(-8, 8) - 15, life: rnd(0.8, 1.5), max: 1.5, c: "rgba(50,50,50,.45)", s: rnd(5, 10), smoke: true });
  // shells
  for (const s of b.shells) {
    const steps = s.small ? 4 : 3;
    for (let k = 0; k < steps && s.life > 0; k++) {
      s.x += s.vx * dt / steps; s.y += s.vy * dt / steps;
      if (!s.air && b.map.pointInWalls(s.x, s.y)) { s.life = 0; spark(s.x, s.y, "#bdb6a0", 8); break; }
      if (!s.small) { let hitTree = false; for (const tr of b.map.treesNear(s.x, s.y)) if (tr.alive && !tr.fall && (tr.x - s.x) ** 2 + (tr.y - s.y) ** 2 < tr.r * tr.r * 0.5) { b.map.knockTree(tr, Math.atan2(s.vy, s.vx)); SFX("tree", { x: tr.x, y: tr.y }); s.life = 0; spark(s.x, s.y, "#56783e", 10); hitTree = true; break; } if (hitTree) break; }
      for (const t of b.units) {
        if (t.dead || t.team === s.team || t === s.owner) continue;
        if (s.aa && t.kind !== "plane") continue;
        if (s.ground && t.kind === "plane") continue;
        const hr = t.kind === "ship" ? t.r * 1.1 : t.r + (s.small ? 3 : 2);
        if ((t.x - s.x) ** 2 + (t.y - s.y) ** 2 < hr * hr) { if (s.team !== -1) hit(s, t); else s.life = 0; break; }
      }
    }
    s.life -= dt;
    if (s.rocket && Math.random() < 0.8) b.parts.push({ x: s.x, y: s.y, vx: rnd(-8, 8), vy: rnd(-8, 8), life: 0.5, max: 0.5, c: "rgba(210,205,195,.5)", s: rnd(2, 4), smoke: true });
    if (s.life <= 0 && s.splash && !s.blasted && s.team !== -1) { s.blasted = true; blast(s, s.hitT); SFX("boom", { x: s.x, y: s.y, vol: 0.45 }); }
    if (s.life <= 0 && !s.small) { if (b.map.isWater(s.x, s.y)) { spark(s.x, s.y, "#dfeef2", 7, 90); SFX("splash", { x: s.x, y: s.y, vol: 0.5 }); } else if (s.dmg > 20) b.map.stamp({ t: "crater", x: s.x, y: s.y, a: 0, r: 5 + Math.min(10, s.dmg / 15) }); }
  }
  b.shells = b.shells.filter(s => s.life > 0);
  for (const q of b.parts) { q.x += q.vx * dt; q.y += q.vy * dt; const f = q.smoke ? 0.97 : 0.92; q.vx *= f; q.vy *= f; q.life -= dt; if (q.smoke) q.s += dt * 6; }
  b.parts = b.parts.filter(q => q.life > 0);
  const PCAP = lowFx ? 220 : 420;
  if (b.parts.length > PCAP) b.parts.splice(0, b.parts.length - PCAP);
  for (const f of b.texts) { f.y -= 26 * dt; f.life -= dt; }
  b.texts = b.texts.filter(f => f.life > 0);
  for (const f of b.feed) f.t -= dt;
  b.feed = b.feed.filter(f => f.t > 0);
  if (b.banner) { b.banner.t -= dt; if (b.banner.t <= 0) b.banner = null; }
  if (b.ammoNote) { b.ammoNote.t -= dt; if (b.ammoNote.t <= 0) b.ammoNote = null; }
  // camera
  let focus = p;
  if (p.dead) { if (!b.spectate || b.spectate.dead) b.spectate = b.units.find(u => !u.dead && u.team === 0) || b.units.find(u => !u.dead); focus = b.spectate || p; }
  const look = focus.kind === "plane" ? 0.5 : 0;
  const tx = focus.x + Math.cos(focus.angle) * focus.vel * look - W / 2, ty = focus.y + Math.sin(focus.angle) * focus.vel * look - H / 2;
  b.cam.x += (tx - b.cam.x) * Math.min(1, dt * 5); b.cam.y += (ty - b.cam.y) * Math.min(1, dt * 5);
  const S = b.map.size;
  b.cam.x = W < S ? clamp(b.cam.x, -30, S - W + 30) : (S - W) / 2; b.cam.y = H < S ? clamp(b.cam.y, -30, S - H + 30) : (S - H) / 2;
  b.cam.shake *= Math.max(0, 1 - dt * 8);
  // end conditions
  if (!b.over) {
    const a0 = b.units.filter(u => u.team === 0 && !u.dead).length, a1 = b.units.filter(u => u.team === 1 && !u.dead).length;
    let result = null;
    if (a1 === 0) result = "win"; else if (a0 === 0) result = "lose";
    else if (b.time <= 0 || (b.lastDmg !== undefined ? b.lastDmg : b.mode.time) - b.time > 30) {
      const hpOf = t => b.units.filter(u => u.team === t).reduce((s, u) => s + Math.max(0, u.hp) / u.maxHp, 0);
      result = hpOf(0) >= hpOf(1) ? "win" : "lose";
    }
    if (result) finish(result);
  }
}

function finish(result) {
  const b = B; b.over = true; b.result = result;
  b.banner = { text: result === "win" ? "ПЕРЕМОГА" : "ПОРАЗКА", sub: "", t: 99 };
  WOV.haptic(result === "win" ? "success" : "warning");
  if (WOV.Audio) { WOV.Audio.engine(null); WOV.Audio.music(null); SFX(result); }
  const p = b.player, prof = WOV.profile;
  let coins = Math.round((150 + p.dmgDone * 0.8 + p.kills * (150 + 25 * p.v.tier)) * (b.mode.coinMul || 1)) + (result === "win" ? b.mode.winBonus : 0);
  const boosted = prof.boost > 0; if (boosted) { coins *= 2; prof.boost--; }
  const xp = Math.round(coins * 0.5);
  const before = WOV.rank().r.i;
  prof.coins += coins; prof.xp += xp;
  let rankUp = null;
  for (const r of WOV.RANKS) if (r.i > before && prof.xp >= r.xp) { rankUp = r; prof.coins += r.reward.coins; prof.crystals += r.reward.crystals; }
  prof.stats.battles++; if (result === "win") prof.stats.wins++; prof.stats.kills += p.kills; prof.stats.dmg += Math.round(p.dmgDone);
  WOV.save(); WOV.emit("wallet");
  const summary = { rankUp, result, kills: p.kills, dmg: Math.round(p.dmgDone), coins, xp, boosted, survived: !p.dead, mode: b.mode.name,
    board: b.units.slice().sort((x, y) => y.kills - x.kills || y.dmgDone - x.dmgDone).map(u => ({ name: u.name, team: u.team, v: u.v.name, kills: u.kills, dmg: Math.round(u.dmgDone), dead: !!u.dead, me: u.isPlayer })) };
  setTimeout(() => { if (B === b) { const cb = b.onEnd; stop(); cb && cb(summary); } }, 2200);
}

// player gives up / leaves: the remaining battle is decided by remaining strength
function leave() {
  if (!B || B.over) return;
  const b = B;
  if (!b.player.dead) { b.player.hp = 0; destroy(b.player, null); }
  const hpOf = t => b.units.filter(u => u.team === t).reduce((s, u) => s + Math.max(0, u.hp) / u.maxHp, 0);
  finish(hpOf(0) > hpOf(1) * 1.15 ? "win" : "lose");
}

// ---------- render ----------
function render() {
  const b = B, map = b.map, cam = b.cam;
  ctx.fillStyle = "#16201f"; ctx.fillRect(0, 0, W, H);
  const sx = cam.x + rnd(-cam.shake, cam.shake), sy = cam.y + rnd(-cam.shake, cam.shake);
  map.drawGround(ctx, Math.round(sx), Math.round(sy), W, H);
  ctx.save(); ctx.translate(-sx, -sy);
  // animated waves
  const tw = performance.now() / 1000;
  ctx.strokeStyle = "rgba(225,240,245,.13)"; ctx.lineWidth = 2; ctx.beginPath();
  for (const w of map.waves) { if (w.x < sx - 40 || w.x > sx + W + 40 || w.y < sy - 20 || w.y > sy + H + 20) continue; const o = Math.sin(tw * 1.3 + w.p) * 5; ctx.moveTo(w.x + o, w.y); ctx.lineTo(w.x + o + w.l, w.y); }
  ctx.stroke();
  const vis = (x, y, m) => x > sx - m && x < sx + W + m && y > sy - m && y < sy + H + m;
  for (const q of b.parts) if (q.wake && vis(q.x, q.y, 20)) { ctx.globalAlpha = clamp(q.life / q.max, 0, 1) * 0.55; ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.s, 0, TAU); ctx.fill(); }
  for (const w of b.wrecks) if (vis(w.x, w.y, 80)) { ctx.globalAlpha = 0.9; WOV.drawVehicle(ctx, w.v, w.x, w.y, w.a, w.ta, { wreck: true }); }
  ctx.globalAlpha = 1;
  map.drawTreeShadows(ctx, sx, sy, W, H);
  const drawU = (u) => {
    if (u.kind === "tank" && u.wet) { ctx.strokeStyle = "rgba(220,240,240,.45)"; ctx.lineWidth = 2; const k = (performance.now() / 600) % 1; ctx.beginPath(); ctx.ellipse(u.x, u.y, u.r * (1.3 + k * 0.6), u.r * (1.1 + k * 0.5), u.angle, 0, TAU); ctx.stroke(); }
    WOV.drawVehicle(ctx, u.v, u.x, u.y, u.angle, u.tAngle, { camo: u.camo, flash: u.flash, track: u.track, bank: u.bank, team: u.team === 0 ? "ally" : "enemy" });
    if (!u.isPlayer) {
      const w = 34, yy = u.y - u.r - (u.kind === "ship" ? 22 : 16);
      ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(u.x - w / 2, yy, w, 4);
      ctx.fillStyle = TEAM_COL[u.team]; ctx.fillRect(u.x - w / 2, yy, w * clamp(u.hp / u.maxHp, 0, 1), 4);
      ctx.font = "600 10px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = u.team === 0 ? "rgba(240,220,160,.9)" : "rgba(255,170,150,.9)";
      ctx.fillText(u.name + " · " + WOV.ROMAN[u.v.tier], u.x, yy - 3);
    }
  };
  for (const u of b.units) if (!u.dead && u.kind !== "plane" && vis(u.x, u.y, 80)) drawU(u);
  map.drawTrees(ctx, sx, sy, W, H);
  for (const s of b.shells) {
    if (!vis(s.x, s.y, 30)) continue;
    ctx.strokeStyle = s.owner.isPlayer && s.col ? s.col : s.team === 0 ? "#ffe29a" : s.team === 1 ? "#ff9a7a" : "#ddd";
    ctx.lineWidth = s.rocket ? 4 : s.small ? 1.6 : 3.2; const k = s.rocket ? 0.03 : s.small ? 0.012 : 0.024;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * k, s.y - s.vy * k); ctx.stroke();
  }
  for (const q of b.parts) if (!q.wake && vis(q.x, q.y, 30)) {
    ctx.globalAlpha = clamp(q.life / q.max, 0, 1); ctx.fillStyle = q.c;
    if (q.smoke) { ctx.beginPath(); ctx.arc(q.x, q.y, q.s, 0, TAU); ctx.fill(); } else ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
  }
  ctx.globalAlpha = 1;
  for (const u of b.units) if (!u.dead && u.kind === "plane" && vis(u.x, u.y, 80)) drawU(u);
  ctx.font = "bold 13px system-ui, sans-serif"; ctx.textAlign = "center";
  for (const f of b.texts) { ctx.globalAlpha = clamp(f.life * 1.5, 0, 1); ctx.fillStyle = "#000"; ctx.fillText(f.s, f.x + 1, f.y + 1); ctx.fillStyle = f.c; ctx.fillText(f.s, f.x, f.y); }
  ctx.globalAlpha = 1;
  const p = b.player;
  if (!p.dead) {
    const ang = p.kind === "plane" ? p.angle : p.tAngle, len = p.kind === "plane" ? 280 : p.v.shell * p.v.range * 0.85;
    ctx.strokeStyle = "rgba(240,211,138,.22)"; ctx.setLineDash([6, 9]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(ang) * len, p.y + Math.sin(ang) * len); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(217,164,65,.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + (p.kind === "ship" ? p.r * 0.9 : 8), 0, TAU); ctx.stroke();
  }
  ctx.restore();
  // edge arrows for off-screen enemies
  for (const u of b.units) if (!u.dead && u.team === 1 && !vis(u.x, u.y, 0)) {
    const cx = W / 2, cy = H / 2, a = Math.atan2(u.y - (sy + cy), u.x - (sx + cx));
    const ex = clamp(cx + Math.cos(a) * W, 18, W - 18), ey = clamp(cy + Math.sin(a) * H, 90, H - 18);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.fillStyle = "rgba(224,96,74,.75)";
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  drawHUD();
}

function drawHUD() {
  const b = B, p = b.player, tg = WOV.tg;
  const top = 10 + ((tg && tg.safeAreaInset && tg.safeAreaInset.top) || 0) + ((tg && tg.contentSafeAreaInset && tg.contentSafeAreaInset.top) || 0);
  // team score + timer
  const a0 = b.units.filter(u => u.team === 0 && !u.dead).length, a1 = b.units.filter(u => u.team === 1 && !u.dead).length;
  const tm = Math.max(0, Math.ceil(b.time)), ts = Math.floor(tm / 60) + ":" + String(tm % 60).padStart(2, "0");
  ctx.fillStyle = "rgba(10,14,13,.6)"; WOV.rr(ctx, W / 2 - 74, top, 148, 34, 10); ctx.fill();
  ctx.font = "800 18px system-ui, sans-serif"; ctx.textAlign = "center";
  ctx.fillStyle = TEAM_COL[0]; ctx.fillText(a0, W / 2 - 50, top + 24);
  ctx.fillStyle = TEAM_COL[1]; ctx.fillText(a1, W / 2 + 50, top + 24);
  ctx.fillStyle = "#e8e4d8"; ctx.font = "700 14px system-ui, sans-serif"; ctx.fillText(ts, W / 2, top + 22);
  // damaged modules of the player's vehicle + temporary alerts
  if (!p.dead) {
    const chips = [];
    for (const k in p.mods) chips.push({ t: MODS[p.kind][k], s: Math.ceil(p.mods[k]), c: "#e0604a" });
    if (p.fire > 0) chips.push({ t: "пожежа", s: Math.ceil(p.fire), c: "#ff8a3a" });
    if (p.stall > 0) chips.push({ t: "двигун заглох", s: Math.ceil(p.stall), c: "#6fc3f0" });
    ctx.font = "700 10.5px system-ui, sans-serif"; ctx.textAlign = "left";
    chips.forEach((c, i) => {
      const y = top + 92 + i * 21, w = ctx.measureText(c.t + " " + c.s + "с").width + 20;
      ctx.fillStyle = "rgba(10,14,13,.72)"; WOV.rr(ctx, 10, y, w, 18, 6); ctx.fill();
      ctx.fillStyle = c.c; ctx.fillRect(16, y + 6, 6, 6);
      ctx.fillStyle = "#ece7da"; ctx.fillText(c.t + " " + c.s + "с", 27, y + 13);
    });
    b.hudChips = chips.length;
  } else b.hudChips = 0;
  b.alerts.forEach((a, i) => {
    const y = Math.max(H * 0.3, top + 190) + i * 30;
    ctx.globalAlpha = clamp(a.t * 1.5, 0, 1); ctx.font = "800 15px system-ui, sans-serif"; ctx.textAlign = "center";
    const w = ctx.measureText(a.text).width + 40, col = a.kind === "good" ? "#7fbf6b" : a.kind === "water" ? "#6fc3f0" : a.kind === "fire" ? "#ff8a3a" : "#e0604a";
    ctx.fillStyle = "rgba(10,14,13,.75)"; WOV.rr(ctx, W / 2 - w / 2, y - 18, w, 26, 8); ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(W / 2 - w / 2, y - 18, 4, 26);
    ctx.fillText((a.kind === "good" ? "✓ " : "⚠ ") + a.text, W / 2, y);
    ctx.globalAlpha = 1;
  });
  // player panel
  const pw = Math.min(170, W * 0.4);
  ctx.fillStyle = "rgba(10,14,13,.6)"; WOV.rr(ctx, 10, top + 42, pw, 44, 9); ctx.fill();
  ctx.fillStyle = "#e8e4d8"; ctx.font = "700 11px system-ui, sans-serif"; ctx.textAlign = "left";
  ctx.fillText(p.v.name + "  " + WOV.ROMAN[p.v.tier], 18, top + 57);
  ctx.fillStyle = "#33403a"; ctx.fillRect(18, top + 63, pw - 16, 6);
  ctx.fillStyle = p.hp / p.maxHp > 0.35 ? "#7fbf6b" : "#e0604a"; ctx.fillRect(18, top + 63, (pw - 16) * clamp(p.hp / p.maxHp, 0, 1), 6);
  let bar;
  if (p.kind === "plane") { bar = clamp((p.vel - p.v.minSpeed) / (p.v.speed - p.v.minSpeed), 0, 1); ctx.fillStyle = "#33403a"; ctx.fillRect(18, top + 74, pw - 16, 4); ctx.fillStyle = "#8fc3d8"; }
  else { bar = clamp(1 - p.cd / p.v.reload, 0, 1); ctx.fillStyle = "#33403a"; ctx.fillRect(18, top + 74, pw - 16, 4); ctx.fillStyle = bar >= 1 ? "#d9a441" : "#8a7a55"; }
  ctx.fillRect(18, top + 74, (pw - 16) * bar, 4);
  // kill feed
  ctx.font = "600 11px system-ui, sans-serif";
  b.feed.forEach((f, i) => {
    const y = top + 104 + (b.hudChips || 0) * 21 + i * 17; ctx.globalAlpha = clamp(f.t, 0, 1);
    ctx.fillStyle = "rgba(10,14,13,.5)"; const txt = f.a + "  ✕  " + f.b, w = ctx.measureText(txt).width + 14;
    WOV.rr(ctx, 10, y - 12, w, 16, 5); ctx.fill();
    ctx.fillStyle = TEAM_COL[f.at]; ctx.fillText(f.a, 17, y); const wa = ctx.measureText(f.a + "  ").width;
    ctx.fillStyle = "#cfcab8"; ctx.fillText("✕", 17 + wa, y);
    ctx.fillStyle = TEAM_COL[f.bt]; ctx.fillText(f.b, 17 + wa + ctx.measureText("✕  ").width, y);
  });
  ctx.globalAlpha = 1;
  // minimap
  const ms = Math.min(110, W * 0.28), mx = W - ms - 10, my = top + 42, k = ms / b.map.size;
  ctx.fillStyle = "rgba(10,14,13,.6)"; ctx.fillRect(mx - 3, my - 3, ms + 6, ms + 6);
  ctx.drawImage(b.map.mini, mx, my, ms, ms);
  ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1; ctx.strokeRect(mx + b.cam.x * k, my + b.cam.y * k, W * k, H * k);
  for (const u of b.units) if (!u.dead) {
    const ux = mx + u.x * k, uy = my + u.y * k;
    ctx.fillStyle = u.isPlayer ? "#fff" : TEAM_COL[u.team];
    if (u.kind === "plane") { ctx.beginPath(); ctx.moveTo(ux, uy - 3); ctx.lineTo(ux + 3, uy + 2); ctx.lineTo(ux - 3, uy + 2); ctx.fill(); }
    else if (u.kind === "ship") ctx.fillRect(ux - 3, uy - 1.5, 6, 3);
    else ctx.fillRect(ux - 2, uy - 2, 4, 4);
  }
  // banner
  if (b.banner) {
    ctx.globalAlpha = clamp(b.banner.t, 0, 1); ctx.textAlign = "center";
    ctx.font = "900 34px system-ui, sans-serif"; ctx.fillStyle = b.result === "lose" ? "#e0604a" : "#d9a441"; ctx.fillText(b.banner.text, W / 2, H * 0.3);
    if (b.banner.sub) { ctx.font = "600 13px system-ui, sans-serif"; ctx.fillStyle = "#cfcab8"; ctx.fillText(b.banner.sub, W / 2, H * 0.3 + 24); }
    ctx.globalAlpha = 1;
  }
  if (p.dead && !b.over) {
    ctx.textAlign = "center"; ctx.font = "800 16px system-ui, sans-serif"; ctx.fillStyle = "#e0604a"; ctx.fillText("ТЕБЕ ЗНИЩЕНО", W / 2, H - 120);
    ctx.font = "600 12px system-ui, sans-serif"; ctx.fillStyle = "#cfcab8"; ctx.fillText("Спостереження за союзниками. Бій триває.", W / 2, H - 100);
  }
  if (!p.dead && !b.over) drawControls(p);
}

function drawControls(p) {
  // sticks: left = movement (always shown on touch), right = manual aim (only while held)
  if (usingTouch) for (const s of [sticks.L, sticks.R]) {
    const isL = s === sticks.L; if (!isL && s.id === null) continue;
    const ox = s.id !== null ? s.ox : 100, oy = s.id !== null ? s.oy : H - 120 - safeBottom();
    ctx.globalAlpha = s.id !== null ? 0.55 : 0.28;
    ctx.fillStyle = "rgba(10,14,13,.35)"; ctx.beginPath(); ctx.arc(ox, oy, STICK_R, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#e8e4d8"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox, oy, STICK_R, 0, TAU); ctx.stroke();
    ctx.fillStyle = isL ? "#e8e4d8" : "#d9a441"; ctx.beginPath(); ctx.arc(ox + s.dx * STICK_R, oy + s.dy * STICK_R, 24, 0, TAU); ctx.fill();
    if (isL && s.id === null) { ctx.globalAlpha = 0.5; ctx.fillStyle = "#e8e4d8"; ctx.font = "700 10px system-ui"; ctx.textAlign = "center"; ctx.fillText("РУХ", ox, oy - STICK_R - 8); }
    ctx.globalAlpha = 1;
  }
  const A = ammoDef(p), reload = p.kind === "plane" && !A.rocket ? 0 : clamp(p.cd / (A.rocket ? 0.7 : p.S.reload), 0, 1);
  for (const c of controls()) {
    ctx.textAlign = "center";
    if (c.k === "fire") {
      const on = fireBtn.id !== null, ready = reload <= 0;
      ctx.globalAlpha = on ? 0.95 : 0.8;
      ctx.fillStyle = ready ? (on ? "#f3cf7a" : "#d9a441") : "#7d6a42"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = A.col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 4, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - reload)); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = "#1d1a12"; ctx.font = "900 13px system-ui, sans-serif"; ctx.fillText("ВОГОНЬ", c.x, c.y + 1);
      ctx.font = "800 10px system-ui, sans-serif"; ctx.fillText(A.short, c.x, c.y + 16);
    } else if (c.k === "ammo") {
      const left = ammoLeft(p, c.a), sel = c.a.id === p.ammo, none = left <= 0;
      ctx.globalAlpha = none ? 0.35 : 0.92;
      ctx.fillStyle = sel ? c.a.col : "rgba(10,14,13,.72)"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = c.a.col; ctx.lineWidth = sel ? 3 : 2; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.stroke();
      ctx.fillStyle = sel ? "#1d1a12" : c.a.col; ctx.font = "900 11px system-ui, sans-serif"; ctx.fillText(c.a.short, c.x, c.y + (left === Infinity ? 4 : 0));
      if (left !== Infinity) { ctx.font = "700 9px system-ui, sans-serif"; ctx.fillText(left, c.x, c.y + 11); }
      if (!usingTouch) { ctx.globalAlpha = 0.7; ctx.fillStyle = "#e8e4d8"; ctx.font = "700 9px system-ui"; ctx.fillText(c.i + 1, c.x - c.r + 2, c.y - c.r + 6); }
      ctx.globalAlpha = 1;
    } else {
      const n = WOV.profile.ammo.repair || 0, off = p.repairUsed || n <= 0;
      ctx.globalAlpha = off ? 0.35 : 0.92;
      ctx.fillStyle = "rgba(10,14,13,.72)"; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#7fbf6b"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.stroke();
      ctx.fillStyle = "#7fbf6b"; ctx.fillRect(c.x - 7, c.y - 6, 14, 4); ctx.fillRect(c.x - 2, c.y - 11, 4, 14);
      ctx.font = "700 9px system-ui, sans-serif"; ctx.fillText(p.repairUsed ? "✓" : n, c.x, c.y + 14);
      if (!usingTouch) { ctx.globalAlpha = 0.7; ctx.fillStyle = "#e8e4d8"; ctx.fillText("R", c.x - c.r + 2, c.y - c.r + 6); }
      ctx.globalAlpha = 1;
    }
  }
  if (p.autoAim) { ctx.globalAlpha = 0.55; ctx.fillStyle = "#d9a441"; ctx.font = "700 10px system-ui"; ctx.textAlign = "right"; ctx.fillText("автоприціл", W - 12, H - 12 - safeBottom()); ctx.globalAlpha = 1; }
  if (B.ammoNote) {
    const n = B.ammoNote; ctx.globalAlpha = clamp(n.t * 2, 0, 1); ctx.font = "800 13px system-ui, sans-serif"; ctx.textAlign = "center";
    const w = ctx.measureText(n.text).width + 24, y = H - (usingTouch ? 230 : 130) - safeBottom();
    ctx.fillStyle = "rgba(10,14,13,.78)"; WOV.rr(ctx, W / 2 - w / 2, y - 16, w, 24, 8); ctx.fill();
    ctx.fillStyle = n.col; ctx.fillText(n.text, W / 2, y + 1); ctx.globalAlpha = 1;
  }
}

function loop(now) {
  if (!B) return;
  const raw = (now - last) / 1000, dt = Math.min(0.033, raw); last = now;
  update(dt); if (B) render();
  if (B && WOV.Audio) {
    const p = B.player; WOV.Audio.listen(B.cam.x + W / 2, B.cam.y + H / 2, W);
    WOV.Audio.engine(p.dead || B.over ? null : p.kind, Math.abs(p.vel) / p.v.speed);
  }
  // adaptive quality: slow device -> lower resolution and fewer particles
  if (!lowFx && raw < 0.5) { perf.acc += raw; perf.n++; if (perf.n >= 90) { if (perf.acc / perf.n > 0.026) { lowFx = true; resize(); } perf.n = 0; perf.acc = 0; } }
  raf = requestAnimationFrame(loop);
}

WOV.Battle = { start, stop, leave, active: () => !!B, debug: () => B };
})();
