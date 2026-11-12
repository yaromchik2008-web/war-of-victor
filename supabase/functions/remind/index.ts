// Bot reminders: called twice a day by GitHub Actions (.github/workflows/remind.yml).
// Writes to players who allowed it (/start in the bot or "allow messages" in the game), at most once per 6 hours,
// and skips anyone who already played in the last 3 hours.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { bot, sha256hex, BOT_TOKEN } from "../_shared/tg.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const GAME_URL = Deno.env.get("GAME_URL") ?? "";
const H = 3600_000;

const MORNING = [
  "🎁 Щоденна нагорода вже чекає! Заходь і забирай, поки серія входів не згоріла.",
  "☀️ Новий день, нові завдання. Виконай щоденні і забери монети.",
  "🎯 Сьогоднішні завдання оновились. Три бої, і нагорода твоя.",
  "📅 Не перервай серію входів: сьому добу чекає великий приз.",
];
const EVENING = [
  "⚔️ Вечірній бій чекає. Твоя техніка застоялась в ангарі!",
  "🛡 Команда шукає бійця. Один бій до сну?",
  "🔥 Сезонна смуга сама себе не прокачає. Заходь на пару боїв.",
  "🚀 Досліди наступну машину: тобі бракує лише кількох боїв.",
];

Deno.serve(async req => {
  const want = await sha256hex("wov-remind:" + BOT_TOKEN);
  if (!BOT_TOKEN || req.headers.get("x-remind-key") !== want) return new Response("forbidden", { status: 403 });
  const slot = new URL(req.url).searchParams.get("slot") === "evening" ? EVENING : MORNING;
  const now = Date.now();
  const { data } = await db.from("players").select("tg_id, name, last_seen, last_ping, pings").eq("notify", true)
    .or('last_ping.is.null,last_ping.lt."' + new Date(now - 6 * H).toISOString() + '"').limit(1000);
  let sent = 0, off = 0, skipped = 0;
  for (const p of data || []) {
    if (p.last_seen && now - new Date(p.last_seen).getTime() < 3 * H) { skipped++; continue; }
    const text = slot[(p.pings + Math.floor(now / 86400_000)) % slot.length];
    const kb = GAME_URL ? { reply_markup: { inline_keyboard: [[{ text: "⚔️ ГРАТИ", web_app: { url: GAME_URL } }]] } } : {};
    const r = await bot("sendMessage", { chat_id: p.tg_id, text, ...kb });
    if (r.ok) { sent++; await db.from("players").update({ last_ping: new Date().toISOString(), pings: (p.pings || 0) + 1 }).eq("tg_id", p.tg_id); }
    else if (r.error_code === 403 || r.error_code === 400) { off++; await db.from("players").update({ notify: false }).eq("tg_id", p.tg_id); }
    else if (r.error_code === 429) { await new Promise(res => setTimeout(res, ((r.parameters && r.parameters.retry_after) || 2) * 1000)); }
    await new Promise(res => setTimeout(res, 50)); // stay well under Telegram's 30 messages a second
  }
  return new Response(JSON.stringify({ sent, off, skipped }), { headers: { "content-type": "application/json" } });
});
