// War of Victor game API: leaderboards, battle results, Stars invoices and claiming paid purchases.
// Every call carries Telegram initData, which is checked against the bot token.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyInitData, bot, PRODUCTS, cors, json } from "../_shared/tg.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BOARDS = ["xp", "wins", "kills"] as const;
const clampInt = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
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
    case "hello":
      return json({ ok: true, claim: await claim(user.id) });

    case "battle": {
      // per-battle deltas with sane limits; at most one result every 20 s
      const last = me.last_battle ? new Date(me.last_battle).getTime() : 0;
      if (Date.now() - last < 20_000) return json({ ok: false, error: "too fast" });
      const d = { kills: clampInt(body.kills, 12), dmg: clampInt(body.dmg, 8000), xp: clampInt(body.xp, 4000), win: body.win ? 1 : 0 };
      await db.from("players").update({
        xp: Number(me.xp) + d.xp, battles: me.battles + 1, wins: me.wins + d.win, kills: me.kills + d.kills, dmg: Number(me.dmg) + d.dmg,
        last_battle: new Date().toISOString(), updated_at: new Date().toISOString(),
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
