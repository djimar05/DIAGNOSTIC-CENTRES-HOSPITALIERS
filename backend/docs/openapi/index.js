const { version } = require('../../package.json');
const composants = require('./composants');

/**
 * Spécification OpenAPI 3 de l'API, assemblée à partir d'un fichier par module.
 * Toute nouvelle route doit être décrite ici : scripts/testDocumentation.js échoue sinon.
 */
const MODULES = ['comptes', 'referentiel', 'grilles', 'planification'].map((m) => require(`./${m}`));

const DESCRIPTION = `
API de l'application de diagnostic des centres hospitaliers (web de supervision et application mobile de collecte).

### Authentification
1. \`POST /auth/connexion\` renvoie un **access token** (JWT, 15 min) et un **refresh token** (30 jours, à usage unique).
2. Envoyer l'access token dans l'en-tête \`Authorization: Bearer <token>\` (bouton **Authorize** ci-dessus).
3. À l'expiration (401), appeler \`POST /auth/rafraichir\` pour obtenir une nouvelle paire. Présenter un refresh token
   déjà utilisé révoque toutes les sessions de l'utilisateur : ne jamais rafraîchir deux fois en parallèle.

Un compte créé ou réinitialisé par l'administrateur a un **mot de passe temporaire** : tant qu'il n'est pas changé
(\`PATCH /auth/mot-de-passe\`), seules les routes \`/auth\` répondent, les autres renvoient 403.

### Droits
Les droits viennent des **affectations** : un rôle sur un périmètre (national, zone avec ses sous-zones, ou un centre).
Les listes sont filtrées automatiquement sur ce périmètre ; un objet hors périmètre répond 404.

### Format des réponses
- Succès : \`{ "success": true, "data": …, "pagination"?: … }\`
- Erreur : \`{ "success": false, "error": { "message": "…", "details"?: ["…"] } }\`

Limitation : 300 requêtes par minute et par adresse IP (429 au-delà).
`;

const fusionner = (cle) => Object.assign({}, ...MODULES.map((m) => m[cle]));

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'API – Diagnostic des centres hospitaliers',
    version,
    description: DESCRIPTION.trim(),
  },
  servers: [{ url: '/api', description: 'Ce serveur' }],
  security: [{ bearerAuth: [] }],
  tags: MODULES.flatMap((m) => m.tags),
  paths: fusionner('paths'),
  components: composants,
};
