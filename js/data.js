// War of Victor: static game data (vehicles, tech tree, shop, boxes, camouflage)
(function () {
"use strict";
const WOV = (window.WOV = window.WOV || {});

// Put your bot username and Mini App short name here after creating them in @BotFather.
// They are used to build invite links: https://t.me/<BOT_USERNAME>/<APP_NAME>?startapp=ref_<code>
WOV.CONFIG = { BOT_USERNAME: "", APP_NAME: "play" };

WOV.ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII"];
WOV.KIND_NAME = { tank: "Танки", plane: "Літаки", ship: "Кораблі" };
WOV.KIND_ONE = { tank: "Танк", plane: "Літак", ship: "Корабель" };
WOV.PRICE = [0, 1500, 5000, 12000, 25000, 45000, 75000, 120000];

const V = [];
// ---------- tanks ----------
// role: light | medium | heavy | mbt. look: hull length/width, turret shape, barrel, etc.
function tank(id, name, tier, role, nation, look, prem) {
  const k = { light: { sp: 1.3, hp: 0.8, ar: 1.15, rl: 0.85, dm: 0.85 }, medium: { sp: 1, hp: 1, ar: 1, rl: 1, dm: 1 },
              heavy: { sp: 0.72, hp: 1.3, ar: 0.75, rl: 1.25, dm: 1.2 }, mbt: { sp: 1.05, hp: 1.1, ar: 0.85, rl: 0.95, dm: 1.05 } }[role];
  V.push({ id, name, tier, kind: "tank", role, nation, prem: prem || 0,
    r: 14 + tier * 0.9 + (role === "heavy" ? 2 : role === "light" ? -1 : 0),
    hp: Math.round((90 + tier * 38) * k.hp), speed: Math.round((100 + tier * 6) * k.sp), turn: 2.5 * (role === "heavy" ? 0.8 : 1), tturn: 2.6 + tier * 0.15,
    reload: +(1.7 * k.rl - tier * 0.04).toFixed(2), dmg: Math.round((24 + tier * 10) * k.dm), shell: 520 + tier * 28, range: 1.35 + tier * 0.03,
    armor: [Math.max(0.25, (0.75 - tier * 0.05) * k.ar), 1.0, 1.45], aa: { range: 300, reload: 0.3, dmg: 1.8 + tier * 0.35 },
    look: Object.assign({ L: 1.25, Wd: 0.95, turret: "round", tR: 0.58, tPos: 0, bL: 1.3, bW: 4, brake: false, skirts: false, color: "#7d8a5a" }, look) });
}
tank("t26", "Т-26", 1, "light", "СРСР", { L: 1.15, Wd: 0.85, turret: "round", tR: 0.5, bL: 1.0, bW: 3, color: "#6f7d4f" });
tank("bt7", "БТ-7", 1, "light", "СРСР", { L: 1.3, Wd: 0.8, turret: "box", tR: 0.5, bL: 1.05, bW: 3, color: "#7b8653" });
tank("t34", "Т-34", 2, "medium", "СРСР", { L: 1.25, Wd: 0.98, turret: "wedge", tR: 0.58, tPos: 0.15, bL: 1.3, bW: 4, color: "#5f6f43" });
tank("sherman", "M4 Sherman", 2, "medium", "США", { L: 1.2, Wd: 0.95, turret: "round", tR: 0.6, bL: 1.2, bW: 4, color: "#6c6a45" });
tank("kv1", "КВ-1", 3, "heavy", "СРСР", { L: 1.3, Wd: 1.05, turret: "box", tR: 0.66, bL: 1.25, bW: 5, color: "#566440" });
tank("panther", "Panther", 3, "medium", "Німеччина", { L: 1.4, Wd: 0.98, turret: "wedge", tR: 0.56, tPos: -0.05, bL: 1.7, bW: 4, brake: true, skirts: true, color: "#a0905a" });
tank("tiger", "Tiger I", 4, "heavy", "Німеччина", { L: 1.3, Wd: 1.08, turret: "box", tR: 0.68, bL: 1.6, bW: 5, brake: true, color: "#8f8456" });
tank("is2", "ІС-2", 4, "heavy", "СРСР", { L: 1.35, Wd: 1.02, turret: "round", tR: 0.64, tPos: 0.05, bL: 1.7, bW: 5, brake: true, color: "#56653f" });
tank("t54", "Т-54", 5, "medium", "СРСР", { L: 1.3, Wd: 1.0, turret: "dome", tR: 0.62, tPos: 0.12, bL: 1.6, bW: 4.5, color: "#5d6b45" });
tank("centurion", "Centurion", 5, "medium", "Британія", { L: 1.4, Wd: 1.0, turret: "wedge", tR: 0.62, bL: 1.75, bW: 4.5, skirts: true, color: "#6a7350" });
tank("leo1", "Leopard 1", 6, "mbt", "ФРН", { L: 1.4, Wd: 0.98, turret: "wedge", tR: 0.6, bL: 1.85, bW: 4.5, skirts: true, color: "#4f5a3c" });
tank("t72", "Т-72", 6, "mbt", "СРСР", { L: 1.3, Wd: 1.0, turret: "dome", tR: 0.6, tPos: 0.08, bL: 1.85, bW: 5, skirts: true, color: "#5a6640" });
tank("abrams", "M1 Abrams", 7, "mbt", "США", { L: 1.45, Wd: 1.05, turret: "modern", tR: 0.7, tPos: -0.05, bL: 1.8, bW: 5, skirts: true, color: "#9c9068" });
tank("leo2", "Leopard 2A6", 7, "mbt", "ФРН", { L: 1.45, Wd: 1.02, turret: "modern", tR: 0.68, tPos: -0.02, bL: 2.0, bW: 5, skirts: true, color: "#56603f" });
tank("tiger2", "Tiger II", 5, "heavy", "Німеччина", { L: 1.45, Wd: 1.1, turret: "wedge", tR: 0.7, tPos: -0.05, bL: 1.95, bW: 5.5, brake: true, color: "#8a7d55" }, 450);

// ---------- planes ----------
function plane(id, name, tier, role, nation, look, prem) {
  const jet = look.wing === "swept" || look.wing === "delta" || look.engines === "jet";
  const k = { fighter: { sp: 1, hp: 1, dm: 1, tn: 1 }, attacker: { sp: 0.85, hp: 1.6, dm: 1.35, tn: 0.8 }, heavy: { sp: 1.05, hp: 1.3, dm: 1.2, tn: 0.85 } }[role];
  V.push({ id, name, tier, kind: "plane", role, nation, prem: prem || 0, r: 13 + tier * 0.6,
    hp: Math.round((65 + tier * 16) * k.hp), speed: Math.round((215 + tier * 22 + (jet ? 40 : 0)) * k.sp), minSpeed: Math.round((150 + tier * 12) * k.sp),
    turn: +((2.7 - (jet ? 0.35 : 0) + tier * 0.03) * k.tn).toFixed(2), reload: 0.09, dmg: +((3.6 + tier * 1.1) * k.dm).toFixed(1),
    shell: 900 + tier * 40, range: 0.55, armor: [1, 1, 1],
    look: Object.assign({ wing: "straight", span: 1.25, engines: 1, len: 1, tail: "single", color: "#8fa0a8" }, look) });
}
plane("i16", "І-16", 1, "fighter", "СРСР", { wing: "straight", span: 1.1, len: 0.85, color: "#7f8d5a" });
plane("bf109", "Bf 109 E", 1, "fighter", "Німеччина", { wing: "straight", span: 1.15, len: 1.0, color: "#8a9296" });
plane("spitfire", "Spitfire Mk V", 2, "fighter", "Британія", { wing: "elliptic", span: 1.3, len: 1.0, color: "#6f7a55" });
plane("yak3", "Як-3", 2, "fighter", "СРСР", { wing: "straight", span: 1.15, len: 1.0, color: "#8c979c" });
plane("p51", "P-51D Mustang", 3, "fighter", "США", { wing: "straight", span: 1.3, len: 1.05, color: "#b4b8b8" });
plane("il2", "Іл-2", 3, "attacker", "СРСР", { wing: "straight", span: 1.45, len: 1.1, color: "#5f6b45" });
plane("fw190", "Fw 190 A", 4, "fighter", "Німеччина", { wing: "straight", span: 1.2, len: 1.0, color: "#7b8488" });
plane("me262", "Me 262", 4, "heavy", "Німеччина", { wing: "swept", span: 1.35, engines: 2, len: 1.15, color: "#848c7a" });
plane("mig15", "МіГ-15", 5, "fighter", "СРСР", { wing: "swept", span: 1.15, engines: "jet", len: 1.1, tail: "t", color: "#a9adb0" });
plane("f86", "F-86 Sabre", 5, "fighter", "США", { wing: "swept", span: 1.2, engines: "jet", len: 1.15, color: "#c2c4c4" });
plane("mig21", "МіГ-21", 6, "fighter", "СРСР", { wing: "delta", span: 0.95, engines: "jet", len: 1.35, color: "#9aa2a6" });
plane("f4", "F-4 Phantom II", 6, "heavy", "США", { wing: "swept", span: 1.1, engines: "jet", len: 1.35, color: "#7d8578" });
plane("su27", "Су-27", 7, "fighter", "СРСР", { wing: "delta", span: 1.2, engines: "jet", len: 1.45, tail: "twin", color: "#8fa2b4" });
plane("f16", "F-16", 7, "fighter", "США", { wing: "delta", span: 1.05, engines: "jet", len: 1.35, color: "#8f969c" });
plane("p47", "P-47 Thunderbolt", 4, "attacker", "США", { wing: "elliptic", span: 1.4, len: 1.1, color: "#9a9f8a" }, 380);

// ---------- ships ----------
function ship(id, name, tier, role, nation, look, prem) {
  const k = { boat: { sp: 1.6, hp: 0.55, tn: 1.8, rl: 0.6, dm: 0.55, rg: 0.8 }, destroyer: { sp: 1.2, hp: 0.85, tn: 1.2, rl: 0.8, dm: 0.8, rg: 0.95 },
              cruiser: { sp: 1, hp: 1, tn: 1, rl: 1, dm: 1, rg: 1 }, battleship: { sp: 0.75, hp: 1.5, tn: 0.7, rl: 1.4, dm: 1.5, rg: 1.15 } }[role];
  V.push({ id, name, tier, kind: "ship", role, nation, prem: prem || 0, r: role === "boat" ? 15 : 20 + tier * 1.4 + (role === "battleship" ? 4 : 0),
    hp: Math.round((160 + tier * 70) * k.hp), speed: Math.round((70 + tier * 2) * k.sp), turn: +(0.95 * k.tn).toFixed(2), tturn: 1.7,
    reload: +(2.2 * k.rl).toFixed(2), dmg: Math.round((34 + tier * 12) * k.dm), shell: 600 + tier * 15, range: +(1.7 * k.rg + tier * 0.04).toFixed(2),
    armor: [0.6, 1.0, 1.2], aa: { range: 380 + tier * 15, reload: role === "boat" ? 0.3 : 0.2, dmg: 3 + tier * 0.6 },
    look: Object.assign({ len: 1.6, beam: 0.62, turrets: 1, funnels: 1, bridge: 0.75, color: "#7f8f9a" }, look) });
}
ship("g5", "Катер Г-5", 1, "boat", "СРСР", { len: 1.35, beam: 0.5, turrets: 1, funnels: 0, bridge: 0.45, color: "#7a8a8f" });
ship("pt109", "PT-109", 1, "boat", "США", { len: 1.45, beam: 0.52, turrets: 1, funnels: 0, bridge: 0.5, color: "#6d7d68" });
ship("flower", "Корвет Flower", 2, "destroyer", "Британія", { len: 1.45, beam: 0.6, turrets: 1, funnels: 1, bridge: 0.6, color: "#8f9ca3" });
ship("gnevny", "Есмінець Гнєвний", 2, "destroyer", "СРСР", { len: 1.65, beam: 0.52, turrets: 2, funnels: 2, bridge: 0.55, color: "#7b8a92" });
ship("fletcher", "Есмінець Fletcher", 3, "destroyer", "США", { len: 1.7, beam: 0.52, turrets: 3, funnels: 2, bridge: 0.6, color: "#7d8b95" });
ship("tashkent", "Лідер Ташкент", 3, "destroyer", "СРСР", { len: 1.8, beam: 0.5, turrets: 3, funnels: 3, bridge: 0.55, color: "#8a989f" });
ship("atlanta", "Крейсер Atlanta", 4, "cruiser", "США", { len: 1.75, beam: 0.55, turrets: 4, funnels: 2, bridge: 0.7, color: "#7a8792" });
ship("kirov", "Крейсер Кіров", 4, "cruiser", "СРСР", { len: 1.8, beam: 0.56, turrets: 3, funnels: 2, bridge: 0.7, color: "#86939b" });
ship("hipper", "Крейсер Admiral Hipper", 5, "cruiser", "Німеччина", { len: 1.85, beam: 0.56, turrets: 4, funnels: 1, bridge: 0.8, color: "#8d969a" });
ship("baltimore", "Крейсер Baltimore", 5, "cruiser", "США", { len: 1.85, beam: 0.58, turrets: 3, funnels: 2, bridge: 0.8, color: "#77848d" });
ship("marat", "Лінкор Марат", 6, "battleship", "СРСР", { len: 1.9, beam: 0.58, turrets: 4, funnels: 2, bridge: 0.75, color: "#808c93" });
ship("bismarck", "Лінкор Bismarck", 6, "battleship", "Німеччина", { len: 1.9, beam: 0.62, turrets: 4, funnels: 1, bridge: 0.9, color: "#8b9397" });
ship("yamato", "Лінкор Yamato", 7, "battleship", "Японія", { len: 1.95, beam: 0.66, turrets: 3, funnels: 1, bridge: 1.0, color: "#7d878c" });
ship("iowa", "Лінкор Iowa", 7, "battleship", "США", { len: 2.0, beam: 0.6, turrets: 3, funnels: 2, bridge: 0.9, color: "#76838c" });
ship("grafspee", "Крейсер Admiral Graf Spee", 5, "cruiser", "Німеччина", { len: 1.8, beam: 0.6, turrets: 2, funnels: 1, bridge: 0.95, color: "#959da0" }, 420);

// give same-tier vehicles their own character: small deterministic stat differences per model
for (const v of V) {
  let h = 0; for (const ch of v.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = ((h % 1000) / 500) - 1, b = (((h >> 10) % 1000) / 500) - 1;
  v.speed = Math.round(v.speed * (1 + 0.08 * a)); if (v.minSpeed) v.minSpeed = Math.round(v.minSpeed * (1 + 0.08 * a));
  v.hp = Math.round(v.hp * (1 - 0.07 * a));
  v.dmg = +(v.dmg * (1 + 0.07 * b)).toFixed(1); v.reload = +(v.reload * (1 + 0.05 * b)).toFixed(2);
}
WOV.VEHICLES = V;
WOV.byId = {}; for (const v of V) WOV.byId[v.id] = v;
WOV.STARTERS = ["t26", "i16", "g5"];
WOV.priceOf = v => (v.prem ? 0 : WOV.PRICE[v.tier]);

// ---------- camouflage (bought with crystals, applied to any vehicle) ----------
WOV.CAMOS = [
  { id: "base", name: "Заводський", price: 0, colors: null },
  { id: "forest", name: "Ліс", price: 60, colors: ["#4b5a34", "#2f3a22", "#6b7a45"] },
  { id: "desert", name: "Пустеля", price: 60, colors: ["#b9a06a", "#8f7a4c", "#d2bf8c"] },
  { id: "winter", name: "Зима", price: 90, colors: ["#d8dcd8", "#a9b0ad", "#eef0ec"] },
  { id: "urban", name: "Місто", price: 90, colors: ["#6e7377", "#4a4e52", "#9599a0"] },
  { id: "night", name: "Ніч", price: 140, colors: ["#2c3240", "#1b1f29", "#454d60"] },
  { id: "tiger", name: "Тигр", price: 180, colors: ["#c48a3a", "#2b241a", "#d9a65a"] },
  { id: "gold", name: "Золото", price: 400, colors: ["#d9a441", "#a8761d", "#f3d27a"] },
];

// ---------- boxes (bought with coins, give crystals and more) ----------
WOV.BOXES = [
  { id: "wood", name: "Дерев'яний", price: 800, color: "#9a6b3c", rim: "#6b4523",
    crystals: [3, 12], coins: [150, 900], camo: 0, prem: 0, boost: 0, desc: "3–12 кристалів і трохи монет" },
  { id: "iron", name: "Залізний", price: 2500, color: "#8b9399", rim: "#5d656b",
    crystals: [12, 35], coins: [400, 2200], camo: 0.08, prem: 0, boost: 0.1, desc: "12–35 кристалів, шанс на камуфляж" },
  { id: "gold", name: "Золотий", price: 7000, color: "#d9a441", rim: "#9c701e",
    crystals: [35, 90], coins: [1000, 5000], camo: 0.2, prem: 0.05, boost: 0.2, desc: "35–90 кристалів, шанс на преміум-техніку" },
  { id: "legend", name: "Легендарний", price: 20000, color: "#9b6bd6", rim: "#5f3d92",
    crystals: [110, 260], coins: [3000, 12000], camo: 0.35, prem: 0.18, boost: 0.3, desc: "110–260 кристалів, великий шанс на преміум" },
];
WOV.BOOST = { price: 60, battles: 5 };          // x2 coins for N battles, bought with crystals
WOV.EXCHANGE = { crystals: 10, coins: 1000 };   // 10 crystals -> 1000 coins
WOV.FRIEND_BONUS = 1500; WOV.REF_BONUS = 3000; WOV.MAX_FRIEND_REWARDS = 10;

WOV.MODES = {
  quick: { name: "Швидкий бій", desc: "4 на 4 · 3 хв · мала карта", size: 2800, team: 4, time: 180, winBonus: 500 },
  team: { name: "Командний бій", desc: "7 на 7 · 5 хв · велика карта", size: 4000, team: 7, time: 300, winBonus: 1200 },
};
})();
