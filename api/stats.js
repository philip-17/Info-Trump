// Vercel serverless function : GET /api/stats
import { computeStats } from "../lib/core.js";

export default async function handler(req, res) {
  try {
    const data = await computeStats();
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
}
