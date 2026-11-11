// Shared helpers: Telegram Mini App signature check, Bot API calls, products
const enc = new TextEncoder();

async function hmac(key: Uint8Array, data: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}
const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, "0")).join("");

export const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "";

export async function sha256hex(s: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))));
}

export type TgUser = { id: number; first_name?: string; last_name?: string; username?: string };

// Checks Telegram WebApp initData (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
export async function verifyInitData(initData: string, maxAgeSec = 7 * 24 * 3600): Promise<TgUser | null> {
  if (!initData || !BOT_TOKEN) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const check = [...params.entries()].map(([k, v]) => k + "=" + v).sort().join("\n");
  const secret = await hmac(enc.encode("WebAppData"), BOT_TOKEN);
  const calc = hex(await hmac(secret, check));
  if (calc !== hash) return null;
  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;
  try { const u = JSON.parse(params.get("user") || "null"); return u && u.id ? u : null; } catch { return null; }
}

export async function bot(method: string, body: unknown) {
  const r = await fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/" + method, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  return await r.json();
}

// Products sold for Telegram Stars. The game shows the same list (js/data.js STAR_PACKS).
export const PRODUCTS: Record<string, { stars: number; crystals: number; coins: number; title: string }> = {
  cr15:  { stars: 15,  crystals: 100,  coins: 0,     title: "100 кристалів" },
  cr50:  { stars: 50,  crystals: 380,  coins: 0,     title: "380 кристалів" },
  cr100: { stars: 100, crystals: 850,  coins: 0,     title: "850 кристалів" },
  cr250: { stars: 250, crystals: 2300, coins: 0,     title: "2300 кристалів" },
  co20:  { stars: 20,  crystals: 0,    coins: 25000, title: "25 000 монет" },
  pack75:{ stars: 75,  crystals: 400,  coins: 40000, title: "Набір командира" },
};

export const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "content-type": "application/json" } });
