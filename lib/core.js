// Logique métier partagée entre le serveur local (server.js) et les fonctions
// serverless Vercel (api/*.js). Source unique de vérité : zéro logique dupliquée.
import { readFile } from "node:fs/promises";

// ---- Chargement des données ----
// Résolu relativement à CE module via import.meta.url → marche en local
// (depuis n'importe quel cwd) ET sur Vercel (le tracer @vercel/nft détecte
// ces `new URL(...)` statiques et embarque les fichiers JSON dans le bundle).
const DATA_FILES = {
  "trump-trades.json": new URL("../data/trump-trades.json", import.meta.url),
  "meta.json": new URL("../data/meta.json", import.meta.url),
  "trump-posts.json": new URL("../data/trump-posts.json", import.meta.url),
};
export async function loadData(file) {
  const url = DATA_FILES[file];
  if (!url) throw new Error("Fichier de données inconnu : " + file);
  return JSON.parse(await readFile(url, "utf-8"));
}

// ---- Posts Truth Social (alimentés par le workflow n8n) ----
// Renvoie les posts du plus récent au plus ancien. Tolérant : si le fichier
// est absent/illisible, renvoie une liste vide (la section s'affiche « vide »).
export async function computePosts(limit = 50) {
  let posts;
  try {
    posts = await loadData("trump-posts.json");
  } catch {
    posts = [];
  }
  if (!Array.isArray(posts)) posts = [];
  posts = posts
    .slice()
    .sort((a, b) => String(b.addedAt || b.date || "").localeCompare(String(a.addedAt || a.date || "")));
  return { count: posts.length, posts: posts.slice(0, limit) };
}

// ---- Transactions ----
export const estValue = (t) => Math.round((t.amountMin + t.amountMax) / 2);

export async function computeTrades(query = {}) {
  let trades = await loadData("trump-trades.json");
  const { type, ticker, sector, q } = query;
  if (type) trades = trades.filter((t) => t.type === type);
  if (ticker) trades = trades.filter((t) => t.ticker === String(ticker).toUpperCase());
  if (sector) trades = trades.filter((t) => t.sector === sector);
  if (q) {
    const needle = String(q).toLowerCase();
    trades = trades.filter(
      (t) =>
        t.company.toLowerCase().includes(needle) ||
        t.ticker.toLowerCase().includes(needle)
    );
  }
  trades = trades
    .map((t) => ({ ...t, estValue: estValue(t) }))
    .sort((a, b) => b.date.localeCompare(a.date));
  return { count: trades.length, trades };
}

// ---- Statistiques agrégées ----
export async function computeStats() {
  const trades = await loadData("trump-trades.json");
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

  return {
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
  };
}

// ---- Action DJT via Yahoo Finance ----
export const RANGE_INTERVAL = {
  "1d": "5m",
  "5d": "15m",
  "1mo": "1d",
  "6mo": "1d",
  "1y": "1d",
  "5y": "1wk",
};

// petit cache mémoire (utile en local et tant qu'une instance serverless reste chaude)
const cache = new Map();
function getCache(key, maxAgeMs) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < maxAgeMs) return hit.v;
  return null;
}
function setCache(key, v) {
  cache.set(key, { t: Date.now(), v });
}

export async function fetchYahoo(symbol, range, interval) {
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
export function normalizeSeries(result) {
  const ts = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const pts = ts
    .map((t, i) => ({ t: new Date(t * 1000).toISOString(), c: closes[i] }))
    .filter((p) => p.c != null);
  const base = pts[0]?.c;
  return pts.map((p) => ({ t: p.t, v: base ? (p.c / base - 1) * 100 : 0 }));
}

export async function buildDJT(query = {}) {
  const range = RANGE_INTERVAL[query.range] ? query.range : "6mo";
  const interval = RANGE_INTERVAL[range];

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
  return {
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
}

export async function buildCompare(query = {}) {
  const range = RANGE_INTERVAL[query.range] ? query.range : "6mo";
  const interval = RANGE_INTERVAL[range];
  const [djt, spx] = await Promise.all([
    fetchYahoo("DJT", range, interval),
    fetchYahoo("^GSPC", range, interval),
  ]);
  return {
    range,
    djt: normalizeSeries(djt),
    spx: normalizeSeries(spx),
  };
}
