# Updating the Prices tab (fuel and markets)

The Prices tab reads `data/fuel.json` and `data/markets.json`. New numbers are added with

    node tools/prices.mjs update.json

where `update.json` holds only the new points (see the top of `tools/prices.mjs` for the format).
The script checks every value, keeps the files small and sets the "updated" date. Never edit the two data files by hand
and never guess a number: if a source can't be read, leave it out and the page keeps working from what it has.

All sources are read with the browser (they block other fetches). Run each snippet with the browser's JavaScript tool
on the page named, and copy the JSON it returns into `update.json`.

## 1. Markets (every run)

Open `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1mo&interval=1d`, then run:

    (async()=>{const g=async s=>{const r=await fetch('/v8/finance/chart/'+encodeURIComponent(s)+'?range=1mo&interval=1d');const j=(await r.json()).chart.result[0];const o=[];j.timestamp.forEach((t,i)=>{const c=j.indicators.quote[0].close[i];if(c!=null)o.push([new Date((t+j.meta.gmtoffset)*1000).toISOString().slice(0,10),c])});return o};const fx=new Map(await g('AUDUSD=X'));const fxAt=d=>{let t=Date.parse(d);for(let k=0;k<7;k++){const f=fx.get(new Date(t-k*864e5).toISOString().slice(0,10));if(f)return f}return null};const S={gold:['GC=F',1],silver:['SI=F',1],btc:['BTC-AUD',0],eth:['ETH-AUD',0],asx:['^AXJO',0],spx:['^GSPC',0],ndq:['^IXIC',0]};const out={};for(const k in S){let a=(await g(S[k][0])).slice(-12);out[k]={};a.forEach(([d,v])=>{if(S[k][1]){const f=fxAt(d);if(!f)return;v=v/f}out[k][d]=+(v>=1000?v.toFixed(0):v>=100?v.toFixed(1):v.toFixed(2))})}return JSON.stringify({markets:out})})()

Gold and silver are US-dollar futures converted to Australian dollars with the same day's exchange rate; Bitcoin and
Ethereum are already in Australian dollars. Drop today's date for gold, silver, ASX 200, S&P 500 and Nasdaq if that
market hasn't closed yet (a part-day value would be replaced tomorrow anyway).

## 2. Wholesale fuel prices (every run)

Open `https://aip.com.au/pricing/terminal-gate-prices/adelaideULP`, wait a few seconds, run the snippet, then do the
same on `https://aip.com.au/pricing/terminal-gate-prices/adelaidediesel`:

    JSON.stringify(Object.fromEntries(chartSeries[0].data.slice(-10).map(p=>[new Date(p[0]).toISOString().slice(0,10),+p[1].toFixed(1)])))

Put the two results under `{"fuel":{"tgp":{"ulp":{...},"dsl":{...}}}}`.

## 3. Weekly pump price averages (Mondays and Wednesdays)

Same snippet (use `slice(-4)`) on
`https://aip.com.au/pricing/petrol/south-australian-retail-petrol-prices/adelaide/` and
`https://aip.com.au/pricing/diesel/south-australian-retail-diesel-prices/adelaide/`.
Put the results under `{"fuel":{"weekly":{"ulp":{...},"dsl":{...}}}}`. Each date is the Sunday that ends the week.

## 4. Daily unleaded average and the ACCC buying tip (every run)

1. Open `https://www.accc.gov.au/sites/www.accc.gov.au/files/fuelwatch/adelaide-metro-ulp.png` and take a screenshot.
   Read three things off it: the top and bottom numbers on the cents-per-litre axis, and the first date on the date axis
   (the first point sits on the first date label).
2. Run the code in `tools/accc-chart.js` on that page, then `acccChart(top, bottom, "YYYY-MM-DD")`.
3. Check the result: about 45 points, the last date is yesterday or within the last few days, and the last value matches
   where the line ends in the screenshot. If anything is off, leave the daily prices out this run.
4. Copy the `fuel.daily.ulp` part into `update.json` (the last 7 days are enough after the first run).
5. Open `https://www.accc.gov.au/consumers/petrol-and-fuel/petrol-price-cycles-in-the-5-largest-cities`, find the Adelaide
   buying tip and add it in your own words (one short sentence, under 160 characters) as
   `{"fuel":{"tip":{"d":"date the tip was updated","t":"..."}}}`.

## 5. Market phase summary (Wednesdays, or any day something big happens)

The box at the top of the markets section has a short written summary above a table. The table is worked out by the page
from the prices. The summary is yours to rewrite, about once a week, as
`{"phase":{"title":"...","points":["...","..."],"housing":"...","watch":"..."}}` in `update.json`:

- `title`: one plain line naming the phase (under 70 characters), e.g. "Rates are rising, so money is moving to cash".
- `points`: 3 to 5 short sentences on what is happening and where money is moving. Base them on the page's own numbers
  (1 month, 1 year and distance from the 12-month high for each market — compute them from `data/markets.json`) and on
  this week's facts: the Reserve Bank cash rate and latest decision (rba.gov.au media releases), the latest inflation
  figure, and any major event moving markets. Search for these; never state a rate, date or figure from memory.
- `housing`: one or two sentences on Adelaide and national home values from the latest Cotality (or PropTrack) monthly
  report, with the figures as published.
- `watch`: one or two sentences on what would signal a change of phase.

Write for a family reader: plain words, no jargon, no predictions stated as certain, and no advice to buy or sell
anything. Describe what is happening and what usually follows; the page adds "not financial advice" itself. If the facts
can't be checked this week, leave the summary as it is.

## After updating

Commit `data/fuel.json` and `data/markets.json` with the rest of the day's changes. A change in these two files alone is
worth a commit and push, but it does not need a message to the user unless the fuel advice changed (see the task prompt).
