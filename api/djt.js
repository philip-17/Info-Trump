// Vercel serverless function : GET /api/djt?range=
import { buildDJT } from "../lib/core.js";

export default async function handler(req, res) {
  try {
    const data = await buildDJT(req.query || {});
    // Cache CDN Vercel : 60 s frais, puis servi tel quel ~120 s pendant le rafraîchissement
    // en arrière-plan. Remplace avantageusement le cache mémoire en serverless.
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: "Impossible de récupérer DJT", detail: String(err?.message || err) });
  }
}
