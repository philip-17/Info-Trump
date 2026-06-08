// Construction des graphiques via Chart.js (chargé depuis /vendor).
const PALETTE = ["#4f8cff", "#2ecc71", "#f5b942", "#ff5c5c", "#a78bfa", "#22d3ee", "#fb923c", "#f472b6", "#34d399", "#94a3b8"];
const charts = {}; // instances vivantes, pour les détruire avant reconstruction

if (window.Chart) {
  Chart.defaults.color = "#8a97ad";
  Chart.defaults.font.family = "Segoe UI, system-ui, sans-serif";
  Chart.defaults.borderColor = "rgba(36,48,68,.6)";
}

function rebuild(id, config) {
  if (!window.Chart) return;
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id);
  if (ctx) charts[id] = new Chart(ctx, config);
}

const Charts = {
  doughnut(id, rows, valueFmt) {
    rebuild(id, {
      type: "doughnut",
      data: {
        labels: rows.map((r) => r.label),
        datasets: [{ data: rows.map((r) => r.value), backgroundColor: PALETTE, borderWidth: 2, borderColor: "#151c2c" }],
      },
      options: {
        responsive: true, cutout: "62%",
        plugins: {
          legend: { position: "right", labels: { boxWidth: 12, padding: 12 } },
          tooltip: { callbacks: { label: (c) => ` ${c.label}: ${valueFmt(c.raw)}` } },
        },
      },
    });
  },

  barH(id, rows, valueFmt) {
    rebuild(id, {
      type: "bar",
      data: {
        labels: rows.map((r) => r.label),
        datasets: [{ data: rows.map((r) => r.value), backgroundColor: "#4f8cff", borderRadius: 6 }],
      },
      options: {
        indexAxis: "y", responsive: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => " " + valueFmt(c.raw) } } },
        scales: { x: { ticks: { callback: (v) => valueFmt(v) } } },
      },
    });
  },

  monthGrouped(id, rows, valueFmt) {
    rebuild(id, {
      type: "bar",
      data: {
        labels: rows.map((r) => r.month),
        datasets: [
          { label: "Achats", data: rows.map((r) => r.buy), backgroundColor: "#2ecc71", borderRadius: 5 },
          { label: "Ventes", data: rows.map((r) => r.sell), backgroundColor: "#ff5c5c", borderRadius: 5 },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "top" }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${valueFmt(c.raw)}` } } },
        scales: { y: { ticks: { callback: (v) => valueFmt(v) } } },
      },
    });
  },

  djtLine(id, series, up, intraday) {
    const color = up ? "#2ecc71" : "#ff5c5c";
    const ctx = document.getElementById(id);
    let grad = color;
    if (ctx && ctx.getContext) {
      const g = ctx.getContext("2d").createLinearGradient(0, 0, 0, 300);
      g.addColorStop(0, up ? "rgba(46,204,113,.28)" : "rgba(255,92,92,.28)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      grad = g;
    }
    // labels lisibles (pas de scale "time" => pas besoin d'adaptateur de date)
    const labelFor = (iso) => {
      const d = new Date(iso);
      return intraday
        ? d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
    };
    rebuild(id, {
      type: "line",
      data: {
        labels: series.map((p) => labelFor(p.t)),
        datasets: [{
          data: series.map((p) => p.c),
          borderColor: color, backgroundColor: grad, fill: true,
          borderWidth: 2, pointRadius: 0, tension: 0.25,
        }],
      },
      options: {
        responsive: true, interaction: { intersect: false, mode: "index" },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => " " + fmt.price(c.raw) } } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, autoSkip: true, maxRotation: 0 } },
          y: { ticks: { callback: (v) => v + " $" } },
        },
      },
    });
  },

  // Comparaison de performance normalisée (% depuis le début) : DJT vs S&P 500.
  compareLine(id, djt, spx) {
    const labelFor = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
    rebuild(id, {
      type: "line",
      data: {
        labels: djt.map((p) => labelFor(p.t)),
        datasets: [
          { label: "DJT (Trump Media)", data: djt.map((p) => p.v), borderColor: "#4f8cff", backgroundColor: "transparent", borderWidth: 2, pointRadius: 0, tension: 0.2 },
          { label: "S&P 500", data: spx.map((p) => p.v), borderColor: "#f5b942", backgroundColor: "transparent", borderWidth: 2, pointRadius: 0, borderDash: [5, 4], tension: 0.2 },
        ],
      },
      options: {
        responsive: true, interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: { position: "top" },
          tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt.pct(c.raw)}` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, autoSkip: true, maxRotation: 0 } },
          y: { ticks: { callback: (v) => (v > 0 ? "+" : "") + v.toFixed(0) + " %" } },
        },
      },
    });
  },
};
