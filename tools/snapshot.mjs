// Adds this week's deals from index.html to data/prices.csv.
// Usage: node tools/snapshot.mjs YYYY-MM-DD   (the Wednesday the week starts)
// Running it again for the same week replaces that week's rows.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const week = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(week || "")) { console.error("Give the week start date, e.g. 2026-10-21"); process.exit(1); }

const html = readFileSync("index.html", "utf8");
const grab = name => {
  const start = html.indexOf(`const ${name} = [`);
  if (start < 0) throw new Error(`${name} not found`);
  const end = html.indexOf("\n];", start);
  return new Function(`return ${html.slice(start + `const ${name} = `.length, end + 2)}`)();
};
const DEALS = grab("DEALS"), GROUPS = grab("GROUPS");
const groupOf = {}; GROUPS.forEach(g => g.r.forEach(r => groupOf[r] = g.k));

const slug = s => s.toLowerCase().normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
const cell = v => { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
const HEAD = ["week","id","retailer","store_type","item","category","price","was","pct_off","note"];

const rows = DEALS.filter(d => typeof d.now === "number").map(d => [
  week, `${slug(d.r)}--${slug(d.n)}`, d.r, groupOf[d.r] || "", d.n, d.cat || "",
  d.now, d.was ?? "", d.was ? Math.round((1 - d.now / d.was) * 100) : "", d.note || ""
]);

mkdirSync("data", { recursive: true });
const file = "data/prices.csv";
let old = existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").slice(1) : [];
old = old.filter(l => l && !l.startsWith(week + ","));
const out = [HEAD.join(","), ...old, ...rows.map(r => r.map(cell).join(","))].join("\n") + "\n";
writeFileSync(file, out);
console.log(`${rows.length} prices saved for week ${week} (${old.length} earlier rows kept)`);
