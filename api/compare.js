// Vercel serverless function : GET /api/compare?range=  (DJT vs S&P 500, perf % normalisée)
import { buildCompare } from "../lib/core.js";

export default async function handler(req, res) {
  try {
    const data = await buildCompare(req.query || {});
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: "Comparaison impossible", detail: String(err?.message || err) });
  }
}
