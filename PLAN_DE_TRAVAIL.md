# Plan de travail – Application de diagnostic des centres hospitaliers

Ce document liste les API à implémenter, les écrans à réaliser (web et mobile) et l'ordre de réalisation proposé.
Il découle du cahier des charges et du modèle de données (`backend/models/`).

**Légende :** ✅ fait · 🟡 en partie · ⬜ à faire

---

## 1. État actuel

| Élément | État |
|---|---|
| Modèles Mongoose (14 collections) | ✅ Tous chargés et validés (`scripts/testModeles.js`) |
| Authentification JWT (connexion, rafraîchissement, déconnexion, mot de passe) | ✅ |
| Gestion des utilisateurs (CRUD) | ✅ |
| Contrôle des droits par rôle et par périmètre | ✅ Backend (`scripts/smokeTestDroits.js`) |
| Affectations et journal d'activité | ✅ Backend |
| Front web | 🟡 Socle prêt (React, Mantine, connexion, accueil, menu par rôle) |
| Seed de démonstration, CORS, fichiers `.env` | ✅ |
| Application mobile | ⬜ |

Tests : `cd backend && npm test` (modèles, seed, utilisateurs, authentification, droits) · `cd frontend && npm test` (client API).
Démarrage : voir [README.md](README.md).

---

## 2. Les API

Toutes les routes sont sous `/api` et exigent un jeton JWT, sauf la connexion.
**Périmètre** = les résultats sont filtrés automatiquement selon les affectations de l'utilisateur (zone ou centre).

### Socle transverse

| Brique | Rôle | État |
|---|---|---|
| `autoriser(...roles)` | Vérifie que l'utilisateur a l'un des rôles, via ses affectations actives | ✅ |
| `filtrePerimetre(affectations)` | Filtre MongoDB réutilisable (`zoneAncetres` / `centre`) pour toutes les listes | ✅ |
| `journaliser(req, { action, entite })` | Trace les actions sensibles dans JournalActivite | ✅ |
| Pagination, tri, filtres | Format commun `?page&limite&tri` | 🟡 (utilisateurs, journal) |

### Module 8 – Utilisateurs, affectations, journal

| Méthode | Route | Qui | État |
|---|---|---|---|
| POST | `/auth/connexion`, `/auth/rafraichir`, `/auth/deconnexion` | Public | ✅ |
| GET | `/auth/moi` (profil + affectations + rôles) | Tous | ✅ |
| PATCH | `/auth/mot-de-passe` | Tous | ✅ |
| GET / POST / PATCH / DELETE | `/utilisateurs`, `/utilisateurs/:id` | Lecture : Admin, Coordonnateur · Écriture : Admin | ✅ |
| PATCH | `/utilisateurs/:id/mot-de-passe` | Admin | ✅ |
| GET / POST | `/utilisateurs/:id/affectations` | Admin, Coordonnateur (son périmètre) | ✅ |
| PATCH / DELETE | `/affectations/:id` | Admin, Coordonnateur (son périmètre) | ✅ |
| GET | `/journal?utilisateur&action&entite&du&au` | Admin | ✅ |

### Module 1 – Référentiel (zones et centres)

| Méthode | Route | Remarque |
|---|---|---|
| GET | `/zones?parent=&niveau=` · `/zones/arbre` | L'arbre sert aux filtres en cascade (région → district) |
| POST / PATCH | `/zones`, `/zones/:id` | Admin. Recalcule `ancetres` de la zone et de toute sa descendance |
| GET | `/centres?zone&niveau&statut&recherche` | Périmètre |
| GET / POST / PATCH | `/centres/:id`, `/centres` | Admin. Remplit `zoneAncetres` automatiquement |
| POST | `/centres/import` (Excel) → rapport par ligne | Admin. Mode « simulation » qui contrôle sans enregistrer |
| GET | `/centres/import/modele` | Modèle Excel vide |

### Module 2 – Grilles

| Méthode | Route | Remarque |
|---|---|---|
| GET | `/grilles?statut&niveau` · `/grilles/:id` | |
| POST | `/grilles` | Admin. Crée un brouillon |
| PUT | `/grilles/:id` | Brouillon uniquement (le modèle refuse déjà toute modification d'une grille publiée) |
| POST | `/grilles/:id/publier` | Contrôle poids = 100 et codes uniques, renseigne `publieeLe` |
| POST | `/grilles/:id/nouvelle-version` | Copie en brouillon, `version + 1` |
| POST | `/grilles/:id/archiver` | |
| GET / POST | `/grilles/:id/export` · `/grilles/import` | Chargement de la grille officielle depuis Excel ou JSON |

### Module 3 – Campagnes et missions

| Méthode | Route | Remarque |
|---|---|---|
| GET / POST / PATCH | `/campagnes`, `/campagnes/:id` | Coordonnateur (périmètre). Grille PUBLIEE obligatoire |
| POST | `/campagnes/:id/demarrer` · `/campagnes/:id/cloturer` | |
| POST | `/campagnes/:id/missions` `{ centres: [...] }` | Crée les missions en masse et les évaluations PLANIFIEE |
| GET | `/campagnes/:id/avancement` | Centres par statut, missions en retard |
| GET / PATCH / DELETE | `/missions/:id` | Évaluateurs, superviseur, date prévue |
| GET | `/missions?campagne&statut&du&au` | Alimente le calendrier |

### Module 4 – Collecte et synchronisation

| Méthode | Route | Remarque |
|---|---|---|
| GET | `/mobile/mes-missions` | Missions + grille complète + fiche centre, en un seul appel |
| GET | `/mobile/grilles/:id` (ETag) | Pas de retéléchargement si la grille n'a pas changé |
| POST | `/sync/evaluations` `[{ clientId, syncVersion, reponses, ... }]` | Envoi par lots. Accepté si `syncVersion` plus récente ; **refusé si l'évaluation est VALIDEE** (la version du superviseur fait foi). Résultat document par document |
| GET | `/sync/evaluations?depuis=<date>` | Renvois A_CORRIGER et commentaires du superviseur |
| POST | `/fichiers/presigne` → URL d'envoi S3/MinIO | La photo part directement vers MinIO |
| POST / GET | `/fichiers` (métadonnées) · `/fichiers/:id/url` | |

### Module 5 – Contrôle et validation

| Méthode | Route | Remarque |
|---|---|---|
| GET | `/evaluations?statut&campagne&centre` | Périmètre. File « à valider » |
| GET | `/evaluations/:id` | Réponses, fichiers, commentaires |
| POST | `/evaluations/:id/soumettre` | Évaluateur. Contrôle critères obligatoires et preuves exigées |
| POST | `/evaluations/:id/renvoyer` `{ motif }` | Superviseur, **qui ne doit pas être évaluateur de la mission** |
| POST | `/evaluations/:id/valider` | Superviseur / Coordonnateur. Calcule les scores, met à jour `Centre.derniereEvaluation` |
| POST | `/evaluations/:id/publier` | Responsable national |
| GET / POST | `/evaluations/:id/commentaires` (avec `critereCode`) | Commentaire sur une réponse précise |
| GET | `/evaluations/:id/historique` | |

### Module 6 – Scores et tableaux de bord

| Méthode | Route | Remarque |
|---|---|---|
| — | `scoreService.calculer(evaluation, grille)` | **Fonction pure, testée à fond** : sans objet exclu, pondération, plafond éliminatoire, classe |
| GET | `/stats/carte?campagne&zone&niveau` | Liste légère : GPS, classe, score |
| GET | `/stats/centres/:id/radar` | 10 domaines vs moyenne du niveau |
| GET | `/stats/centres/:id/evolution` | |
| GET | `/stats/classement?campagne&zone` | |
| GET | `/stats/criteres-non-conformes?top=10` | |
| GET | `/stats/campagnes/:id/avancement` · `/stats/actions/realisation` | |

Objectif : moins de 5 s pour 1 000 centres (collection de statistiques précalculées à la validation si nécessaire).
Le partenaire (bailleur) ne reçoit **que des données agrégées**, sans noms.

### Module 7 – Actions correctives

| Méthode | Route | Remarque |
|---|---|---|
| POST | `/evaluations/:id/actions/generer` | Propose une action par critère non conforme |
| GET / POST / PATCH | `/actions`, `/actions/:id` | Le responsable de centre ne voit que son centre |
| POST | `/actions/:id/preuves` | Fichiers de preuve de réalisation |
| (tâche planifiée) | Relances avant échéance | node-cron, e-mail / notification (SMS au lot 2) |

### Rapports

| Méthode | Route |
|---|---|
| GET | `/rapports/centres/:evaluationId.pdf` |
| GET | `/rapports/campagnes/:id.pdf` |
| GET | `/exports/campagnes/:id.xlsx` (données brutes) |

---

## 3. Les écrans

### Application web (supervision et analyse)

| # | Écran | Profils |
|---|---|---|
| W1 | Connexion, mot de passe oublié, mon profil | Tous |
| W2 | Tableau de bord d'accueil, adapté au rôle | Tous |
| W3 | Utilisateurs : liste, fiche, **affectations** (rôle + périmètre) | Admin |
| W4 | Zones : arborescence modifiable | Admin |
| W5 | Centres : liste filtrée, fiche (infos / évaluations / actions), **import Excel** | Admin, lecture pour les autres |
| W6 | Grilles : versions, **éditeur** (domaines → critères, poids, barème, conditions), aperçu, publier | Admin |
| W7 | Campagnes : liste, création en assistant (grille → zone → centres → équipes) | Coordonnateur |
| W8 | Campagne : avancement, **calendrier des missions**, affectation des équipes | Coordonnateur |
| W9 | File de validation | Superviseur, Coordonnateur |
| W10 | **Revue d'une évaluation** : réponses, photos, GPS, commentaire par réponse, renvoyer / valider, historique | Superviseur |
| W11 | Résultat d'un centre : score, classe, radar, évolution, écarts | Tous (selon périmètre) |
| W12 | **Carte** des centres colorés par classe | Décideur, Coordonnateur, Partenaire |
| W13 | Classement et top 10 des critères non conformes | Décideur, Coordonnateur |
| W14 | Actions correctives : liste / kanban, fiche, preuves | Responsable de centre, Coordonnateur |
| W15 | Rapports et exports | Décideur, Coordonnateur |
| W16 | Journal d'activité | Admin |

### Application mobile (évaluateur, hors ligne)

| # | Écran |
|---|---|
| M1 | Connexion, puis verrouillage par code PIN (base locale chiffrée) |
| M2 | **Mes missions** : téléchargement, état local (non commencée / en cours / à envoyer / renvoyée) |
| M3 | Fiche mission et centre, démarrage de la visite (capture GPS) |
| M4 | Sommaire de l'évaluation : progression par domaine |
| M5 | **Saisie d'un critère** : composant par type de réponse, photo, observation, « sans objet », contrôles |
| M6 | Récapitulatif avant soumission : réponses et preuves manquantes |
| M7 | File de synchronisation : en attente, erreurs, nouvel essai |
| M8 | Corrections demandées : commentaires du superviseur, accès direct aux réponses concernées |

---

## 4. Plan de réalisation

Principe : **une tranche verticale complète par étape** (API → écran → test), plutôt que tout le backend puis tout le front.
Chaque étape se termine par une démonstration qui fonctionne.

| Étape | Contenu | Terminé quand… | État |
|---|---|---|---|
| **0. Fondations** (1 sem.) | Front web : React + Vite + React Router + TanStack Query + bibliothèque UI ; client API avec rafraîchissement automatique du jeton. Seed de démonstration (zones, centres, 1 utilisateur par rôle). Variables d'environnement, CORS. | On se connecte depuis le web et on voit son nom | ✅ |
| **1. Droits** (1 sem.) | `autoriser`, `filtrePerimetre`, `journaliser`, API Affectations, `/auth/moi` avec rôles. Écrans W1, W3, W16 | Test automatisé rôle par rôle ; un coordonnateur du district A ne voit rien du district B | 🟡 Backend fait (42 tests) ; écrans à faire |
| **2. Référentiel** (1–2 sem.) | API Zones et Centres, import Excel. Écrans W4, W5 | Les vrais centres sont importés depuis le fichier du ministère | ⬜ |
| **3. Grilles et scoring** (2 sem.) | API Grilles, import de la grille officielle, **`scoreService` testé** sur les exemples du cahier des charges. Écran W6 | Grille à 10 domaines publiée ; le calcul passe tous les cas de test | ⬜ |
| **4. Planification** (1–2 sem.) | API Campagnes et Missions, création en masse, avancement. Écrans W7, W8 | Campagne pilote de 20 centres avec équipes affectées | ⬜ |
| **5. Collecte en ligne** (2 sem.) | `/mobile/mes-missions`, réponses, soumission, fichiers vers MinIO. Mobile en ligne : M1 à M6 | Un évaluateur remplit une grille complète avec photos sur téléphone | ⬜ |
| **6. Validation** (1–2 sem.) | Soumettre / renvoyer / valider, commentaires, historique, scores à la validation. Écrans W9, W10, W11, M8 | Cycle complet : soumise → à corriger → soumise → validée → publiée | ⬜ |
| **7. Hors ligne et synchronisation** (2–3 sem.) | Base locale chiffrée (SQLite / WatermelonDB), sauvegarde à chaque réponse, file d'envoi, reprise, compression des photos, conflits via `syncVersion`. Écran M7 | En mode avion : évaluation complète, téléphone redémarré au milieu, synchronisée sans perte ni doublon | ⬜ |
| **8. Actions correctives** (1–2 sem.) | Génération depuis les écarts, CRUD, preuves, relances planifiées. Écran W14 | Un responsable de centre clôture une action avec une photo | ⬜ |
| **9. Tableaux de bord** (2 sem.) | API `/stats/*`, statistiques précalculées si besoin. Écrans W2, W12, W13 | Test de charge : 1 000 centres en moins de 5 s ; le partenaire ne voit que des agrégats | ⬜ |
| **10. Rapports** (1–2 sem.) | PDF côté serveur (Puppeteer ou pdfmake), export Excel (exceljs). Écran W15 | Rapport PDF d'un centre validé par le métier | ⬜ |
| **11. Durcissement** (1–2 sem.) | HTTPS, sauvegardes quotidiennes + restauration testée, audit de sécurité, test en 3G, préparation de l'arabe (i18n, droite à gauche) | → **Pilote (phase 3)** | ⬜ |

**Durée estimée : 20 à 24 semaines** pour une à deux personnes, ce qui tient dans la phase 2 du planning de 30 semaines.
À deux, démarrer la partie mobile (étape 5) en parallèle des étapes 2 à 4.

---

## 5. Points d'attention

1. **Le contrat d'API d'abord.** Un fichier OpenAPI (ou au minimum des exemples JSON) avant chaque module, pour que web et mobile avancent avec des données simulées.
2. **Le moteur de score est le cœur du métier.** Fonction pure, sans accès à la base, testée avec les exemples chiffrés du cahier des charges, utilisable par l'API et par le mobile (aperçu).
3. **Tester le hors-ligne tôt sur un vrai téléphone bas de gamme.** C'est le risque n°1 du projet.
4. **Un test automatisé par règle de droits.** Le tableau des profils du cahier des charges se traduit directement en cas de test (ex. « un évaluateur ne valide pas sa propre évaluation »).
5. **Premier compte administrateur :** `node scripts/creerUtilisateur.js <nom> <telephone> <motDePasse> [email]` crée un administrateur national. Les comptes créés avant l'étape 1 n'ont aucune affectation, donc aucun droit.
