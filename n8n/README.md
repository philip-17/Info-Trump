# 🔁 Workflows n8n

Automatisations prêtes à importer dans n8n (cron 24/7, sans PC allumé si ton n8n est hébergé).

## `djt-alerte.json` — Alerte cours DJT 24/7

Surveille l'action **DJT** et envoie une notification quand le cours varie au-delà d'un seuil.

**Flux :** `Toutes les 30 min` → `Cours DJT (Yahoo)` → `Calcul variation` → `Seuil dépassé ?` → `Notifier`.

### Importer
1. Dans n8n : **menu (•••) → Import from File** → choisis `djt-alerte.json`.
   *(ou Workflows → Import from URL avec le lien GitHub brut du fichier.)*

### Configurer (2 choses)
1. **Le seuil** : ouvre le nœud **« Calcul variation »** → change `const THRESHOLD = 5;` (en %).
2. **La notification** : ouvre le nœud **« Notifier »** → remplace l'URL `https://REMPLACE-PAR-TON-WEBHOOK` :
   - **Discord** : crée un webhook dans un salon (Paramètres du salon → Intégrations → Webhooks → Copier l'URL). Le corps `{ "content": ... }` est déjà bon.
   - **Slack** : colle l'URL du webhook entrant, et dans le nœud Code remplace la clé `content` par `text`.
   - **Telegram / Email** : remplace carrément le nœud « Notifier » par le nœud **Telegram** ou **Send Email** de n8n (ils demanderont des identifiants).

### Activer
Bascule le workflow sur **Active** (en haut à droite). C'est tout — il tourne en continu.

> 💡 Astuce : la bourse US n'est ouverte qu'en journée (≈ 15h30–22h Paris). Tu peux affiner le `Schedule Trigger` pour ne pinger qu'aux heures d'ouverture si tu veux économiser des exécutions.

---

## À venir (dis-moi si tu les veux)
- **Veille des déclarations OGE** (notif quand Trump publie une nouvelle déclaration).
- **Keep-alive Render** (ping l'app déployée toutes les 5 min).
- **Pipeline complet** (récupère → Claude API extrait → commit GitHub → redéploie).
