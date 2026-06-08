# 📋 HANDOFF — reprendre ce projet sur une autre machine (ex. Mac)

Ce fichier résume **tout** le projet pour qu'une nouvelle session Claude Code reprenne **sans repartir de zéro**. Ouvre simplement ce dossier avec Claude Code sur ton Mac : ce fichier + le code donnent tout le contexte.

## Le projet
`trump-bourse-tracker` — application web (serveur Node **sans dépendance**) pour suivre :
- les **transactions boursières déclarées de Donald Trump** (déclarations officielles OGE 278-T) ;
- l'**action DJT** (Trump Media & Technology) en temps réel.

## Démarrer
```bash
npm start          # = node --use-system-ca server.js  → http://localhost:5180
```
- Le flag `--use-system-ca` sert au **proxy/antivirus TLS du PC Windows**. Sur **Mac** : `node server.js` suffit (ou Node ≥ 22 pour utiliser `npm start` tel quel).

## Architecture
| Élément | Rôle |
|--------|------|
| `server.js` | Serveur Node : sert le front + API + **proxy Yahoo Finance** (DJT). Zéro dépendance. |
| `public/` | Front : `index.html`, `css/`, `js/` (api, charts, alerts, app), `vendor/chart.umd.min.js`. |
| `data/trump-trades.json` | Les transactions (39 — échantillon de la déclaration OGE T1 2026). |
| `data/meta.json` | Métadonnées / source / dernière mise à jour. |
| `tools/state.mjs` | Affiche l'état actuel des données. |
| `tools/append-trades.mjs` | Ajoute de nouvelles transactions **en sécurité** (validation, anti-doublon). |
| `.claude/commands/maj-trump.md` | Commande **`/maj-trump`** : cherche une nouvelle déclaration et met à jour. |

**5 menus** : Vue d'ensemble · Transactions (triable + export CSV) · Statistiques · Action DJT (+ comparaison S&P 500) · Alertes.

## Sources de données (point clé)
- **DJT** = Yahoo Finance (gratuit, temps réel, relayé par le serveur → pas de souci CORS). ✅ Vraiment continu.
- **Trades de Trump** = **aucune API gratuite temps réel** (les API politiques ne couvrent que le Congrès, pas le Président). Source = déclarations OGE, publiées **par à-coups**. ⚠️ Les PDF OGE sont **scannés** (non parsables automatiquement) → pour mettre à jour, lire une **source déjà parsée** (Quiver, Capitol Trades, article fiable).

## Automatisation des mises à jour
- Manuel : `/maj-trump`
- Boucle locale (PC allumé) : `/loop 12h /maj-trump`
- **Vrai 24/7 sans PC** → **Routine cloud** : `/schedule` (Claude Code, nécessite abonnement Pro/Max + auth claude.ai).

## Déploiement (mise en ligne 24/7)
- Prêt : `render.yaml`, `Procfile`, guide complet dans **`DEPLOY.md`**.
- **État actuel** : dépôt git initialisé + commité **localement**, PAS encore poussé sur GitHub.
- **À faire** : créer un dépôt GitHub `trump-bourse-tracker` (compte `philip-17`) → `git push` → déployer sur **Render** (Blueprint). Tout est détaillé dans `DEPLOY.md`.

## Prochaines étapes possibles
1. **Pousser sur GitHub + déployer sur Render** → URL publique accessible PC + mobile (le cloud = indépendant de la machine).
2. Convertir le `/loop` local en **Routine cloud** (`/schedule`) pour du 24/7 sans PC allumé.
3. Faire un vrai run `/maj-trump` pour intégrer les transactions d'**avril 2026** (déclaration du 20/04/2026 déjà repérée, plus récente que nos données qui s'arrêtent au 19/03).

## Contraintes de la machine Windows actuelle
- Proxy/antivirus TLS → pour Node : `--use-system-ca` ; pour `uv` : `UV_NATIVE_TLS=1`. (Pas nécessaire sur Mac normalement.)
