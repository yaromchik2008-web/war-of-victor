// War of Victor: progression systems inspired by big tank games
// research by experience, vehicle modifications, crew skills, repair costs, daily tasks, season battle pass, nations
(function () {
"use strict";
const WOV = window.WOV;
const P = () => WOV.profile;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- nations ----------
WOV.NATIONS = [
  { id: "СРСР", short: "СРСР", col: "#c0392b" }, { id: "США", short: "США", col: "#2f5fa8" }, { id: "Німеччина", short: "НІМ", col: "#6b6f74" },
  { id: "Британія", short: "БРИТ", col: "#1f3f70" }, { id: "Японія", short: "ЯП", col: "#d24a5a" },
];
WOV.nationOf = v => (v.nation === "ФРН" ? "Німеччина" : v.nation);

// ---------- research: experience earned in battles unlocks the next vehicles ----------
// each tier needs much more experience than the one before: II ≈ 2 100, V ≈ 21 000, X ≈ 120 000
WOV.rpNeed = v => (v.prem || WOV.STARTERS.includes(v.id) ? 0 : Math.round(380 * Math.pow(v.tier, 2.5) / 50) * 50);
WOV.rpOf = v => P().rp[v.id] || 0;
WOV.researched = v => WOV.owns(v.id) || WOV.rpOf(v) >= WOV.rpNeed(v);
// can be researched now: previous tier of the same class owned
WOV.researchable = v => !WOV.owns(v.id) && !v.prem && (v.tier === 1 || WOV.VEHICLES.some(o => o.kind === v.kind && o.tier === v.tier - 1 && WOV.owns(o.id)));
WOV.researchTarget = function (kind) {
  const p = P(), t = WOV.byId[p.resTarget[kind]];
  if (t && WOV.researchable(t) && !WOV.researched(t)) return t;
  return WOV.VEHICLES.filter(v => v.kind === kind && WOV.researchable(v) && !WOV.researched(v)).sort((a, b) => b.tier - a.tier || WOV.rpNeed(a) - WOV.rpNeed(b))[0] || null; // the highest open tier first: after buying a IV, research goes to V
};
// spend research points on the class's target (overflow flows to the next one); returns finished vehicles
WOV.addResearch = function (kind, rp) {
  const p = P(), done = [];
  let guard = 0;
  while (rp > 0 && guard++ < 10) {
    const t = WOV.researchTarget(kind); if (!t) break;
    const need = WOV.rpNeed(t) - WOV.rpOf(t), add = Math.min(need, rp);
    p.rp[t.id] = WOV.rpOf(t) + add; rp -= add;
    if (WOV.rpOf(t) >= WOV.rpNeed(t)) { done.push(t); if (p.resTarget[kind] === t.id) p.resTarget[kind] = null; }
  }
  return done;
};

// ---------- vehicle modifications: unlocked by battles on that vehicle, bought with coins ----------
WOV.VMODS = [
  { id: "engine", battles: 1, cost: 300, names: { tank: "Форсований двигун", plane: "Форсований мотор", ship: "Нові турбіни" }, desc: "+8% швидкості" },
  { id: "armor", battles: 3, cost: 450, names: { tank: "Додаткові екрани", plane: "Бронеспинка", ship: "Броньовий пояс" }, desc: "+10% міцності" },
  { id: "gun", battles: 5, cost: 600, names: { tank: "Новий прицільний комплекс", plane: "Посилені кулемети", ship: "Нова система керування вогнем" }, desc: "+8% шкоди і −5% перезарядки" },
];
WOV.vmodCost = (m, v) => m.cost * v.tier;
WOV.hasVmod = (v, id) => !!(P().vmods[v.id] && P().vmods[v.id][id]);

// ---------- crew: per class, upgraded with coins ----------
WOV.CREW = [
  { id: "reload", name: "Заряджання", desc: "−3% часу перезарядки за рівень" },
  { id: "aim", name: "Наведення", desc: "+8% швидкості повороту башти й маневру за рівень" },
  { id: "repair", name: "Ремонт", desc: "−12% часу ремонту модулів і пожежі за рівень" },
  { id: "vital", name: "Живучість", desc: "+2.5% міцності за рівень" },
];
WOV.CREW_MAX = 5;
WOV.crewLvl = (kind, id) => (P().crew[kind] && P().crew[kind][id]) || 0;
WOV.crewCost = lvl => Math.round(600 * Math.pow(lvl + 1, 1.7));

// stats of the player's vehicle with modifications and crew applied (a copy; look and id stay the same)
WOV.battleStats = function (v) {
  const k = v.kind, c = id => WOV.crewLvl(k, id), m = id => WOV.hasVmod(v, id);
  const o = Object.assign({}, v);
  o.speed = v.speed * (m("engine") ? 1.08 : 1); if (v.minSpeed) o.minSpeed = v.minSpeed * (m("engine") ? 1.05 : 1);
  o.hp = Math.round(v.hp * (m("armor") ? 1.1 : 1) * (1 + 0.025 * c("vital")));
  o.dmg = v.dmg * (m("gun") ? 1.08 : 1);
  o.reload = v.reload * (m("gun") ? 0.95 : 1) * (1 - 0.03 * c("reload"));
  o.turn = v.turn * (1 + 0.08 * c("aim") * (k === "plane" ? 0.5 : 0.25)); if (v.tturn) o.tturn = v.tturn * (1 + 0.08 * c("aim"));
  o.repairMul = 1 - 0.12 * c("repair");
  o.base = v;
  return o;
};

// ---------- repair after battle (premium vehicles repair for free) ----------
WOV.repairCost = v => (v.prem ? 0 : 50 + v.tier * 90);

// ---------- daily tasks ----------
const TASKS = [
  { id: "battles", text: n => "Зіграй " + n + " бої", n: [3, 4], reward: 400 },
  { id: "wins", text: n => "Виграй " + n + " бої", n: [2, 3], reward: 600 },
  { id: "kills", text: n => "Знищ " + n + " одиниць техніки", n: [4, 7], reward: 600 },
  { id: "dmg", text: n => "Завдай " + n + " шкоди", n: [1200, 2500], reward: 500 },
  { id: "kills_tank", text: n => "Знищ " + n + " цілі, граючи на танку", n: [2, 4], reward: 550 },
  { id: "kills_plane", text: n => "Знищ " + n + " цілі, граючи на літаку", n: [2, 3], reward: 550 },
  { id: "kills_ship", text: n => "Знищ " + n + " цілі, граючи на кораблі", n: [2, 3], reward: 550 },
  { id: "caps", text: n => "Захопи " + n + " точки в режимі «Захоплення»", n: [2, 4], reward: 650 },
  { id: "survive", text: n => "Виживи до кінця " + n + " боїв", n: [2, 3], reward: 450 },
];
const dayKey = () => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
WOV.dailyTasks = function () {
  const p = P();
  if (p.daily.day !== dayKey()) {
    let h = 0; for (const ch of dayKey() + p.code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const pool = TASKS.slice(), list = [];
    for (let i = 0; i < 3; i++) { const t = pool.splice(h % pool.length, 1)[0]; h = (h * 1103515245 + 12345) >>> 0; const n = t.n[0] + (h % (t.n[1] - t.n[0] + 1)); list.push({ id: t.id, n, got: 0, claimed: false, reward: t.reward }); }
    p.daily = { day: dayKey(), list };
  }
  return p.daily.list.map(t => Object.assign({ text: TASKS.find(x => x.id === t.id).text(t.n) }, t));
};
WOV.taskTimeLeft = () => { const d = new Date(), e = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); return e - d; };

// ---------- season battle pass (free track) ----------
WOV.SEASON = { name: "Сезон 1: Залізний шторм", ends: new Date(2026, 11, 15), perLevel: 100, levels: 30 };
WOV.passReward = function (lvl) {
  if (lvl === 30) return { type: "vehicle", id: "p47", alt: { type: "crystals", amount: 300 } };
  if (lvl % 10 === 0) return { type: "camo", id: lvl === 10 ? "digital" : "carbon", alt: { type: "crystals", amount: 120 } };
  if (lvl % 5 === 0) return { type: "box", id: lvl >= 20 ? "gold" : "iron" };
  if (lvl % 3 === 0) return { type: "crystals", amount: 10 + lvl };
  if (lvl % 4 === 0) return { type: "stock", id: ["apcr", "repair", "heavy", "inc"][(lvl / 4) % 4], amount: [15, 3, 10, 200][(lvl / 4) % 4] };
  return { type: "coins", amount: 400 + lvl * 60 };
};
WOV.passLevel = () => Math.min(WOV.SEASON.levels, Math.floor(P().pass.xp / WOV.SEASON.perLevel));
// gives a pass reward; returns a short text for the toast
WOV.claimPass = function (lvl) {
  const p = P(); if (p.pass.claimed.includes(lvl) || lvl > WOV.passLevel()) return null;
  let r = WOV.passReward(lvl), text;
  if (r.type === "vehicle" && WOV.owns(r.id)) r = r.alt;
  if (r.type === "camo" && p.camos.includes(r.id)) r = r.alt;
  if (r.type === "coins") { p.coins += r.amount; text = "+" + r.amount + " монет"; }
  else if (r.type === "crystals") { p.crystals += r.amount; text = "+" + r.amount + " кристалів"; }
  else if (r.type === "stock") { p.ammo[r.id] = (p.ammo[r.id] || 0) + r.amount; text = "+" + r.amount + " · " + WOV.STOCK[r.id].name; }
  else if (r.type === "camo") { p.camos.push(r.id); text = "Камуфляж «" + WOV.CAMOS.find(c => c.id === r.id).name + "»"; }
  else if (r.type === "vehicle") { p.owned.push(r.id); text = WOV.byId[r.id].name + " у твоєму ангарі!"; }
  else if (r.type === "box") { const box = WOV.BOXES.find(b => b.id === r.id); WOV.openBox(box); text = box.name + " бокс відкрито: здобич уже на рахунку"; }
  p.pass.claimed.push(lvl); WOV.save(); WOV.emit("wallet");
  return text;
};

// ---------- after every battle: tasks, pass, research, vehicle battle counter ----------
WOV.recordBattle = function (s) {
  const p = P(), v = WOV.byId[s.vehicleId];
  const inc = { battles: 1, wins: s.result === "win" ? 1 : 0, kills: s.kills, dmg: s.dmg, caps: s.caps || 0, survive: s.survived ? 1 : 0 };
  inc["kills_" + v.kind] = s.kills;
  const finished = [];
  WOV.dailyTasks();
  for (const t of p.daily.list) if (!t.claimed && t.got < t.n) { t.got = Math.min(t.n, t.got + (inc[t.id] || 0)); if (t.got >= t.n) finished.push(t); }
  const passBefore = WOV.passLevel();
  p.pass.xp += Math.round(20 + s.xp / 12);
  p.vbattles[v.id] = (p.vbattles[v.id] || 0) + 1;
  const researched = WOV.addResearch(v.kind, s.xp);
  const medals = medalsFor(s);
  for (const md of medals) { p.medals[md.id] = (p.medals[md.id] || 0) + 1; p.coins += md.coins; }
  const mastery = masteryFor(s);
  return { finished, passUp: WOV.passLevel() > passBefore ? WOV.passLevel() : 0, researched, rp: s.xp, medals, mastery };
};
// ---------- medals and vehicle mastery (called from WOV.recordBattle) ----------
function medalsFor(s) {
  const m = s.medalStats || {}, out = [];
  const has = id => out.push(WOV.MEDALS.find(x => x.id === id));
  if (m.firstBlood) has("blood");
  if (s.kills >= 5) has("ace"); else if (s.kills >= 3) has("warrior");
  if (m.longKill) has("sniper");
  if (m.planes >= 2) has("aa");
  if (s.survived && m.taken > m.maxHp) has("wall");
  if (s.result === "win" && s.survived && m.hpLeft < 0.15) has("hair");
  if (m.crates >= 2) has("courier");
  if (m.strikeKills) has("artillery");
  if (m.top && (s.kills || s.dmg > 0)) has("top");
  if (s.caps >= 2) has("capture");
  if (s.result === "win" && s.survived && m.lastAlly) has("lone");
  return out.filter(Boolean);
}
WOV.masteryOf = id => WOV.MASTERY[(P().mastery[id] || 0) - 1] || null;
function masteryFor(s) {
  const m = s.medalStats || {}; if (!m.maxHp) return null;
  const score = (s.dmg / m.maxHp) * 100 + s.kills * 60 + (s.result === "win" ? 40 : 0) + (s.survived ? 20 : 0);
  let got = null; for (const q of WOV.MASTERY) if (score >= q.score) got = q;
  if (!got) return null;
  const p = P(), before = p.mastery[s.vehicleId] || 0;
  if (got.lvl > before) { p.mastery[s.vehicleId] = got.lvl; p.crystals += got.crystals; return { level: got, fresh: true, score: Math.round(score) }; }
  return { level: got, fresh: false, score: Math.round(score) };
}

// ---------- 7-day login calendar ----------
const dayNum = d => Math.floor((d.getTime() - d.getTimezoneOffset() * 60e3) / 864e5);
WOV.loginState = function () {
  const L = P().login, today = String(dayNum(new Date()));
  if (L.day !== today) {
    const yesterday = String(dayNum(new Date()) - 1);
    L.streak = L.day === yesterday && L.claimed === L.day ? (L.streak % 7) + 1 : 1;
    L.day = today;
  }
  return { day: L.streak, claimed: L.claimed === today };
};
WOV.claimLogin = function () {
  const st = WOV.loginState(); if (st.claimed) return null;
  const p = P(), r = WOV.LOGIN_REWARDS[st.day - 1], parts = [];
  if (r.coins) { p.coins += r.coins; parts.push("+" + r.coins + " монет"); }
  if (r.crystals) { p.crystals += r.crystals; parts.push("+" + r.crystals + " кристалів"); }
  if (r.stock) { p.ammo[r.stock] = (p.ammo[r.stock] || 0) + r.n; parts.push("+" + r.n + " · " + WOV.STOCK[r.stock].name); }
  if (r.box) { const box = WOV.BOXES.find(b => b.id === r.box); if (box) { WOV.openBox(box); parts.push(box.name + " бокс"); } }
  p.login.claimed = p.login.day; WOV.save(); WOV.emit("wallet");
  return parts.join(", ");
};

WOV.claimTask = function (i) {
  const p = P(), t = p.daily.list[i]; if (!t || t.claimed || t.got < t.n) return false;
  t.claimed = true; p.coins += t.reward; p.pass.xp += 150; WOV.save(); WOV.emit("wallet"); return true;
};
})();
