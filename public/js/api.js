// Helpers d'accès à l'API du serveur + formatage.
const API = {
  async _get(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  },
  meta() { return this._get("/api/meta"); },
  trades(params = {}) {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    return this._get("/api/trades?" + q.toString());
  },
  stats() { return this._get("/api/stats"); },
  posts() { return this._get("/api/posts"); },
  djt(range = "6mo") { return this._get("/api/djt?range=" + range); },
  compare(range = "6mo") { return this._get("/api/compare?range=" + range); },
  async health() { try { return (await fetch("/api/health")).ok; } catch { return false; } },
};

// ---- Formatage ----
const fmt = {
  money(n) {
    if (n == null || isNaN(n)) return "—";
    const a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(1).replace(".", ",") + " Md$";
    if (a >= 1e6) return (n / 1e6).toFixed(1).replace(".", ",") + " M$";
    if (a >= 1e3) return Math.round(n / 1e3) + " k$";
    return Math.round(n) + " $";
  },
  range(min, max) { return this.money(min) + " – " + this.money(max); },
  price(n) {
    if (n == null || isNaN(n)) return "—";
    return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
  },
  pct(n) {
    if (n == null || isNaN(n)) return "—";
    return (n >= 0 ? "+" : "") + n.toFixed(2).replace(".", ",") + " %";
  },
  int(n) { return (n ?? 0).toLocaleString("fr-FR"); },
  date(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  },
  dateTime(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  },
};

// ---- Toast (notification visuelle en bas à droite) ----
function showToast(title, msg, icon = "🔔") {
  const wrap = document.getElementById("toast-wrap");
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<strong>${icon} ${title}</strong><small>${msg}</small>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .4s";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 400);
  }, 5000);
}
