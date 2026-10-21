const {
  ref, liste, ok, erreurs, corps, fichier, telechargement, parametreId, requete, roles, XLSX,
} = require('./outils');

const contenuGrille = {
  type: 'object',
  properties: {
    nom: { type: 'string' },
    niveauxCibles: liste(ref('NiveauCentre')),
    domaines: liste(ref('Domaine')),
    classes: liste(ref('ClasseGrille')),
  },
};

const verification = {
  type: 'object',
  properties: {
    erreurs: { type: 'array', items: { type: 'string' }, description: 'Bloquent la publication' },
    avertissements: { type: 'array', items: { type: 'string' } },
  },
};

module.exports = {
  tags: [{
    name: 'Grilles',
    description: 'Questionnaires versionnés : BROUILLON (modifiable) → PUBLIEE (figée) → ARCHIVEE. '
      + 'Modifier une grille publiée = créer une nouvelle version.',
  }],
  paths: {
    '/grilles': {
      get: {
        tags: ['Grilles'], operationId: 'listerGrilles', summary: 'Lister les grilles (toutes versions)',
        description: `${roles('tous les profils')} Liste résumée, sans le détail des critères.`,
        parameters: [
          requete('statut', null, { type: 'string', enum: ['BROUILLON', 'PUBLIEE', 'ARCHIVEE'] }),
          requete('niveau', 'Grilles qui visent ce niveau de centre', ref('NiveauCentre')),
          requete('code', 'Toutes les versions d\'une grille'),
        ],
        responses: {
          200: ok('Grilles', liste({
            allOf: [ref('Grille'), {
              type: 'object',
              properties: { nbDomaines: { type: 'integer' }, nbCriteres: { type: 'integer' }, totalPoids: { type: 'number' } },
            }],
          })),
          ...erreurs(401, 403),
        },
      },
      post: {
        tags: ['Grilles'], operationId: 'creerGrille', summary: 'Créer une grille (brouillon, version 1)',
        description: `${roles('ADMINISTRATEUR')} Pour un code existant, utiliser « nouvelle version ».`,
        requestBody: corps({ allOf: [{ type: 'object', required: ['code', 'nom'], properties: { code: { type: 'string' } } }, contenuGrille] }),
        responses: { 201: ok('Brouillon créé', ref('Grille')), ...erreurs(400, 401, 403, 409) },
      },
    },
    '/grilles/{id}': {
      parameters: [parametreId()],
      get: {
        tags: ['Grilles'], operationId: 'obtenirGrille', summary: 'Grille complète',
        description: roles('tous les profils'),
        responses: { 200: ok('Grille', ref('Grille')), ...erreurs(401, 403, 404) },
      },
      put: {
        tags: ['Grilles'], operationId: 'modifierGrille', summary: 'Remplacer le contenu d\'un brouillon',
        description: `${roles('ADMINISTRATEUR')} Refusé (409) pour une grille publiée ou archivée.`,
        requestBody: corps(contenuGrille),
        responses: { 200: ok('Brouillon à jour', ref('Grille')), ...erreurs(400, 401, 403, 404, 409) },
      },
      delete: {
        tags: ['Grilles'], operationId: 'supprimerGrille', summary: 'Supprimer un brouillon',
        description: `${roles('ADMINISTRATEUR')} Seul un brouillon peut être supprimé ; une grille publiée s'archive.`,
        responses: { 204: { description: 'Supprimé' }, ...erreurs(401, 403, 404, 409) },
      },
    },
    '/grilles/{id}/verification': {
      parameters: [parametreId()],
      get: {
        tags: ['Grilles'], operationId: 'verifierGrille', summary: 'Contrôles avant publication',
        description: `${roles('ADMINISTRATEUR')} Somme des poids = 100, codes uniques, options présentes, niveau ciblé…`,
        responses: { 200: ok('Résultat des contrôles', verification), ...erreurs(401, 403, 404) },
      },
    },
    '/grilles/{id}/publier': {
      parameters: [parametreId()],
      post: {
        tags: ['Grilles'], operationId: 'publierGrille', summary: 'Publier un brouillon',
        description: `${roles('ADMINISTRATEUR')} La grille devient figée ; la version publiée précédente du même code est archivée. `
          + 'Refusé (400, avec la liste des erreurs) si les contrôles échouent.',
        responses: {
          200: ok('Grille publiée', ref('Grille'), { avertissements: { type: 'array', items: { type: 'string' } } }),
          ...erreurs(400, 401, 403, 404, 409),
        },
      },
    },
    '/grilles/{id}/nouvelle-version': {
      parameters: [parametreId()],
      post: {
        tags: ['Grilles'], operationId: 'nouvelleVersionGrille', summary: 'Créer la version suivante (brouillon)',
        description: `${roles('ADMINISTRATEUR')} Copie de la grille avec version + 1. Un seul brouillon par code.`,
        responses: { 201: ok('Nouveau brouillon', ref('Grille')), ...erreurs(401, 403, 404, 409) },
      },
    },
    '/grilles/{id}/archiver': {
      parameters: [parametreId()],
      post: {
        tags: ['Grilles'], operationId: 'archiverGrille', summary: 'Archiver une grille publiée',
        description: `${roles('ADMINISTRATEUR')} Elle n'est plus proposée pour les nouvelles campagnes ; les évaluations existantes restent lisibles.`,
        responses: { 200: ok('Grille archivée', ref('Grille')), ...erreurs(401, 403, 404, 409) },
      },
    },
    '/grilles/{id}/simuler-score': {
      parameters: [parametreId()],
      post: {
        tags: ['Grilles'], operationId: 'simulerScore', summary: 'Aperçu : calculer le score de réponses fictives',
        description: `${roles('tous les profils')} Rien n'est enregistré. Règles : sans objet exclu, moyenne pondérée, `
          + 'plafond si critère éliminatoire à 0, score global pondéré par domaine, classe selon les seuils de la grille.',
        requestBody: corps({ type: 'object', properties: { reponses: liste(ref('ReponseSaisie')) } }, {
          reponses: [{ critereCode: 'EAU-01', valeur: 'Non' }, { critereCode: 'EAU-02', valeur: 'SOLAIRE' }, { critereCode: 'RH-04', valeur: 82 }],
        }),
        responses: { 200: ok('Scores calculés', ref('ResultatScore')), ...erreurs(401, 403, 404) },
      },
    },
    '/grilles/{id}/export': {
      parameters: [parametreId()],
      get: {
        tags: ['Grilles'], operationId: 'exporterGrille', summary: 'Exporter une grille (JSON ou Excel)',
        description: `${roles('ADMINISTRATEUR')} Même format que l'import : un export réimporté donne une grille identique.`,
        parameters: [requete('format', null, { type: 'string', enum: ['xlsx', 'json'], default: 'xlsx' })],
        responses: { 200: telechargement('Fichier de la grille', [XLSX, 'application/json']), ...erreurs(401, 403, 404) },
      },
    },
    '/grilles/import': {
      post: {
        tags: ['Grilles'], operationId: 'importerGrille', summary: 'Importer une grille (.xlsx ou .json)',
        description: `${roles('ADMINISTRATEUR')} La grille est créée en brouillon (version 1, ou version suivante si le code existe). `
          + 'En simulation (par défaut), rien n\'est enregistré.',
        parameters: [requete('simulation', 'false pour créer le brouillon', { type: 'boolean', default: true })],
        requestBody: fichier('Fichier .xlsx (feuilles Grille, Domaines, Criteres) ou .json, 5 Mo max'),
        responses: {
          200: ok('Rapport d\'import', {
            type: 'object',
            properties: {
              simulation: { type: 'boolean' },
              enregistree: { type: 'boolean' },
              grille: { type: 'object', properties: { _id: ref('ObjectId'), code: { type: 'string' }, nom: { type: 'string' }, version: { type: 'integer' } } },
              resume: { type: 'object', properties: { domaines: { type: 'integer' }, criteres: { type: 'integer' }, totalPoids: { type: 'number' } } },
              erreurs: { type: 'array', items: { type: 'string' }, description: 'Empêchent l\'import' },
              avertissements: { type: 'array', items: { type: 'string' }, description: 'À corriger avant publication' },
            },
          }),
          ...erreurs(400, 401, 403),
        },
      },
    },
  },
};
