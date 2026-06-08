// Trump Bourse Tracker — serveur Node sans dépendance.
// Lancement : node --use-system-ca server.js   (le flag aide à traverser un proxy/AV TLS)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const PORT = process.env.PORT || 5180;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
};

// ---- petit cache mémoire pour les appels Yahoo ----
const cache = new Map();
function getCache(key, maxAgeMs) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < maxAgeMs) return hit.v;
  return null;
}
function setCache(key, v) {
  cache.set(key, { t: Date.now(), v });
}

async function loadJSON(file) {
  const raw = await readFile(path.join(DATA_DIR, file), "utf-8");
  return JSON.parse(raw);
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

const estValue = (t) => Math.round((t.amountMin + t.amountMax) / 2);

// ---------- API : transactions ----------
async function handleTrades(res, query) {
  let trades = await loadJSON("trump-trades.json");
  const { type, ticker, sector, q } = query;
  if (type) trades = trades.filter((t) => t.type === type);
  if (ticker) trades = trades.filter((t) => t.ticker === ticker.toUpperCase());
  if (sector) trades = trades.filter((t) => t.sector === sector);
  if (q) {
    const needle = q.toLowerCase();
    trades = trades.filter(
      (t) =>
        t.company.toLowerCase().includes(needle) ||
        t.ticker.toLowerCase().includes(needle)
    );
  }
  trades = trades
    .map((t) => ({ ...t, estValue: estValue(t) }))
    .sort((a, b) => b.date.localeCompare(a.date));
  sendJSON(res, 200, { count: trades.length, trades });
}

// ---------- API : statistiques agrégées ----------
async function handleStats(res) {
  const trades = await loadJSON("trump-trades.json");
  const buys = trades.filter((t) => t.type === "buy");
  const sells = trades.filter((t) => t.type === "sell");
  const sum = (arr) => arr.reduce((s, t) => s + estValue(t), 0);

  const groupSum = (keyFn) => {
    const m = {};
    for (const t of trades) {
      const k = keyFn(t);
      m[k] = (m[k] || 0) + estValue(t);
    }
    return Object.entries(m)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  };
  const groupCount = (keyFn) => {
    const m = {};
    for (const t of trades) {
      const k = keyFn(t);
      m[k] = (m[k] || 0) + 1;
    }
    return Object.entries(m)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  };

  // par mois (achats vs ventes)
  const months = {};
  for (const t of trades) {
    const m = t.date.slice(0, 7);
    months[m] = months[m] || { month: m, buy: 0, sell: 0 };
    months[m][t.type] += estValue(t);
  }

  sendJSON(res, 200, {
    totals: {
      transactions: trades.length,
      buys: buys.length,
      sells: sells.length,
      estBuyValue: sum(buys),
      estSellValue: sum(sells),
      estNetValue: sum(buys) - sum(sells),
    },
    bySector: groupSum((t) => t.sector),
    byTicker: groupSum((t) => t.ticker).slice(0, 10),
    byAssetType: groupSum((t) => t.assetType),
    countByTicker: groupCount((t) => t.ticker).slice(0, 10),
    byMonth: Object.values(months).sort((a, b) => a.month.localeCompare(b.month)),
  });
}

// ---------- API : action DJT via Yahoo Finance ----------
const RANGE_INTERVAL = {
  "1d": "5m",
  "5d": "15m",
  "1mo": "1d",
  "6mo": "1d",
  "1y": "1d",
  "5y": "1wk",
};

async function fetchYahoo(symbol, range, interval) {
  const key = `yh:${symbol}:${range}:${interval}`;
  const cached = getCache(key, 60_000);
  if (cached) return cached;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
  });
  if (!r.ok) throw new Error("Yahoo HTTP " + r.status);
  const data = await r.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error("Réponse Yahoo inattendue");
  setCache(key, result);
  return result;
}

// série normalisée en % depuis le début de la plage
function normalizeSeries(result) {
  const ts = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const pts = ts
    .map((t, i) => ({ t: new Date(t * 1000).toISOString(), c: closes[i] }))
    .filter((p) => p.c != null);
  const base = pts[0]?.c;
  return pts.map((p) => ({ t: p.t, v: base ? (p.c / base - 1) * 100 : 0 }));
}

// ---------- API : comparaison DJT vs S&P 500 (performance % normalisée) ----------
async function handleCompare(res, query) {
  const range = RANGE_INTERVAL[query.range] ? query.range : "6mo";
  const interval = RANGE_INTERVAL[range];
  try {
    const [djt, spx] = await Promise.all([
      fetchYahoo("DJT", range, interval),
      fetchYahoo("^GSPC", range, interval),
    ]);
    sendJSON(res, 200, {
      range,
      djt: normalizeSeries(djt),
      spx: normalizeSeries(spx),
    });
  } catch (err) {
    sendJSON(res, 502, { error: "Comparaison impossible", detail: String(err.message || err) });
  }
}

async function handleDJT(res, query) {
  const range = RANGE_INTERVAL[query.range] ? query.range : "6mo";
  const interval = RANGE_INTERVAL[range];
  try {
    // 1) Cote du jour (toujours range=1d) : variation quotidienne, plus haut/bas, volume, 52 sem.
    const quote = await fetchYahoo("DJT", "1d", "5m");
    const qm = quote.meta || {};
    const opens = quote.indicators?.quote?.[0]?.open || [];
    const open = opens.find((v) => v != null) ?? null;

    // 2) Série pour le graphique selon la plage demandée.
    const chart = range === "1d" ? quote : await fetchYahoo("DJT", range, interval);
    const ts = chart.timestamp || [];
    const closes = chart.indicators?.quote?.[0]?.close || [];
    const series = ts
      .map((t, i) => ({ t: new Date(t * 1000).toISOString(), c: closes[i] }))
      .filter((p) => p.c != null);

    const price = qm.regularMarketPrice ?? series.at(-1)?.c ?? null;
    const prev = qm.chartPreviousClose ?? null; // sur range=1d => clôture de la veille
    const out = {
      symbol: qm.symbol || "DJT",
      name: "Trump Media & Technology Group",
      currency: qm.currency || "USD",
      exchange: qm.fullExchangeName || qm.exchangeName || "",
      marketState: qm.marketState || "",
      price,
      previousClose: prev,
      change: price != null && prev != null ? price - prev : null,
      changePercent: price != null && prev != null ? ((price - prev) / prev) * 100 : null,
      open,
      dayHigh: qm.regularMarketDayHigh ?? null,
      dayLow: qm.regularMarketDayLow ?? null,
      volume: qm.regularMarketVolume ?? null,
      fiftyTwoWeekHigh: qm.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: qm.fiftyTwoWeekLow ?? null,
      time: qm.regularMarketTime ? new Date(qm.regularMarketTime * 1000).toISOString() : null,
      range,
      series,
    };
    sendJSON(res, 200, out);
  } catch (err) {
    sendJSON(res, 502, { error: "Impossible de récupérer DJT", detail: String(err.message || err) });
  }
}

// ---------- fichiers statiques ----------
async function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  if (!existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    return res.end("<h1>404</h1>");
  }
  try {
    const body = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end("Erreur serveur");
  }
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  const query = Object.fromEntries(u.searchParams);
  try {
    switch (u.pathname) {
      case "/api/health":
        return sendJSON(res, 200, { ok: true });
      case "/api/meta":
        return sendJSON(res, 200, await loadJSON("meta.json"));
      case "/api/trades":
        return await handleTrades(res, query);
      case "/api/stats":
        return await handleStats(res);
      case "/api/djt":
        return await handleDJT(res, query);
      case "/api/compare":
        return await handleCompare(res, query);
      default:
        return await serveStatic(req, res);
    }
  } catch (err) {
    sendJSON(res, 500, { error: String(err.message || err) });
  }
});

server.listen(PORT, () => {
  console.log(`\n  📈 Trump Bourse Tracker en ligne :  http://localhost:${PORT}\n`);
});
