// War of Victor game API: leaderboards, battle results, Stars invoices and claiming paid purchases.
// Every call carries Telegram initData, which is checked against the bot token.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyInitData, bot, PRODUCTS, cors, json } from "../_shared/tg.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BOARDS = ["xp", "wins", "kills"] as const;
const clampInt = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
// a player's friend code is "T" + Telegram id in base 36 (see js/profile.js)
const idFromCode = (c: unknown) => { const m = /^T([0-9A-Z]{1,14})$/.exec(String(c || "").toUpperCase()); const n = m ? parseInt(m[1], 36) : 0; return Number.isSafeInteger(n) && n > 0 ? n : 0; };
const GAME_URL = Deno.env.get("GAME_URL") ?? "";
function cleanMedals(m: unknown) {
  const out: Record<string, number> = {};
  if (m && typeof m === "object") for (const [k, v] of Object.entries(m as Record<string, unknown>).slice(0, 40)) if (/^[a-z]{2,12}$/.test(k)) out[k] = clampInt(v, 1_000_000);
  return out;
}
const cleanName = (s: unknown) => String(s || "Командир").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 24) || "Командир";

async function ensurePlayer(id: number, name: string) {
  const { data } = await db.from("players").select("*").eq("tg_id", id).maybeSingle();
  if (data) {
    if (data.name !== name) await db.from("players").update({ name, updated_at: new Date().toISOString() }).eq("tg_id", id);
    return { ...data, name };
  }
  const row = { tg_id: id, name };
  await db.from("players").upsert(row);
  return { ...row, xp: 0, battles: 0, wins: 0, kills: 0, dmg: 0, last_battle: null };
}

async function claim(id: number) {
  const { data } = await db.from("purchases").update({ claimed: true, claimed_at: new Date().toISOString() })
    .eq("tg_id", id).eq("claimed", false).select("charge_id, product, crystals, coins");
  const list = data || [];
  return { crystals: list.reduce((s, r) => s + r.crystals, 0), coins: list.reduce((s, r) => s + r.coins, 0), items: list.map(r => r.product) };
}

async function top(by: string, me: { [k: string]: unknown }) {
  const col = (BOARDS as readonly string[]).includes(by) ? by : "xp";
  const { data } = await db.from("players").select("tg_id, name, xp, wins, kills, battles").order(col, { ascending: false }).limit(50);
  const myVal = Number(me[col] || 0);
  const { count } = await db.from("players").select("tg_id", { count: "exact", head: true }).gt(col, myVal);
  return {
    by: col,
    list: (data || []).map((r, i) => ({ place: i + 1, name: r.name, value: r[col], xp: r.xp, battles: r.battles, me: r.tg_id === me.tg_id })),
    me: { place: (count || 0) + 1, value: myVal },
  };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const user = await verifyInitData(String(body.initData || ""));
  if (!user) return json({ error: "auth" }, 401);
  const name = cleanName(body.name || user.first_name || user.username);
  const me = await ensurePlayer(user.id, name);

  switch (body.action) {
    case "hello": {
      await db.from("players").update({ last_seen: new Date().toISOString() }).eq("tg_id", user.id);
      // every vehicle ever bought for Stars, so it comes back even after the game data was cleared
      const { data: bought } = await db.from("purchases").select("product").eq("tg_id", user.id).like("product", "v\\_%");
      return json({ ok: true, claim: await claim(user.id), vehicles: [...new Set((bought || []).map(r => r.product))] });
    }
    case "notify":
      // the player allowed the bot to write (Telegram's requestWriteAccess) or switched reminders in settings
      await db.from("players").update({ notify: !!body.on }).eq("tg_id", user.id);
      return json({ ok: true });

    case "friend": {
      // public card of a friend: name, rank experience, battle stats, medals, best vehicle
      const fid = idFromCode(body.code);
      if (!fid) return json({ ok: true, found: false });
      const { data: f } = await db.from("players").select("name, xp, battles, wins, kills, dmg, medals, best, last_seen").eq("tg_id", fid).maybeSingle();
      if (!f) return json({ ok: true, found: false });
      const online = !!f.last_seen && Date.now() - new Date(f.last_seen).getTime() < 10 * 60_000;
      return json({ ok: true, found: true, name: f.name, xp: f.xp, battles: f.battles, wins: f.wins, kills: f.kills, dmg: f.dmg, medals: f.medals || {}, best: f.best, online });
    }
    case "challenge": {
      // the bot sends the friend a message with a button that opens the game straight into the duel room
      const fid = idFromCode(body.code), room = String(body.room || "");
      if (!fid || fid === user.id || !/^[0-9A-Z]{2,16}-[0-9A-Z]{2,16}$/.test(room)) return json({ error: "bad" }, 400);
      const last = me.last_challenge ? new Date(me.last_challenge).getTime() : 0;
      if (Date.now() - last < 30_000) return json({ ok: false, error: "wait" });
      await db.from("players").update({ last_challenge: new Date().toISOString() }).eq("tg_id", user.id);
      const kb = GAME_URL ? { reply_markup: { inline_keyboard: [[{ text: "⚔️ ПРИЙНЯТИ ВИКЛИК", web_app: { url: GAME_URL + "?duel=" + room } }]] } } : {};
      const r = await bot("sendMessage", { chat_id: fid, text: "⚔️ " + name + " викликає тебе на бій у War of Victor! Тисни кнопку протягом півтори хвилини.", ...kb });
      return json({ ok: !!r.ok, error: r.ok ? undefined : "unreachable" });
    }
    case "battle": {
      // per-battle deltas with sane limits; at most one result every 20 s
      const last = me.last_battle ? new Date(me.last_battle).getTime() : 0;
      if (Date.now() - last < 20_000) return json({ ok: false, error: "too fast" });
      const d = { kills: clampInt(body.kills, 12), dmg: clampInt(body.dmg, 8000), xp: clampInt(body.xp, 4000), win: body.win ? 1 : 0 };
      await db.from("players").update({
        xp: Number(me.xp) + d.xp, battles: me.battles + 1, wins: me.wins + d.win, kills: me.kills + d.kills, dmg: Number(me.dmg) + d.dmg,
        last_battle: new Date().toISOString(), updated_at: new Date().toISOString(), last_seen: new Date().toISOString(),
        ...(body.medals ? { medals: cleanMedals(body.medals) } : {}),
        ...(typeof body.best === "string" && /^[a-z0-9_]{1,16}$/.test(body.best) ? { best: body.best } : {}),
      }).eq("tg_id", user.id);
      return json({ ok: true });
    }

    case "top":
      return json(await top(String(body.by || "xp"), me));

    case "invoice": {
      const p = PRODUCTS[String(body.product)];
      if (!p) return json({ error: "product" }, 400);
      const r = await bot("createInvoiceLink", {
        title: p.title, description: "War of Victor: " + p.title + ". Нараховується одразу після оплати.",
        payload: JSON.stringify({ u: user.id, p: String(body.product) }),
        provider_token: "", currency: "XTR", prices: [{ label: p.title, amount: p.stars }],
      });
      if (!r.ok) return json({ error: "telegram", detail: r.description }, 502);
      return json({ ok: true, link: r.result });
    }

    case "claim":
      return json({ ok: true, claim: await claim(user.id) });
  }
  return json({ error: "action" }, 400);
});
