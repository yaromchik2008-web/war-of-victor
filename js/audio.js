// War of Victor: synthesized sound effects and procedural music (WebAudio, no files)
(function () {
"use strict";
const WOV = (window.WOV = window.WOV || {});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

let ac = null, master, sfxBus, musBus, noiseBuf, voices = 0;
const last = {};                       // per-sound throttle
const L = { x: 0, y: 0, w: 800 };      // listener (camera centre)
const set = { sound: true, music: true };
let wantMusic = "menu";

function init() {
  if (ac) { if (ac.state === "suspended") ac.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  ac = new C();
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
  master = ac.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ac.destination);
  sfxBus = ac.createGain(); sfxBus.gain.value = set.sound ? 1 : 0; sfxBus.connect(master);
  musBus = ac.createGain(); musBus.gain.value = set.music ? 0.32 : 0; musBus.connect(master);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  if (ac.state === "suspended") ac.resume();
  music(wantMusic);
}
["pointerdown", "touchend", "keydown"].forEach(ev => window.addEventListener(ev, init, { passive: true }));
document.addEventListener("visibilitychange", () => { if (!ac) return; document.hidden ? ac.suspend() : ac.resume(); });

// ---------- building blocks ----------
function out(vol, pan) {
  const g = ac.createGain(); g.gain.value = vol;
  if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = clamp(pan, -0.8, 0.8); g.connect(p); p.connect(sfxBus); }
  else g.connect(sfxBus);
  return g;
}
function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
function noise(dst, t, dur, type, f, q, peak, a, fEnd) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = rnd(0.9, 1.1);
  const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (fEnd) fl.frequency.exponentialRampToValueAtTime(fEnd, t + dur); fl.Q.value = q || 0.7;
  const g = ac.createGain(); env(g, t, a || 0.003, peak, dur);
  s.connect(fl); fl.connect(g); g.connect(dst); s.start(t, rnd(0, 1)); s.stop(t + dur + 0.05);
  voices++; s.onended = () => voices--;
}
function tone(dst, t, dur, type, f, fEnd, peak, a) {
  a = a || 0.004;
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
  const g = ac.createGain(); env(g, t, a, peak, dur);
  o.connect(g); g.connect(dst); o.start(t); o.stop(t + dur + a + 0.05);
  voices++; o.onended = () => voices--;
}

// ---------- sound effects ----------
const FX = {
  cannon(o, t, k) { // k: 0 small gun .. 1 battleship
    noise(o, t, 0.35 + k * 0.6, "lowpass", 1400 - k * 700, 0.8, 0.9, 0.002, 160);
    tone(o, t, 0.25 + k * 0.4, "sine", 120 - k * 50, 35, 0.9);
    noise(o, t, 0.05, "highpass", 3000, 0.7, 0.35);
  },
  mg(o, t) { noise(o, t, 0.045, "bandpass", rnd(1500, 2100), 1.2, 0.55); tone(o, t, 0.04, "square", 170, 90, 0.12); },
  aa(o, t) { noise(o, t, 0.07, "bandpass", 1100, 1.5, 0.5); tone(o, t, 0.06, "triangle", 240, 120, 0.2); },
  hit(o, t) { tone(o, t, 0.22, "square", rnd(380, 460), 260, 0.18); tone(o, t, 0.3, "triangle", rnd(620, 720), 500, 0.15); noise(o, t, 0.12, "bandpass", 2500, 2, 0.5); },
  tick(o, t) { noise(o, t, 0.03, "highpass", 4000, 0.7, 0.3); tone(o, t, 0.05, "square", 900, 600, 0.05); },
  ricochet(o, t) { tone(o, t, 0.32, "sine", rnd(2600, 3200), 800, 0.25, 0.002); noise(o, t, 0.06, "highpass", 3500, 0.7, 0.3); },
  boom(o, t) {
    noise(o, t, 1.6, "lowpass", 900, 0.8, 1, 0.004, 90);
    tone(o, t, 0.9, "sine", 70, 28, 1);
    noise(o, t + 0.08, 0.7, "bandpass", 500, 0.8, 0.35, 0.02, 150);
  },
  splash(o, t) { noise(o, t, 0.6, "bandpass", 1200, 0.9, 0.6, 0.01, 300); noise(o, t + 0.05, 0.35, "highpass", 2500, 0.7, 0.2, 0.01); },
  tree(o, t) { noise(o, t, 0.09, "highpass", 1800, 0.8, 0.6); noise(o, t + 0.06, 0.4, "lowpass", 500, 0.9, 0.4, 0.01, 120); tone(o, t + 0.05, 0.25, "sine", 110, 55, 0.3); },
  alert(o, t) { tone(o, t, 0.12, "square", 880, 0, 0.08); tone(o, t + 0.16, 0.14, "square", 660, 0, 0.08); },
  good(o, t) { tone(o, t, 0.1, "triangle", 660, 0, 0.18); tone(o, t + 0.1, 0.18, "triangle", 990, 0, 0.18); },
  click(o, t) { tone(o, t, 0.05, "sine", 1100, 700, 0.18, 0.002); },
  coin(o, t) { tone(o, t, 0.1, "square", 1320, 0, 0.08); tone(o, t + 0.08, 0.3, "square", 1760, 0, 0.08); },
  box(o, t) { for (let i = 0; i < 6; i++) { noise(o, t + i * 0.13, 0.06, "bandpass", 700 + i * 120, 2, 0.4); tone(o, t + i * 0.13, 0.08, "triangle", 196 * Math.pow(1.122, i), 0, 0.12); } },
  reward(o, t) {
    noise(o, t, 0.6, "highpass", 2000, 0.6, 0.35, 0.005, 6000);
    [523, 659, 784, 1047].forEach((f, i) => { tone(o, t + i * 0.09, 0.5, "triangle", f, 0, 0.22); tone(o, t + i * 0.09, 0.4, "square", f * 2, 0, 0.03); });
  },
  win(o, t) { [392, 523, 659, 784].forEach((f, i) => tone(o, t + i * 0.16, i === 3 ? 1.1 : 0.22, "sawtooth", f, 0, 0.12, 0.01)); tone(o, t + 0.48, 1.1, "sawtooth", 523, 0, 0.08, 0.02); },
  lose(o, t) { [392, 370, 349, 294].forEach((f, i) => tone(o, t + i * 0.28, i === 3 ? 1.2 : 0.3, "sawtooth", f, 0, 0.1, 0.02)); },
};
const MIN_GAP = { mg: 0.05, aa: 0.07, tick: 0.06, hit: 0.05, tree: 0.08, cannon: 0.03, splash: 0.08, click: 0.03 };

// sfx(name, {x, y, k, vol}) — x/y in world coords give distance falloff and stereo
function sfx(name, o) {
  if (!ac || !set.sound || ac.state !== "running" || !FX[name]) return;
  o = o || {};
  const now = ac.currentTime;
  if (now - (last[name] || 0) < (MIN_GAP[name] || 0)) return;
  if (voices > 70 && name !== "boom") return;
  let vol = o.vol || 1, pan = 0;
  if (o.x !== undefined) {
    const dx = o.x - L.x, dy = o.y - L.y, d = Math.hypot(dx, dy);
    const f = clamp(1 - d / 1500, 0, 1); vol *= f * f; pan = dx / L.w;
    if (vol < 0.03) return;
  }
  last[name] = now;
  FX[name](out(vol, pan), now + 0.005, o.k || 0);
}
function listen(x, y, w) { L.x = x; L.y = y; L.w = Math.max(300, w); }

// ---------- engine hum (player vehicle) ----------
let eng = null;
function engine(kind, frac) {
  if (!ac || ac.state !== "running") return;
  if (!kind || !set.sound) { if (eng) { eng.g.gain.setTargetAtTime(0, ac.currentTime, 0.15); } return; }
  if (!eng || eng.kind !== kind) {
    if (eng) { const e = eng; e.g.gain.setTargetAtTime(0, ac.currentTime, 0.1); setTimeout(() => { e.o1.stop(); e.o2.stop(); e.n.stop(); }, 600); }
    const g = ac.createGain(); g.gain.value = 0; g.connect(sfxBus);
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = kind === "plane" ? 900 : 260; lp.connect(g);
    const o1 = ac.createOscillator(); o1.type = "sawtooth"; const o2 = ac.createOscillator(); o2.type = kind === "plane" ? "square" : "sawtooth";
    const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const nf = ac.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = kind === "plane" ? 1400 : 300; nf.Q.value = 0.8;
    const ng = ac.createGain(); ng.gain.value = kind === "plane" ? 0.35 : 0.5;
    o1.connect(lp); o2.connect(lp); n.connect(nf); nf.connect(ng); ng.connect(lp);
    o1.start(); o2.start(); n.start();
    eng = { kind, g, lp, o1, o2 };
    eng.n = n;
  }
  const t = ac.currentTime, f = clamp(frac, 0, 1.2);
  const base = eng.kind === "plane" ? 70 + f * 60 : eng.kind === "ship" ? 32 + f * 14 : 38 + f * 30;
  eng.o1.frequency.setTargetAtTime(base, t, 0.12); eng.o2.frequency.setTargetAtTime(base * 1.505, t, 0.12);
  eng.lp.frequency.setTargetAtTime((eng.kind === "plane" ? 700 : 200) + f * 500, t, 0.15);
  eng.g.gain.setTargetAtTime((eng.kind === "plane" ? 0.05 : 0.07) + f * 0.06, t, 0.15);
}

// ---------- music ----------
// battle: martial 132 bpm in D minor (Dm-Bb-C-A); menu: calm 84 bpm pad and arpeggio
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
const SONGS = {
  battle: { bpm: 132, chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]],
    lead: [[62, 0, 3], [65, 3, 1], [64, 4, 2], [62, 6, 2], [69, 8, 4], [67, 12, 2], [65, 14, 2]] },
  menu: { bpm: 84, chords: [[50, 53, 57], [53, 57, 60], [48, 52, 55], [43, 46, 50]], lead: [] },
};
let song = null, step = 0, nextT = 0, timer = 0, songBar = 0;
function mbus(vol) { const g = ac.createGain(); g.gain.value = vol; g.connect(musBus); return g; }
function mtone(t, dur, type, f, vol, a, cut) {
  const o = ac.createOscillator(); o.type = type; o.frequency.value = f;
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (a || 0.01)); g.gain.setValueAtTime(vol, t + Math.max(a || 0.01, dur * 0.6)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let dst = musOut;
  if (cut) { const fl = ac.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = cut; fl.connect(musOut); dst = fl; o.connect(g); g.connect(fl); }
  else { o.connect(g); g.connect(dst); }
  o.start(t); o.stop(t + dur + 0.05);
}
let musOut = null;
function drum(t, kind, vol) {
  if (kind === "k") { const o = ac.createOscillator(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); const g = ac.createGain(); env(g, t, 0.002, vol, 0.28); o.connect(g); g.connect(musOut); o.start(t); o.stop(t + 0.35); }
  else if (kind === "s") { noise(musOut, t, 0.18, "bandpass", 1700, 0.7, vol, 0.002); mtone(t, 0.1, "triangle", 190, vol * 0.5, 0.002); }
  else if (kind === "h") noise(musOut, t, 0.04, "highpass", 7000, 0.7, vol, 0.001);
  else if (kind === "t") { const o = ac.createOscillator(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.2); const g = ac.createGain(); env(g, t, 0.003, vol, 0.25); o.connect(g); g.connect(musOut); o.start(t); o.stop(t + 0.3); }
}
function schedule() {
  if (!song || !ac) return;
  const S = SONGS[song], s16 = 60 / S.bpm / 4;
  while (nextT < ac.currentTime + 0.12) {
    const t = nextT, st = step % 16, bar = Math.floor(step / 16), ch = S.chords[bar % 4];
    if (song === "battle") {
      const fill = bar % 4 === 3 && st >= 12;
      if (st === 0 || st === 8 || st === 10 || (st === 3 && bar % 2)) drum(t, "k", 0.9);
      if ((st === 4 || st === 12) && !fill) drum(t, "s", 0.45);
      if (fill) drum(t, st % 2 ? "s" : "t", 0.35 + (st - 12) * 0.06);
      if (st % 2 === 0) drum(t, "h", st % 4 === 2 ? 0.12 : 0.07);
      if (st % 2 === 0) mtone(t, s16 * 1.7, "sawtooth", NOTE(ch[0] - 12 + (st % 8 === 6 ? 12 : 0)), 0.16, 0.005, 520);
      if (st === 0 || st === 6 || st === 10) ch.forEach(n => { mtone(t, s16 * (st === 0 ? 5 : 3), "sawtooth", NOTE(n), 0.05, 0.02, 1500); mtone(t, s16 * (st === 0 ? 5 : 3), "square", NOTE(n + 12), 0.012, 0.02, 2200); });
      if (bar % 8 >= 4) for (const [n, at, len] of S.lead) if (at === st) { const sh = bar % 4 === 1 ? -4 : bar % 4 === 2 ? -2 : bar % 4 === 3 ? -5 : 0; mtone(t, s16 * len * 0.95, "square", NOTE(n + sh + 12), 0.035, 0.01, 2600); mtone(t, s16 * len * 0.95, "triangle", NOTE(n + sh), 0.06, 0.01); }
    } else {
      if (st === 0) ch.forEach(n => mtone(t, s16 * 16, "triangle", NOTE(n), 0.05, 0.6, 1200));
      if (st === 0) mtone(t, s16 * 15, "sine", NOTE(ch[0] - 12), 0.12, 0.3);
      if (st % 2 === 0) { const arp = [0, 1, 2, 1, 0, 2, 1, 2]; mtone(t, s16 * 2.5, "triangle", NOTE(ch[arp[(st / 2) % 8]] + 12), 0.035, 0.01, 2400); }
      if (st === 0 || st === 8) drum(t, "k", 0.25);
      if (st % 4 === 2) drum(t, "h", 0.035);
    }
    nextT += s16; step++;
  }
}
function music(name) {
  wantMusic = name;
  if (!ac) return;
  if (song === name) return;
  // fade out the old song's bus and start a fresh one
  if (musOut) { const old = musOut; old.gain.setTargetAtTime(0, ac.currentTime, 0.3); setTimeout(() => old.disconnect(), 2000); musOut = null; }
  song = name || null;
  clearInterval(timer);
  if (!song) return;
  musOut = mbus(0.0001); musOut.gain.setTargetAtTime(1, ac.currentTime, 0.6);
  step = 0; songBar = 0; nextT = ac.currentTime + 0.1;
  timer = setInterval(schedule, 40); schedule();
}

function setSound(on) { set.sound = !!on; if (ac) sfxBus.gain.setTargetAtTime(on ? 1 : 0, ac.currentTime, 0.05); if (!on) engine(null); }
function setMusic(on) { set.music = !!on; if (ac) musBus.gain.setTargetAtTime(on ? 0.32 : 0, ac.currentTime, 0.1); }

WOV.Audio = { sfx, listen, engine, music, setSound, setMusic, settings: set, unlock: init };
})();
