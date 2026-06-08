# 🌐 Mettre l'app en ligne 24h/24 (gratuit)

L'app est prête à être déployée sur **Render** (gratuit). Voici les étapes — compte 10 minutes la première fois.

> Tu auras besoin de créer 2 comptes gratuits : **GitHub** (pour héberger le code) et **Render** (pour l'exécuter). C'est à toi de les créer (mot de passe perso).

---

## Étape 1 — Code sur GitHub ✅ (déjà fait)

Le code est **déjà en ligne** : **https://github.com/philip-17/Info-Trump**

Pour le récupérer sur une autre machine (ex. Mac) :
```bash
git clone https://github.com/philip-17/Info-Trump.git
cd Info-Trump
```

GitHub te demandera de te connecter (une fenêtre s'ouvre dans le navigateur). Accepte.

---

## Étape 2 — Déployer sur Render

1. Va sur **https://render.com** et crée un compte — clique **« Get Started »** et choisis **« Sign in with GitHub »** (le plus simple).
2. Une fois connecté : **New + → Blueprint**.
3. Render liste tes dépôts GitHub → choisis **`Info-Trump`** → **Connect**.
4. Render détecte automatiquement le fichier `render.yaml` et propose le service. Clique **Apply** / **Create**.
5. Patiente 1-2 minutes : Render installe et démarre. Quand c'est vert (**Live**), tu obtiens une URL du type :

   **`https://trump-bourse-tracker.onrender.com`**

   👉 C'est ton app, accessible depuis n'importe quel appareil (PC, téléphone). Mets-la en favori !

### Plan B (si le Blueprint ne se lance pas tout seul)

Crée le service à la main : **New + → Web Service** → choisis ton dépôt → règle :
- **Build Command** : `npm install`
- **Start Command** : `node server.js`
- **Instance Type** : `Free`

…puis **Create Web Service**. Même résultat.

---

## ⏰ Pour un vrai 24h/24 sans coupure (option gratuite)

Sur le plan gratuit de Render, le service **se met en veille après 15 min sans visite** et met ~30 s à se réveiller au prochain accès. Pour le garder éveillé en permanence, gratuitement :

1. Crée un compte sur **https://uptimerobot.com** (gratuit).
2. **Add New Monitor** → type **HTTP(s)** → URL = ton URL Render + `/api/health`
   (ex. `https://trump-bourse-tracker.onrender.com/api/health`).
3. Intervalle : **5 minutes**.

UptimeRobot va « pinger » l'app toutes les 5 min → elle ne s'endort jamais. ✅

---

## 🔄 Mettre à jour l'app plus tard

Quand tu modifies le code (ex. ajouter des transactions dans `data/trump-trades.json`) :

```bash
git add .
git commit -m "Mise à jour des transactions"
git push
```

Render redéploie **automatiquement** à chaque `push` (grâce à `autoDeploy: true`). 🚀
