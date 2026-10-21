const {
  ref, liste, ok, message, erreurs, corps, parametreId, requete, roles,
} = require('./outils');

const pagination = { pagination: ref('Pagination') };
const public_ = { security: [] };

module.exports = {
  tags: [
    { name: 'Authentification', description: 'Connexion, jetons, profil et mot de passe de l\'utilisateur connecté' },
    { name: 'Utilisateurs', description: 'Comptes (administrateur) et affectations rôle + périmètre' },
    { name: 'Journal', description: 'Trace des actions sensibles' },
  ],
  paths: {
    '/auth/connexion': {
      post: {
        tags: ['Authentification'], operationId: 'connexion', summary: 'Se connecter', ...public_,
        description: 'Par téléphone ou e-mail. Limité à 10 échecs par IP et par 15 minutes (429 ensuite).',
        requestBody: corps({
          type: 'object', required: ['identifiant', 'motDePasse'],
          properties: { identifiant: { type: 'string', description: 'Téléphone ou e-mail' }, motDePasse: { type: 'string', format: 'password' } },
        }, { identifiant: '+235660000100', motDePasse: 'Demo2026!' }),
        responses: {
          200: ok('Connecté', { allOf: [ref('Jetons'), { type: 'object', properties: { utilisateur: ref('Utilisateur') } }] }),
          ...erreurs(400, 401, 403, 429),
        },
      },
    },
    '/auth/rafraichir': {
      post: {
        tags: ['Authentification'], operationId: 'rafraichir', summary: 'Renouveler les jetons', ...public_,
        description: 'Le refresh token est à usage unique : en présenter un déjà utilisé révoque toutes les sessions de l\'utilisateur.',
        requestBody: corps({ type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } }),
        responses: { 200: ok('Nouvelle paire de jetons', ref('Jetons')), ...erreurs(400, 401, 429) },
      },
    },
    '/auth/deconnexion': {
      post: {
        tags: ['Authentification'], operationId: 'deconnexion', summary: 'Se déconnecter (cet appareil)', ...public_,
        requestBody: corps({ type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } }),
        responses: { 200: message('Session fermée', 'Déconnexion effectuée'), ...erreurs(400, 429) },
      },
    },
    '/auth/moi': {
      get: {
        tags: ['Authentification'], operationId: 'moi', summary: 'Mon profil, mes affectations et mes rôles',
        description: 'Accessible même avec un mot de passe temporaire.',
        responses: { 200: ok('Profil', ref('Profil')), ...erreurs(401, 403) },
      },
      patch: {
        tags: ['Authentification'], operationId: 'modifierMoi', summary: 'Modifier mes préférences',
        description: 'Seule la langue est modifiable par l\'utilisateur ; le reste est géré par l\'administrateur.',
        requestBody: corps({ type: 'object', properties: { langue: { type: 'string', enum: ['fr', 'ar'] } } }),
        responses: { 200: ok('Profil à jour', ref('Profil')), ...erreurs(400, 401) },
      },
    },
    '/auth/deconnexion-partout': {
      post: {
        tags: ['Authentification'], operationId: 'deconnexionPartout', summary: 'Fermer toutes mes sessions',
        responses: { 200: message('Sessions fermées', 'Toutes les sessions ont été fermées'), ...erreurs(401) },
      },
    },
    '/auth/mot-de-passe': {
      patch: {
        tags: ['Authentification'], operationId: 'changerMonMotDePasse', summary: 'Changer mon mot de passe',
        description: 'Ferme toutes les sessions (se reconnecter ensuite) et lève l\'indicateur de mot de passe temporaire.',
        requestBody: corps({
          type: 'object', required: ['ancienMotDePasse', 'nouveauMotDePasse'],
          properties: { ancienMotDePasse: { type: 'string', format: 'password' }, nouveauMotDePasse: { type: 'string', format: 'password', minLength: 8 } },
        }),
        responses: { 200: message('Mot de passe changé', 'Mot de passe mis à jour, veuillez vous reconnecter'), ...erreurs(400, 401) },
      },
    },

    '/utilisateurs': {
      get: {
        tags: ['Utilisateurs'], operationId: 'listerUtilisateurs', summary: 'Lister les utilisateurs',
        description: `${roles('ADMINISTRATEUR', 'COORDONNATEUR')} Chaque utilisateur est renvoyé avec ses rôles actifs.`,
        parameters: [
          { $ref: '#/components/parameters/page' },
          requete('limite', '1 à 100', { type: 'integer', default: 20 }),
          requete('recherche', 'Nom, prénom, téléphone ou e-mail (texte littéral)'),
          requete('actif', 'true / false', { type: 'boolean' }),
          requete('role', 'Ayant une affectation active avec ce rôle', ref('Role')),
        ],
        responses: { 200: ok('Page d\'utilisateurs', liste(ref('Utilisateur')), pagination), ...erreurs(401, 403) },
      },
      post: {
        tags: ['Utilisateurs'], operationId: 'creerUtilisateur', summary: 'Créer un compte',
        description: `${roles('ADMINISTRATEUR')} Le mot de passe est temporaire : la personne devra le changer à sa première connexion.`,
        requestBody: corps({
          type: 'object', required: ['nom', 'telephone', 'motDePasse'],
          properties: {
            nom: { type: 'string' }, prenom: { type: 'string' }, telephone: { type: 'string' }, email: { type: 'string', format: 'email' },
            fonction: { type: 'string' }, langue: { type: 'string', enum: ['fr', 'ar'] }, motDePasse: { type: 'string', format: 'password', minLength: 8 },
          },
        }, { nom: 'Haroun', prenom: 'Moussa', telephone: '+235660000107', motDePasse: 'Temporaire1' }),
        responses: { 201: ok('Compte créé', ref('Utilisateur')), ...erreurs(400, 401, 403, 409) },
      },
    },
    '/utilisateurs/{id}': {
      parameters: [parametreId()],
      get: {
        tags: ['Utilisateurs'], operationId: 'obtenirUtilisateur', summary: 'Détail d\'un utilisateur',
        description: roles('ADMINISTRATEUR', 'COORDONNATEUR'),
        responses: { 200: ok('Utilisateur', ref('Utilisateur')), ...erreurs(400, 401, 403, 404) },
      },
      patch: {
        tags: ['Utilisateurs'], operationId: 'modifierUtilisateur', summary: 'Modifier un compte',
        description: `${roles('ADMINISTRATEUR')} \`actif: false\` ferme ses sessions. On ne peut pas se désactiver soi-même.`,
        requestBody: corps({
          type: 'object',
          properties: {
            nom: { type: 'string' }, prenom: { type: 'string' }, telephone: { type: 'string' }, email: { type: 'string' },
            fonction: { type: 'string' }, langue: { type: 'string', enum: ['fr', 'ar'] }, actif: { type: 'boolean' },
          },
        }),
        responses: { 200: ok('Compte à jour', ref('Utilisateur')), ...erreurs(400, 401, 403, 404, 409) },
      },
      delete: {
        tags: ['Utilisateurs'], operationId: 'supprimerUtilisateur', summary: 'Supprimer un compte',
        description: `${roles('ADMINISTRATEUR')} Définitif ; ses affectations sont retirées. Préférer la désactivation.`,
        responses: { 204: { description: 'Supprimé' }, ...erreurs(401, 403, 404) },
      },
    },
    '/utilisateurs/{id}/mot-de-passe': {
      parameters: [parametreId()],
      patch: {
        tags: ['Utilisateurs'], operationId: 'reinitialiserMotDePasse', summary: 'Réinitialiser le mot de passe (oubli)',
        description: `${roles('ADMINISTRATEUR')} Le nouveau mot de passe est temporaire ; les sessions de la personne sont fermées.`,
        requestBody: corps({ type: 'object', required: ['nouveauMotDePasse'], properties: { nouveauMotDePasse: { type: 'string', minLength: 8 } } }),
        responses: { 200: message('Réinitialisé', 'Mot de passe mis à jour'), ...erreurs(400, 401, 403, 404) },
      },
    },
    '/utilisateurs/{id}/affectations': {
      parameters: [parametreId('Identifiant de l\'utilisateur')],
      get: {
        tags: ['Utilisateurs'], operationId: 'listerAffectations', summary: 'Affectations d\'un utilisateur (actives et passées)',
        description: `${roles('ADMINISTRATEUR', 'COORDONNATEUR')} Un coordonnateur ne voit que celles de son périmètre.`,
        responses: { 200: ok('Affectations', liste(ref('Affectation'))), ...erreurs(401, 403, 404) },
      },
      post: {
        tags: ['Utilisateurs'], operationId: 'creerAffectation', summary: 'Donner un rôle sur un périmètre',
        description: `${roles('ADMINISTRATEUR', 'COORDONNATEUR')} Sans zone ni centre = national (admin seulement). `
          + 'Un coordonnateur n\'attribue que EVALUATEUR, SUPERVISEUR ou RESPONSABLE_CENTRE, dans sa zone. '
          + 'Pour un centre sans zone, la zone est déduite du centre.',
        requestBody: corps({
          type: 'object', required: ['role'],
          properties: { role: ref('Role'), zone: ref('ObjectId'), centre: ref('ObjectId'), dateDebut: { type: 'string', format: 'date' }, dateFin: { type: 'string', format: 'date' } },
        }),
        responses: { 201: ok('Affectation créée', ref('Affectation')), ...erreurs(400, 401, 403, 404, 409) },
      },
    },
    '/affectations/{id}': {
      parameters: [parametreId()],
      patch: {
        tags: ['Utilisateurs'], operationId: 'modifierAffectation', summary: 'Modifier le périmètre ou les dates d\'une affectation',
        description: `${roles('ADMINISTRATEUR', 'COORDONNATEUR')} Le rôle n'est pas modifiable (retirer puis recréer).`,
        requestBody: corps({
          type: 'object',
          properties: { zone: ref('ObjectId'), centre: ref('ObjectId'), actif: { type: 'boolean' }, dateDebut: { type: 'string', format: 'date' }, dateFin: { type: 'string', format: 'date' } },
        }),
        responses: { 200: ok('Affectation à jour', ref('Affectation')), ...erreurs(400, 401, 403, 404) },
      },
      delete: {
        tags: ['Utilisateurs'], operationId: 'retirerAffectation', summary: 'Retirer une affectation',
        description: `${roles('ADMINISTRATEUR', 'COORDONNATEUR')} L'affectation est désactivée (pas supprimée) pour garder l'historique des droits.`,
        responses: { 200: ok('Affectation retirée', ref('Affectation')), ...erreurs(401, 403, 404) },
      },
    },

    '/journal': {
      get: {
        tags: ['Journal'], operationId: 'listerJournal', summary: 'Journal d\'activité',
        description: roles('ADMINISTRATEUR'),
        parameters: [
          { $ref: '#/components/parameters/page' },
          requete('limite', '1 à 200', { type: 'integer', default: 50 }),
          requete('utilisateur', 'Auteur', ref('ObjectId')),
          requete('action', 'Ex. CONNEXION, AFFECTATION_CREEE, GRILLE_PUBLIEE…'),
          requete('entite', 'Objet concerné', ref('ObjectId')),
          requete('du', 'À partir de (date ou date-heure)', { type: 'string', format: 'date-time' }),
          requete('au', 'Jusqu\'à', { type: 'string', format: 'date-time' }),
        ],
        responses: {
          200: ok('Entrées, de la plus récente à la plus ancienne', liste({
            type: 'object',
            properties: {
              _id: ref('ObjectId'), utilisateur: ref('Personne'), action: { type: 'string' },
              entite: { type: 'object', properties: { modele: { type: 'string' }, id: ref('ObjectId') } },
              details: { type: 'object', additionalProperties: true }, ip: { type: 'string' }, appareil: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          }), pagination),
          ...erreurs(401, 403),
        },
      },
    },
  },
};
