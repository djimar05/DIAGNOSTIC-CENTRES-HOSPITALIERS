const {
  ref, liste, ok, erreurs, corps, fichier, telechargement, parametreId, requete, roles, XLSX,
} = require('./outils');

const TOUS = 'tous les profils (selon leur périmètre)';

const centreSaisie = {
  type: 'object',
  properties: {
    code: { type: 'string' }, nom: { type: 'string' }, niveau: ref('NiveauCentre'),
    statutJuridique: { type: 'string', enum: ['PUBLIC', 'CONFESSIONNEL', 'PRIVE', 'COMMUNAUTAIRE', 'ONG'] },
    zone: { ...ref('ObjectId'), description: 'Région, district ou zone de responsabilité (pas le national)' },
    localite: { type: 'string', nullable: true },
    gps: { ...ref('Gps'), nullable: true, description: 'null pour effacer' },
    populationDesservie: { type: 'integer', nullable: true },
    nombreLits: { type: 'integer', nullable: true },
    services: liste({ type: 'string' }),
    responsable: { type: 'object', properties: { nom: { type: 'string' }, telephone: { type: 'string' } } },
    actif: { type: 'boolean' },
  },
};

module.exports = {
  tags: [
    { name: 'Zones', description: 'Découpage sanitaire : national → région → district → zone de responsabilité' },
    { name: 'Centres', description: 'Formations sanitaires évaluées, import Excel' },
  ],
  paths: {
    '/zones': {
      get: {
        tags: ['Zones'], operationId: 'listerZones', summary: 'Zones du périmètre (liste plate)',
        description: `${roles(TOUS)} Triées du plus large au plus fin.`,
        parameters: [requete('niveau', 'Filtrer par niveau', ref('NiveauZone')), requete('parent', 'Sous-zones directes de', ref('ObjectId'))],
        responses: { 200: ok('Zones', liste(ref('Zone'))), ...erreurs(401, 403) },
      },
      post: {
        tags: ['Zones'], operationId: 'creerZone', summary: 'Créer une zone',
        description: `${roles('ADMINISTRATEUR')} Le parent doit être du niveau immédiatement supérieur ; une seule zone nationale.`,
        requestBody: corps({
          type: 'object', required: ['code', 'nom', 'niveau'],
          properties: { code: { type: 'string' }, nom: { type: 'string' }, niveau: ref('NiveauZone'), parent: ref('ObjectId') },
        }, { code: 'DS-01-03', nom: 'District E', niveau: 'DISTRICT', parent: '6ad77fef55d788951e4e2f21' }),
        responses: { 201: ok('Zone créée', ref('Zone')), ...erreurs(400, 401, 403, 409) },
      },
    },
    '/zones/arbre': {
      get: {
        tags: ['Zones'], operationId: 'arbreZones', summary: 'Arbre des zones du périmètre, avec le nombre de centres',
        description: roles(TOUS),
        responses: { 200: ok('Racines de l\'arbre', liste(ref('NoeudZone'))), ...erreurs(401, 403) },
      },
    },
    '/zones/{id}': {
      parameters: [parametreId()],
      patch: {
        tags: ['Zones'], operationId: 'modifierZone', summary: 'Modifier ou déplacer une zone',
        description: `${roles('ADMINISTRATEUR')} Changer le parent déplace la zone : les ancêtres de ses sous-zones, `
          + 'de ses centres, missions et évaluations sont recalculés. Le niveau n\'est pas modifiable.',
        requestBody: corps({
          type: 'object',
          properties: { code: { type: 'string' }, nom: { type: 'string' }, actif: { type: 'boolean' }, parent: ref('ObjectId') },
        }),
        responses: { 200: ok('Zone à jour', ref('Zone')), ...erreurs(400, 401, 403, 404, 409) },
      },
    },

    '/centres': {
      get: {
        tags: ['Centres'], operationId: 'listerCentres', summary: 'Centres du périmètre',
        description: roles(TOUS),
        parameters: [
          requete('zone', 'Dans cette zone (sous-zones comprises)', ref('ObjectId')),
          requete('niveau', null, ref('NiveauCentre')),
          requete('statutJuridique', null, { type: 'string', enum: ['PUBLIC', 'CONFESSIONNEL', 'PRIVE', 'COMMUNAUTAIRE', 'ONG'] }),
          requete('actif', null, { type: 'boolean' }),
          requete('recherche', 'Nom, code ou localité'),
          { $ref: '#/components/parameters/page' },
          requete('limite', '1 à 200', { type: 'integer', default: 50 }),
        ],
        responses: { 200: ok('Page de centres', liste(ref('Centre')), { pagination: ref('Pagination') }), ...erreurs(401, 403) },
      },
      post: {
        tags: ['Centres'], operationId: 'creerCentre', summary: 'Créer un centre',
        description: `${roles('ADMINISTRATEUR')} \`zoneAncetres\` est calculé à partir de la zone.`,
        requestBody: corps({ ...centreSaisie, required: ['code', 'nom', 'niveau', 'zone'] }),
        responses: { 201: ok('Centre créé', ref('Centre')), ...erreurs(400, 401, 403, 409) },
      },
    },
    '/centres/{id}': {
      parameters: [parametreId()],
      get: {
        tags: ['Centres'], operationId: 'obtenirCentre', summary: 'Fiche d\'un centre',
        description: `${roles(TOUS)} 404 si le centre est hors du périmètre.`,
        responses: { 200: ok('Centre (zone et zones ancêtres détaillées)', ref('Centre')), ...erreurs(401, 403, 404) },
      },
      patch: {
        tags: ['Centres'], operationId: 'modifierCentre', summary: 'Modifier un centre',
        description: `${roles('ADMINISTRATEUR')} Un changement de zone recalcule les zones du centre, de ses missions et évaluations.`,
        requestBody: corps(centreSaisie),
        responses: { 200: ok('Centre à jour', ref('Centre')), ...erreurs(400, 401, 403, 404, 409) },
      },
    },
    '/centres/{id}/evaluations': {
      parameters: [parametreId()],
      get: {
        tags: ['Centres'], operationId: 'evaluationsDuCentre', summary: 'Historique des évaluations du centre',
        description: roles('tous sauf PARTENAIRE (périmètre)'),
        responses: {
          200: ok('Évaluations, des plus récentes aux plus anciennes', liste({
            type: 'object',
            properties: {
              _id: ref('ObjectId'), statut: ref('StatutEvaluation'), campagne: ref('Reference'), grilleVersion: { type: 'integer' },
              debut: { type: 'string', format: 'date-time' }, soumisLe: { type: 'string', format: 'date-time' },
              scores: { type: 'object', properties: { global: { type: 'number' }, classe: ref('Classe') } },
            },
          })),
          ...erreurs(401, 403, 404),
        },
      },
    },
    '/centres/{id}/actions': {
      parameters: [parametreId()],
      get: {
        tags: ['Centres'], operationId: 'actionsDuCentre', summary: 'Actions correctives du centre',
        description: roles('tous sauf PARTENAIRE (périmètre)'),
        responses: {
          200: ok('Actions', liste({
            type: 'object',
            properties: {
              _id: ref('ObjectId'), domaineCode: { type: 'string' }, critereCode: { type: 'string' }, actionPrevue: { type: 'string' },
              priorite: { type: 'string', enum: ['HAUTE', 'MOYENNE', 'BASSE'] }, echeance: { type: 'string', format: 'date-time' },
              statut: { type: 'string', enum: ['A_FAIRE', 'EN_COURS', 'REALISEE', 'VERIFIEE', 'ABANDONNEE'] }, avancement: { type: 'integer' },
            },
          })),
          ...erreurs(401, 403, 404),
        },
      },
    },
    '/centres/import': {
      post: {
        tags: ['Centres'], operationId: 'importerCentres', summary: 'Importer des centres depuis Excel',
        description: `${roles('ADMINISTRATEUR')} Une ligne par centre, le code sert de clé (code connu = mise à jour). `
          + 'En simulation (par défaut), rien n\'est enregistré. En réel, les lignes valides sont enregistrées et les autres signalées.',
        parameters: [requete('simulation', 'false pour enregistrer', { type: 'boolean', default: true })],
        requestBody: fichier('Classeur .xlsx (5 Mo max), feuille « Centres » ou première feuille'),
        responses: {
          200: ok('Rapport ligne par ligne', {
            type: 'object',
            properties: {
              simulation: { type: 'boolean' },
              resume: {
                type: 'object',
                properties: { total: { type: 'integer' }, crees: { type: 'integer' }, misAJour: { type: 'integer' }, inchanges: { type: 'integer' }, erreurs: { type: 'integer' } },
              },
              lignes: liste({
                type: 'object',
                properties: {
                  ligne: { type: 'integer', description: 'Numéro de ligne Excel' }, code: { type: 'string' }, nom: { type: 'string' },
                  statut: { type: 'string', enum: ['CREE', 'MIS_A_JOUR', 'INCHANGE', 'ERREUR'] }, erreurs: liste({ type: 'string' }),
                },
              }),
            },
          }),
          ...erreurs(400, 401, 403),
        },
      },
    },
    '/centres/import/modele': {
      get: {
        tags: ['Centres'], operationId: 'modeleImportCentres', summary: 'Télécharger le modèle Excel d\'import',
        description: `${roles('ADMINISTRATEUR')} Feuilles Centres (à remplir), Listes, Zones (codes existants) et Aide.`,
        responses: { 200: telechargement('Classeur .xlsx', [XLSX]), ...erreurs(401, 403) },
      },
    },
  },
};
