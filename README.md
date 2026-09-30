# 📊 UHQ Analytics Addon

> **Free Addon by [Bloume SAS](https://bloume.fr)**  
> Analyse complète de [UHQ Panel OS](https://github.com/BloumeSAS/UHQ-Panel-OS) : comptes, catégories, pool de proxies, checker, scraper, sécurité — et **quand** vos comptes sont utilisés (heures et jours les plus actifs).

---

## Fonctionnalités

> **Plus de 70 graphiques et une cinquantaine d'indicateurs** : courbes (comparaison avec la période précédente, cumul, chronologie heure par heure), histogrammes, anneaux, classements, cartes de chaleur et barres de santé.

### Panneau d'analyse (admin / support) — 8 sections
| Section | Ce que vous y trouvez |
|---|---|
| **Vue d'ensemble** | Constats & alertes automatiques, 11 indicateurs, trafic par jour, **comparaison avec la période précédente**, trafic cumulé, **chronologie heure par heure (72 h)**, envoyé/reçu, comptes par volume consommé et par taux de quota, mouvement des comptes actifs, créations de comptes, concentration par domaine, **plus fortes hausses / baisses**, classements (comptes, domaines, utilisateurs) |
| **Activité** | **Heure de pointe**, **jour le plus actif**, **fenêtre la plus calme** (idéale pour une maintenance), répartition par heure et par jour de semaine, **carte de chaleur jour × heure**, créneaux les plus chargés, chronologie heure par heure (14 j), comptes actifs par heure, matin / après-midi / soirée / nuit, semaine vs week-end — global, par catégorie ou par compte |
| **Comptes** | Tableau triable/filtrable (recherche, état, catégorie) : trafic, requêtes, domaines, jours actifs, dernière activité, heure de pointe, quota. Détail par compte (tendance, heures/jours, top domaines, erreurs), **export CSV** |
| **Catégories** | Par catégorie : comptes, trafic, part du trafic, proxies amont, latence, heure de pointe, multiplicateur de consommation, quota consommé |
| **Pool de proxies** | Santé (fonctionnels / morts / blacklistés / archivés), rendement par fournisseur, protocoles, pays, répartition des latences, ancienneté des tests, meilleurs et pires proxies, proxies en cours d'utilisation |
| **Checker** | État en direct, historique des cycles (durée, testés, vivants), santé du pool dans le temps |
| **Scraper** | Rendement et état de chaque source (échecs, dernier succès, proxies utilisables), historique des cycles (collectés, uniques, doublons) |
| **Sécurité** | IP bannies (auto / manuelles), erreurs côté cible (403, captcha, géo-blocage), actions d'administration, sessions, clés API |

### Page « Mon activité » (tout utilisateur)
Pour **ses propres comptes** uniquement : consommation, quota, heures et jours où il utilise le plus ses proxies, carte de chaleur, sites les plus utilisés.

### Widget Dashboard
Trafic du jour, connexions en direct et heure de pointe sur 7 jours.

### Et aussi
- 🔎 **Constats automatiques** : tendance, concentration sur quelques comptes, pics anormaux, quotas proches, catégorie sans proxy fonctionnel, checker/scraper bloqués, bannissements en hausse…
- 🕒 **Fuseau du navigateur** : les heures et jours sont calculés dans votre fuseau horaire.
- 🌍 Français et anglais, thème clair/sombre et couleurs personnalisées du panel repris automatiquement.
- 🪶 Sans base de données ni dépendance de graphiques (SVG natif) : l'addon est **sans état**.

---

## Prérequis

| Outil | Version minimale |
|---|---|
| Node.js | 20+ |
| UHQ Panel OS | **2.4.72+** |

> Les statistiques sont calculées **par le panel** (`/api/panel/analytics/*`, lecture seule, réservé ADMIN/SUPPORT). Le panel enregistre depuis la 2.4.72 l'historique **horaire** de consommation et l'historique des cycles checker/scraper : les heures de pointe apparaissent donc au fil de l'activité (les jours de la semaine et la tendance journalière couvrent déjà tout l'historique).

---

## Installation rapide

```bash
git clone https://github.com/BloumeSAS/UHQ-Addon-Analytics
cd UHQ-Addon-Analytics
npm run install:all
cp .env.example .env     # ajuster PANEL_URL
npm run build && npm start
```

Connecter dans le panel : `http://localhost:3001`

> Embarqué dans l'image du panel, l'addon s'active en 1 clic : **Extensions → Analytics → Activer**.

---

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3001` | Port d'écoute |
| `PANEL_URL` | `http://localhost:8000` | URL du panel |
| `CACHE_TTL_SECONDS` | `20` | Cache mémoire des réponses du panel (par utilisateur) |

---

## Sécurité

- Aucune donnée n'est stockée par l'addon : chaque appel relaie l'API du panel **avec le JWT de l'utilisateur**, et c'est le panel qui applique les rôles.
- Un utilisateur simple ne peut lire que **ses** comptes (`/api/panel/me/proxies/:id/activity`) ; toute route globale lui renvoie 403.

---

## Développement

```bash
cd api && npm run start:dev     # NestJS :3001
cd web && npm run dev           # Vite   :5174 (proxy /api → :3001)
```

Ouvrir `http://localhost:5174/admin?token=<JWT admin>&lang=fr&theme=dark`.

### Structure

```
api/src/
  stats/        panel-client (relais + cache) · insights (règles d'analyse) · controller
  manifest/     uhq-manifest.json + thème du panel
web/src/
  pages/        Admin (8 sections) · MyActivity
  components/   charts (SVG) · ActivityView · ui
  i18n/         fr · en
uhq-manifest.json
```

---

## Licence

MIT — © Bloume SAS
