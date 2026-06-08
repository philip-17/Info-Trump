// Gestion des alertes : notifications navigateur, seuil DJT, détection de nouvelles transactions.
const Alerts = {
  KEY: "tbt_alerts",
  settings: { threshold: 5, pollMs: 300000 },
  seen: new Set(),
  lastDjtAlertPct: null,
  pollTimer: null,
  initialized: false,

  load() {
    try {
      const s = JSON.parse(localStorage.getItem(this.KEY) || "{}");
      if (s.threshold != null) this.settings.threshold = s.threshold;
      if (s.pollMs != null) this.settings.pollMs = s.pollMs;
      if (Array.isArray(s.seen)) this.seen = new Set(s.seen);
    } catch {}
  },
  save() {
    localStorage.setItem(this.KEY, JSON.stringify({
      threshold: this.settings.threshold,
      pollMs: this.settings.pollMs,
      seen: [...this.seen],
    }));
  },

  notifGranted() { return "Notification" in window && Notification.permission === "granted"; },

  async requestNotif() {
    if (!("Notification" in window)) { showToast("Indisponible", "Ton navigateur ne gère pas les notifications.", "⚠️"); return; }
    const p = await Notification.requestPermission();
    this.refreshToggle();
    if (p === "granted") this.fire("Notifications activées", "Tu seras prévenu des nouvelles transactions et mouvements DJT.", "✅");
  },

  refreshToggle() {
    const btn = document.getElementById("notif-toggle");
    if (!btn) return;
    if (this.notifGranted()) { btn.textContent = "Activées ✓"; btn.classList.add("on"); }
    else { btn.textContent = "Activer"; btn.classList.remove("on"); }
  },

  // Émet une alerte : notification navigateur (si autorisée) + toast + entrée dans le flux.
  fire(title, msg, icon = "🔔") {
    showToast(title, msg, icon);
    this.addFeed(icon, title, msg);
    if (this.notifGranted()) {
      try { new Notification(title, { body: msg, silent: false }); } catch {}
    }
  },

  addFeed(icon, title, msg) {
    const feed = document.getElementById("alerts-feed");
    if (!feed) return;
    const placeholder = feed.querySelector(".empty");
    if (placeholder) placeholder.remove();
    const el = document.createElement("div");
    el.className = "feed-item";
    el.innerHTML = `<div class="fi-ic">${icon}</div><div class="fi-body"><strong>${title}</strong><small>${msg} · ${fmt.dateTime(new Date().toISOString())}</small></div>`;
    feed.prepend(el);
    while (feed.children.length > 30) feed.lastChild.remove();
  },

  // Première initialisation : on remplit le flux avec les transactions récentes sans alerter.
  async seedFeed() {
    const { trades } = await API.trades();
    const feed = document.getElementById("alerts-feed");
    const firstRun = this.seen.size === 0;
    trades.forEach((t) => this.seen.add(t.id));
    this.save();
    if (feed) feed.innerHTML = "";
    trades.slice(0, 6).forEach((t) => {
      const verb = t.type === "buy" ? "Achat" : "Vente";
      this.addFeed(t.type === "buy" ? "🟢" : "🔴", `${verb} ${t.ticker}`,
        `${t.company} — ${fmt.range(t.amountMin, t.amountMax)} · ${fmt.date(t.date)}`);
    });
    if (firstRun) this.addFeed("ℹ️", "Suivi démarré", `${trades.length} transactions chargées. Les prochaines déclarations déclencheront une alerte.`);
  },

  // Vérifie nouvelles transactions + mouvement DJT.
  async check(manual = false) {
    try {
      const { trades } = await API.trades();
      let news = 0;
      // parcours du plus ancien au plus récent pour un flux cohérent
      for (const t of [...trades].reverse()) {
        if (!this.seen.has(t.id)) {
          this.seen.add(t.id);
          news++;
          const verb = t.type === "buy" ? "Nouvel achat" : "Nouvelle vente";
          this.fire(`${verb} : ${t.ticker}`, `${t.company} — ${fmt.range(t.amountMin, t.amountMax)}`, t.type === "buy" ? "🟢" : "🔴");
        }
      }
      this.save();

      const djt = await API.djt("5d").catch(() => null);
      if (djt && djt.changePercent != null) {
        const pct = djt.changePercent;
        if (Math.abs(pct) >= this.settings.threshold && Math.round(pct) !== this.lastDjtAlertPct) {
          this.lastDjtAlertPct = Math.round(pct);
          this.fire("Mouvement DJT", `L'action DJT varie de ${fmt.pct(pct)} (seuil : ${this.settings.threshold} %). Cours : ${fmt.price(djt.price)}`, "💹");
        }
      }
      if (manual && news === 0) showToast("À jour", "Aucune nouvelle transaction détectée.", "✅");
    } catch (e) {
      if (manual) showToast("Erreur", "Vérification impossible.", "⚠️");
    }
  },

  startPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.settings.pollMs > 0) this.pollTimer = setInterval(() => this.check(false), this.settings.pollMs);
  },

  initUI() {
    if (this.initialized) return;
    this.initialized = true;
    this.load();
    this.refreshToggle();

    const thr = document.getElementById("djt-threshold");
    const poll = document.getElementById("poll-interval");
    if (thr) { thr.value = this.settings.threshold; thr.addEventListener("change", () => { this.settings.threshold = parseFloat(thr.value) || 0; this.save(); }); }
    if (poll) { poll.value = String(this.settings.pollMs); poll.addEventListener("change", () => { this.settings.pollMs = parseInt(poll.value, 10); this.save(); this.startPolling(); }); }

    document.getElementById("notif-toggle")?.addEventListener("click", () => this.requestNotif());
    document.getElementById("test-notif")?.addEventListener("click", () =>
      this.fire("Notification de test", "Tout fonctionne ! Voici à quoi ressemblera une alerte.", "🧪"));

    this.seedFeed();
    this.startPolling();
  },
};
