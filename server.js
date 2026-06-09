// Trump Bourse Tracker — serveur Node sans dépendance (dev local + hébergement Mac mini).
// Lancement : node server.js   → http://localhost:5180
// (Sur Vercel, ce fichier n'est PAS utilisé : voir api/*.js qui réutilisent la même
//  logique via lib/core.js. Source unique de vérité = lib/core.js.)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadData,
  computeTrades,
  computeStats,
  computePosts,
  buildDJT,
  buildCompare,
} from "./lib/core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
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

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
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
        return sendJSON(res, 200, await loadData("meta.json"));
      case "/api/trades":
        return sendJSON(res, 200, await computeTrades(query));
      case "/api/stats":
        return sendJSON(res, 200, await computeStats());
      case "/api/posts":
        return sendJSON(res, 200, await computePosts());
      case "/api/djt":
        try {
          return sendJSON(res, 200, await buildDJT(query));
        } catch (err) {
          return sendJSON(res, 502, { error: "Impossible de récupérer DJT", detail: String(err.message || err) });
        }
      case "/api/compare":
        try {
          return sendJSON(res, 200, await buildCompare(query));
        } catch (err) {
          return sendJSON(res, 502, { error: "Comparaison impossible", detail: String(err.message || err) });
        }
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
