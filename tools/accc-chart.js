// Reads the daily Adelaide unleaded averages off the ACCC's 45-day chart image.
// Run in the browser on https://www.accc.gov.au/sites/www.accc.gov.au/files/fuelwatch/adelaide-metro-ulp.png
// then call acccChart(topLabel, bottomLabel, "YYYY-MM-DD of the first point"), with the three values read from a screenshot
// of the chart: the top and bottom numbers on the cents-per-litre axis and the first date on the date axis.
window.acccChart = (top, bottom, firstDate) => {
  const im = document.images[0], W = im.naturalWidth, H = im.naturalHeight;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, W, H).data;
  const dark = (x, y) => { const i = (y * W + x) * 4; return d[i] < 150 && Math.abs(d[i] - d[i + 1]) < 12 && Math.abs(d[i + 1] - d[i + 2]) < 12; };
  const line = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return false; const i = (y * W + x) * 4; return d[i] > 40 && d[i] < 130 && d[i + 1] < 60 && d[i + 2] > 100 && d[i + 2] < 210; };
  let ax = -1; for (let x = 40; x < 200; x++){ let n = 0; for (let y = 0; y < H; y++) if (dark(x, y)) n++; if (n > H / 2){ ax = x; break; } }
  if (ax < 0) return JSON.stringify({error:"axis not found"});
  let base = -1; for (let y = H - 1; y > 0; y--){ let n = 0; for (let x = ax; x < W; x++) if (dark(x, y)) n++; if (n > W / 2){ base = y; break; } }
  const ticks = []; for (let y = 0; y <= base; y++){ let n = 0; for (let x = ax - 12; x < ax; x++) if (dark(x, y)) n++; if (n >= 6 && (!ticks.length || y - ticks[ticks.length - 1] > 3)) ticks.push(y); }
  if (ticks.length < 2) return JSON.stringify({error:"axis ticks not found"});
  const yTop = ticks[0], yBot = ticks[ticks.length - 1], val = y => bottom + (yBot - y) / (yBot - yTop) * (top - bottom);
  const best = []; let x0 = 1e9, x1 = -1;
  for (let x = ax + 1; x < W; x++) for (let y = 0; y < base; y++) if (line(x, y)){ x0 = Math.min(x0, x); x1 = Math.max(x1, x); break; }
  for (let x = x0; x <= x1; x++){ let b = -1, by = 0; for (let y = 8; y < base; y++){ if (!line(x, y)) continue; let n = 0; for (let a = -8; a <= 8; a++) for (let e = -8; e <= 8; e++) if (a * a + e * e <= 64 && line(x + a, y + e)) n++; if (n > b){ b = n; by = y; } } best.push([x, by, b]); }
  const dots = []; for (let i = 0; i < best.length; i++){ const [x, y, n] = best[i]; if (n < 170) continue; let top1 = true; for (let k = Math.max(0, i - 9); k <= Math.min(best.length - 1, i + 9); k++) if (best[k][2] > n || (best[k][2] === n && k < i)) top1 = false; if (top1) dots.push([x, y]); }
  const t0 = Date.parse(firstDate + "T00:00:00Z"), out = {};
  dots.forEach(([x, y], i) => out[new Date(t0 + i * 864e5).toISOString().slice(0, 10)] = Math.round(val(y) * 10) / 10);
  return JSON.stringify({points:dots.length, axisTicks:ticks.length, last:Object.entries(out).pop(), fuel:{daily:{ulp:out}}});
};
