// Vercel serverless function : GET /api/trades?type=&ticker=&sector=&q=
import { computeTrades } from "../lib/core.js";

export default async function handler(req, res) {
  try {
    const data = await computeTrades(req.query || {});
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
}
