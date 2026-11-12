// War of Victor: menus (hangar, tech tree, shop, friends), boxes and battle results
(function () {
"use strict";
const WOV = window.WOV;
const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const fmt = n => Math.round(n).toLocaleString("uk-UA").replace(/ /g, " ");
const tg = WOV.tg;

const ICONS = {
  coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#e0ac45"/><circle cx="12" cy="12" r="7.5" fill="#f3cf7a"/><circle cx="12" cy="12" r="7.5" fill="none" stroke="#b9862a" stroke-width="1.2"/><path d="M12 7.2l1.4 2.9 3.2.4-2.3 2.2.6 3.1-2.9-1.5-2.9 1.5.6-3.1-2.3-2.2 3.2-.4z" fill="#b9862a"/></svg>',
  crystal: '<svg viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 13L2 9z" fill="#4aa7dc"/><path d="M6 3h12l4 6H2z" fill="#8fd6fa"/><path d="M8.5 9L12 22 15.5 9z" fill="#6fc3f0"/><path d="M6 3l2.5 6L12 3l3.5 6L18 3" fill="none" stroke="#d9f2ff" stroke-width=".8"/></svg>',
  boost: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="#f3cf7a"/></svg>',
  camo: '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" fill="#5b6b3c"/><circle cx="8" cy="9" r="4" fill="#33402a"/><circle cx="16" cy="15" r="5" fill="#8a7a4c"/></svg>',
  vehicle: '<svg viewBox="0 0 24 24"><rect x="3" y="12" width="18" height="6" rx="2" fill="#a27be0"/><rect x="7" y="8" width="8" height="5" rx="2" fill="#c7a8f5"/><rect x="14" y="9.5" width="8" height="2" fill="#c7a8f5"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2" fill="currentColor"/><path d="M8 10V7a4 4 0 018 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  hangar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 20V9l9-5 9 5v11"/><path d="M7 20v-6h10v6"/></svg>',
  tree: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="3" width="6" height="5" rx="1.5"/><rect x="3" y="16" width="6" height="5" rx="1.5"/><rect x="15" y="16" width="6" height="5" rx="1.5"/><path d="M12 8v4M6 16v-4h12v4"/></svg>',
  shop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 8h16l-1.5 12h-13z"/><path d="M8 8a4 4 0 018 0"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/></svg>',
  music: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 17.5V5.5l11-2.5v12" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.8"/><circle cx="17.5" cy="15" r="2.8"/></svg>',
  tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8.5l1.5 1.5L12 7.5M8 14.5l1.5 1.5 2.5-2.5M14.5 9h2M14.5 15h2"/></svg>',
  friends: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-4 3.4-6 6.5-6s5.7 2 6.5 6"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.2c2.8.1 4.8 1.9 5.5 5.3"/></svg>',
};
WOV.ICONS = ICONS;
document.querySelectorAll("[data-ico]").forEach(e => { e.innerHTML = ICONS[e.dataset.ico] || ""; });
const priceHtml = (cur, n) => '<span class="price">' + ICONS[cur === "coins" ? "coin" : "crystal"] + fmt(n) + "</span>";

function toast(msg, ms) {
  const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add("hidden"), ms || 2200);
}
WOV.toast = toast;

// ---------- wallet / player ----------
let lastCoins = null, lastCr = null;
function renderWallet() {
  const p = WOV.profile;
  $("#coins").textContent = fmt(p.coins); $("#crystals").textContent = fmt(p.crystals);
  if (lastCoins !== null && lastCoins !== p.coins) bump(".pill.coins");
  if (lastCr !== null && lastCr !== p.crystals) bump(".pill.crystals");
  lastCoins = p.coins; lastCr = p.crystals;
  const R = WOV.rank();
  $("#pname").textContent = p.name; $("#avatar").innerHTML = WOV.rankIcon(R.r, 30); $("#avatar").classList.toggle("gen", R.r.ins === "gen");
  $("#plvl").textContent = R.r.name; $("#pxp").style.width = Math.round(R.frac * 100) + "%";
}
// rank ladder sheet (tap on the player chip)
$("#playerChip").onclick = () => {
  const R = WOV.rank(), xp = WOV.profile.xp;
  const rows = WOV.RANKS.map(r => '<div class="rank-row' + (r.i === R.r.i ? " cur" : r.xp <= xp ? " done" : "") + '"><span class="avatar' + (r.ins === "gen" ? " gen" : "") + '">' + WOV.rankIcon(r, 24) + "</span><div><b>" + r.name + "</b><small>" + fmt(r.xp) + " досвіду" + (r.i ? " · нагорода " + fmt(r.reward.coins) + " монет" + (r.reward.crystals ? " + " + r.reward.crystals + " кристалів" : "") : "") + "</small></div></div>").join("");
  openSheet('<h2 style="margin:0 0 4px">Військові звання</h2><div class="sub">Досвід дають бої: чим краще граєш, тим швидше росте звання. ' + (R.next ? "До звання «" + R.next.name + "» ще " + fmt(R.next.xp - xp) + " досвіду." : "Ти досяг найвищого звання!") + '</div><div class="ranks">' + rows + "</div>", sh => { const c = sh.querySelector(".rank-row.cur"); c && c.scrollIntoView({ block: "center" }); });
};
function bump(sel) { const e = $(sel); e.classList.remove("bump"); void e.offsetWidth; e.classList.add("bump"); }
WOV.on("wallet", () => { renderWallet(); });

// ---------- tabs ----------
let tab = "hangar";
function setTab(t) {
  tab = t;
  document.querySelectorAll(".tabbar button").forEach(b => b.classList.toggle("active", b.dataset.tab === t));
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active", s.id === "scr-" + t));
  if (t === "hangar") renderHangar(); else if (t === "tree") renderTree(); else if (t === "shop") renderShop(); else if (t === "tasks") renderTasks(); else renderFriends();
  updateTaskDot();
  WOV.haptic("select");
}
document.querySelectorAll(".tabbar button").forEach(b => b.onclick = () => setTab(b.dataset.tab));

function segment(container, value, onChange) {
  container.innerHTML = "";
  for (const k of ["tank", "plane", "ship"]) {
    const b = el("button", k === value ? "active" : "", WOV.KIND_NAME[k]);
    b.onclick = () => { onChange(k); WOV.haptic("select"); };
    container.appendChild(b);
  }
}

// ---------- stat normalisation ----------
function statsOf(v) {
  const same = WOV.VEHICLES.filter(o => o.kind === v.kind);
  const max = f => Math.max(...same.map(f));
  const dps = o => o.dmg / o.reload;
  const rows = [
    ["Швидкість", Math.round(v.speed) + (v.kind === "plane" ? " км/г" : " км/г"), v.speed / max(o => o.speed)],
    ["Міцність", v.hp, v.hp / max(o => o.hp)],
    ["Вогонь", Math.round(dps(v)) + "/с", dps(v) / max(dps)],
  ];
  if (v.kind === "plane") rows.push(["Маневр", v.turn.toFixed(1), v.turn / max(o => o.turn)]);
  else rows.push(["Броня лоба", Math.round((1 - v.armor[0]) * 100) + "%", (1 - v.armor[0]) / max(o => 1 - o.armor[0])]);
  rows.push(["Дальність", Math.round(v.shell * v.range) + " м", (v.shell * v.range) / max(o => o.shell * o.range)]);
  rows.push(["Ранг", WOV.ROMAN[v.tier], v.tier / 7]);
  return rows.map(([n, val, k]) => '<div class="stat"><div><span>' + n + "</span><b>" + val + '</b></div><i style="--v:' + Math.round(Math.max(0.06, Math.min(1, k)) * 100) + '%"></i></div>').join("");
}
const roleName = { light: "легкий танк", medium: "середній танк", heavy: "важкий танк", mbt: "основний бойовий танк", fighter: "винищувач", attacker: "штурмовик", heavy_plane: "важкий винищувач", boat: "торпедний катер", destroyer: "есмінець", cruiser: "крейсер", battleship: "лінкор" };
const roleOf = v => v.kind === "plane" && v.role === "heavy" ? roleName.heavy_plane : roleName[v.role];

// ---------- hangar ----------
let hangarAngle = -Math.PI / 2, hangarRaf = 0, mode = "team";
function renderHangar() {
  const p = WOV.profile, v = WOV.currentVehicle();
  segment($("#hangarCls"), p.cls, k => { p.cls = k; WOV.save(); renderHangar(); });
  $("#hTier").textContent = WOV.ROMAN[v.tier]; $("#hTier").className = "tier" + (v.prem ? " prem" : "");
  $("#hName").textContent = v.name; $("#hMeta").textContent = v.nation + " · " + roleOf(v) + (v.prem ? " · преміум" : "");
  const mq = WOV.masteryOf(v.id); if (mq) $("#hName").insertAdjacentHTML("beforeend", ' <span class="mastery" style="--c:' + mq.col + '" title="' + mq.name + '">' + mq.short + "</span>");
  renderHangarStats();
  const owned = WOV.VEHICLES.filter(o => o.kind === p.cls && WOV.owns(o.id)).sort((a, b) => a.tier - b.tier);
  const car = $("#hOwned"); car.innerHTML = "";
  for (const o of owned) {
    const c = el("button", "vcard" + (o.id === v.id ? " sel" : ""), '<span class="tier' + (o.prem ? " prem" : "") + '">' + WOV.ROMAN[o.tier] + "</span><canvas></canvas><b>" + o.name + "</b>");
    c.onclick = () => { p.sel[p.cls] = o.id; WOV.save(); renderHangar(); WOV.haptic("select"); };
    car.appendChild(c); WOV.preview(c.querySelector("canvas"), o, { fill: 0.9, angle: -0.5, tAngle: -0.2, camo: WOV.camoOf(o) });
  }
  const add = el("button", "vcard add", "+ Нова<br>техніка"); add.onclick = () => { treeCls = p.cls; setTab("tree"); }; car.appendChild(add);
  renderAmmoRow(v);
  const cs = $("#hCamos"); cs.innerHTML = "";
  for (const cm of WOV.CAMOS.filter(c => p.camos.includes(c.id))) {
    const b = el("button", "camo" + (WOV.camoOf(v).id === cm.id ? " sel" : ""), "<span></span>");
    b.firstChild.style.background = swatchBg(cm, v); b.title = cm.name;
    b.onclick = () => { p.camoSel[v.id] = cm.id; WOV.save(); renderHangar(); WOV.haptic("select"); };
    cs.appendChild(b);
  }
  const shopCamo = el("button", "camo", '<span style="display:grid;place-items:center;color:var(--muted);font-size:20px">+</span>'); shopCamo.onclick = () => setTab("shop"); cs.appendChild(shopCamo);
  const ms = $("#modes"); ms.innerHTML = "";
  for (const id of ["quick", "conquest", "team"]) {
    const m = WOV.MODES[id], b = el("button", "mode" + (mode === id ? " sel" : ""), "<b>" + m.name + "</b><small>" + m.desc + "</small>");
    b.onclick = () => { mode = id; renderHangar(); WOV.haptic("select"); }; ms.appendChild(b);
  }
  $("#boostInfo").textContent = p.boost > 0 ? "×2 монет ще на " + p.boost + " боїв" : v.name + " · ранг " + WOV.ROMAN[v.tier];
  cancelAnimationFrame(hangarRaf);
  const spinStage = () => {
    if (tab !== "hangar" || WOV.Battle.active()) return;
    hangarAngle += 0.004;
    WOV.preview($("#hangarCanvas"), v, { fill: v.kind === "ship" ? 0.95 : 0.7, angle: hangarAngle, tAngle: hangarAngle + Math.sin(hangarAngle * 3) * 0.5, camo: WOV.camoOf(v) });
    hangarRaf = requestAnimationFrame(spinStage);
  };
  spinStage();
}
function renderAmmoRow(v) {
  const p = WOV.profile, row = $("#hAmmo"); row.innerHTML = "";
  const list = WOV.AMMO[v.kind]; let sel = list.find(a => a.id === p.ammoSel[v.kind]) || list[0];
  for (const a of list) {
    const left = a.limit ? a.limit + " на бій" : a.stock ? "запас " + fmt(p.ammo[a.stock] || 0) : "безліміт";
    const none = a.stock && !(p.ammo[a.stock] > 0);
    const b = el("button", "ammo" + (a === sel ? " sel" : "") + (none ? " none" : ""), shellIco(a) + "<b>" + a.name + "</b><small>" + left + "</small>");
    b.onclick = () => {
      if (none) { shopTab = "ammo"; setTab("shop"); toast(a.name + ": купи в розділі «Снаряди»"); return; }
      p.ammoSel[v.kind] = a.id; WOV.save(); WOV.haptic("select"); renderAmmoRow(v);
    };
    row.appendChild(b);
  }
  $("#hAmmoDesc").textContent = "Стартовий снаряд: " + sel.name + ". " + sel.desc;
}
function swatchBg(cm, v) {
  const c = cm.colors || [v ? v.look.color : "#6f7d4f", "#555", "#777"];
  return "radial-gradient(circle at 30% 30%, " + c[1] + " 0 22%, transparent 23%), radial-gradient(circle at 75% 70%, " + c[2] + " 0 26%, transparent 27%), " + c[0];
}
$("#toBattle").onclick = () => startBattle();

// ---------- tech tree ----------
let treeCls = "tank";
let treeNat = "all";
const natBadge = v => { const n = WOV.NATIONS.find(x => x.id === WOV.nationOf(v)); return n ? '<span class="nat" style="background:' + n.col + '">' + n.short + "</span>" : ""; };
function renderTree() {
  segment($("#treeCls"), treeCls, k => { treeCls = k; renderTree(); });
  const nats = WOV.NATIONS.filter(n => WOV.VEHICLES.some(v => v.kind === treeCls && WOV.nationOf(v) === n.id));
  if (treeNat !== "all" && !nats.some(n => n.id === treeNat)) treeNat = "all";
  const nb = $("#treeNat"); nb.innerHTML = "";
  for (const n of [{ id: "all", short: "Усі нації" }].concat(nats)) { const b = el("button", n.id === treeNat ? "active" : "", n.id === "all" ? n.short : n.id); b.onclick = () => { treeNat = n.id; renderTree(); }; nb.appendChild(b); }
  const tgt = WOV.researchTarget(treeCls);
  $("#treeHint").innerHTML = tgt ? "Досліджується: <b style='color:#9fd8ff'>" + tgt.name + "</b> · " + fmt(WOV.rpOf(tgt)) + " / " + fmt(WOV.rpNeed(tgt)) + " досвіду. Досвід приходить з кожного бою на техніці цього класу. Торкнись іншої машини, щоб досліджувати її." : "Усе доступне в цьому класі досліджено.";
  const tree = $("#tree"); tree.innerHTML = "";
  const list = WOV.VEHICLES.filter(v => v.kind === treeCls && !v.prem && (treeNat === "all" || WOV.nationOf(v) === treeNat));
  for (let t = 1; t <= 7; t++) {
    const row = el("div", "tier-row", '<div class="tier-label">' + WOV.ROMAN[t] + '</div><div class="tier-cards"></div>');
    for (const v of list.filter(v => v.tier === t)) row.lastChild.appendChild(treeCard(v));
    tree.appendChild(row);
  }
  const prem = WOV.VEHICLES.filter(v => v.kind === treeCls && v.prem && (treeNat === "all" || WOV.nationOf(v) === treeNat));
  if (prem.length) {
    const row = el("div", "tier-row", '<div class="tier-label" style="color:var(--purple)">★</div><div class="tier-cards"></div>');
    for (const v of prem) row.lastChild.appendChild(treeCard(v));
    tree.appendChild(row);
  }
}
function treeCard(v) {
  const owned = WOV.owns(v.id), avail = WOV.canUnlock(v), sel = WOV.profile.sel[v.kind] === v.id;
  const resNow = !owned && !v.prem && WOV.researchable(v) && !WOV.researched(v), isTarget = resNow && WOV.researchTarget(v.kind) === v;
  const cls = "tcard " + (owned ? "owned" : avail ? "avail" : resNow ? "research" : "locked") + (sel ? " sel" : "");
  let state, extra = "";
  if (owned) state = sel ? "В АНГАРІ ✓" : "ОТРИМАНО";
  else if (v.prem) state = ICONS.crystal + fmt(v.prem);
  else if (avail) state = ICONS.coin + fmt(WOV.priceOf(v));
  else if (resNow) { const k = WOV.rpOf(v) / WOV.rpNeed(v); state = "Дослідж. " + Math.floor(k * 100) + "%"; extra = '<div class="rbar"><i style="width:' + Math.round(k * 100) + '%"></i></div>'; }
  else state = ICONS.lock + fmt(WOV.priceOf(v));
  const c = el("button", cls, natBadge(v) + (isTarget ? '<span class="target">🎯</span>' : "") + "<canvas></canvas><b>" + v.name + "</b><small>" + roleOf(v) + '</small><div class="state">' + state + "</div>" + extra);
  c.onclick = () => vehicleSheet(v);
  setTimeout(() => WOV.preview(c.querySelector("canvas"), v, { fill: 0.92, angle: -0.6, tAngle: -0.3 }), 0);
  return c;
}

// ---------- modal ----------
function openSheet(html, onOpen) {
  $("#sheet").innerHTML = html; $("#modal").classList.remove("hidden");
  if (tg && tg.BackButton) tg.BackButton.show();
  onOpen && onOpen($("#sheet"));
}
function closeSheet() { $("#modal").classList.add("hidden"); if (tg && tg.BackButton && !WOV.Battle.active()) tg.BackButton.hide(); }
$("#modal").addEventListener("click", e => { if (e.target.id === "modal" && !$("#modal").dataset.lock) closeSheet(); });
WOV.closeSheet = closeSheet;

function vehicleSheet(v) {
  const owned = WOV.owns(v.id), avail = WOV.canUnlock(v), p = WOV.profile;
  let action;
  if (owned) action = '<button class="btn-main" id="vsSel">' + (p.sel[v.kind] === v.id ? "Вже в ангарі" : "Обрати в ангар") + "</button>";
  else if (v.prem) action = '<button class="btn-main" id="vsBuy">Купити за ' + fmt(v.prem) + " кристалів</button>";
  else if (avail) action = '<button class="btn-main" id="vsBuy">Купити за ' + fmt(WOV.priceOf(v)) + " монет</button>";
  else if (WOV.researchable(v)) {
    const isT = WOV.researchTarget(v.kind) === v, k = WOV.rpOf(v) / WOV.rpNeed(v);
    action = '<div class="res-box" style="width:100%">Дослідження: <b>' + fmt(WOV.rpOf(v)) + " / " + fmt(WOV.rpNeed(v)) + '</b> досвіду<div class="rprog"><i style="width:' + Math.round(k * 100) + '%"></i></div>Після дослідження техніку можна купити за ' + fmt(WOV.priceOf(v)) + " монет.</div>" +
      (isT ? '<button class="btn-sec" disabled style="width:100%">🎯 Уже досліджується</button>' : '<button class="btn-main" id="vsRes">Досліджувати цю машину</button>');
  }
  else action = '<button class="btn-sec" disabled style="width:100%">Спершу отримай техніку рангу ' + WOV.ROMAN[v.tier - 1] + "</button>";
  openSheet('<h2><span class="tier' + (v.prem ? " prem" : "") + '">' + WOV.ROMAN[v.tier] + "</span> " + v.name + '</h2><div class="sub">' + natBadge(v) + " " + v.nation + " · " + roleOf(v) + "</div>" +
    '<canvas class="big"></canvas><div class="stats">' + statsOf(v) + '</div><div class="actions">' + action + "</div>", s => {
    WOV.preview(s.querySelector("canvas.big"), v, { fill: 0.75, angle: -0.5, tAngle: -0.15, camo: owned ? WOV.camoOf(v) : null });
    const sel = s.querySelector("#vsSel"); if (sel) sel.onclick = () => { p.sel[v.kind] = v.id; p.cls = v.kind; WOV.save(); closeSheet(); setTab("hangar"); toast(v.name + " в ангарі"); };
    const buy = s.querySelector("#vsBuy"); if (buy) buy.onclick = () => buyVehicle(v);
    const res = s.querySelector("#vsRes"); if (res) res.onclick = () => { p.resTarget[v.kind] = v.id; WOV.save(); WOV.haptic("success"); closeSheet(); toast("Досвід тепер іде на " + v.name); if (tab === "tree") renderTree(); };
  });
}
function buyVehicle(v) {
  const cur = v.prem ? "crystals" : "coins", price = v.prem || WOV.priceOf(v);
  if (!WOV.spend(cur, price)) { WOV.haptic("error"); toast(cur === "coins" ? "Не вистачає монет. Заробляй у боях!" : "Не вистачає кристалів. Відкривай бокси!"); return; }
  const p = WOV.profile; p.owned.push(v.id); p.sel[v.kind] = v.id; p.cls = v.kind; WOV.save();
  WOV.haptic("success"); if (A) A.sfx("coin"); closeSheet(); toast("Нова техніка: " + v.name + "!");
  if (tab === "tree") renderTree(); else if (tab === "shop") renderShop();
}

// ---------- shop ----------
function boxArt(b) { return '<div class="boxart" style="--c:' + b.color + ";--r:" + b.rim + '"><div class="body"></div><div class="lid"></div><div class="band"></div><div class="lock"></div></div>'; }
let shopTab = "boxes";
const SHOP_TABS = [["stars", "⭐ Зірки"], ["boxes", "Бокси"], ["ammo", "Снаряди"], ["vehicles", "Техніка"], ["camo", "Камуфляж"], ["other", "Інше"]];
const shellIco = (a, txt) => '<div class="shell-ico" style="--c:' + a.col + '">' + (txt || a.short) + "</div>";
const STOCK_ICO = { apcr: { col: "#9fd8ff", short: "ПК" }, inc: { col: "#ff7a3a", short: "ЗАП" }, heavy: { col: "#c9a8ff", short: "НВ" }, repair: { col: "#7fbf6b", short: "РЕМ" }, strike: { col: "#ff5a32", short: "АРТ" } };
function noMoney(cur) { WOV.haptic("error"); toast(cur === "coins" ? "Не вистачає монет" : "Не вистачає кристалів"); }
const todayKey = () => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
// one discounted item per day (same for the whole day), chosen from things the player does not own yet
function dailyDeal() {
  const p = WOV.profile, pool = [];
  for (const v of WOV.VEHICLES) if (v.prem && !WOV.owns(v.id)) pool.push({ type: "vehicle", v, full: v.prem });
  for (const c of WOV.CAMOS) if (c.price > 0 && !p.camos.includes(c.id)) pool.push({ type: "camo", c, full: c.price });
  if (!pool.length) return null;
  let h = 0; for (const ch of todayKey()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const d = pool[h % pool.length]; d.price = Math.round(d.full * 0.7); return d;
}
function renderShopTop() {
  const p = WOV.profile, top = $("#shopTop"); top.innerHTML = "";
  const G = WOV.DAILY_GIFT, wait = p.giftAt + G.hours * 3600e3 - Date.now(), ready = wait <= 0;
  const gift = el("button", "promo gift" + (ready ? " ready" : ""), "<small>Щоденний подарунок</small><b>" + (ready ? "Забери безкоштовно!" : "Наступний через") + "</b><div class='sub'>" + (ready ? "Монети і шанс на кристали" : Math.floor(Math.ceil(wait / 60e3) / 60) + " год " + (Math.ceil(wait / 60e3) % 60) + " хв") + "</div>" + (ready ? '<span class="price" style="color:var(--good)">Забрати</span>' : ""));
  gift.onclick = () => {
    if (!ready) { toast("Подарунок ще готується"); return; }
    const r = (a, b) => Math.floor(a + Math.random() * (b - a + 1)), co = Math.round(r(G.coins[0], G.coins[1]) / 10) * 10;
    let msg = "+" + fmt(co) + " монет"; p.coins += co;
    if (Math.random() < G.crystalsChance) { const cr = r(G.crystals[0], G.crystals[1]); p.crystals += cr; msg += " і +" + cr + " кристалів"; }
    p.giftAt = Date.now(); WOV.save(); WOV.emit("wallet"); WOV.haptic("success"); if (A) A.sfx("reward"); toast("Подарунок: " + msg); renderShop();
  };
  top.appendChild(gift);
  const d = dailyDeal();
  if (d) {
    const name = d.type === "vehicle" ? d.v.name : "Камуфляж «" + d.c.name + "»";
    const deal = el("button", "promo deal", '<span class="tag">−30%</span><small>Пропозиція дня</small>' + (d.type === "vehicle" ? "<canvas></canvas>" : '<div class="swatch" style="height:30px"></div>') + "<b>" + name + '</b><span class="price"><s>' + d.full + "</s>" + ICONS.crystal + fmt(d.price) + "</span>");
    if (d.type === "vehicle") WOV.preview(deal.querySelector("canvas"), d.v, { fill: 0.9, angle: -0.4, tAngle: -0.1 });
    else deal.querySelector(".swatch").style.background = swatchBg(d.c);
    deal.onclick = () => {
      if (!WOV.spend("crystals", d.price)) return noMoney("crystals");
      if (d.type === "vehicle") { p.owned.push(d.v.id); toast(d.v.name + " у твоєму ангарі!"); }
      else { p.camos.push(d.c.id); toast("Камуфляж «" + d.c.name + "» твій"); }
      WOV.save(); WOV.haptic("success"); if (A) A.sfx("coin"); renderShop();
    };
    top.appendChild(deal);
  }
}
function renderShop() {
  const p = WOV.profile;
  renderShopTop();
  const tabs = $("#shopTabs"); tabs.innerHTML = "";
  for (const [id, label] of SHOP_TABS) { const b = el("button", id === shopTab ? "active" : "", label); b.onclick = () => { shopTab = id; renderShop(); WOV.haptic("select"); }; tabs.appendChild(b); }
  const body = $("#shopBody"); body.innerHTML = "";
  if (shopTab === "stars") {
    const st = el("div", "stars"); body.appendChild(st);
    for (const pk of WOV.STAR_PACKS) {
      const c = el("button", "shopitem star" + (pk.best ? " best" : ""), (pk.best ? '<span class="tag">Вигідно</span>' : "") + '<div class="star-ico">' + (pk.coins && !pk.crystals ? ICONS.coin : ICONS.crystal).replace("<svg", '<svg width="38" height="38"') + "</div><b>" + pk.title + "</b>" + (pk.crystals && pk.coins ? "<small>" + fmt(pk.crystals) + " кристалів + " + fmt(pk.coins) + " монет</small>" : "") + '<span class="price">⭐ ' + pk.stars + "</span>");
      c.onclick = () => {
        if (!WOV.Net || !WOV.Net.enabled() || !WOV.Net.inTelegram()) { toast("Купівля за зірки працює в Telegram"); return; }
        c.disabled = true; WOV.haptic("medium");
        WOV.Net.buy(pk.id, r => {
          c.disabled = false;
          if (r.msg) { WOV.haptic("success"); if (A) A.sfx("reward"); toast("Дякуємо! " + r.msg, 3500); renderShop(); }
          else if (r.status === "paid") toast("Оплату прийнято, нарахуємо за хвилину", 3500);
          else if (r.error) toast(r.error === "notg" ? "Купівля за зірки працює в Telegram" : "Не вдалося створити рахунок, спробуй пізніше");
        });
      };
      st.appendChild(c);
    }
    body.appendChild(el("p", "note", "Оплата зірками Telegram прямо в грі. Кристали й монети нараховуються одразу після оплати."));
  } else if (shopTab === "boxes") {
    const bx = el("div", "boxes"); body.appendChild(bx);
    for (const b of WOV.BOXES) {
      const c = el("button", "box", boxArt(b) + "<b>" + b.name + "</b><small>" + b.desc + "</small>" + priceHtml("coins", b.price));
      c.style.setProperty("--glow", b.color);
      c.onclick = () => buyBox(b); bx.appendChild(c);
    }
    body.appendChild(el("p", "note", "Монети заробляються в боях: за знищену техніку, шкоду і перемогу. Кристали випадають з боксів."));
  } else if (shopTab === "ammo") {
    body.appendChild(el("p", "note", "Звичайні снаряди безлімітні. Спецснаряди витрачаються в бою, перемикай їх кнопками біля «ВОГОНЬ» (на ПК клавіші 1, 2, 3). Ремкомплект (зелений хрестик або R) раз за бій лагодить модулі, гасить пожежу і додає 20% міцності. Артудар (приціл або F) раз за бій накриває найближчого ворога залпом."));
    for (const k of Object.keys(WOV.STOCK)) {
      const st = WOV.STOCK[k], ico = STOCK_ICO[k], ammo = st.kind ? WOV.AMMO[st.kind].find(a => a.stock === k) : null;
      const card = el("div", "stock", shellIco(ico) + "<div><b>" + st.name + "</b>" + (st.kind ? ' <small style="color:var(--muted)">· ' + WOV.KIND_NAME[st.kind].toLowerCase() + "</small>" : "") +
        '<div class="have">У запасі: ' + fmt(p.ammo[k] || 0) + "</div><p>" + (ammo ? ammo.desc : st.desc || "Раз за бій лагодить модулі, гасить пожежу і повертає 20% міцності.") + '</p></div><div class="packs"></div>');
      st.packs.forEach(pk => {
        const b = el("button", "", "<span>×" + fmt(pk.n) + "</span>" + priceHtml("coins", pk.coins));
        b.onclick = () => { if (!WOV.spend("coins", pk.coins)) return noMoney("coins"); p.ammo[k] = (p.ammo[k] || 0) + pk.n; WOV.save(); WOV.haptic("success"); if (A) A.sfx("coin"); toast("+" + fmt(pk.n) + " · " + st.name); renderShop(); };
        card.querySelector(".packs").appendChild(b);
      });
      body.appendChild(card);
    }
  } else if (shopTab === "vehicles") {
    const pl = el("div", "prem"); body.appendChild(pl);
    for (const v of WOV.VEHICLES.filter(v => v.prem)) {
      const owned = WOV.owns(v.id);
      const c = el("button", "shopitem" + (owned ? " owned" : ""), "<canvas></canvas><b>" + v.name + " · " + WOV.ROMAN[v.tier] + "</b>" + (owned ? '<span class="price">Отримано ✓</span>' : priceHtml("crystals", v.prem)));
      c.onclick = () => vehicleSheet(v); pl.appendChild(c);
      WOV.preview(c.querySelector("canvas"), v, { fill: 0.9, angle: -0.5, tAngle: -0.2 });
    }
    const go = el("button", "btn-sec", "Звичайна техніка в дереві досліджень →"); go.style.cssText = "width:100%;margin-top:12px"; go.onclick = () => setTab("tree"); body.appendChild(go);
  } else if (shopTab === "camo") {
    const cs = el("div", "camo-shop"); body.appendChild(cs);
    for (const cm of WOV.CAMOS.filter(c => c.price > 0)) {
      const owned = p.camos.includes(cm.id);
      const c = el("button", "shopitem" + (owned ? " owned" : ""), '<div class="swatch"></div><b>' + cm.name + "</b>" + (owned ? '<span class="price">✓</span>' : priceHtml("crystals", cm.price)));
      c.style.padding = "6px"; c.querySelector(".swatch").style.background = swatchBg(cm);
      c.onclick = () => {
        if (owned) { toast("Обери камуфляж в ангарі"); return; }
        if (!WOV.spend("crystals", cm.price)) return noMoney("crystals");
        p.camos.push(cm.id); p.camoSel[WOV.currentVehicle().id] = cm.id; WOV.save(); WOV.haptic("success"); toast("Камуфляж «" + cm.name + "» наведено на " + WOV.currentVehicle().name); renderShop();
      };
      cs.appendChild(c);
    }
    body.appendChild(el("p", "note", "Куплений камуфляж можна наводити на будь-яку свою техніку в ангарі."));
  } else {
    const misc = el("div", "misc"); body.appendChild(misc);
    for (const bo of WOV.BOOSTS) {
      const b = el("button", "shopitem", '<div style="height:46px;display:grid;place-items:center">' + ICONS.boost.replace("<svg", '<svg width="40" height="40"') + "</div><b>×2 монет на " + bo.battles + " боїв</b>" + priceHtml("crystals", bo.price));
      b.onclick = () => { if (!WOV.spend("crystals", bo.price)) return noMoney("crystals"); p.boost += bo.battles; WOV.save(); WOV.haptic("success"); toast("Бустер: ×2 монет ще на " + p.boost + " боїв"); renderShop(); };
      misc.appendChild(b);
    }
    for (const ex of WOV.EXCHANGES) {
      const b = el("button", "shopitem", '<div style="height:46px;display:flex;align-items:center;justify-content:center;gap:6px">' + ICONS.crystal.replace("<svg", '<svg width="30" height="30"') + "<b style='margin:0'>→</b>" + ICONS.coin.replace("<svg", '<svg width="30" height="30"') + "</div><b>" + ex.crystals + " → " + fmt(ex.coins) + " монет</b>" + priceHtml("crystals", ex.crystals));
      b.onclick = () => { if (!WOV.spend("crystals", ex.crystals)) return noMoney("crystals"); WOV.give("coins", ex.coins); WOV.haptic("success"); if (A) A.sfx("coin"); toast("+" + fmt(ex.coins) + " монет"); };
      misc.appendChild(b);
    }
    if (p.boost > 0) body.appendChild(el("p", "note", "Активний бустер: ×2 монет ще на " + p.boost + " боїв."));
  }
}

function buyBox(b) {
  if (WOV.profile.coins < b.price) { WOV.haptic("error"); toast("Не вистачає монет: потрібно " + fmt(b.price)); return; }
  WOV.spend("coins", b.price);
  $("#modal").dataset.lock = "1";
  openSheet('<div class="opening" style="--glow:' + b.color + '"><h2>' + b.name + ' бокс</h2><div class="sub">Відкриваємо…</div><div id="openBox" class="shake">' + boxArt(b) + '</div><div class="rewards" id="rewards"></div><div class="actions hidden" id="openActions"><button class="btn-sec" id="obClose">Готово</button><button class="btn-main" id="obAgain">Ще один · ' + fmt(b.price) + "</button></div></div>");
  WOV.haptic("medium");
  const rewards = WOV.openBox(b);
  if (A) A.sfx("box");
  setTimeout(() => WOV.haptic("heavy"), 450);
  setTimeout(() => {
    const ob = $("#openBox"); if (!ob) return;
    ob.outerHTML = '<div class="burst"></div>';
    $(".opening .sub").textContent = "Твоя здобич";
    if (A) A.sfx("reward");
    WOV.haptic("success");
    const box = $("#rewards");
    rewards.forEach((r, i) => {
      let ico, val, label, epic = false;
      if (r.type === "crystals") { ico = ICONS.crystal; val = "+" + fmt(r.amount); label = r.note || "кристалів"; }
      else if (r.type === "coins") { ico = ICONS.coin; val = "+" + fmt(r.amount); label = "монет"; }
      else if (r.type === "camo") { ico = ICONS.camo; val = r.label; label = "камуфляж"; epic = true; }
      else if (r.type === "boost") { ico = ICONS.boost; val = "×2"; label = "монет на " + r.amount + " бої"; epic = true; }
      else if (r.type === "ammo") { ico = shellIco(STOCK_ICO[r.id]); val = "+" + fmt(r.amount); label = r.label.toLowerCase(); }
      else { ico = ICONS.vehicle; val = r.label; label = "преміум-техніка!"; epic = true; }
      const e = el("div", "reward" + (epic ? " epic" : ""), ico + "<b>" + val + "</b><small>" + label + "</small>");
      e.style.animationDelay = (i * 0.18) + "s"; box.appendChild(e);
    });
    $("#openActions").classList.remove("hidden");
    $("#obClose").onclick = () => { delete $("#modal").dataset.lock; closeSheet(); renderShop(); };
    $("#obAgain").onclick = () => { delete $("#modal").dataset.lock; buyBox(b); };
  }, 950);
}

// ---------- friends ----------
let lbBy = "xp";
function leaderSheet() {
  const tabs = [["xp", "Звання"], ["wins", "Перемоги"], ["kills", "Знищення"]];
  openSheet('<h2>Таблиця лідерів</h2><div class="sub">Найкращі командири War of Victor</div><div class="chips" id="lbTabs"></div><div class="lb" id="lbList"><div class="empty">Завантаження…</div></div><div class="actions"><button class="btn-sec" id="lbClose">Закрити</button></div>', sh => {
    sh.querySelector("#lbClose").onclick = closeSheet;
    const load = () => {
      const t = sh.querySelector("#lbTabs"); t.innerHTML = "";
      for (const [id, label] of tabs) { const b = el("button", id === lbBy ? "active" : "", label); b.onclick = () => { lbBy = id; load(); WOV.haptic("select"); }; t.appendChild(b); }
      const list = sh.querySelector("#lbList");
      if (!WOV.Net || !WOV.Net.enabled() || !WOV.Net.inTelegram()) { list.innerHTML = '<div class="empty">Таблиця лідерів працює, коли гра відкрита в Telegram.</div>'; return; }
      list.innerHTML = '<div class="empty">Завантаження…</div>';
      WOV.Net.top(lbBy).then(r => {
        if (r.by !== lbBy) return;
        list.innerHTML = "";
        const val = x => lbBy === "xp" ? WOV.rank(x.value).r.name : fmt(x.value);
        r.list.forEach(x => {
          const row = el("div", "lbrow" + (x.me ? " me" : "") + (x.place <= 3 ? " top" + x.place : ""), '<span class="pl">' + x.place + '</span><b></b><span class="v">' + (lbBy === "xp" ? WOV.rankIcon(WOV.rank(x.value).r, 18) + " " : "") + val(x) + "</span>");
          row.querySelector("b").textContent = x.name; list.appendChild(row);
        });
        if (!r.list.length) list.appendChild(el("div", "empty", "Поки порожньо. Зіграй бій і стань першим!"));
        if (!r.list.some(x => x.me)) list.appendChild(el("div", "lbrow me", '<span class="pl">' + r.me.place + "</span><b>Ти</b><span class=\"v\">" + val(r.me) + "</span>"));
      }).catch(() => { list.innerHTML = '<div class="empty">Сервер не відповідає. Спробуй пізніше.</div>'; });
    };
    load();
  });
}
function renderFriends() {
  const p = WOV.profile;
  const lb = $("#lbBtn"); if (lb) lb.onclick = leaderSheet;
  $("#myCode").textContent = p.code; $("#refBonusTxt").textContent = fmt(WOV.REF_BONUS); $("#friendBonusTxt").textContent = fmt(WOV.FRIEND_BONUS);
  const list = $("#friendsList"); list.innerHTML = "";
  $("#friendCount").textContent = p.friends.length ? "· " + p.friends.length : "";
  if (!p.friends.length) list.appendChild(el("div", "empty", "Поки що порожньо. Запроси друзів або додай їх за кодом."));
  for (const f of p.friends) {
    const row = el("div", "friend", '<div class="avatar">' + (f.name[0] || "?").toUpperCase() + "</div><div><b></b><small>код " + f.code + (f.viaInvite ? " · запросив тебе" : "") + '</small></div><button aria-label="Видалити">✕</button>');
    row.querySelector("b").textContent = f.name;
    row.querySelector("button").onclick = () => { p.friends = p.friends.filter(x => x !== f); WOV.save(); renderFriends(); };
    list.appendChild(row);
  }
  const s = p.stats, wr = s.battles ? Math.round(s.wins / s.battles * 100) : 0;
  $("#myStats").innerHTML = "<div><b>" + s.battles + "</b><small>боїв</small></div><div><b>" + wr + "%</b><small>перемог</small></div><div><b>" + s.kills + "</b><small>знищено</small></div><div><b style='font-size:13px'>" + WOV.rank().r.name + "</b><small>звання</small></div>";
}
$("#copyCode").onclick = () => { const l = WOV.inviteLink(); copy(l || WOV.profile.code, l ? "Посилання-запрошення скопійовано" : "Код скопійовано"); };
$("#inviteBtn").onclick = () => {
  const link = WOV.inviteLink(), text = "Го в War of Victor! Танки, літаки й кораблі в одному бою. Мій код: " + WOV.profile.code;
  if (!link) { copy(text, "Код скопійовано: надішли його другу"); return; }
  const share = "https://t.me/share/url?url=" + encodeURIComponent(link) + "&text=" + encodeURIComponent(text);
  if (tg && tg.openTelegramLink) { try { tg.openTelegramLink(share); return; } catch (e) {} }
  copy(link + "\n" + text, "Запрошення скопійовано: надішли його другу");
};
$("#addFriend").onclick = () => {
  const p = WOV.profile, code = $("#friendCode").value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const name = $("#friendName").value.trim() || "Друг " + code.slice(-4);
  if (code.length < 4) { toast("Введи код друга (його видно в розділі «Друзі»)"); return; }
  if (code === p.code) { toast("Це твій власний код 🙂"); return; }
  if (p.friends.some(f => f.code === code)) { toast("Цей друг уже в списку"); return; }
  p.friends.push({ code, name, since: Date.now() });
  let msg = name + " тепер у друзях";
  if (p.friendRewards < WOV.MAX_FRIEND_REWARDS) { p.friendRewards++; p.coins += WOV.FRIEND_BONUS; msg += " · +" + fmt(WOV.FRIEND_BONUS) + " монет"; WOV.emit("wallet"); }
  WOV.save(); WOV.haptic("success"); toast(msg);
  $("#friendCode").value = ""; $("#friendName").value = ""; renderFriends();
};
function copy(text, msg) {
  const done = () => toast(msg);
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  else fallbackCopy(text, done);
}
function fallbackCopy(text, done) { const t = el("textarea"); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch (e) {} t.remove(); done(); }


// ---------- modifications and crew (hangar buttons) ----------
function modsSheet() {
  const v = WOV.currentVehicle(), p = WOV.profile, nb = p.vbattles[v.id] || 0;
  const rows = WOV.VMODS.map(m => {
    const has = WOV.hasVmod(v, m.id), open = nb >= m.battles, cost = WOV.vmodCost(m, v);
    return '<div class="mrow' + (has ? " done" : "") + '"><div><b>' + m.names[v.kind] + "</b><small>" + m.desc + (has ? "" : open ? "" : " · відкриється після " + m.battles + " боїв на цій машині (зараз " + nb + ")") + "</small></div>" +
      (has ? '<span class="ok">✓ Встановлено</span>' : '<button class="btn-sec" data-mod="' + m.id + '"' + (open ? "" : " disabled") + ">" + ICONS.coin.replace("<svg", '<svg width="14" height="14"') + " " + fmt(cost) + "</button>") + "</div>";
  }).join("");
  openSheet('<h2 style="margin:0 0 4px">Модифікації · ' + v.name + '</h2><div class="sub">Модифікації відкриваються боями на цій машині й купуються за монети. Діють тільки на неї.</div><div style="margin-top:12px">' + rows + "</div>", sh => {
    sh.querySelectorAll("[data-mod]").forEach(b => b.onclick = () => {
      const m = WOV.VMODS.find(x => x.id === b.dataset.mod), cost = WOV.vmodCost(m, v);
      if (!WOV.spend("coins", cost)) return noMoney("coins");
      (p.vmods[v.id] = p.vmods[v.id] || {})[m.id] = true; WOV.save(); WOV.haptic("success"); if (A) A.sfx("coin"); toast(m.names[v.kind] + " встановлено"); modsSheet(); renderHangarStats();
    });
  });
}
function crewSheet() {
  const v = WOV.currentVehicle(), p = WOV.profile, k = v.kind;
  const rows = WOV.CREW.map(c => {
    const lvl = WOV.crewLvl(k, c.id), max = lvl >= WOV.CREW_MAX, cost = WOV.crewCost(lvl);
    let pips = ""; for (let i = 0; i < WOV.CREW_MAX; i++) pips += "<i" + (i < lvl ? ' class="on"' : "") + "></i>";
    return '<div class="mrow"><div><b>' + c.name + " · " + lvl + "/" + WOV.CREW_MAX + "</b><small>" + c.desc + '</small><div class="pips">' + pips + "</div></div>" +
      (max ? '<span class="ok">Макс.</span>' : '<button class="btn-sec" data-crew="' + c.id + '">' + ICONS.coin.replace("<svg", '<svg width="14" height="14"') + " " + fmt(cost) + "</button>") + "</div>";
  }).join("");
  openSheet('<h2 style="margin:0 0 4px">Екіпаж · ' + WOV.KIND_NAME[k] + '</h2><div class="sub">Навички екіпажу діють на всю техніку цього класу.</div><div style="margin-top:12px">' + rows + "</div>", sh => {
    sh.querySelectorAll("[data-crew]").forEach(b => b.onclick = () => {
      const id = b.dataset.crew, lvl = WOV.crewLvl(k, id), cost = WOV.crewCost(lvl);
      if (!WOV.spend("coins", cost)) return noMoney("coins");
      p.crew[k][id] = lvl + 1; WOV.save(); WOV.haptic("success"); if (A) A.sfx("coin"); crewSheet(); renderHangarStats();
    });
  });
}
function renderHangarStats() { const v = WOV.currentVehicle(); $("#hStats").innerHTML = statsOf(WOV.battleStats(v), v); }
$("#hMods").onclick = modsSheet;
$("#hCrew").onclick = crewSheet;

// ---------- tasks and battle pass ----------
const passIcon = r => r.type === "coins" ? "🪙" : r.type === "crystals" ? "💎" : r.type === "box" ? "📦" : r.type === "camo" ? "🎨" : r.type === "vehicle" ? "⭐" : "💥";
const passText = r => r.type === "coins" || r.type === "crystals" ? fmt(r.amount) : r.type === "box" ? (WOV.BOXES.find(b => b.id === r.id) || {}).name : r.type === "camo" ? "камуфляж" : r.type === "vehicle" ? WOV.byId[r.id].name : "×" + r.amount;
function updateTaskDot() {
  const p = WOV.profile, ready = WOV.dailyTasks().some(t => !t.claimed && t.got >= t.n) || !WOV.loginState().claimed, lvl = WOV.passLevel();
  let pass = false; for (let i = 1; i <= lvl; i++) if (!p.pass.claimed.includes(i)) { pass = true; break; }
  $("#tasksDot").classList.toggle("hidden", !(ready || pass));
}
function loginRewardText(r) { return r.coins ? fmt(r.coins) + " 🪙" : r.crystals ? r.crystals + " 💎" + (r.box ? " + бокс" : "") : "×" + r.n + " " + (r.stock === "strike" ? "💥" : "🔧"); }
function renderLogin(box) {
  box = box || $("#loginCal");
  const st = WOV.loginState(); box.innerHTML = "";
  const grid = el("div", "cal");
  WOV.LOGIN_REWARDS.forEach((r, i) => {
    const d = i + 1, cls = d < st.day || (d === st.day && st.claimed) ? " got" : d === st.day ? " now" : "";
    grid.appendChild(el("div", "cday" + cls, "<small>День " + d + "</small><b>" + loginRewardText(r) + "</b>"));
  });
  box.appendChild(grid);
  const btn = el("button", st.claimed ? "btn-sec" : "btn-main", st.claimed ? "Нагороду отримано, приходь завтра" : "Забрати нагороду дня " + st.day);
  btn.disabled = st.claimed; btn.style.cssText = "width:100%;margin-top:10px";
  btn.onclick = () => { const t = WOV.claimLogin(); if (t) { WOV.haptic("success"); if (A) A.sfx("reward"); toast("День " + st.day + ": " + t, 3000); if (box.id === "loginSheet") closeSheet(); else renderTasks(); updateTaskDot(); } };
  box.appendChild(btn);
}
function renderMedals() {
  const p = WOV.profile, box = $("#medalHall"); box.innerHTML = "";
  for (const m of WOV.MEDALS) {
    const n = p.medals[m.id] || 0;
    const c = el("div", "hall" + (n ? "" : " none"), "<span>" + m.ico + "</span><b>" + m.name + "</b><small>" + m.desc + "</small>" + (n ? '<i>×' + n + "</i>" : ""));
    box.appendChild(c);
  }
  const owned = WOV.VEHICLES.filter(v => p.mastery[v.id]);
  $("#masteryList").innerHTML = owned.length ? owned.map(v => { const q = WOV.masteryOf(v.id); return '<span class="mchip"><span class="mastery" style="--c:' + q.col + '">' + q.short + "</span>" + v.name + "</span>"; }).join("") : '<div class="empty">Майстерність дається за сильний бій на конкретній машині: III, II, I ступінь і Майстер.</div>';
}
function renderTasks() {
  renderLogin(); renderMedals();
  const p = WOV.profile, list = WOV.dailyTasks(), left = WOV.taskTimeLeft();
  $("#taskTimer").textContent = "· нові через " + Math.floor(left / 3600e3) + " год " + Math.floor((left % 3600e3) / 60e3) + " хв";
  const dl = $("#dailyList"); dl.innerHTML = "";
  list.forEach((t, i) => {
    const done = t.got >= t.n, c = el("div", "task" + (t.claimed ? " claimed" : done ? " done" : ""), "<div><b>" + t.text + "</b><br><small>" + fmt(t.got) + " / " + fmt(t.n) + " · нагорода " + fmt(t.reward) + " монет і 150 очок пропуску</small></div>" +
      (t.claimed ? '<span class="ok" style="color:var(--good);font-weight:800">✓</span>' : done ? '<button class="btn-main" style="width:auto;padding:8px 14px">Забрати</button>' : "<span></span>") + '<div class="rprog"><i style="width:' + Math.round(Math.min(1, t.got / t.n) * 100) + '%"></i></div>');
    const b = c.querySelector("button"); if (b) b.onclick = () => { if (WOV.claimTask(i)) { WOV.haptic("success"); if (A) A.sfx("reward"); toast("+" + fmt(t.reward) + " монет"); renderTasks(); updateTaskDot(); } };
    dl.appendChild(c);
  });
  const S = WOV.SEASON, lvl = WOV.passLevel(), xpIn = p.pass.xp - lvl * S.perLevel, days = Math.max(0, Math.ceil((S.ends - Date.now()) / 864e5));
  $("#passHead").innerHTML = "<b>" + S.name + "</b><small>Рівень " + lvl + " з " + S.levels + " · до кінця сезону " + days + " дн. Очки пропуску дають бої і щоденні завдання.</small>" +
    (lvl < S.levels ? '<div class="rprog"><i style="width:' + Math.round(xpIn / S.perLevel * 100) + '%"></i></div><small>' + xpIn + " / " + S.perLevel + " до рівня " + (lvl + 1) + "</small>" : "");
  const pl = $("#passList"); pl.innerHTML = "";
  for (let i = 1; i <= S.levels; i++) {
    const r = WOV.passReward(i), reach = i <= lvl, claimed = p.pass.claimed.includes(i);
    const c = el("button", "plvl" + (claimed ? " claimed" : reach ? " reach" : "") + (i % 10 === 0 ? " big" : ""), '<span class="n">' + i + '</span><span class="r">' + passIcon(r) + "</span><span>" + (claimed ? "✓" : passText(r)) + "</span>");
    c.onclick = () => {
      if (claimed) return;
      if (!reach) { toast("Відкриється на рівні " + i + " пропуску"); return; }
      const text = WOV.claimPass(i); if (text) { WOV.haptic("success"); if (A) A.sfx("reward"); toast(text, 2600); renderTasks(); updateTaskDot(); }
    };
    pl.appendChild(c);
  }
}

// ---------- battle flow ----------
function launch(match) {
  closeSheet(); delete $("#modal").dataset.lock;
  cancelAnimationFrame(hangarRaf);
  $("#app").classList.add("in-battle");
  if (tg && tg.BackButton) tg.BackButton.show();
  WOV.Battle.start(mode, showResult, match || null);
}
let mmCancel = null;
function startBattle() {
  WOV.haptic("heavy");
  if (mode !== "quick" || !WOV.Net || !WOV.Net.enabled()) return launch();
  // quick battle: look for real players first, fill the rest with bots
  const v = WOV.currentVehicle(), camo = WOV.camoOf(v);
  $("#modal").dataset.lock = "1";
  openSheet('<h2>Пошук гравців</h2><div class="sub">Швидкий бій 4 на 4: живі гравці твого рангу, решта місць боти</div>' +
    '<div class="mm"><div class="radar"><i></i></div><div><b id="mmCount">Підключення…</b><small id="mmLeft"></small></div></div>' +
    '<div class="actions"><button class="btn-sec" id="mmCancel">Скасувати</button><button class="btn-main" id="mmBots">Грати з ботами</button></div>', sh => {
    sh.querySelector("#mmCancel").onclick = () => { if (mmCancel) mmCancel(); mmCancel = null; delete $("#modal").dataset.lock; closeSheet(); };
    sh.querySelector("#mmBots").onclick = () => { if (mmCancel) mmCancel(); mmCancel = null; launch(); };
  });
  mmCancel = WOV.Net.findMatch({ id: WOV.Net.myId, name: WOV.profile.name, vid: v.id, kind: v.kind, tier: v.tier, camo: camo ? camo.id : "" }, {
    status(n, left) { const c = $("#mmCount"), l = $("#mmLeft"); if (!c) return; c.textContent = n <= 1 ? "Шукаємо суперників…" : "У черзі: " + n + " гравц" + (n < 5 ? "і" : "ів"); l.textContent = left > 0 ? "Старт через " + left + " с" : "Збираємо бій…"; },
    match(m) { mmCancel = null; WOV.haptic("success"); launch(m); },
    timeout() { mmCancel = null; if (!$("#modal").classList.contains("hidden") && $("#mmCount")) { toast("Живих гравців зараз немає, бій з ботами"); launch(); } },
  });
}
function askLeave() {
  const go = () => WOV.Battle.leave();
  if (tg && tg.showConfirm && tg.isVersionAtLeast && tg.isVersionAtLeast("6.2")) tg.showConfirm("Вийти з бою? Бій зарахується за поточним станом.", ok => { if (ok) go(); });
  else go();
}
$("#exitBattle").onclick = askLeave;
function showResult(s) {
  $("#app").classList.remove("in-battle");
  if (WOV.Net) WOV.Net.reportBattle(s);
  setTab("hangar");
  const rows = s.board.map(u => '<tr class="' + (u.me ? "me " : "") + (u.dead ? "dead" : "") + '"><td class="t' + u.team + '">' + (u.human && !u.me ? "◆ " : "") + escapeHtml(u.name) + '</td><td style="color:var(--muted)">' + u.v + "</td><td>" + u.kills + "</td><td>" + u.dmg + "</td></tr>").join("");
  openSheet('<div class="result-head ' + s.result + '">' + (s.result === "win" ? "ПЕРЕМОГА" : "ПОРАЗКА") + '</div><div class="sub" style="text-align:center">' + s.mode + (s.survived ? " · вцілів" : " · знищено") + "</div>" +
    '<div class="earn"><div><b id="earnCoins">0</b><small>монет' + (s.boosted ? " ×2" : "") + "</small></div><div><b>" + s.kills + "</b><small>знищено</small></div><div><b>" + s.dmg + "</b><small>шкоди</small></div><div><b>+" + s.xp + "</b><small>досвіду</small></div></div>" +
    progressHtml(s) +
    (s.rankUp ? '<div class="rank-up"><span class="avatar' + (s.rankUp.ins === "gen" ? " gen" : "") + '">' + WOV.rankIcon(s.rankUp, 30) + "</span><div><small>Нове звання!</small><b>" + s.rankUp.name + "</b><small>+" + fmt(s.rankUp.reward.coins) + " монет" + (s.rankUp.reward.crystals ? " і +" + s.rankUp.reward.crystals + " кристалів" : "") + "</small></div></div>" : "") +
    '<table class="board"><tr style="color:var(--muted)"><td>Гравець</td><td>Техніка</td><td>✕</td><td>Шкода</td></tr>' + rows + "</table>" +
    '<div class="actions"><button class="btn-sec" id="resClose">В ангар</button><button class="btn-main" id="resAgain">Ще бій</button></div>', sh => {
    const e = sh.querySelector("#earnCoins"), t0 = performance.now();
    const tick = now => { const k = Math.min(1, (now - t0) / 900); e.textContent = "+" + fmt(s.coins * k); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    sh.querySelector("#resClose").onclick = closeSheet;
    sh.querySelector("#resAgain").onclick = () => { closeSheet(); startBattle(); };
  });
}
function progressHtml(s) {
  const g = s.progress || {}, out = [];
  if (s.repair) out.push("🔧 Ремонт техніки: <b>−" + fmt(s.repair) + "</b> монет (уже враховано)");
  if (g.rp) { const t = WOV.researchTarget(WOV.byId[s.vehicleId].kind); out.push("🔬 Досвід на дослідження: <b>+" + fmt(g.rp) + "</b>" + (t ? " · " + t.name + " " + Math.floor(WOV.rpOf(t) / WOV.rpNeed(t) * 100) + "%" : "")); }
  for (const v of g.researched || []) out.push("✅ Досліджено: <b>" + v.name + "</b>, можна купити в дереві техніки");
  for (const t of g.finished || []) out.push("📋 Завдання виконано, забери нагороду у вкладці «Завдання»");
  if (g.passUp) out.push("🎖 Бойовий пропуск: рівень <b>" + g.passUp + "</b>");
  if (s.caps) out.push("🚩 Захоплено точок: <b>" + s.caps + "</b>");
  if (g.mastery) out.push("🎖 <span>Майстерність " + WOV.byId[s.vehicleId].name + ": <b>" + g.mastery.level.name + "</b>" + (g.mastery.fresh ? ", новий рівень! +" + g.mastery.level.crystals + " кристалів" : "") + "</span>");
  let medals = "";
  if (g.medals && g.medals.length) medals = '<div class="medals-row">' + g.medals.map(m => '<div class="medal"><span>' + m.ico + "</span><b>" + m.name + "</b><small>+" + fmt(m.coins) + "</small></div>").join("") + "</div>";
  return medals + out.map(x => '<div class="res-line">' + x + "</div>").join("");
}
const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

if (tg && tg.BackButton) tg.BackButton.onClick(() => {
  if (WOV.Battle.active()) askLeave();
  else if (!$("#modal").classList.contains("hidden") && !$("#modal").dataset.lock) closeSheet();
  else if (tab !== "hangar") setTab("hangar");
});

// ---------- sound ----------
const A = WOV.Audio;
function renderSound() {
  const p = WOV.profile;
  $("#sndBtn").classList.toggle("off", !p.sound); $("#musBtn").classList.toggle("off", !p.music); $("#battleSnd").classList.toggle("off", !p.sound && !p.music);
  if (A) { A.setSound(p.sound); A.setMusic(p.music); }
}
$("#sndBtn").onclick = e => { e.stopPropagation(); WOV.profile.sound = !WOV.profile.sound; WOV.save(); renderSound(); toast(WOV.profile.sound ? "Звуки увімкнено" : "Звуки вимкнено", 1200); };
$("#musBtn").onclick = e => { e.stopPropagation(); WOV.profile.music = !WOV.profile.music; WOV.save(); renderSound(); toast(WOV.profile.music ? "Музику увімкнено" : "Музику вимкнено", 1200); };
$("#battleSnd").onclick = () => { const p = WOV.profile, on = !(p.sound || p.music); p.sound = p.music = on; WOV.save(); renderSound(); };
// soft click on every menu button
document.addEventListener("click", e => { if (A && e.target.closest("#app button, #modal button") && !e.target.closest("#toBattle")) A.sfx("click", { vol: 0.6 }); }, true);

// ---------- boot ----------
if (tg) { try { tg.ready(); tg.expand(); tg.disableVerticalSwipes && tg.disableVerticalSwipes(); tg.setHeaderColor("#121615"); tg.setBackgroundColor("#121615"); } catch (e) {} }
WOV.load(() => {
  renderWallet(); renderSound();
  treeCls = WOV.profile.cls;
  setTab("hangar");
  setTimeout(() => $("#splash").classList.add("gone"), 350);
  if (WOV.pendingToast) setTimeout(() => toast(WOV.pendingToast, 3500), 600);
  // purchases paid while the game was closed
  if (WOV.Net) WOV.Net.hello().then(msg => { if (msg) toast("Покупка зарахована: " + msg, 4000); });
  if (!WOV.loginState().claimed) setTimeout(() => {
    const st = WOV.loginState(); if (st.claimed || WOV.Battle.active()) return;
    openSheet('<h2>Щоденний вхід</h2><div class="sub">Заходь щодня: що довша серія, то краща нагорода. Пропустиш день, і серія почнеться знову.</div><div id="loginSheet"></div>', sh => renderLogin(sh.querySelector("#loginSheet")));
  }, 1200);
});
})();
