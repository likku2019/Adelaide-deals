// Adds new fuel and market prices to data/fuel.json and data/markets.json.
// Usage: node tools/prices.mjs <update.json> [YYYY-MM-DD]
// update.json may hold any of these (dates are YYYY-MM-DD, prices are numbers):
//   {"fuel":{"daily":{"ulp":{date:c}}, "weekly":{"ulp":{date:c},"dsl":{date:c}}, "tgp":{"ulp":{date:c},"dsl":{date:c}}, "tip":{"d":date,"t":"text"}},
//    "markets":{"gold":{date:v},"silver":{},"btc":{},"eth":{},"asx":{},"spx":{},"ndq":{}},
//    "phase":{"title":"", "points":["", ...], "housing":"", "watch":""}}
// Existing dates are overwritten with the new value, other dates are kept. Old points are thinned so the files stay small.
import { readFileSync, writeFileSync } from "node:fs";
const [file, asofArg] = process.argv.slice(2);
if (!file){ console.error("usage: node tools/prices.mjs <update.json> [YYYY-MM-DD]"); process.exit(1); }
const upd = JSON.parse(readFileSync(file, "utf8"));
const asof = asofArg || new Date(Date.now() + 10.5 * 3600e3).toISOString().slice(0, 10);
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const day = s => Math.round(Date.parse(s) / 864e5);
const sorted = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
function merge(into, add, lo, hi, name){
  let n = 0;
  for (const [d, v] of Object.entries(add || {})){
    if (!isDate(d) || d > asof) throw new Error(`${name}: bad or future date ${d}`);
    if (typeof v !== "number" || !(v > lo && v < hi)) throw new Error(`${name}: ${d} value ${v} is outside ${lo}-${hi}`);
    if (into[d] !== v){ into[d] = v; n++; }
  }
  return n;
}
const today = day(asof);
let changed = 0;
if (upd.fuel){
  const F = JSON.parse(readFileSync("data/fuel.json", "utf8"));
  for (const grp of ["daily", "weekly", "tgp"]) for (const k of Object.keys(upd.fuel[grp] || {})){
    if (!["ulp", "dsl"].includes(k)) throw new Error(`fuel.${grp}: unknown fuel ${k}`);
    F[grp] = F[grp] || {}; F[grp][k] = F[grp][k] || {};
    changed += merge(F[grp][k], upd.fuel[grp][k], 80, 450, `fuel.${grp}.${k}`);
    // keep 15 months of weekly and wholesale prices and 120 days of daily prices
    const keep = grp === "daily" ? 120 : 460;
    F[grp][k] = sorted(Object.fromEntries(Object.entries(F[grp][k]).filter(([d]) => today - day(d) <= keep)));
  }
  if (upd.fuel.tip && upd.fuel.tip.t){ F.tip = {d:isDate(upd.fuel.tip.d) ? upd.fuel.tip.d : asof, t:String(upd.fuel.tip.t).slice(0, 160)}; changed++; }
  F.asof = asof;
  writeFileSync("data/fuel.json", JSON.stringify(F));
}
if (upd.phase){
  // the written market summary shown above the markets table: {"title":"", "points":["",...], "housing":"", "watch":""}
  const M = JSON.parse(readFileSync("data/markets.json", "utf8"));
  const txt = (v, n) => String(v || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
  const P = {d:asof, title:txt(upd.phase.title, 70), points:(upd.phase.points || []).slice(0, 5).map(x => txt(x, 260)).filter(Boolean), housing:txt(upd.phase.housing, 320), watch:txt(upd.phase.watch, 320)};
  if (!P.title || P.points.length < 2) throw new Error("phase: needs a title and at least 2 points");
  M.phase = P; M.asof = M.asof || asof;
  writeFileSync("data/markets.json", JSON.stringify(M));
  changed++;
}
if (upd.markets){
  const M = JSON.parse(readFileSync("data/markets.json", "utf8"));
  const LIM = {gold:[500, 50000], silver:[5, 2000], btc:[1000, 5e6], eth:[50, 5e5], asx:[2000, 50000], spx:[1000, 50000], ndq:[3000, 200000]};
  for (const k of Object.keys(upd.markets)){
    if (!LIM[k]) throw new Error(`markets: unknown series ${k}`);
    M.s[k] = M.s[k] || {};
    const prev = Object.keys(M.s[k]).sort().pop();
    for (const [d, v] of Object.entries(upd.markets[k])) if (prev && typeof v === "number" && Math.abs(v / M.s[k][prev] - 1) > .6) throw new Error(`markets.${k}: ${d} value ${v} is more than 60% away from the last value ${M.s[k][prev]} - check the source`);
    changed += merge(M.s[k], upd.markets[k], LIM[k][0], LIM[k][1], `markets.${k}`);
    // daily points for 400 days, one point a week before that, nothing older than 5 years
    const out = {}; let lastWeek = null;
    for (const d of Object.keys(M.s[k]).sort().reverse()){
      const age = today - day(d); if (age > 1830) continue;
      if (age <= 400){ out[d] = M.s[k][d]; continue; }
      const w = Math.floor((day(d) + 3) / 7); if (w !== lastWeek){ out[d] = M.s[k][d]; lastWeek = w; }
    }
    M.s[k] = sorted(out);
  }
  M.asof = asof;
  writeFileSync("data/markets.json", JSON.stringify(M));
}
console.log(`${changed} price point(s) added or changed, as of ${asof}`);
