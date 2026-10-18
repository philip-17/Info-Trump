# 📈 Trump Bourse Tracker

Tableau de bord web pour suivre **les transactions boursières déclarées de Donald Trump** et **l'action DJT** (Trump Media & Technology Group), avec graphiques et alertes.

## Lancer l'application

Dans un terminal, depuis ce dossier :

```bash
npm start
```

Puis ouvre **http://localhost:5180** dans ton navigateur.

> Le flag `--use-system-ca` (déjà dans `npm start`) permet de traverser un proxy/antivirus qui intercepte le TLS. Aucune installation (`npm install`) n'est nécessaire : le serveur n'utilise **aucune dépendance**.

Pour changer le port : `set PORT=8080 && npm start` (Windows) ou `PORT=8080 npm start`.

## Les menus

| Menu | Contenu |
|------|---------|
| 🏠 **Vue d'ensemble** | Tout en un coup d'œil : cours DJT live, KPIs (transactions, achats, ventes), 6 dernières transactions, mini-graphique secteurs et courbe DJT 6 mois. Rafraîchissement auto. |
| 💼 **Transactions** | Tableau **triable** (clic sur les en-têtes) et filtrable de tous les achats/ventes déclarés. Recherche + filtres par type et secteur. **Export CSV**. |
| 📊 **Statistiques** | KPIs + graphiques : répartition par secteur, type d'actif, top 10 sociétés, achats vs ventes par mois. |
| 💹 **Action DJT** | Cours **en temps réel** via Yahoo Finance, graphique (5J → 5A), plus haut/bas, volume, 52 semaines, et **comparaison de performance vs S&P 500**. Rafraîchissement auto toutes les minutes. |
| 🔔 **Alertes** | Notifications navigateur quand une **nouvelle transaction** est déclarée ou quand **DJT dépasse un seuil** de variation. Vérification automatique configurable. |
| 🗣️ **Posts Trump** | Posts Truth Social résumés par Claude (alimentés par le workflow n8n). |
| 📜 **Décrets** | Décrets (Executive Orders), proclamations et mémorandums signés depuis le 20/01/2025, via l'API officielle du **Federal Register**. |

## D'où viennent les données ?

- **Action DJT** → [Yahoo Finance](https://finance.yahoo.com/quote/DJT) (gratuit, temps réel, sans clé). Le serveur fait le relais pour éviter les blocages CORS.
- **Décrets / proclamations / mémorandums** → [API du Federal Register](https://www.federalregister.gov/developers/documentation/api/v1) (officielle, gratuite, sans clé, repérée dans [public-apis](https://github.com/public-apis/public-apis)). Relayée par le serveur, cache 30 min. Les textes paraissent quelques jours après leur signature.
- **Transactions de Trump** → déclarations officielles **OGE (formulaire 278-T)**. ⚠️ Il n'existe **aucune API gratuite temps réel** pour les trades du Président (les API de trading politique ne couvrent que le Congrès). Les montants sont déclarés **par fourchettes**, et les comptes sont décrits comme gérés par des tiers en gestion discrétionnaire.

### Mettre à jour les transactions

Édite simplement le fichier **`data/trump-trades.json`** : chaque ligne est une transaction. Quand une nouvelle déclaration OGE paraît, ajoute les lignes correspondantes. Format :

```json
{ "id": "t040", "date": "2026-06-01", "ticker": "AAPL", "company": "Apple Inc.",
  "type": "buy", "assetType": "stock", "sector": "Technologie",
  "amountMin": 250001, "amountMax": 500000, "filing": "OGE 278-T" }
```

`type` : `buy` ou `sell` · `assetType` : `stock`, `etf`, `bond`, `crypto`.

### Brancher une source live (optionnel)

Pour des données automatiquement à jour, tu peux t'abonner à l'API **Quiver Quantitative** (payante, ~25 $/mois) et remplacer la lecture de `data/trump-trades.json` dans `handleTrades()` (fichier `server.js`) par un appel à leur endpoint.

Autre piste repérée dans [public-apis](https://github.com/public-apis/public-apis) : **Disclosed Capitol** (déclarations STOCK Act + **OGE** de l'exécutif, clé API requise).

## Architecture

```
trump-bourse-tracker/
├── server.js              # serveur Node sans dépendance (statique + API + proxy Yahoo)
├── data/
│   ├── trump-trades.json  # transactions déclarées (modifiable à la main)
│   └── meta.json          # infos sur la source des données
└── public/
    ├── index.html         # interface (7 menus)
    ├── css/styles.css
    ├── js/                # api.js · charts.js · alerts.js · app.js
    └── vendor/            # chart.umd.min.js (Chart.js, embarqué)
```

## Avertissement

Outil informatif/éducatif. Les données sur les transactions sont des **fourchettes déclarées** (pas des montants exacts), reprises des dépôts publics OGE. Ne constitue pas un conseil en investissement.
