// Ajoute de NOUVELLES transactions au fichier data/trump-trades.json, en toute sécurité :
//   - valide chaque ligne (champs requis, types autorisés, format de date, montants)
//   - dé-doublonne (signature date+ticker+type+montants)
//   - attribue des id uniques, re-trie, met à jour data/meta.json
//
// Usage : node append-trades.mjs <nouvelles.json> [--filing "OGE 278-T 2026-05-08"] [--source <URL>]
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.TBT_DATA_DIR || path.join(__dirname, "..", "data");

const args = process.argv.slice(2);
const newPath = args.find((a) => !a.startsWith("--"));
const flag = (name) => { const i = args.indexOf("--" + name); return i >= 0 ? args[i + 1] : null; };
const filing = flag("filing");
const source = flag("source");

if (!newPath) {
  console.error('Usage : node append-trades.mjs <nouvelles.json> [--filing "..."] [--source URL]');
  process.exit(1);
}

const REQUIRED = ["date", "ticker", "company", "type", "assetType", "sector", "amountMin", "amountMax"];
const VALID_TYPE = new Set(["buy", "sell"]);
const VALID_ASSET = new Set(["stock", "etf", "bond", "crypto"]);
const sig = (t) => [t.date, String(t.ticker).toUpperCase(), t.type, t.amountMin, t.amountMax].join("|");

const tradesPath = path.join(DATA_DIR, "trump-trades.json");
const metaPath = path.join(DATA_DIR, "meta.json");
const trades = JSON.parse(await readFile(tradesPath, "utf-8"));
const meta = JSON.parse(await readFile(metaPath, "utf-8"));
let incoming = JSON.parse(await readFile(newPath, "utf-8"));
if (!Array.isArray(incoming)) incoming = [incoming];

const existing = new Set(trades.map(sig));
let maxId = trades.reduce((m, t) => Math.max(m, parseInt(String(t.id).replace(/\D/g, ""), 10) || 0), 0);
let added = 0, skipped = 0, invalid = 0;
const errors = [];

for (const t of incoming) {
  const missing = REQUIRED.filter((k) => t[k] === undefined || t[k] === null || t[k] === "");
  const badDate = !/^\d{4}-\d{2}-\d{2}$/.test(String(t.date));
  const badNums = !(Number(t.amountMax) >= Number(t.amountMin)) || Number(t.amountMin) < 0;
  if (missing.length || !VALID_TYPE.has(t.type) || !VALID_ASSET.has(t.assetType) || badDate || badNums) {
    invalid++;
    errors.push({ ligne: t, raison: missing.length ? "champs manquants: " + missing.join(", ") : "valeurs invalides (type/assetType/date/montants)" });
    continue;
  }
  const row = {
    id: null,
    date: t.date,
    ticker: String(t.ticker).toUpperCase(),
    company: String(t.company),
    type: t.type,
    assetType: t.assetType,
    sector: String(t.sector),
    amountMin: Number(t.amountMin),
    amountMax: Number(t.amountMax),
    filing: t.filing || filing || "OGE 278-T",
  };
  if (source) row.source = source;
  if (existing.has(sig(row))) { skipped++; continue; }
  row.id = "t" + String(++maxId).padStart(3, "0");
  trades.push(row);
  existing.add(sig(row));
  added++;
}

trades.sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
await writeFile(tradesPath, JSON.stringify(trades, null, 2) + "\n");

const today = new Date().toISOString().slice(0, 10);
meta.lastUpdated = today;
if (filing || source) {
  meta.lastFiling = { ...(filing ? { label: filing } : {}), ...(source ? { source } : {}), recordedAt: today };
}
await writeFile(metaPath, JSON.stringify(meta, null, 2) + "\n");

console.log(`✓ Ajoutées : ${added} | doublons ignorés : ${skipped} | invalides : ${invalid} | total : ${trades.length}`);
if (errors.length) console.log("Lignes rejetées :\n" + JSON.stringify(errors.slice(0, 5), null, 2));
