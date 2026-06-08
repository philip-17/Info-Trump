// Affiche l'état actuel des données (pour savoir "où on en est" avant une mise à jour).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.TBT_DATA_DIR || path.join(__dirname, "..", "data");

const trades = JSON.parse(await readFile(path.join(DATA_DIR, "trump-trades.json"), "utf-8"));
const meta = JSON.parse(await readFile(path.join(DATA_DIR, "meta.json"), "utf-8"));
const dates = trades.map((t) => t.date).sort();

console.log(JSON.stringify({
  totalTrades: trades.length,
  earliest: dates[0],
  latest: dates.at(-1),
  metaLastUpdated: meta.lastUpdated,
  lastFiling: meta.lastFiling || null,
  period: meta.period,
}, null, 2));
