# Diagnostic des centres hospitaliers

Évaluation de l'état des centres de santé à l'aide de grilles standardisées, avec collecte hors ligne,
calcul des scores, suivi des actions correctives et tableaux de bord.

| Dossier | Contenu |
|---|---|
| [backend/](backend/) | API REST – Node.js, Express 5, MongoDB (Mongoose), JWT |
| [frontend/](frontend/) | Application web – React, Vite, Mantine, React Router, TanStack Query |

## Prérequis

- Node.js 22 ou plus récent
- MongoDB 7+ en local (ou une URI distante dans `backend/.env`)

## Démarrer en local

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env        # puis adapter si besoin
npm run seed                # données de démonstration (zones, centres, un compte par profil)
npm run dev                 # http://localhost:3000

# 2. Frontend (dans un autre terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

En développement, le front appelle `/api`, que Vite redirige vers le backend (`BACKEND_URL`).

## Comptes de démonstration

Après `npm run seed`, tous les comptes ont le mot de passe **`Demo2026!`** :

| Téléphone | Profil | Périmètre |
|---|---|---|
| +235660000100 | Administrateur | National |
| +235660000101 | Responsable national | National |
| +235660000102 | Coordonnateur | District A |
| +235660000103 | Évaluateur | District A |
| +235660000104 | Superviseur qualité | District A |
| +235660000105 | Responsable de centre | CS Quartier Nord |
| +235660000106 | Partenaire | National |

Le seed publie aussi une grille de démonstration ([backend/donnees/grille-demo.json](backend/donnees/grille-demo.json),
10 domaines aux poids du cahier des charges) ; ce n'est pas la grille officielle, qui s'importe depuis l'écran Grilles.

Le seed est refusé quand `NODE_ENV=production`. Pour créer le premier administrateur d'une base réelle :
`npm run creer-utilisateur -- <nom> <telephone> <motDePasse> [email]`.

## Documentation de l'API (Swagger)

Backend lancé : **http://localhost:3000/api/docs** (ou http://localhost:5173/api/docs via le front).

1. `POST /auth/connexion` → **Try it out** avec un compte de démonstration, copier `accessToken`.
2. Bouton **Authorize** → coller le jeton : toutes les routes sont ensuite testables avec ces droits.

La spécification brute est sur `/api/docs/openapi.json` (import dans Postman / Insomnia, génération de client).
Elle est écrite dans [backend/docs/openapi/](backend/docs/openapi/), un fichier par module ; un test échoue si
une route n'y est pas décrite. Désactivée par défaut en production (`API_DOCS=true` pour l'activer).

## Tests

```bash
cd backend && npm test      # modèles, seed, comptes, droits, référentiel… (MongoDB en mémoire)
cd frontend && npm test     # client API (rafraîchissement du jeton, erreurs)
```

## Configuration

Les variables sont décrites dans [backend/.env.example](backend/.env.example) et [frontend/.env.example](frontend/.env.example).
En production : `JWT_SECRET` est obligatoire, et `CORS_ORIGINES` doit lister le domaine de l'application web
si elle n'est pas servie sur le même domaine que l'API.
