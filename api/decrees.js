// Vercel serverless function : GET /api/decrees?type=executive_order|proclamation|memorandum
import { buildDecrees } from "../lib/core.js";

export default async function handler(req, res) {
  try {
    const data = await buildDecrees(req.query || {});
    // Le Federal Register publie une fois par jour ouvré : 30 min de cache CDN suffisent.
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: "Impossible de récupérer les décrets", detail: String(err?.message || err) });
  }
}
