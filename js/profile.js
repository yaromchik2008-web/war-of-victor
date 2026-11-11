// War of Victor: player profile, currencies and saving (Telegram CloudStorage + localStorage)
(function () {
"use strict";
const WOV = (window.WOV = window.WOV || {});
const tg = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData !== undefined ? window.Telegram.WebApp : null;
WOV.tg = tg;

WOV.haptic = (kind) => {
  try {
    if (!tg || !tg.HapticFeedback) return;
    if (kind === "error" || kind === "success" || kind === "warning") tg.HapticFeedback.notificationOccurred(kind);
    else if (kind === "select") tg.HapticFeedback.selectionChanged();
    else tg.HapticFeedback.impactOccurred(kind);
  } catch (e) {}
};

const KEY = "wov_profile_v3";
const cloudOk = () => { try { return !!(tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast("6.9")); } catch (e) { return false; } };

function tgUser() { try { return (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || null; } catch (e) { return null; } }
function randomCode() { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }

function fresh() {
  const u = tgUser();
  return {
    v: 3, code: u ? "T" + u.id.toString(36).toUpperCase() : randomCode(),
    name: u ? (u.first_name || u.username || "Командир") : "Командир",
    coins: 3000, crystals: 20,
    owned: WOV.STARTERS.slice(), cls: "tank", sel: { tank: "t26", plane: "i16", ship: "g5" },
    camos: ["base"], camoSel: {}, boost: 0,
    friends: [], friendRewards: 0, refUsed: false,
    stats: { battles: 0, wins: 0, kills: 0, dmg: 0 }, xp: 0, boxesOpened: 0, sound: true, music: true,
    ammo: Object.assign({}, WOV.START_STOCK), ammoSel: { tank: "ap", plane: "mg", ship: "ap" }, giftAt: 0, dealDay: "",
  };
}
WOV.profile = fresh();

function sanitize(p) {
  const f = fresh();
  const out = Object.assign(f, p || {});
  out.owned = (out.owned || []).filter(id => WOV.byId[id]);
  for (const s of WOV.STARTERS) if (!out.owned.includes(s)) out.owned.push(s);
  for (const k of ["tank", "plane", "ship"]) if (!out.sel[k] || !out.owned.includes(out.sel[k])) out.sel[k] = WOV.STARTERS[["tank", "plane", "ship"].indexOf(k)];
  out.stats = Object.assign(fresh().stats, out.stats || {});
  out.ammo = Object.assign(fresh().ammo, out.ammo || {});
  out.ammoSel = Object.assign(fresh().ammoSel, out.ammoSel || {});
  return out;
}

WOV.save = function () {
  const s = JSON.stringify(WOV.profile);
  try { localStorage.setItem(KEY, s); } catch (e) {}
  if (cloudOk()) { try { tg.CloudStorage.setItem(KEY, s); } catch (e) {} }
};
WOV.load = function (cb) {
  let local = null;
  try { local = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  const done = (p) => { WOV.profile = sanitize(p); handleReferral(); WOV.save(); cb && cb(); };
  if (!cloudOk()) return done(local);
  let finished = false;
  const timer = setTimeout(() => { if (!finished) { finished = true; done(local); } }, 1500);
  try {
    tg.CloudStorage.getItem(KEY, (err, v) => {
      if (finished) return; finished = true; clearTimeout(timer);
      let cloud = null; try { cloud = v ? JSON.parse(v) : null; } catch (e) {}
      // prefer whichever save has more progress
      const score = p => p ? (p.stats ? p.stats.battles : 0) * 1000 + (p.coins || 0) : -1;
      done(score(cloud) >= score(local) ? cloud : local);
    });
  } catch (e) { finished = true; clearTimeout(timer); done(local); }
};

// someone opened the game through a friend's invite link: t.me/<bot>/<app>?startapp=ref_<code>
function handleReferral() {
  let sp = null;
  try { sp = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || new URLSearchParams(location.search).get("ref"); } catch (e) {}
  if (!sp) return;
  const code = String(sp).replace(/^ref_/, "").toUpperCase().slice(0, 16);
  const p = WOV.profile;
  if (!code || code === p.code || p.refUsed) return;
  p.refUsed = true;
  if (!p.friends.some(f => f.code === code)) p.friends.push({ code, name: "Друг " + code.slice(-4), since: Date.now(), viaInvite: true });
  p.coins += WOV.REF_BONUS;
  WOV.pendingToast = "Ти прийшов за запрошенням друга: +" + WOV.REF_BONUS + " монет!";
}

WOV.inviteLink = function () {
  const c = WOV.CONFIG, code = WOV.profile.code;
  if (c.BOT_USERNAME) return "https://t.me/" + c.BOT_USERNAME + "/" + c.APP_NAME + "?startapp=ref_" + code;
  return null; // bot username not configured yet
};

// ---------- economy helpers ----------
WOV.spend = function (cur, amount) {
  const p = WOV.profile;
  if (p[cur] < amount) return false;
  p[cur] -= amount; WOV.save(); WOV.emit && WOV.emit("wallet"); return true;
};
WOV.give = function (cur, amount) { WOV.profile[cur] += amount; WOV.save(); WOV.emit && WOV.emit("wallet"); };
WOV.owns = id => WOV.profile.owned.includes(id);
// a vehicle can be bought when you own any vehicle of the same class one tier lower
WOV.canUnlock = function (v) {
  if (WOV.owns(v.id) || v.prem) return false;
  if (v.tier === 1) return true;
  return WOV.VEHICLES.some(o => o.kind === v.kind && o.tier === v.tier - 1 && WOV.owns(o.id));
};
WOV.rank = function (xp) {
  xp = xp === undefined ? WOV.profile.xp : xp;
  const R = WOV.RANKS; let i = 0; while (i + 1 < R.length && xp >= R[i + 1].xp) i++;
  const next = R[i + 1] || null;
  return { r: R[i], next, cur: xp - R[i].xp, need: next ? next.xp - R[i].xp : 1, frac: next ? (xp - R[i].xp) / (next.xp - R[i].xp) : 1 };
};
// insignia as an SVG string (shoulder-board style)
WOV.rankIcon = function (r, size) {
  size = size || 30; const n = r.n, c = r.ins === "gen" ? "#3a2a08" : "#1d1a10";
  let g = "";
  if (r.ins === "bar") { if (!n) g = '<circle cx="12" cy="12" r="2.5" fill="' + c + '"/>'; for (let k = 0; k < n; k++) g += '<rect x="5" y="' + (10 - (n - 1) * 2.5 + k * 5) + '" width="14" height="3" rx="1" fill="' + c + '"/>'; }
  else if (r.ins === "chev") { for (let k = 0; k < n; k++) { const y = 6 + k * (12 / Math.max(1, n)) + (n === 1 ? 4 : 0); g += '<path d="M5 ' + (y + 4) + 'L12 ' + y + 'L19 ' + (y + 4) + '" fill="none" stroke="' + c + '" stroke-width="2.2" stroke-linejoin="round"/>'; } }
  else {
    const big = r.ins !== "star", rad = big ? 3.6 : 2.6, pos = { 1: [[12, 12]], 2: [[12, 7.5], [12, 16.5]], 3: [[12, 6], [8, 15], [16, 15]], 4: [[12, 5], [12, 12], [8, 18], [16, 18]] }[n];
    const star = (x, y, R) => { let d = ""; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? R * 0.45 : R; d += (k ? "L" : "M") + (x + Math.cos(a) * rr).toFixed(2) + " " + (y + Math.sin(a) * rr).toFixed(2); } return '<path d="' + d + 'Z" fill="' + c + '"/>'; };
    for (const [x, y] of pos) g += star(x, y, rad);
    if (r.ins === "gen") g = '<path d="M3 21c3-1 5-3 6-6M21 21c-3-1-5-3-6-6" stroke="' + c + '" stroke-width="1.2" fill="none" opacity=".6"/>' + g;
  }
  return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '">' + g + "</svg>";
};
WOV.level = function () { const xp = WOV.profile.xp; let lvl = 1, need = 500, acc = 0; while (xp >= acc + need) { acc += need; lvl++; need = Math.round(need * 1.25); } return { lvl, cur: xp - acc, need }; };
WOV.currentVehicle = function () { const p = WOV.profile; return WOV.byId[p.sel[p.cls]]; };
WOV.camoOf = function (v) { const id = WOV.profile.camoSel[v.id] || "base"; return WOV.CAMOS.find(c => c.id === id) || WOV.CAMOS[0]; };

// open a box: returns list of rewards {type, amount|id, label}
WOV.openBox = function (box) {
  const r = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const p = WOV.profile, out = [];
  const cr = r(box.crystals[0], box.crystals[1]); p.crystals += cr; if (cr > 0) out.push({ type: "crystals", amount: cr });
  const co = Math.round(r(box.coins[0], box.coins[1]) / 10) * 10; p.coins += co; if (co > 0) out.push({ type: "coins", amount: co });
  if (Math.random() < box.camo) {
    const notOwned = WOV.CAMOS.filter(c => c.price > 0 && !p.camos.includes(c.id));
    if (notOwned.length) { const c = notOwned[Math.floor(Math.random() * notOwned.length)]; p.camos.push(c.id); out.push({ type: "camo", id: c.id, label: c.name }); }
  }
  if (Math.random() < box.prem) {
    const prem = WOV.VEHICLES.filter(v => v.prem && !p.owned.includes(v.id));
    if (prem.length) { const v = prem[Math.floor(Math.random() * prem.length)]; p.owned.push(v.id); out.push({ type: "vehicle", id: v.id, label: v.name }); }
    else { const extra = r(80, 200); p.crystals += extra; out.push({ type: "crystals", amount: extra, note: "замість дубліката" }); }
  }
  if (Math.random() < box.boost) { p.boost += 3; out.push({ type: "boost", amount: 3 }); }
  if (box.ammo) {
    const n = r(box.ammo[0], box.ammo[1]), keys = Object.keys(WOV.STOCK);
    for (let i = 0; i < n; i++) {
      const k = keys[Math.floor(Math.random() * keys.length)], st = WOV.STOCK[k], amt = Math.max(1, Math.round(st.packs[0].n * (0.25 + Math.random() * 0.35)));
      p.ammo[k] = (p.ammo[k] || 0) + amt;
      const prev = out.find(o => o.type === "ammo" && o.id === k); if (prev) prev.amount += amt; else out.push({ type: "ammo", id: k, amount: amt, label: st.name });
    }
  }
  p.boxesOpened++;
  WOV.save(); WOV.emit && WOV.emit("wallet");
  return out;
};

// simple event bus for UI refreshes
const subs = {};
WOV.on = (ev, fn) => { (subs[ev] = subs[ev] || []).push(fn); };
WOV.emit = (ev, data) => { (subs[ev] || []).forEach(fn => fn(data)); };
})();
