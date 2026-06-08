---
description: Vérifie s'il existe une nouvelle déclaration boursière de Trump (OGE 278-T) et met à jour l'app trump-bourse-tracker.
---

Tu mets à jour les données de l'application **`trump-bourse-tracker`**. Sois RIGOUREUX : ne jamais inventer de transaction. Procède étape par étape.

> Les chemins ci-dessous supposent que tu es à la racine du dépôt `trump-bourse-tracker`. Si tu es dans le dossier parent, préfixe par `trump-bourse-tracker/`.

## 1. État actuel
Exécute `node tools/state.mjs`. Note `latest` (date de la transaction la plus récente déjà enregistrée) et `lastFiling`.

## 2. Chercher une nouvelle déclaration
Cherche s'il existe une déclaration **278-T de Donald Trump plus récente** que ce qu'on a déjà :
- Recherche web : `Trump OGE 278-T periodic transaction report` avec la date la plus récente.
- Référence d'autorité (lien officiel) : collection OGE Président/VP — https://www.oge.gov/web/OGE.nsf/Officials%20Individual%20Disclosures%20Search%20Collection

> ⚠️ **Important** : les PDF officiels OGE sont **scannés** et NE sont PAS lisibles automatiquement (ni WebFetch ni Read sans OCR). Pour obtenir les chiffres des transactions, lis plutôt une **source déjà parsée** : un tracker (Quiver, Capitol Trades) ou un article fiable qui **liste les transactions avec leurs fourchettes de montant**. Garde le lien OGE comme `--source` (autorité).

## 3. Si RIEN de nouveau
Écris une seule ligne : `✅ Déjà à jour (dernière déclaration : <date>)` puis ARRÊTE-toi. **Ne modifie aucun fichier.**

## 4. Si une NOUVELLE déclaration existe
1. Ouvre une **source parsée** (tracker / article) qui détaille les transactions de cette déclaration.
2. Extrais FIDÈLEMENT les nouvelles transactions notables : `date`, `ticker`, `company`, `type` (achat/vente), `assetType`, `sector`, fourchette de montant OGE (`amountMin`/`amountMax`). **Si une information manque (surtout la fourchette de montant), n'ajoute pas la ligne.**
3. Écris-les dans `tools/_new.json`, par ex. :
   ```json
   [{ "date": "2026-05-04", "ticker": "AAPL", "company": "Apple Inc.", "type": "buy", "assetType": "stock", "sector": "Technologie", "amountMin": 250001, "amountMax": 500000 }]
   ```
   Valeurs autorisées : `type` = `buy` | `sell` ; `assetType` = `stock` | `etf` | `bond` | `crypto`.
   Secteurs existants : Technologie, Semi-conducteurs, Communication, Consommation, Finance, Crypto, Obligations, Fonds indiciel.
4. Lance :
   ```
   node tools/append-trades.mjs tools/_new.json --filing "OGE 278-T <date>" --source "<URL>"
   ```
   (le script valide, dé-doublonne et met à jour `data/` automatiquement.)
5. Supprime `tools/_new.json`.

## 5. Publier (seulement si l'app est déployée)
Si `git remote` renvoie un remote, publie pour que Render redéploie :
```
git add -A && git commit -m "Mise à jour des trades (<date>)" && git push
```
Sinon, ignore cette étape (mise à jour locale seulement).

## 6. Résumé
Indique combien de transactions ont été ajoutées et la nouvelle date de dernière déclaration.

> **Règle d'or :** en cas de doute sur une donnée, NE L'AJOUTE PAS. Mieux vaut rater une ligne que d'inventer un chiffre.
