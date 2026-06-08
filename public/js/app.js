// Orchestrateur : routeur de vues + rendu.
const TITLES = { overview: "Vue d'ensemble", transactions: "Transactions", stats: "Statistiques", djt: "Action DJT", alerts: "Alertes" };
const state = {
  current: "overview", stats: null, sectorsLoaded: false, djtRange: "6mo",
  lastTrades: [], sort: { key: "date", dir: -1 }, compareMode: false, djtTimer: null,
};

// ---------------- Navigation ----------------
function switchView(name) {
  state.current = name;
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
  document.getElementById("view-title").textContent = TITLES[name];
  loadView(name);
}

function loadView(name) {
  if (name === "overview") loadOverview();
  else if (name === "transactions") loadTransactions();
  else if (name === "stats") loadStats();
  else if (name === "djt") loadDJT(state.djtRange);
  else if (name === "alerts") Alerts.initUI();
  manageDjtAutoRefresh(name);
}

// Rafraîchit automatiquement les données live (DJT) quand on est sur une vue concernée.
function manageDjtAutoRefresh(name) {
  if (state.djtTimer) { clearInterval(state.djtTimer); state.djtTimer = null; }
  if (name === "djt") state.djtTimer = setInterval(() => loadDJT(state.djtRange), 60000);
  else if (name === "overview") state.djtTimer = setInterval(() => loadOverview(), 60000);
}

// ---------------- Vue : Vue d'ensemble ----------------
async function loadOverview() {
  const [stats, tr, djt] = await Promise.all([
    ensureStats(),
    API.trades(),
    API.djt("6mo").catch(() => null),
  ]);
  const t = stats.totals;
  document.getElementById("ov-kpis").innerHTML = `
    ${kpi("Action DJT", djt ? fmt.price(djt.price) : "—",
      djt ? `${(djt.change ?? 0) >= 0 ? "▲" : "▼"} ${fmt.pct(djt.changePercent)} aujourd'hui` : "indisponible",
      djt ? ((djt.change ?? 0) >= 0 ? "green" : "red") : "")}
    ${kpi("Transactions", fmt.int(t.transactions), "déclarées (échantillon)")}
    ${kpi("Total achats", fmt.money(t.estBuyValue), t.buys + " opérations", "green")}
    ${kpi("Total ventes", fmt.money(t.estSellValue), t.sells + " opérations", "red")}`;

  document.getElementById("ov-latest").innerHTML = tr.trades.slice(0, 6).map((x) => {
    const verb = x.type === "buy" ? "Achat" : "Vente";
    const ic = x.type === "buy" ? "🟢" : "🔴";
    return `<div class="feed-item"><div class="fi-ic">${ic}</div><div class="fi-body">` +
      `<strong>${verb} ${x.ticker} — ${x.company}</strong>` +
      `<small>${fmt.range(x.amountMin, x.amountMax)} · ${fmt.date(x.date)}</small></div></div>`;
  }).join("");

  Charts.doughnut("chart-ov-sector", stats.bySector, fmt.money);
  if (djt && djt.series) Charts.djtLine("chart-ov-djt", djt.series, (djt.change ?? 0) >= 0, false);
}

// ---------------- Santé serveur ----------------
async function checkHealth() {
  const dot = document.getElementById("live-dot");
  const ok = await API.health();
  dot.classList.toggle("ok", ok);
  dot.classList.toggle("err", !ok);
  dot.title = ok ? "Serveur connecté" : "Serveur injoignable";
}

// ---------------- Méta / source ----------------
async function loadMeta() {
  try {
    const m = await API.meta();
    document.getElementById("data-source").innerHTML =
      `<strong>${m.person}</strong><br>Source : ${m.source.split("—")[0].trim()}<br>` +
      `Période : ${m.period}<br><a href="${m.sourceUrl}" target="_blank" rel="noopener">Voir les déclarations OGE ↗</a>`;
    const note = document.getElementById("stats-note");
    if (note) note.innerHTML =
      `⚠️ ${m.note} Total déclaré sur la période : <strong>${fmt.int(m.disclosedTotalTransactions)}+ transactions</strong> ` +
      `(valeur ${fmt.money(m.disclosedValueRangeUsd.min)} – ${fmt.money(m.disclosedValueRangeUsd.max)}).`;
  } catch {
    document.getElementById("data-source").textContent = "Source indisponible.";
  }
}

async function ensureStats() {
  if (!state.stats) state.stats = await API.stats();
  return state.stats;
}

// ---------------- Vue : Transactions ----------------
async function loadTransactions() {
  const stats = await ensureStats();
  renderTxKPIs(stats.totals);
  if (!state.sectorsLoaded) populateSectors(stats.bySector);
  await renderTable();
}

function renderTxKPIs(t) {
  document.getElementById("tx-kpis").innerHTML = `
    ${kpi("Transactions", fmt.int(t.transactions), "déclarées (échantillon)")}
    ${kpi("Achats", fmt.int(t.buys), fmt.money(t.estBuyValue) + " estimés", "green")}
    ${kpi("Ventes", fmt.int(t.sells), fmt.money(t.estSellValue) + " estimés", "red")}
    ${kpi("Flux net estimé", fmt.money(t.estNetValue), "achats − ventes", t.estNetValue >= 0 ? "green" : "red")}`;
}

function kpi(label, value, sub = "", cls = "") {
  return `<div class="kpi"><div class="k-label">${label}</div><div class="k-value ${cls}">${value}</div><div class="k-sub">${sub}</div></div>`;
}

function populateSectors(bySector) {
  const sel = document.getElementById("filter-sector");
  bySector.forEach((s) => {
    const o = document.createElement("option");
    o.value = o.textContent = s.label;
    sel.appendChild(o);
  });
  state.sectorsLoaded = true;
}

async function renderTable() {
  const params = {
    q: document.getElementById("search").value.trim(),
    type: document.getElementById("filter-type").value,
    sector: document.getElementById("filter-sector").value,
  };
  const { trades } = await API.trades(params);
  state.lastTrades = trades;
  applySortAndRender();
}

function applySortAndRender() {
  const { key, dir } = state.sort;
  const trades = [...state.lastTrades].sort((a, b) => {
    const va = a[key], vb = b[key];
    if (typeof va === "string") return va.localeCompare(vb, "fr") * dir;
    return (va - vb) * dir;
  });
  const body = document.getElementById("tx-body");
  document.getElementById("tx-empty").classList.toggle("hidden", trades.length > 0);
  body.innerHTML = trades.map((t) => `
    <tr>
      <td>${fmt.date(t.date)}</td>
      <td>${t.company}</td>
      <td><span class="ticker-pill">${t.ticker}</span></td>
      <td><span class="tag ${t.type}">${t.type === "buy" ? "Achat" : "Vente"}</span></td>
      <td>${t.sector}</td>
      <td class="num">${fmt.range(t.amountMin, t.amountMax)}</td>
    </tr>`).join("");
  document.querySelectorAll("#tx-table th.sortable").forEach((th) => {
    th.classList.remove("sorted-asc", "sorted-desc");
    if (th.dataset.sort === key) th.classList.add(dir === 1 ? "sorted-asc" : "sorted-desc");
  });
}

function exportCSV() {
  const rows = state.lastTrades;
  if (!rows.length) { showToast("Export", "Aucune transaction à exporter.", "⚠️"); return; }
  const header = ["Date", "Société", "Ticker", "Type", "Secteur", "Montant min ($)", "Montant max ($)"];
  const lines = [header.join(";")];
  for (const t of rows) {
    lines.push([t.date, `"${t.company}"`, t.ticker, t.type === "buy" ? "Achat" : "Vente", t.sector, t.amountMin, t.amountMax].join(";"));
  }
  const csv = "﻿" + lines.join("\r\n"); // BOM + CRLF => Excel FR friendly
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = "trump-transactions.csv";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  showToast("Export réussi", `${rows.length} transactions exportées en CSV.`, "⬇");
}

// ---------------- Vue : Statistiques ----------------
async function loadStats() {
  const s = await ensureStats();
  document.getElementById("stats-kpis").innerHTML = `
    ${kpi("Secteurs", s.bySector.length, "représentés")}
    ${kpi("Société la plus échangée", s.countByTicker[0]?.label || "—", (s.countByTicker[0]?.value || 0) + " transactions", "gold")}
    ${kpi("Plus gros poste", s.byTicker[0]?.label || "—", fmt.money(s.byTicker[0]?.value || 0) + " estimés", "gold")}
    ${kpi("Valeur totale estimée", fmt.money(s.totals.estBuyValue + s.totals.estSellValue), "tous mouvements")}`;
  Charts.doughnut("chart-sector", s.bySector, fmt.money);
  Charts.doughnut("chart-asset", s.byAssetType.map((r) => ({ label: assetLabel(r.label), value: r.value })), fmt.money);
  Charts.barH("chart-ticker", s.byTicker, fmt.money);
  Charts.monthGrouped("chart-month", s.byMonth, fmt.money);
}

function assetLabel(a) { return { stock: "Actions", etf: "ETF / Fonds", bond: "Obligations", crypto: "Crypto" }[a] || a; }

// ---------------- Vue : DJT ----------------
async function loadDJT(range) {
  state.djtRange = range;
  document.querySelectorAll("#djt-ranges button").forEach((b) => b.classList.toggle("active", b.dataset.range === range));
  const priceEl = document.getElementById("djt-price");
  priceEl.textContent = "Chargement…";
  try {
    const d = await API.djt(range);
    const up = (d.change ?? 0) >= 0;
    priceEl.textContent = fmt.price(d.price);
    const chEl = document.getElementById("djt-change");
    chEl.textContent = `${up ? "▲" : "▼"} ${fmt.price(Math.abs(d.change))}  (${fmt.pct(d.changePercent)})`;
    chEl.className = "djt-change " + (up ? "up" : "down");
    document.getElementById("djt-meta").innerHTML =
      `${d.exchange} · ${d.currency} · ${d.marketState === "REGULAR" ? "🟢 Marché ouvert" : "Marché fermé"}<br>Dernière mise à jour : ${fmt.dateTime(d.time)}`;
    document.getElementById("djt-stats").innerHTML = [
      ["Ouverture", fmt.price(d.open)],
      ["Clôture préc.", fmt.price(d.previousClose)],
      ["Plus haut (jour)", fmt.price(d.dayHigh)],
      ["Plus bas (jour)", fmt.price(d.dayLow)],
      ["Plus haut 52 sem.", fmt.price(d.fiftyTwoWeekHigh)],
      ["Plus bas 52 sem.", fmt.price(d.fiftyTwoWeekLow)],
      ["Volume", fmt.int(d.volume)],
      ["Symbole", d.symbol],
    ].map(([k, v]) => `<div class="djt-stat"><span>${k}</span><span>${v}</span></div>`).join("");
    if (state.compareMode) {
      try {
        const cmp = await API.compare(range);
        Charts.compareLine("chart-djt", cmp.djt, cmp.spx);
      } catch {
        Charts.djtLine("chart-djt", d.series, up, range === "5d");
      }
    } else {
      Charts.djtLine("chart-djt", d.series, up, range === "5d");
    }
  } catch (e) {
    priceEl.textContent = "Indisponible";
    document.getElementById("djt-change").textContent = "";
    document.getElementById("djt-meta").textContent = "Impossible de joindre Yahoo Finance (vérifie ta connexion / proxy).";
  }
}

// ---------------- Démarrage ----------------
function boot() {
  document.querySelectorAll(".nav-item").forEach((b) => b.addEventListener("click", () => switchView(b.dataset.view)));
  document.getElementById("refresh-btn").addEventListener("click", async () => {
    state.stats = null;
    await checkHealth();
    loadView(state.current);
    showToast("Rafraîchi", "Données rechargées.", "⟳");
  });
  // filtres transactions
  ["search", "filter-type", "filter-sector"].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener(id === "search" ? "input" : "change", () => renderTable());
  });
  // export CSV
  document.getElementById("export-csv").addEventListener("click", exportCSV);
  // tri des colonnes
  document.querySelectorAll("#tx-table th.sortable").forEach((th) =>
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (state.sort.key === key) state.sort.dir *= -1;
      else state.sort = { key, dir: key === "date" || key === "estValue" ? -1 : 1 };
      applySortAndRender();
    }));
  // boutons de plage DJT
  document.querySelectorAll("#djt-ranges button").forEach((b) =>
    b.addEventListener("click", () => loadDJT(b.dataset.range)));
  // comparaison S&P 500
  document.getElementById("djt-compare-btn").addEventListener("click", () => {
    state.compareMode = !state.compareMode;
    const btn = document.getElementById("djt-compare-btn");
    btn.classList.toggle("on", state.compareMode);
    btn.innerHTML = state.compareMode ? "💹 Cours DJT" : "⚖️ Comparer au S&P 500";
    loadDJT(state.djtRange);
  });

  checkHealth();
  loadMeta();
  Alerts.initUI();
  loadOverview();
  manageDjtAutoRefresh("overview");
}

document.addEventListener("DOMContentLoaded", boot);
