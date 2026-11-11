// War of Victor: online layer on Supabase (game API, matchmaking, battle sync over Realtime)
// Without SUPABASE_URL in WOV.CONFIG everything here quietly stays offline.
(function () {
"use strict";
const WOV = window.WOV, C = WOV.CONFIG, tg = WOV.tg;
const enabled = () => !!(C.SUPABASE_URL && C.SUPABASE_KEY);
const LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js";

// a stable id for this player: Telegram id inside Telegram, a random one in a plain browser
const tgId = (() => { try { return tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? String(tg.initDataUnsafe.user.id) : null; } catch (e) { return null; } })();
const myId = tgId ? "t" + tgId : "g" + Math.random().toString(36).slice(2, 10);

let sb = null, loading = null;
function client() {
  if (sb) return Promise.resolve(sb);
  if (!enabled()) return Promise.reject(new Error("offline"));
  if (!loading) loading = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = LIB; s.async = true;
    s.onload = () => { try { sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 20 } } }); res(sb); } catch (e) { loading = null; rej(e); } };
    s.onerror = () => { loading = null; rej(new Error("load")); };
    document.head.appendChild(s);
  });
  return loading;
}

// ---------- game API (edge function "api"), only inside Telegram ----------
async function api(action, extra) {
  if (!enabled() || !tg || !tg.initData) throw new Error("offline");
  const r = await fetch(C.SUPABASE_URL + "/functions/v1/api", {
    method: "POST", headers: { "content-type": "application/json", apikey: C.SUPABASE_KEY },
    body: JSON.stringify(Object.assign({ action, initData: tg.initData, name: WOV.profile.name }, extra || {})),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || "http " + r.status);
  return j;
}
// paid purchases that reached the server: add them to the profile
function applyClaim(c) {
  if (!c || (!c.crystals && !c.coins)) return null;
  const p = WOV.profile; p.crystals += c.crystals || 0; p.coins += c.coins || 0; WOV.save(); WOV.emit("wallet");
  const parts = []; if (c.crystals) parts.push("+" + c.crystals + " кристалів"); if (c.coins) parts.push("+" + c.coins + " монет");
  return parts.join(" і ");
}
const hello = () => api("hello").then(j => applyClaim(j.claim)).catch(() => null);
const claim = () => api("claim").then(j => applyClaim(j.claim)).catch(() => null);
const reportBattle = s => api("battle", { kills: s.kills, dmg: s.dmg, xp: s.xp, win: s.result === "win" }).catch(() => null);
const top = by => api("top", { by });
// Telegram Stars: get an invoice link from the server and open Telegram's payment sheet
function buy(product, done) {
  if (!tg || !tg.openInvoice || !tg.initData) return done({ error: "notg" });
  api("invoice", { product }).then(j => {
    tg.openInvoice(j.link, status => {
      if (status !== "paid") return done({ status });
      // the webhook may arrive a moment after the sheet closes
      let tries = 0;
      const poll = () => claim().then(msg => { if (msg) done({ status, msg }); else if (++tries < 6) setTimeout(poll, 1500); else done({ status, msg: null }); });
      setTimeout(poll, 800);
    });
  }).catch(e => done({ error: e.message }));
}

// ---------- matchmaking: everyone waiting sits in one presence channel ----------
const WAIT = 9000, MAXP = 8;
function findMatch(me, h) {
  let ch = null, done = false, timer = null;
  const t0 = Date.now();
  const finish = fn => { if (done) return; done = true; clearInterval(timer); if (ch) { ch.untrack().catch(() => {}); sb.removeChannel(ch); } fn(); };
  const waiting = () => {
    const st = ch.presenceState(), out = [];
    for (const k in st) { const m = st[k][0]; if (m && !m.busy) out.push(m); }
    return out.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
  };
  const tick = () => {
    if (done) return;
    const list = waiting(), left = Math.max(0, Math.ceil((t0 + WAIT - Date.now()) / 1000));
    h.status(list.length, left);
    const fair = list.filter(m => Math.abs(m.tier - list[0].tier) <= 1);
    if (list[0] && list[0].id === me.id) {
      // I waited longest: I build the match (and later host the bots)
      if (fair.length >= MAXP || (Date.now() - t0 > WAIT && fair.length >= 2)) {
        const players = fair.slice(0, MAXP).map(m => ({ id: m.id, name: m.name, vid: m.vid, camo: m.camo }));
        const match = { mid: me.id + "-" + Date.now().toString(36), host: me.id, seed: Math.floor(Math.random() * 1e9), players };
        ch.send({ type: "broadcast", event: "match", payload: match });
        finish(() => h.match(match));
      } else if (Date.now() - t0 > WAIT) finish(() => h.timeout());
    } else if (Date.now() - t0 > WAIT + 5000) finish(() => h.timeout());
  };
  client().then(c => {
    if (done) return;
    ch = c.channel("wov-mm-v1", { config: { presence: { key: me.id }, broadcast: { self: false } } });
    ch.on("presence", { event: "sync" }, tick);
    ch.on("broadcast", { event: "match" }, ({ payload }) => { if (payload.players.some(p => p.id === me.id)) finish(() => h.match(payload)); });
    ch.subscribe(st => {
      if (st === "SUBSCRIBED") ch.track(Object.assign({ t: t0, busy: false }, me));
      else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") finish(() => h.timeout());
    });
    timer = setInterval(tick, 500);
  }).catch(() => finish(() => h.timeout()));
  return () => finish(() => {});
}

// ---------- battle channel: state of owned units 5 times a second, events batched with it ----------
function joinMatch(mid, h) {
  let ch = null, out = [], ready = false, closed = false, getState = null;
  const present = new Set();
  client().then(c => {
    if (closed) return;
    ch = c.channel("wov-m-" + mid, { config: { presence: { key: myId }, broadcast: { self: false } } });
    ch.on("broadcast", { event: "p" }, ({ payload }) => h.packet(payload));
    ch.on("presence", { event: "sync" }, () => { present.clear(); for (const k in ch.presenceState()) present.add(k); h.presence(present); });
    ch.subscribe(st => { if (st === "SUBSCRIBED") { ready = true; ch.track({ id: myId }); } });
  });
  const flush = setInterval(() => {
    if (!ready || closed) return;
    const s = getState ? getState() : [];
    if (!s.length && !out.length) return;
    ch.send({ type: "broadcast", event: "p", payload: { f: myId, s, e: out } }); out = [];
  }, 200);
  return {
    present,
    event(e) { out.push(e); if (out.length > 60) out.splice(0, out.length - 60); },
    state(fn) { getState = fn; },
    flushNow() { if (ready && out.length) { ch.send({ type: "broadcast", event: "p", payload: { f: myId, s: [], e: out } }); out = []; } },
    close() { if (closed) return; closed = true; clearInterval(flush); if (ch) { const c = ch; setTimeout(() => { c.untrack().catch(() => {}); sb.removeChannel(c); }, 400); } },
  };
}

WOV.Net = { enabled, myId, inTelegram: () => !!(tg && tg.initData), hello, claim, reportBattle, top, buy, findMatch, joinMatch };
})();
