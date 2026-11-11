// Telegram bot webhook: Stars payments (pre-checkout + successful_payment), /start, /paysupport.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { bot, sha256hex, BOT_TOKEN, PRODUCTS } from "../_shared/tg.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const GAME_URL = Deno.env.get("GAME_URL") ?? "";

Deno.serve(async req => {
  // Telegram sends the secret we gave to setWebhook; it is derived from the bot token
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!BOT_TOKEN || secret !== (await sha256hex("wov-webhook:" + BOT_TOKEN))) return new Response("forbidden", { status: 403 });
  const u = await req.json().catch(() => ({}));

  if (u.pre_checkout_query) {
    const q = u.pre_checkout_query;
    let ok = false;
    try { const pl = JSON.parse(q.invoice_payload); const p = PRODUCTS[pl.p]; ok = !!p && q.currency === "XTR" && q.total_amount === p.stars && pl.u === q.from.id; } catch { ok = false; }
    await bot("answerPreCheckoutQuery", ok ? { pre_checkout_query_id: q.id, ok: true } : { pre_checkout_query_id: q.id, ok: false, error_message: "Товар недоступний, спробуй ще раз з гри." });
    return new Response("ok");
  }

  const m = u.message;
  if (m && m.successful_payment) {
    const sp = m.successful_payment;
    let pl: { u: number; p: string } | null = null;
    try { pl = JSON.parse(sp.invoice_payload); } catch { pl = null; }
    const p = pl && PRODUCTS[pl.p];
    if (p && pl) {
      await db.from("purchases").upsert({ charge_id: sp.telegram_payment_charge_id, tg_id: m.from.id, product: pl.p, stars: sp.total_amount, crystals: p.crystals, coins: p.coins }, { onConflict: "charge_id", ignoreDuplicates: true });
      await bot("sendMessage", { chat_id: m.chat.id, text: "✅ Оплата пройшла: " + p.title + ". Повернись у гру, усе вже на рахунку." });
    }
    return new Response("ok");
  }

  if (m && typeof m.text === "string") {
    const cmd = m.text.split(/[\s@]/)[0];
    if (cmd === "/start") {
      const kb = GAME_URL ? { reply_markup: { inline_keyboard: [[{ text: "⚔️ ВОЮВАТИ", web_app: { url: GAME_URL } }]] } } : {};
      await bot("sendMessage", { chat_id: m.chat.id, text: "War of Victor: танки, літаки й кораблі в одному бою. Тисни кнопку і вперед!", ...kb });
    } else if (cmd === "/paysupport") {
      await bot("sendMessage", { chat_id: m.chat.id, text: "Питання щодо оплати зірками? Опиши проблему одним повідомленням тут, і ми відповімо." });
    }
  }
  return new Response("ok");
});
