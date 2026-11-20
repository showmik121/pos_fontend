// হাতে-আঁকা কালির স্কেচ স্কাইলাইন -> public/art/city-3shops.svg
// চালান: node scripts/art/city-sketch.mjs   (ব্রাশ কিট: ink-kit.mjs, MengTo/Skills, MIT)
// seed স্থির: প্রতিটি দাগের কী ক্রমিক, তাই আবার চালালে একই ছবি।
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as K from "./ink-kit.mjs";

const { INK, stroke, fillShape, mottle, hatch, fleck, add, rng, R, resample, catmull, arc, dstr } = K;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "public/art/city-3shops.svg");

K.setPrefix("bz-");
const r0 = rng("scene");
let seq = 0;
const key = (p) => p + seq++;

const GREEN = "#2e6b3a", DK = "#1f4d2a", GOLD = "#f2a900", CREAM = "#fff3c9", PINK = "#c0607f";
const GY = 190; // ফুটপাত রেখা
const SKIN = ["#e0b08a", "#d29f78", "#c68e66", "#b9835d"];

// ---------- মৌলিক হাতিয়ার ----------
const jit = (a, n = 0.5) => [a[0] + R(r0, -n, n), a[1] + R(r0, -n, n)];
/** এক টানে কালির দাগ (ওঠানামা + সরু হয়ে আসা) */
const ln = (pts, w = 1.2, o = {}, col = INK, op = 1) =>
  stroke(key("l"), pts, { w, t0: 2.5, t1: 4, wob: 0.3, nib: 0.25, wv: 0.15, min: 0.3, step: 2, ...o }, col, op);
/** সোজা প্রান্তে সামান্য বাঁক + মাঝখানে কাঁপন */
const seg = (a, b, w = 1.2, o = {}, col = INK, op = 1) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const over = o.over ?? R(r0, 0, 1.6), gap = o.gap ?? R(r0, 0, 1.2);
  const a2 = [a[0] + (dx / L) * gap, a[1] + (dy / L) * gap];
  const b2 = [b[0] + (dx / L) * over, b[1] + (dy / L) * over];
  const mid = [(a2[0] + b2[0]) / 2 - (dy / L) * R(r0, -0.5, 0.5), (a2[1] + b2[1]) / 2 + (dx / L) * R(r0, -0.5, 0.5)];
  return ln([a2, mid, b2], w, o, col, op);
};
const dense = (pts, step = 4) => resample([...pts, pts[0]], step);
/** রঙ লাইন থেকে একটু সরে বসে + দাগ-দাগ ছায়া */
const fillP = (pts, col, o = {}) => {
  const loop = fillShape(key("f"), dense(pts, o.step ?? 4), col, { dense: true, j: o.j ?? 0.45, off: o.off ?? [R(r0, -1.4, 1.4), R(r0, -0.8, 1.6)] });
  if (o.m) mottle(loop, o.m, o.mo ?? 0.34);
  return loop;
};
const outP = (pts, w = 1.3, o = {}, col = INK, op = 1) => {
  for (let i = 0; i < (o.open ? pts.length - 1 : pts.length); i++) {
    if (o.skip && o.skip.includes(i)) continue;
    seg(pts[i], pts[(i + 1) % pts.length], w, o, col, op);
  }
};
const hatchP = (pts, o = {}) => hatch(key("h"), [...pts, pts[0]], { ang: -52, sp: 3, w: 0.8, inset: 0.8, over: 0.5, ...o });
const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const ell = (cx, cy, rx, ry, a0 = 0, a1 = 360, st = 24) => arc(cx, cy, rx, ry, a0, a1, st);
/** ছায়া-ডিম্বাকার (মাটিতে ঠেক) */
const groundShadow = (cx, cy, rx, ry = 2.2) => hatchP(ell(cx, cy, rx, ry, 0, 360, 30), { sp: 2.2, w: 0.7, op: 0.75, ang: -20 });

/** বাক্স: ফিল + মোটল + ডান-ছায়া হ্যাচ + কালির রেখা */
const box = (x, y, w, h, col, o = {}) => {
  const pts = rectPts(x, y, w, h);
  const loop = fillP(pts, col, { m: o.m ?? "#00000012".length ? o.dark : undefined, mo: o.mo ?? 0.3 });
  if (o.shade !== false) hatchP(rectPts(x + w * (1 - (o.sw ?? 0.16)), y + 2, w * (o.sw ?? 0.16) - 1, h - 3), { sp: o.sp ?? 3.2, op: o.hop ?? 0.8 });
  outP(pts, o.w ?? 1.3, o.line ?? {}, INK, o.lop ?? 1);
  return loop;
};

// ---------- আকাশ ----------
function cloud(cx, cy, s) {
  const p = [[-20, 4], [-14, -3], [-6, -7], [2, -5], [8, -9], [17, -4], [22, 3], [14, 6], [-8, 6]].map((q) => [cx + q[0] * s, cy + q[1] * s]);
  fillP(p, "#ffffff", { off: [1.5, 1.5], j: 0.7, step: 6 });
  ln(catmull(p.slice(0, 7), false, 6), 0.9, { dense: true }, INK, 0.35);
  ln([[cx - 14 * s, cy + 6 * s], [cx, cy + 7 * s], [cx + 14 * s, cy + 6 * s]], 0.8, {}, INK, 0.3);
}
function bird(x, y, s = 1) {
  ln([[x - 5 * s, y], [x - 2.5 * s, y - 2.5 * s], [x, y]], 0.9, { t0: 1, t1: 1.5 }, INK, 0.7);
  ln([[x, y], [x + 2.5 * s, y - 2.5 * s], [x + 5 * s, y]], 0.9, { t0: 1, t1: 1.5 }, INK, 0.7);
}
cloud(70, 24, 1.1); cloud(240, 16, 0.9); cloud(430, 30, 1.0);
bird(150, 20); bird(163, 27, 0.8); bird(372, 12, 0.9);

// ---------- দূরের ভবন (হালকা) ----------
function farBuilding(x, w, top) {
  const pts = rectPts(x, top, w, 140 - top + 50);
  fillP(pts, "#efe3c0", { m: "#d9c48c", mo: 0.25, step: 6 });
  hatchP(rectPts(x + w * 0.78, top + 3, w * 0.2, 140 - top + 40), { sp: 4, op: 0.35, w: 0.6 });
  outP(pts.slice(0, 3), 0.9, { open: true }, INK, 0.45);
  for (let wy = top + 8; wy < 150; wy += 9)
    for (let wx = x + 5; wx < x + w - 6; wx += 8) if (r0() > 0.35) fillP(rectPts(wx, wy, 3.5, 4.5), r0() > 0.8 ? "#f4cf72" : "#bdb08a", { j: 0.2, step: 3, off: [0.3, 0.3] });
}
[[0, 40, 84], [36, 34, 100], [152, 30, 96], [196, 36, 84], [290, 40, 90], [330, 30, 108], [440, 40, 88]].forEach((a) => farBuilding(...a));

// ---------- বাম ভবন (ভ্যানের পেছনে) ----------
function sideBuilding(x, w, top, col) {
  const pts = rectPts(x, top, w, GY - top);
  fillP(pts, col, { m: "#c5a770", mo: 0.3 });
  hatchP(rectPts(x + w - 9, top + 3, 8, GY - top - 4), { sp: 3, op: 0.6 });
  outP(pts.slice(0, 3), 1.3, { open: true });
  seg([x - 1, top], [x + w + 2, top], 2.2); // ছাদের কার্নিস
  // ইটের দাগ (হালকা)
  for (let i = 0; i < 26; i++) {
    const bx = x + R(r0, 3, w - 6), by = top + R(r0, 6, GY - top - 8);
    ln([[bx, by], [bx + R(r0, 4, 8), by + R(r0, -0.3, 0.3)]], 0.55, { t0: 1, t1: 1.5 }, INK, 0.28);
  }
}
sideBuilding(2, 140, 62, "#e8cfae");

// ---------- জানালা (গ্রিল-সহ) ----------
function win(x, y, w, h, o = {}) {
  fillP(rectPts(x, y, w, h), o.lit ? "#ffe39a" : "#9eb6af", { j: 0.2, step: 3, off: [0.8, 0.6], m: o.lit ? "#f2a900" : "#5f7f78", mo: 0.3 });
  hatchP(rectPts(x + 1, y + 1, w * 0.4, h - 2), { sp: 2.4, w: 0.55, op: o.lit ? 0.25 : 0.45, ang: -58 });
  ln([[x + w * 0.62, y + 2], [x + w * 0.42, y + h - 2]], 1.2, {}, "#ffffff", 0.6); // কাচের ঝিলিক
  outP(rectPts(x, y, w, h), 1.1);
  for (let i = 1; i < (o.bars ?? 3); i++) seg([x + (w * i) / (o.bars ?? 3), y], [x + (w * i) / (o.bars ?? 3), y + h], 0.7, { over: 0.5, gap: 0 });
  seg([x - 2, y + h + 1.4], [x + w + 2, y + h + 1.4], 1.5, { over: 1 });
  if (o.curtain) {
    fillP([[x, y], [x + w * 0.38, y], [x + w * 0.2, y + h * 0.6], [x, y + h * 0.7]], o.curtain, { j: 0.2, step: 3, off: [0.4, 0.4] });
    ln([[x + 1, y + 1], [x + w * 0.24, y + h * 0.6]], 0.6, {}, INK, 0.5);
  }
}
function acUnit(x, y) {
  fillP(rectPts(x, y, 13, 9), "#e9e6dc", { j: 0.2, step: 3, off: [0.5, 0.5] });
  outP(rectPts(x, y, 13, 9), 1);
  ln(ell(x + 6.5, y + 4.5, 3, 3, 0, 360, 40), 0.7, { dense: true });
  ln([[x + 6.5, y + 1.5], [x + 6.5, y + 7.5]], 0.5, {}); ln([[x + 3.5, y + 4.5], [x + 9.5, y + 4.5]], 0.5, {});
  ln([[x + 6, y + 10], [x + 6.4, y + 15]], 0.6, { t0: 1, t1: 2 }, "#6d8fa3", 0.8); // ফোঁটা
}

// বাম ভবনের জানালা/বারান্দা/কাপড়ের দড়ি
win(14, 74, 16, 20, { curtain: "#c0607f" });
win(44, 74, 16, 20, { lit: true, curtain: "#f2a900" });
win(76, 74, 16, 20, {});
win(108, 74, 16, 20, { curtain: "#7fa08a" });
acUnit(30, 100);
win(14, 108, 16, 20, { lit: true });
win(76, 108, 16, 20, { curtain: "#c0607f" });
acUnit(112, 134);
// কাপড় শুকানোর দড়ি
ln([[36, 106], [60, 110], [86, 106]], 0.7, { dense: false }, INK, 0.85);
[[44, 109.5, "#c0607f"], [54, 110.4, "#f2a900"], [68, 109.8, "#ffffff"], [77, 108, "#2e6b3a"]].forEach(([cx, cy, c]) => {
  fillP([[cx - 3, cy], [cx + 3, cy], [cx + 3.4, cy + 9], [cx - 3.4, cy + 9]], c, { j: 0.3, step: 3, off: [0.4, 0.4] });
  outP([[cx - 3, cy], [cx + 3, cy], [cx + 3.4, cy + 9], [cx - 3.4, cy + 9]], 0.7, { skip: [0] });
});

// ---------- দোকানের সারি ----------
const SHOP_W = 96, SHOP_TOP = 96, SHOPS = [166, 262, 358];
function shopFront(x, spec) {
  const w = SHOP_W;
  const pts = rectPts(x, SHOP_TOP, w, GY - SHOP_TOP);
  fillP(pts, spec.wall, { m: spec.wallD, mo: 0.32 });
  hatchP(rectPts(x + w - 11, SHOP_TOP + 4, 10, GY - SHOP_TOP - 5), { sp: 3, op: 0.7 });
  hatchP(rectPts(x + 1, SHOP_TOP + 1, w - 2, 5), { sp: 2.4, op: 0.6, ang: -40 }); // কার্নিসের নিচের ছায়া
  outP(pts, 1.5, { gap: 0.8 });
  seg([x - 2, SHOP_TOP], [x + w + 2, SHOP_TOP], 2.4);
  // ইট/প্লাস্টারের দাগ
  for (let i = 0; i < 18; i++) {
    const bx = x + R(r0, 4, w - 12), by = SHOP_TOP + R(r0, 8, 22);
    ln([[bx, by], [bx + R(r0, 4, 8), by + R(r0, -0.3, 0.3)]], 0.5, { t0: 1, t1: 1.5 }, INK, 0.25);
  }
  // উপরতলার দুই জানালা
  win(x + 10, SHOP_TOP + 9, 22, 20, { lit: spec.lit?.[0], curtain: spec.curtains?.[0] });
  win(x + 54, SHOP_TOP + 9, 22, 20, { lit: spec.lit?.[1], curtain: spec.curtains?.[1] });
  // সাইনবোর্ড
  const sb = rectPts(x + 8, SHOP_TOP + 34, w - 16, 14);
  fillP(sb, spec.sign, { j: 0.25, step: 4, m: "#00000030", mo: 0.2 });
  outP(sb, 1.3);
  spec.signIcon(x + w / 2, SHOP_TOP + 41);
  // ছাউনি (ডোরাকাটা, ঢেউখেলানো নিচ)
  const ay = SHOP_TOP + 50, aw = w - 8, ax = x + 4, n = 6, sw = aw / n;
  for (let i = 0; i < n; i++) {
    const q = [[ax + i * sw, ay], [ax + (i + 1) * sw, ay], [ax + (i + 1) * sw + 1, ay + 11], [ax + i * sw - 1, ay + 11]];
    fillP(q, i % 2 ? "#fff7e0" : spec.awn, { j: 0.25, step: 3, off: [0.6, 0.6] });
    seg(q[0], q[3], 0.9, { over: 0.4, gap: 0 });
    ln(ell(ax + (i + 0.5) * sw, ay + 11, sw / 2, 2.6, 0, 180, 30), 0.9, { dense: true }, INK, 0.9);
  }
  seg([ax - 1, ay], [ax + aw + 1, ay], 1.8);
  hatchP([[ax + 2, ay + 12], [ax + aw - 2, ay + 12], [ax + aw - 2, ay + 18], [ax + 2, ay + 18]], { sp: 2.6, op: 0.6, ang: -50 });
  // খোলা দোকান-মুখ + ভেতরের তাক
  const dx = x + 8, dy = ay + 13, dw = w - 16, dh = GY - dy;
  fillP(rectPts(dx, dy, dw, dh), spec.inside, { j: 0.2, step: 4, off: [0.8, 0.6], m: "#5b4630", mo: 0.45 });
  hatchP(rectPts(dx + 1, dy + 1, dw - 2, dh - 2), { sp: 3.4, op: 0.28, ang: -58, w: 0.7 });
  for (let s = 0; s < 3; s++) {
    const sy = dy + 8 + s * 11;
    seg([dx + 2, sy], [dx + dw - 2, sy], 1.1, { over: 0.4 });
    let px = dx + 4;
    while (px < dx + dw - 8) {
      const c = spec.goods[Math.floor(r0() * spec.goods.length)], gw = R(r0, 4, 7), gh = R(r0, 4, 8);
      fillP(rectPts(px, sy - gh, gw, gh), c, { j: 0.2, step: 2.5, off: [0.5, 0.4] });
      outP(rectPts(px, sy - gh, gw, gh), 0.55, { over: 0.2, gap: 0 });
      px += gw + R(r0, 1.2, 2.6);
    }
  }
  // কাউন্টার
  const cy = GY - 11;
  fillP(rectPts(dx - 2, cy, dw + 4, 11), "#c99a62", { j: 0.3, step: 4, m: "#8a5320", mo: 0.4 });
  hatchP(rectPts(dx, cy + 2, dw, 8), { sp: 2.8, op: 0.55 });
  outP(rectPts(dx - 2, cy, dw + 4, 11), 1.2);
  seg([dx - 3, cy], [dx + dw + 3, cy], 1.8);
  // দরজার দুই পাশের থাম
  seg([dx, dy], [dx, GY], 1.8); seg([dx + dw, dy], [dx + dw, GY], 1.8);
  spec.extra?.(x, ay, dx, dw);
}

const iconCross = (cx, cy) => { fillP([[cx - 1.8, cy - 5], [cx + 1.8, cy - 5], [cx + 1.8, cy - 1.8], [cx + 5, cy - 1.8], [cx + 5, cy + 1.8], [cx + 1.8, cy + 1.8], [cx + 1.8, cy + 5], [cx - 1.8, cy + 5], [cx - 1.8, cy + 1.8], [cx - 5, cy + 1.8], [cx - 5, cy - 1.8], [cx - 1.8, cy - 1.8]], "#ffffff", { j: 0.15, step: 2, off: [0.4, 0.4] }); outP([[cx - 1.8, cy - 5], [cx + 1.8, cy - 5], [cx + 1.8, cy - 1.8], [cx + 5, cy - 1.8], [cx + 5, cy + 1.8], [cx + 1.8, cy + 1.8], [cx + 1.8, cy + 5], [cx - 1.8, cy + 5], [cx - 1.8, cy + 1.8], [cx - 5, cy + 1.8], [cx - 5, cy - 1.8], [cx - 1.8, cy - 1.8]], 0.6, { over: 0.2, gap: 0 }); };
const iconBasket = (cx, cy) => { fillP([[cx - 6, cy - 1], [cx + 6, cy - 1], [cx + 4, cy + 5], [cx - 4, cy + 5]], "#ffe39a", { j: 0.2, step: 3, off: [0.4, 0.4] }); outP([[cx - 6, cy - 1], [cx + 6, cy - 1], [cx + 4, cy + 5], [cx - 4, cy + 5]], 0.7, { gap: 0, over: 0.3 }); ln(arc(cx, cy - 1, 4.5, 4, 180, 360, 20), 0.8, { dense: true }); };
const iconLip = (cx, cy) => { fillP(rectPts(cx - 2, cy - 1, 4, 6), "#fff", { j: 0.15, step: 2, off: [0.3, 0.3] }); fillP([[cx - 1.7, cy - 6], [cx + 1.7, cy - 6], [cx + 2, cy - 1], [cx - 2, cy - 1]], "#c0607f", { j: 0.15, step: 2, off: [0.3, 0.3] }); outP(rectPts(cx - 2, cy - 1, 4, 6), 0.6, { gap: 0, over: 0.2 }); seg([cx - 1.7, cy - 6], [cx + 1.7, cy - 6], 0.7); fleck(key("fk"), cx + 6, cy - 3, 1); fleck(key("fk"), cx - 6, cy - 2, 0.9); };

// কাঠের বাক্স, কলার ছড়া ইত্যাদি (সাধারণ দোকানের সামনে)
function crate(x, y, w = 12, h = 8) {
  fillP(rectPts(x, y, w, h), "#d9a860", { j: 0.2, step: 3, m: "#8a5320", mo: 0.4 });
  outP(rectPts(x, y, w, h), 0.9);
  for (let i = 1; i < 3; i++) seg([x, y + (h * i) / 3], [x + w, y + (h * i) / 3], 0.6, { gap: 0, over: 0.2 });
}

shopFront(SHOPS[0], {
  wall: "#d4e6d0", wallD: "#7fa08a", sign: GREEN, awn: "#4a8a56", inside: "#d8c9a0", signIcon: iconCross,
  goods: ["#ffffff", "#f2a900", "#c0607f", "#7fb7d4", "#4a8a56"], lit: [true, false], curtains: [null, "#f2a900"],
});
shopFront(SHOPS[1], {
  wall: "#f3d6b4", wallD: "#c98a52", sign: "#d98a00", awn: "#f2a900", inside: "#dcc89a", signIcon: iconBasket,
  goods: ["#c0607f", "#4a8a56", "#f2a900", "#e8e0c8", "#b8452f", "#7fb7d4"], lit: [false, true], curtains: ["#4a8a56", null],
  extra: (x, ay) => { crate(x + 70, GY - 8, 13, 8); crate(x + 72, GY - 15, 10, 7);
    // ঝুলন্ত চিপসের প্যাকেট
    [[x + 20, "#c0607f"], [x + 27, "#f2a900"], [x + 34, "#4a8a56"], [x + 41, "#7fb7d4"]].forEach(([hx, c]) => { ln([[hx, ay + 12], [hx, ay + 17]], 0.5, {}, INK, 0.7); fillP([[hx - 2, ay + 17], [hx + 2, ay + 17], [hx + 2.4, ay + 24], [hx - 2.4, ay + 24]], c, { j: 0.2, step: 2.5, off: [0.4, 0.4] }); outP([[hx - 2, ay + 17], [hx + 2, ay + 17], [hx + 2.4, ay + 24], [hx - 2.4, ay + 24]], 0.55, { gap: 0, over: 0.2 }); }); },
});
shopFront(SHOPS[2], {
  wall: "#f0cfd6", wallD: "#c0607f", sign: PINK, awn: "#c0607f", inside: "#ead3b6", signIcon: iconLip,
  goods: ["#ffffff", "#c0607f", "#f2a900", "#e8b5c4", "#7fb7d4", "#2e6b3a"], lit: [true, true], curtains: [null, null],
  extra: (x) => { // টবের গাছ
    fillP([[x + 78, GY - 8], [x + 87, GY - 8], [x + 85, GY], [x + 80, GY]], "#b8452f", { j: 0.2, step: 3, off: [0.4, 0.4] });
    outP([[x + 78, GY - 8], [x + 87, GY - 8], [x + 85, GY], [x + 80, GY]], 0.8, { gap: 0, over: 0.2 });
    for (let i = 0; i < 7; i++) { const a = -70 + i * 22; ln([[x + 82.5, GY - 8], [x + 82.5 + Math.sin((a * Math.PI) / 180) * 9, GY - 8 - Math.cos((a * Math.PI) / 180) * 10]], 1.6, { t0: 1, t1: 5 }, "#3f8a4a", 1); } },
});

// দোকানের নিচের ধাপ/ফুটপাত
seg([SHOPS[0] - 3, GY], [SHOPS[2] + SHOP_W + 3, GY], 2);

// ---------- বিলবোর্ড (লোগো + Bipone) ----------
const logo = fs.readFileSync(path.join(ROOT, "public/icons/logo.svg"), "utf8").trim();
let inner = logo.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
["bg", "glow", "wh", "gold"].forEach((i) => { inner = inner.replaceAll(`id="${i}"`, `id="bz-lg-${i}"`).replaceAll(`url(#${i})`, `url(#bz-lg-${i})`); });
function billboard() {
  const bx = 306, by = 30, bw = 116, bh = 48;
  // ঠ্যাং ও মই
  [bx + 16, bx + bw - 20].forEach((px) => { seg([px, by + bh], [px, SHOP_TOP], 2.4, { over: 0 }); seg([px - 6, SHOP_TOP], [px, by + bh + 6], 0.9, { over: 0 }); seg([px + 6, SHOP_TOP], [px, by + bh + 6], 0.9, { over: 0 }); });
  // ক্যাটওয়াক
  seg([bx + 4, by + bh + 4], [bx + bw - 4, by + bh + 4], 1.4);
  // ফ্রেম
  const pts = rectPts(bx, by, bw, bh);
  fillP(pts, DK, { j: 0.3, step: 5, off: [1.4, 1.4] });
  const inn = rectPts(bx + 4, by + 4, bw - 8, bh - 8);
  fillP(inn, GREEN, { j: 0.3, step: 5, off: [-0.6, 0.8], m: DK, mo: 0.4 });
  hatchP(rectPts(bx + 6, by + bh - 14, bw - 12, 8), { sp: 3, op: 0.35, col: INK, ang: -50 });
  outP(pts, 1.8, { gap: 0.8 });
  outP(inn, 0.9, { gap: 0, over: 0.5 }, INK, 0.7);
  // বাতি (উপরের তিনটি আর্ম)
  [bx + 22, bx + bw / 2, bx + bw - 22].forEach((lx, i) => { ln([[lx, by], [lx, by - 7], [lx + 5, by - 8]], 1, { t0: 1, t1: 2 }); fillP(ell(lx + 6, by - 8, 3.2, 1.8, 0, 360, 40), "#ffd45a", { j: 0.1, step: 2, off: [0.3, 0.3] }); ln(ell(lx + 6, by - 8, 3.2, 1.8, 0, 360, 40), 0.7, { dense: true }); ln([[lx + 4, by - 6], [lx + 2, by - 1]], 0.6, {}, "#ffd45a", 0.8); });
  // লোগো (আইকনটি নিজে থেকে বসানো, চারপাশে স্কেচের ছায়া)
  const lx = bx + 11, ly = by + 8, ls = 32;
  hatchP(rectPts(lx + 2, ly + ls - 3, ls - 2, 4), { sp: 2.4, op: 0.5 });
  add(`<svg x="${lx}" y="${ly}" width="${ls}" height="${ls}" viewBox="0 0 512 512">${inner}</svg>`);
  outP(rectPts(lx, ly, ls, ls), 1.1, { over: 0.8, gap: 0 }, INK, 0.7);
  // "Bipone" হাতের অক্ষরে
  const G = {
    B: [[[0, 0], [0, 14]], [[0, 0], [6, 0], [8.2, 3.5], [6, 7], [0, 7]], [[0, 7], [7, 7], [9, 10.5], [7, 14], [0, 14]]],
    i: [[[0, 5], [0, 14]]], p: [[[0, 5], [0, 19]], [[0, 5.5], [5, 5], [7.4, 9.5], [5, 14], [0, 13.5]]],
    o: [[ell(4, 9.5, 4, 4.7, 90, 450, 36)].flat()], n: [[[0, 14], [0, 5]], [[0, 7.5], [3, 5], [6.5, 6], [7, 14]]],
    e: [[[0, 10], [8, 10], [7.4, 6.5], [4, 5], [1, 7], [0, 10], [1.4, 13.4], [4, 14.6], [7.2, 13.4]]],
  };
  const adv = { B: 12, i: 5, p: 11, o: 11, n: 11, e: 10 };
  let cx = bx + 49; const cy = by + 15, sc = 1.15;
  for (const ch of "Bipone") {
    G[ch].forEach((poly) => ln(poly.map(([gx, gy]) => [cx + gx * sc, cy + gy * sc]), 2.3, { t0: 2, t1: 3, wob: 0.25, dense: false }, CREAM, 1));
    if (ch === "i") fleck(key("dot"), cx, cy + 1.6, 1.5);
    cx += adv[ch] * sc;
  }
  ln([[bx + 50, by + 36], [bx + 78, by + 37.5], [bx + 104, by + 36]], 1, { t0: 4, t1: 8 }, "#ffd45a", 0.9);
}
billboard();

// ---------- বিদ্যুতের খুঁটি + জট-পাকানো তার ----------
function pole(x) {
  ln([[x, 36], [x + 0.6, 110], [x, GY]], 3, { t0: 4, t1: 3, wob: 0.4 }, INK, 0.92);
  seg([x - 12, 42], [x + 12, 42], 2); seg([x - 9, 52], [x + 9, 52], 1.6);
  [[x - 12, 42], [x + 12, 42], [x - 9, 52], [x + 9, 52]].forEach(([ix, iy]) => fillP(ell(ix, iy - 1.5, 1.4, 1.8, 0, 360, 60), "#c9b99a", { j: 0.1, step: 2, off: [0.2, 0.2] }));
  hatchP([[x - 1.5, 120], [x + 1.5, 120], [x + 1.5, GY], [x - 1.5, GY]], { sp: 4, op: 0.5, w: 0.5 });
}
pole(258);
const wires = [[[0, 50], [130, 66], [246, 42], [330, 56], [480, 44]], [[0, 58], [120, 74], [250, 52], [350, 66], [480, 54]], [[270, 42], [340, 34], [420, 46], [480, 36]], [[268, 52], [350, 46], [430, 58], [480, 48]]];
wires.forEach((w, i) => ln(w.map((p) => jit(p, 0.6)), 0.55, { t0: 6, t1: 6, wob: 0.2, wv: 0.1 }, INK, 0.7 - i * 0.05));
// তারে বসা দুটি কাক
[[214, 51.6], [221, 52.2]].forEach(([cx, cy], i) => { fillP(ell(cx, cy - 3, 3.2, 2.2, 0, 360, 40), INK, { j: 0.1, step: 2, off: [0, 0] }); ln([[cx - 3, cy - 3], [cx - 6, cy - 4]], 1.2, { t0: 1, t1: 1 }); ln([[cx + 3, cy - 3], [cx + 6, cy - 2]], 1, { t0: 1, t1: 2 }); fillP(ell(cx + 3.6, cy - 5.4, 1.5, 1.3, 0, 360, 40), INK, { j: 0, step: 2, off: [0, 0] }); ln([[cx - 0.5, cy - 1], [cx - 0.5, cy + 1.2]], 0.5, {}); ln([[cx + 1, cy - 1], [cx + 1, cy + 1.2]], 0.5, {}); });

// ---------- ফুটপাত ও রাস্তা ----------
function street() {
  const sw = rectPts(0, GY, 480, 7);
  fillP(sw, "#e6d5a6", { j: 0.2, step: 8, off: [0, 0.6], m: "#b8a56a", mo: 0.3 });
  for (let i = 0; i < 24; i++) seg([i * 21 + R(r0, 0, 6), GY + 1], [i * 21 + R(r0, 0, 6) + 0.5, GY + 6.5], 0.5, { over: 0, gap: 0 }, INK, 0.28);
  seg([0, GY], [480, GY], 1.3, { over: 0 }); seg([0, GY + 7], [480, GY + 7], 1.6, { over: 0 });
  const rd = rectPts(0, GY + 7, 480, 33);
  fillP(rd, "#efe2ba", { j: 0.2, step: 10, off: [0, 0], m: "#d9c48c", mo: 0.4 });
  for (let i = 0; i < 90; i++) { const sx = R(r0, 0, 470), sy = R(r0, GY + 10, 226); ln([[sx, sy], [sx + R(r0, 4, 14), sy + R(r0, -0.4, 0.4)]], 0.5, { t0: 2, t1: 4 }, INK, 0.2); }
  // মাঝের রেখা (হাতে টানা)
  for (let i = 0; i < 10; i++) { const sx = 14 + i * 47 + R(r0, -3, 3); ln([[sx, 215], [sx + 20, 215.4]], 2.2, { t0: 3, t1: 4, wob: 0.5 }, "#fff8e6", 0.95); }
}
street();

// ---------- ভ্যান (বড়, কোনো ব্র্যান্ডিং নেই) ----------
function van() {
  const bodyCol = "#f4efe3", lowCol = "#cdd5d0", glass = "#9fc0c4";
  groundShadow(78, GY + 1.5, 76, 3);
  // মূল গড়ন (বামমুখী ক্যাব, ডানে মালবাক্স)
  const body = [[2, 172], [4, 158], [16, 150], [30, 128], [48, 124], [52, 120], [150, 120], [153, 124], [153, 176], [146, 180], [8, 180]];
  const loop = fillP(body, bodyCol, { step: 5, j: 0.4, off: [-1.4, 1.2], m: "#c9c2ae", mo: 0.35 });
  // নিচের ফলক
  const low = [[4, 164], [153, 164], [153, 178], [8, 180], [2, 172]].map((p) => p);
  fillP([[3, 166], [153, 166], [153, 179], [147, 180], [8, 180], [3, 174]], lowCol, { step: 6, j: 0.3, off: [-1, 1], m: "#8aa0a0", mo: 0.3 });
  // ছাদের ছায়া ও ডান ধার ছায়া
  hatchP([[54, 121], [150, 121], [150, 130], [54, 130]], { sp: 2.8, op: 0.7 });
  hatchP([[142, 130], [152, 130], [152, 176], [142, 176]], { sp: 2.6, op: 0.8 });
  hatchP([[3, 168], [150, 168], [150, 178], [8, 178]], { sp: 3, op: 0.55, ang: -45 });
  // বাইরের রেখা (ভাঙা কোণ সহ)
  for (let i = 0; i < body.length; i++) if (i !== 1) seg(body[i], body[(i + 1) % body.length], i === body.length - 1 ? 1.8 : 1.6, { over: i % 2 ? 1.4 : 0.4 });
  // পাশের স্লাইডিং দরজা খোলা: ভেতরে কার্টন
  const dx = 66, dy = 128, dw = 70, dh = 38;
  fillP(rectPts(dx, dy, dw, dh), "#3d3228", { j: 0.2, step: 5, off: [0.6, 0.6] });
  hatchP(rectPts(dx + 1, dy + 1, dw - 2, 12), { sp: 2.4, op: 0.5, col: "#f0e0b8", w: 0.5, ang: -55 });
  const cartons = [[dx + 4, dy + dh - 15, 18, 15, "#d9b07a"], [dx + 23, dy + dh - 15, 16, 15, "#e0bd8a"], [dx + 40, dy + dh - 15, 18, 15, "#d4a76b"], [dx + 7, dy + dh - 29, 16, 14, "#e0bd8a"], [dx + 25, dy + dh - 28, 15, 13, "#d9b07a"], [dx + 49, dy + dh - 29, 17, 14, "#e5c595"]];
  cartons.forEach(([cx, cy, cw, ch, c]) => { fillP(rectPts(cx, cy, cw, ch), c, { j: 0.2, step: 4, off: [0.5, 0.5], m: "#8a5320", mo: 0.3 }); hatchP(rectPts(cx + cw * 0.72, cy + 1, cw * 0.26, ch - 2), { sp: 2.2, op: 0.7 }); outP(rectPts(cx, cy, cw, ch), 0.9, { over: 0.4 }); seg([cx + cw / 2, cy], [cx + cw / 2, cy + ch * 0.45], 0.6, { gap: 0, over: 0 }, INK, 0.6); });
  // দরজার ফ্রেম/রেল
  outP(rectPts(dx, dy, dw, dh), 1.4, { over: 0.8 });
  seg([dx - 4, dy - 2], [dx + dw + 20, dy - 2], 1.8); // রেল
  seg([dx + dw, dy], [dx + dw + 22, dy + 2], 1, { over: 0 }); // দরজার পাল্লা (সরানো)
  fillP([[dx + dw + 2, dy + 1], [dx + dw + 18, dy + 3], [dx + dw + 18, dy + dh - 3], [dx + dw + 2, dy + dh - 1]].map((p) => [p[0] - 18, p[1]]).map((p) => [p[0] + 18, p[1]]), bodyCol, { j: 0.2, step: 5, off: [0.5, 0.5] });
  // ক্যাবের জানালা
  const win2 = [[17, 150], [31, 130], [47, 129], [47, 150]];
  fillP(win2, glass, { j: 0.2, step: 4, off: [0.8, 0.8], m: "#5f8f94", mo: 0.4 });
  hatchP([[18, 148], [30, 131], [36, 131], [30, 148]], { sp: 2.2, w: 0.5, op: 0.4, ang: -60 });
  ln([[41, 131], [34, 148]], 1.4, {}, "#ffffff", 0.7);
  ln([[43, 135], [38, 148]], 0.8, {}, "#ffffff", 0.5);
  outP(win2, 1.2, { over: 0.6 });
  // ক্যাবের দরজা
  seg([48, 124], [48, 176], 1.2, { over: 0 }); seg([7, 168], [48, 168], 1, { over: 0 });
  seg([40, 154], [45, 154], 1.4, { over: 0 }); // হাতল
  // সাইড মিরর, হেডলাইট, গ্রিল, বাম্পার
  fillP([[9, 140], [15, 138], [16, 148], [10, 149]], "#2c2824", { j: 0.1, step: 2, off: [0.3, 0.3] });
  seg([14, 148], [19, 152], 0.9, { over: 0 });
  fillP(ell(7, 163, 3.4, 3, 0, 360, 40), "#ffe9a8", { j: 0.1, step: 2, off: [0.4, 0.3] });
  ln(ell(7, 163, 3.4, 3, 0, 360, 40), 0.8, { dense: true });
  ln([[1, 164], [-3, 161]], 0.7, { t0: 1, t1: 2 }, "#f2a900", 0.7); ln([[1, 166], [-4, 166]], 0.7, { t0: 1, t1: 2 }, "#f2a900", 0.6);
  for (let i = 0; i < 4; i++) seg([4, 168 + i * 2.2], [12, 168 + i * 2.2], 0.6, { over: 0, gap: 0 });
  fillP(rectPts(0, 178, 14, 4), "#6b6358", { j: 0.2, step: 3, off: [0.3, 0.3] }); outP(rectPts(0, 178, 14, 4), 0.8, { gap: 0, over: 0.3 });
  fillP(rectPts(144, 176, 12, 5), "#6b6358", { j: 0.2, step: 3, off: [0.3, 0.3] }); outP(rectPts(144, 176, 12, 5), 0.8, { gap: 0, over: 0.3 });
  // লাল টেল-লাইট, নম্বর প্লেট (খালি)
  fillP(rectPts(149, 150, 4, 9), "#d9432f", { j: 0.1, step: 2, off: [0.2, 0.2] }); outP(rectPts(149, 150, 4, 9), 0.7, { gap: 0, over: 0.2 });
  // ছাদের পাঁজর
  for (let i = 0; i < 4; i++) seg([68 + i * 22, 121], [68 + i * 22, 126], 0.7, { over: 0, gap: 0 }, INK, 0.5);
  // কাদার ছিটা, দাগ
  for (let i = 0; i < 26; i++) { const sx = R(r0, 8, 148), sy = R(r0, 166, 180); ln([[sx, sy], [sx + R(r0, -1, 1), sy - R(r0, 2, 5)]], 0.7, { t0: 1, t1: 3 }, "#8a6a40", 0.45); }
  // চাকা
  [[30, 181], [118, 181]].forEach(([cx, cy], k) => {
    const arch = ell(cx, cy - 2, 12.5, 12.5, 180, 360, 20);
    fillP([...ell(cx, cy - 2, 12.5, 12, 180, 360, 20)], "#4a4540", { j: 0.2, step: 3, off: [0, 0] });
    fillP(ell(cx, cy, 9.5, 9.5, 0, 360, 22), "#2c2824", { j: 0.3, step: 3, off: [0.8, 0.8] });
    hatchP(ell(cx, cy, 9, 9, 0, 360, 22), { sp: 2, op: 0.5, col: "#6b6358", w: 0.6, ang: -35 });
    fillP(ell(cx, cy, 5, 5, 0, 360, 30), "#b9b3a6", { j: 0.2, step: 3, off: [0.6, 0.6], m: "#7a746a", mo: 0.4 });
    ln(ell(cx, cy, 5, 5, 0, 360, 30), 0.9, { dense: true });
    for (let s = 0; s < 5; s++) { const a = (s / 5) * 6.283 + k; ln([[cx, cy], [cx + Math.cos(a) * 4.6, cy + Math.sin(a) * 4.6]], 0.6, { t0: 1, t1: 1 }); }
    fillP(ell(cx, cy, 1.4, 1.4, 0, 360, 40), "#2c2824", { j: 0, step: 2, off: [0, 0] });
    ln(ell(cx, cy, 9.6, 9.6, 0, 360, 22), 1.6, { dense: true, press: 0.5 });
    ln(arch.slice(0, 20), 1.5, { dense: true }, INK, 0.95);
  });
  // ধুলোর টান (রাস্তায় থামার পর)
  for (let i = 0; i < 6; i++) ln([[R(r0, 142, 156), GY + R(r0, 0, 4)], [R(r0, 152, 166), GY + R(r0, -2, 3)]], 0.6, { t0: 2, t1: 5 }, "#a68f5a", 0.5);
}
add('<g transform="translate(4 0)">'); van(); add('</g>');

// ---------- মাটির কার্টন, ট্রলি ----------
function groundCarton(x, y, w, h, col = "#e0bd8a", label = true) {
  fillP(rectPts(x, y, w, h), col, { j: 0.2, step: 4, off: [0.6, 0.6], m: "#8a5320", mo: 0.3 });
  hatchP(rectPts(x + w * 0.75, y + 1, w * 0.23, h - 2), { sp: 2.2, op: 0.7 });
  outP(rectPts(x, y, w, h), 1, { over: 0.5 });
  seg([x + w / 2, y], [x + w / 2, y + h * 0.4], 0.6, { gap: 0, over: 0 }, INK, 0.6);
  if (label) { ln([[x + 2, y + h - 4], [x + w * 0.45, y + h - 4]], 0.6, {}, INK, 0.6); ln([[x + w - 7, y + h - 6], [x + w - 7, y + h - 2.5], [x + w - 9, y + h - 4]], 0.6, {}, INK, 0.7); }
}
groundCarton(168, GY + 9, 18, 14, "#d9b07a");
groundCarton(188, GY + 12, 15, 11, "#e5c595");
groundCarton(170, GY + 0, 14, 10, "#e0bd8a", false);

// ---------- মানুষ ----------
/** একজন মানুষ: x = মাঝ, y = পায়ের তলা, f = মুখ (-1 বামে, 1 ডানে) */
function person(o) {
  const { x, y, f = 1, skin = SKIN[0], hair = "#2b211b", top = GREEN, bottom = "#5b4a35", H = 40, walk = 0, shirtD = "#00000030" } = o;
  const hipY = y - H * 0.42, shY = y - H * 0.78, headY = y - H * 0.9;
  groundShadow(x, y + 0.5, 8, 1.6);
  // পা
  const legs = [[-2.2, walk * 1.8], [2.2, -walk * 1.8]];
  legs.forEach(([lx, sw], i) => {
    const q = [[x + lx - 2.4, hipY], [x + lx + 2.4, hipY], [x + lx + 1.8 + sw, y - 2], [x + lx - 1.8 + sw, y - 2]];
    fillP(q, i ? shade(bottom, -12) : bottom, { j: 0.15, step: 3, off: [0.4, 0.3] });
    seg(q[0], q[3], 0.9, { over: 0, gap: 0 }); seg(q[1], q[2], 0.9, { over: 0, gap: 0 });
    fillP([[x + lx + sw - 2.4, y - 2.4], [x + lx + sw + 3.2 * f, y - 2.4], [x + lx + sw + 3.4 * f, y], [x + lx + sw - 2.2, y]], "#2c2824", { j: 0.1, step: 2, off: [0.2, 0.2] });
  });
  hatchP([[x - 4.6, hipY], [x + 4.6, hipY], [x + 3, hipY + 6], [x - 3, hipY + 6]], { sp: 2.2, w: 0.5, op: 0.5 });
  // ধড়
  const torso = o.dress
    ? [[x - 5, shY], [x + 5, shY], [x + 7.5, y - 3], [x - 7.5, y - 3]]
    : [[x - 5.2, shY], [x + 5.2, shY], [x + 4.6, hipY + 1], [x - 4.6, hipY + 1]];
  fillP(torso, top, { j: 0.2, step: 3, off: [0.5, 0.4], m: o.topD ?? "#00000040", mo: 0.3 });
  hatchP([[x + 1.8 * -f, shY + 2], [x + 4.8 * -f + 0 * f, shY + 2], [x + 4.4 * -f, (o.dress ? y - 5 : hipY)], [x + 1.8 * -f, (o.dress ? y - 5 : hipY)]].map((p) => p), { sp: 2.2, w: 0.5, op: 0.6 });
  outP(torso, 1, { over: 0.4 });
  // ঘাড় ও মাথা
  fillP(rectPts(x - 1.4, shY - 3, 2.8, 3.4), skin, { j: 0.1, step: 2, off: [0.2, 0.2] });
  const head = ell(x, headY, 4.1, 4.7, 0, 360, 24);
  fillP(head, skin, { j: 0.12, step: 2.2, off: [0.5, 0.4], m: "#8a5a38", mo: 0.3 });
  hatchP(ell(x + 1.2 * -f, headY + 1.2, 2.2, 3.2, -70, 70, 30).concat([[x + 1.2 * -f, headY + 1.2]]), { sp: 1.8, w: 0.45, op: 0.35 });
  ln(head, 0.95, { dense: true, t0: 3, t1: 4 }, INK, 0.95);
  // চুল
  if (o.hijab) {
    fillP([[x - 5.4, headY + 1], [x - 4.8, headY - 4.4], [x, headY - 6], [x + 4.8, headY - 4.4], [x + 5.4, headY + 1], [x + 5.8, shY + 5], [x - 5.8, shY + 5]], o.hijab, { j: 0.25, step: 3, off: [0.4, 0.4], m: "#00000040", mo: 0.3 });
    outP([[x - 5.4, headY + 1], [x - 4.8, headY - 4.4], [x, headY - 6], [x + 4.8, headY - 4.4], [x + 5.4, headY + 1]], 0.9, { gap: 0, over: 0 });
    fillP(ell(x + 0.6 * f, headY + 0.6, 3.1, 3.6, 0, 360, 24), skin, { j: 0.1, step: 2, off: [0, 0] }); ln(ell(x + 0.6 * f, headY + 0.6, 3.1, 3.6, 0, 360, 24), 0.7, { dense: true });
  } else if (o.cap) {
    fillP([[x - 4.4, headY - 1.4], [x - 3.8, headY - 4.8], [x, headY - 5.8], [x + 3.8, headY - 4.8], [x + 4.4, headY - 1.4]], o.cap, { j: 0.15, step: 2.5, off: [0.4, 0.3] });
    outP([[x - 4.4, headY - 1.4], [x - 3.8, headY - 4.8], [x, headY - 5.8], [x + 3.8, headY - 4.8], [x + 4.4, headY - 1.4]], 0.8, { gap: 0, over: 0.2 });
    seg([x + 3.8 * f, headY - 2], [x + 7.2 * f, headY - 1.4], 1.2, { over: 0 }); // টুপির ছাউনি
  } else {
    fillP([[x - 4.4, headY + 0.6], [x - 4.2, headY - 3.6], [x, headY - 5.2], [x + 4.2, headY - 3.6], [x + 4.4, headY + 0.6], [x + 2.6, headY - 2.6], [x - 2.4, headY - 2.8]], hair, { j: 0.15, step: 2.5, off: [0.3, 0.2] });
    for (let i = 0; i < 3; i++) ln([[x - 3 + i * 2.8, headY - 4.5], [x - 3.5 + i * 2.8 + R(r0, -0.5, 0.5), headY - 1.2]], 0.5, { t0: 1, t1: 2 }, INK, 0.5);
  }
  // মুখ-চোখ
  if (!o.look) {
    const ex = x + 1.6 * f;
    fleck(key("e"), ex - 1.1, headY - 0.2, 0.55); fleck(key("e"), ex + 1.5, headY - 0.2, 0.55);
    ln([[x + 2.6 * f, headY + 0.2], [x + 3.1 * f, headY + 1.4], [x + 2.4 * f, headY + 1.6]], 0.45, {}, INK, 0.7);
    ln([[x + 0.8 * f, headY + 2.6], [x + 2.4 * f, headY + 2.7]], 0.5, {}, "#7a2f25", 0.9);
  } else { // নিচে তাকিয়ে (কাগজ দেখছে)
    fleck(key("e"), x + 1.6 * f - 1, headY + 1, 0.5); fleck(key("e"), x + 1.6 * f + 1.4, headY + 1, 0.5);
    ln([[x + 0.8 * f, headY + 3.2], [x + 2.2 * f, headY + 3.3]], 0.5, {}, "#7a2f25", 0.9);
  }
  if (o.moustache) ln([[x + 0.4 * f, headY + 2.2], [x + 1.8 * f, headY + 1.9], [x + 3.2 * f, headY + 2.4]], 1.1, { t0: 1, t1: 1 }, INK, 0.95);
  if (o.glasses) { ln(ell(x + 0.4 * f - 1.1, headY + 0.4, 1.4, 1.4, 0, 360, 40), 0.5, { dense: true }); ln(ell(x + 0.4 * f + 1.9, headY + 0.4, 1.4, 1.4, 0, 360, 40), 0.5, { dense: true }); }
  if (o.beard) ln([[x - 2.6, headY + 2.8], [x, headY + 5.6], [x + 2.6, headY + 2.8]], 0.9, { t0: 1, t1: 1 }, INK, 0.7);
  return { x, y, f, shY, hipY, headY, skin, top };
}
const shade = (hex, d) => { const n = parseInt(hex.slice(1), 16); const c = (v) => Math.max(0, Math.min(255, v + d)); return "#" + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join(""); };
/** হাত: কাঁধ->কনুই->কবজি, হাতা রঙে, ডগায় হাতের চামড়া */
function arm(p, pts, sleeve, w = 3.2) {
  stroke(key("a"), pts, { w, t0: 1.5, t1: 1, wob: 0.15, nib: 0.1, min: 1.2, step: 1.2 }, sleeve, 1);
  ln(pts.map((q) => [q[0] + 0.9, q[1] + 0.9]), 0.7, { t0: 1, t1: 1 }, INK, 0.8);
  const e = pts[pts.length - 1];
  fillP(ell(e[0], e[1], 1.7, 1.7, 0, 360, 40), p.skin, { j: 0.1, step: 2, off: [0.2, 0.2] });
  return e;
}

// ১) মাল-নামানো কর্মী (কার্টন হাতে হাঁটছে)
function unloader() {
  const x = 156, y = GY + 4;
  const p = person({ x, y, f: 1, skin: SKIN[2], top: "#4a6fa5", topD: "#1c2e50", bottom: "#4a4038", cap: "#e0d4b0", walk: 1.4, H: 40 });
  // হাতের কার্টন (বুকের সামনে)
  const bx = x + 1, by = p.shY + 3;
  fillP(rectPts(bx - 1, by, 17, 13), "#e0bd8a", { j: 0.2, step: 3, off: [0.6, 0.6], m: "#8a5320", mo: 0.3 });
  hatchP(rectPts(bx + 11, by + 1, 4, 11), { sp: 2, op: 0.7 });
  outP(rectPts(bx - 1, by, 17, 13), 1, { over: 0.4 });
  seg([bx + 7.5, by], [bx + 7.5, by + 5], 0.6, { gap: 0, over: 0 }, INK, 0.6);
  ln([[bx + 1, by + 9], [bx + 6, by + 9]], 0.5, {}, INK, 0.6);
  arm(p, [[x + 1, p.shY + 2], [x + 4, p.shY + 9], [x + 8, by + 12]], "#4a6fa5");
  arm(p, [[x - 3, p.shY + 2], [x, p.shY + 9], [x + 3, by + 12.5]], "#365a8c");
  // ঘামের ফোঁটা
  ln([[x - 6, p.headY - 1], [x - 6.4, p.headY + 1]], 0.7, { t0: 1, t1: 1 }, "#6d9fc4", 0.9);
}
// ২) দোকানদার: হাতে কাগজ-কলম, তালিকা মেলাচ্ছেন
function shopkeeper() {
  const x = 202, y = GY + 5;
  const p = person({ x, y, f: -1, skin: SKIN[1], top: "#f4f0e4", topD: "#a89c7c", bottom: "#3f4a3a", H: 42, look: true, moustache: true, glasses: true });
  // কাঁধে গামছা
  fillP([[x - 5, p.shY], [x - 1, p.shY - 0.6], [x + 5, p.shY + 9], [x + 2, p.shY + 9.4]], "#b8452f", { j: 0.15, step: 2.5, off: [0.4, 0.3] });
  for (let i = 0; i < 4; i++) seg([x - 4 + i * 2, p.shY + 1 + i * 2], [x - 1 + i * 2, p.shY + 3 + i * 2 - 1], 0.4, { gap: 0, over: 0 }, "#ffe9a8", 0.8);
  // বাম হাতে কাগজ (পাশ থেকে দেখা), ডান হাতে কলম
  const py = p.shY + 6;
  const sheet = [[x - 12, py - 3], [x - 3, py - 6], [x - 1.5, py + 6], [x - 10.5, py + 9]];
  arm(p, [[x - 3, p.shY + 2], [x - 5, p.shY + 9], [x - 3.5, py + 6]], "#f4f0e4");
  fillP(sheet, "#fffdf4", { j: 0.15, step: 3, off: [0.6, 0.5] });
  outP(sheet, 0.8, { over: 0.4 });
  for (let i = 0; i < 5; i++) ln([[x - 10.5 + i * 0.35, py - 1 + i * 2.2], [x - 3.6 + i * 0.35, py - 3 + i * 2.2]], 0.45, { t0: 1, t1: 1 }, INK, 0.65);
  ln([[x - 6.6, py + 4.8], [x - 4.4, py + 4.4]], 0.5, { t0: 1, t1: 1 }, "#b8452f", 0.9);
  const hand = arm(p, [[x + 3, p.shY + 2], [x + 2, p.shY + 9], [x - 5.5, py + 3]], "#f4f0e4");
  ln([[hand[0] - 0.6, hand[1] + 1], [hand[0] - 2.6, hand[1] + 4.2]], 0.9, { t0: 0.5, t1: 0.5 }, "#1d4f9f", 1); // কলম
  // পাশে সরু ক্লিপবোর্ড ছায়া
  // কাঁধের ঝোলা মানি-ব্যাগ
  fillP(rectPts(x + 3, p.hipY - 3, 6, 7), "#6b4a30", { j: 0.15, step: 2.5, off: [0.4, 0.4] }); outP(rectPts(x + 3, p.hipY - 3, 6, 7), 0.7, { gap: 0, over: 0.2 });
  ln([[x + 3.5, p.hipY - 3], [x - 3, p.shY + 1]], 0.6, {}, INK, 0.7);
}
// ৩) ক্রেতা: নারী (থ্রি-পিস) ব্যাগ হাতে
function womanCustomer(x) {
  const y = GY + 5;
  const p = person({ x, y, f: -1, skin: SKIN[0], top: "#c0607f", topD: "#6a2040", bottom: "#c0607f", H: 38, dress: true, hijab: "#7a3a5a" });
  arm(p, [[x + 3, p.shY + 2], [x + 4, p.shY + 10], [x + 1, p.shY + 16]], "#c0607f");
  fillP(rectPts(x - 3, p.shY + 15, 9, 9), "#fff3c9", { j: 0.15, step: 2.5, off: [0.5, 0.5] }); outP(rectPts(x - 3, p.shY + 15, 9, 9), 0.8, { gap: 0, over: 0.2 });
  ln([[x - 1, p.shY + 15], [x + 1.5, p.shY + 11], [x + 4, p.shY + 15]], 0.6, {});
  arm(p, [[x - 3.5, p.shY + 2], [x - 5, p.shY + 9], [x - 8, p.shY + 13]], "#c0607f");
}
// ৪) স্কুল-ব্যাগ কাঁধে ছেলে
function boy(x) {
  const y = GY + 6;
  const p = person({ x, y, f: -1, skin: SKIN[3], top: "#f2a900", topD: "#8a5a00", bottom: "#2f4a6f", H: 28, walk: 0.6 });
  fillP(rectPts(x + 2.4, p.shY - 0.5, 6, 9), "#2e6b3a", { j: 0.15, step: 2.5, off: [0.4, 0.4] }); outP(rectPts(x + 2.4, p.shY - 0.5, 6, 9), 0.8, { gap: 0, over: 0.2 });
  arm(p, [[x - 3, p.shY + 1.5], [x - 4, p.shY + 7], [x - 3, p.shY + 11]], "#f2a900", 2.6);
}
// ৫) হাসি-মুখে পুরুষ ক্রেতা (পাঞ্জাবি-টুপি)
function manCustomer(x) {
  const y = GY + 5;
  const p = person({ x, y, f: 1, skin: SKIN[2], top: "#dfe8ef", topD: "#6d8fa3", bottom: "#f4f0e4", H: 40, cap: "#f4f0e4", beard: true, dress: false });
  arm(p, [[x + 3, p.shY + 2], [x + 5, p.shY + 8], [x + 9, p.shY + 5]], "#dfe8ef");
  arm(p, [[x - 3, p.shY + 2], [x - 4, p.shY + 9], [x - 3, p.shY + 15]], "#dfe8ef");
}
unloader(); shopkeeper(); womanCustomer(298); boy(322); manCustomer(386); boy(414);

// ---------- ল্যাম্পপোস্ট ও গাছ ----------
function mango(x, s = 1) {
  ln([[x, GY], [x - 1, GY - 22 * s], [x - 2, GY - 38 * s]], 4.2 * s, { t0: 2, t1: 5, wob: 0.6 }, "#6b4a30", 1);
  ln([[x - 1, GY - 20 * s], [x - 10 * s, GY - 32 * s]], 2 * s, { t0: 1, t1: 4 }, "#6b4a30", 1);
  ln([[x + 4 * s, GY - 2], [x + 4.5 * s, GY - 18 * s]], 0.7, {}, INK, 0.5);
  const blobs = [[0, -50, 17], [-14, -42, 13], [13, -43, 14], [-6, -58, 11], [8, -57, 11]];
  blobs.forEach(([bx, by, br], i) => {
    const p = ell(x + bx * s, GY + by * s, br * s, br * 0.85 * s, 0, 360, 36);
    const loop = fillP(p, i % 2 ? "#4e8a4a" : "#5c9a4f", { step: 4, j: 0.9, off: [-1.4, 1.6], m: "#2f5a35", mo: 0.45 });
    hatchP(ell(x + (bx + 3) * s, GY + (by + 4) * s, br * 0.8 * s, br * 0.55 * s, 0, 180, 30).concat([[x + (bx + 3) * s, GY + (by + 4) * s]]), { sp: 3, w: 0.7, op: 0.5 });
    for (let k = 0; k < 8; k++) { const a = R(r0, 0, 6.28), rr = R(r0, 0.4, 0.95) * br * s; ln([[x + bx * s + Math.cos(a) * rr, GY + by * s + Math.sin(a) * rr * 0.85], [x + bx * s + Math.cos(a) * rr + R(r0, -2.5, 2.5), GY + by * s + Math.sin(a) * rr * 0.85 + R(r0, 1, 3)]], 0.7, { t0: 1, t1: 2 }, INK, 0.45); }
  });
  // আম
  [[-8, -38], [6, -34], [-1, -45]].forEach(([mx, my]) => { fillP(ell(x + mx * s, GY + my * s, 2.2, 3, 0, 360, 40), "#f2a900", { j: 0.1, step: 2, off: [0.3, 0.3] }); ln([[x + mx * s, GY + (my - 3) * s], [x + mx * s, GY + (my - 6) * s]], 0.4, {}); });
}
mango(466, 0.82);
function tin(x) { // ছোট ঝোপ
  for (let i = 0; i < 9; i++) { const a = -80 + i * 20; ln([[x, GY], [x + Math.sin((a * Math.PI) / 180) * 9, GY - 4 - Math.cos((a * Math.PI) / 180) * 9]], 1.6, { t0: 1, t1: 5 }, i % 2 ? "#4e8a4a" : "#5c9a4f", 1); }
}
tin(152);


// ---------- রাস্তার ছোট দৃশ্য: জমা পানি, টায়ারের দাগ, ঘুমন্ত কুকুর ----------
function puddle(cx, cy) {
  fillP(ell(cx, cy, 20, 3.4, 0, 360, 40), "#cfe3e6", { j: 0.4, step: 5, off: [0, 0.4], m: "#7fa8b0", mo: 0.4 });
  ln(ell(cx, cy, 20, 3.4, 190, 350, 30), 0.9, { dense: true }, INK, 0.7);
  ln([[cx - 9, cy - 0.6], [cx - 2, cy - 0.8]], 0.7, {}, "#ffffff", 0.9); ln([[cx + 3, cy + 0.6], [cx + 10, cy + 0.4]], 0.6, {}, "#ffffff", 0.8);
  ln(ell(cx + 6, cy + 0.2, 2.6, 0.7, 0, 360, 40), 0.4, { dense: true }, INK, 0.5);
}
puddle(330, 213);
for (let i = 0; i < 3; i++) ln([[200 + i * 3, 205 + i * 5], [260 + i * 3, 206 + i * 5], [330 + i * 3, 204 + i * 5]], 0.6, { t0: 8, t1: 14 }, INK, 0.22);
function sleepingDog(x, y) {
  groundShadow(x, y + 1, 12, 1.8);
  const body = [[x - 10, y - 5], [x - 4, y - 8], [x + 4, y - 8], [x + 9, y - 5], [x + 10, y], [x - 10, y]];
  fillP(body, "#c9a060", { j: 0.3, step: 3, off: [0.5, 0.4], m: "#8a5320", mo: 0.45 });
  hatchP([[x - 8, y - 4], [x + 8, y - 4], [x + 8, y - 0.5], [x - 8, y - 0.5]], { sp: 2, w: 0.5, op: 0.6 });
  outP(body, 0.9, { over: 0.3 });
  fillP(ell(x + 11, y - 3.2, 4, 3.2, 0, 360, 36), "#d9b278", { j: 0.2, step: 3, off: [0.3, 0.3] });
  ln(ell(x + 11, y - 3.2, 4, 3.2, 0, 360, 36), 0.8, { dense: true });
  fillP([[x + 8, y - 6], [x + 10, y - 9], [x + 11.5, y - 5.5]], "#8a5a30", { j: 0.1, step: 2, off: [0.2, 0.2] });
  ln([[x + 13.5, y - 3.6], [x + 14.6, y - 3.4]], 1.1, { t0: 0.5, t1: 0.5 });
  ln([[x + 11, y - 3.6], [x + 12.2, y - 3.8]], 0.5, {});
  ln([[x - 10, y - 3], [x - 16, y - 1.5]], 1.6, { t0: 1, t1: 5 }, "#a07a40", 1);
  ln([[x + 14, y - 9], [x + 17, y - 12], [x + 15, y - 14]], 0.5, { t0: 1, t1: 1 }, INK, 0.6); // z
}
sleepingDog(238, GY + 11);

// ---------- ছড়ানো স্কেচ-দাগ (ধুলো, ফ্লেক) ----------
for (let i = 0; i < 26; i++) fleck(key("fl"), R(r0, 6, 474), R(r0, 60, 226), R(r0, 0.5, 1));


// ---------- সাইজ কমানো: পথকে আপেক্ষিক, ১ দশমিক করা ----------
const tenth = (n) => { const t = Math.round(n * 10); const a = Math.abs(t); const s = a % 10 === 0 ? String(a / 10) : (a / 10).toFixed(1).replace(/^0/, ""); return (t < 0 ? "-" : "") + s; };
const shrink = (str) => str.replace(/ d="(M-?[\d.]+,-?[\d.]+(?:L-?[\d.]+,-?[\d.]+)*Z?)"/g, (m, d) => {
  const pts = d.replace(/Z$/, "").split(/[ML]/).filter(Boolean).map((q) => q.split(",").map((v) => Math.round(parseFloat(v) * 10)));
  let out = "M" + tenth(pts[0][0] / 10) + "," + tenth(pts[0][1] / 10) + "l";
  let prev = pts[0], last = "";
  for (let i = 1; i < pts.length; i++) {
    for (const v of [pts[i][0] - prev[0], pts[i][1] - prev[1]]) { const s = tenth(v / 10); out += (last && !s.startsWith("-") ? " " : "") + s; last = s; }
    prev = pts[i];
  }
  return ` d="${out}${d.endsWith("Z") ? "z" : ""}"`;
});

// ---------- লেখা ----------
const W = 480, H = 230;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Bipone">
<defs>
<filter id="bz-rough" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="0.45" numOctaves="1" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="0.7" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="bz-mottle"><feTurbulence type="fractalNoise" baseFrequency="0.035 0.06" numOctaves="3" seed="11" result="t"/><feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.6 -1.25" result="a"/><feComposite in="SourceGraphic" in2="a" operator="in"/></filter>
${K.defs.join("\n")}
</defs>
<g filter="url(#bz-rough)">
${shrink(K.el.join("\n"))}
</g>
</svg>
`;
fs.writeFileSync(OUT, svg);
console.log("wrote", OUT, (svg.length / 1024).toFixed(1) + " KB", K.el.length, "elements");
