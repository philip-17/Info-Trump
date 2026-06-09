// Ajoute un post Truth Social (+ résumé Claude) à data/trump-posts.json, puis
// (par défaut) commit + pull --rebase + push → Vercel redéploie.
//
// Appelé par le workflow n8n « Trump Truth Social → Telegram » via un nœud
// Execute Command, juste après le nœud « Résumé Claude » :
//   node tools/add-post.mjs /tmp/trump_post.json
//
// Entrée : un objet JSON { date, title, originalContent, postUrl, summary }, fourni
// soit via un fichier (argument positionnel), soit en base64 via --b64 <data>
// (pratique depuis n8n : aucun souci d'échappement shell). Seul `summary` est
// obligatoire (sinon le post est ignoré — on n'affiche rien d'inventé).
//
// Options : --no-git (n'écrit que le JSON, sans commit/push — utile pour tester).
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, "..");
const POSTS = path.join(REPO, "data", "trump-posts.json");
const MAX_POSTS = 50;

const args = process.argv.slice(2);
const noGit = args.includes("--no-git");
const flagVal = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const b64 = flagVal("--b64");
const inPath = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--b64");

if (!b64 && !inPath) {
  console.error("Usage : node add-post.mjs (<post.json> | --b64 <base64>) [--no-git]");
  process.exit(1);
}

function git(...a) {
  return execFileSync("git", a, { cwd: REPO, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
}

const rawJson = b64 ? Buffer.from(b64, "base64").toString("utf-8") : await readFile(inPath, "utf-8");
const incoming = JSON.parse(rawJson);
const summary = String(incoming.summary || "").trim();
if (!summary) {
  console.log("⏭️  Aucun résumé fourni → rien ajouté (règle : on n'affiche pas de contenu vide/inventé).");
  process.exit(0);
}

let posts = [];
try {
  posts = JSON.parse(await readFile(POSTS, "utf-8"));
  if (!Array.isArray(posts)) posts = [];
} catch {
  posts = [];
}

// Dé-doublonnage : par URL si dispo, sinon par (date + début du résumé).
const sig = (p) => (p.postUrl ? "u:" + p.postUrl : "s:" + String(p.date || "") + "|" + String(p.summary || "").slice(0, 60));
const incomingSig = sig(incoming);
if (posts.some((p) => sig(p) === incomingSig)) {
  console.log("⏭️  Post déjà présent (doublon) → rien ajouté.");
  process.exit(0);
}

const maxId = posts.reduce((m, p) => Math.max(m, parseInt(String(p.id).replace(/\D/g, ""), 10) || 0), 0);
const post = {
  id: "p" + String(maxId + 1).padStart(3, "0"),
  date: String(incoming.date || "").trim() || null,
  title: String(incoming.title || "").trim() || null,
  originalContent: String(incoming.originalContent || incoming.content || "").trim() || null,
  postUrl: String(incoming.postUrl || incoming.link || "").trim() || null,
  summary,
  addedAt: new Date().toISOString(),
};

posts.unshift(post); // plus récent en tête
posts.sort((a, b) => String(b.addedAt || "").localeCompare(String(a.addedAt || "")));
if (posts.length > MAX_POSTS) posts.length = MAX_POSTS;

await writeFile(POSTS, JSON.stringify(posts, null, 2) + "\n");
console.log(`✓ Post ajouté (${post.id}) — total ${posts.length}.`);

if (noGit) {
  console.log("(--no-git : pas de commit/push)");
  process.exit(0);
}

// Publication git (robuste face à un push concurrent : commit → pull --rebase → push).
try {
  git("add", "data/trump-posts.json");
  const status = git("status", "--porcelain", "data/trump-posts.json");
  if (!status) {
    console.log("(rien à committer)");
    process.exit(0);
  }
  git("commit", "-m", `Post Trump ${post.date || post.addedAt}`);
  try { git("pull", "--rebase", "origin", "main"); } catch (e) { console.error("pull --rebase :", String(e.message || e)); }
  git("push", "origin", "main");
  console.log("🚀 Poussé sur main (Vercel va redéployer).");
} catch (e) {
  console.error("❌ Échec git :", String(e.stderr || e.message || e));
  process.exit(1);
}
