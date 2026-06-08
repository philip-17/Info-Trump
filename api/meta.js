// Vercel serverless function : GET /api/meta
import { loadData } from "../lib/core.js";

export default async function handler(req, res) {
  try {
    const meta = await loadData("meta.json");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(meta);
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
}
