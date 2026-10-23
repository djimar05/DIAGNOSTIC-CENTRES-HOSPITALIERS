const {
  ref, liste, ok, erreurs, corps, parametreId, roles,
} = require('./outils');

const TERRAIN = roles('EVALUATEUR (de la mission)');
const LECTURE = roles('ADMINISTRATEUR', 'RESPONSABLE_NATIONAL', 'COORDONNATEUR (périmètre)', 'SUPERVISEUR et EVALUATEUR (leurs missions)');

const reponseEnregistree = {
  type: 'object',
  properties: {
    domaineCode: { type: 'string' }, critereCode: { type: 'string' }, libelle: { type: 'string', description: 'Copie au moment de la saisie' },
    typeReponse: ref('TypeReponse'), valeur: { description: 'Selon le type ; pour PHOTO : nombre de photos' },
    sansObjet: { type: 'boolean' }, points: { type: 'number', nullable: true }, pointsMax: { type: 'number' }, poids: { type: 'number' },
    eliminatoireNonSatisfait: { type: 'boolean' }, observation: { type: 'string' }, fichiers: liste(ref('ObjectId')),
    saisiLe: { type: 'string', format: 'date-time' }, modifiePar: ref('ObjectId'),
  },
};

const fichier = {
  type: 'object',
  properties: {
    _id: ref('ObjectId'), clientId: { type: 'string' }, evaluation: ref('ObjectId'), critereCode: { type: 'string' },
    type: { type: 'string', enum: ['PHOTO', 'DOCUMENT'] }, mime: { type: 'string', example: 'image/jpeg' },
    tailleOctets: { type: 'integer' }, gps: ref('Gps'), prisLe: { type: 'string', format: 'date-time' }, televersePar: ref('ObjectId'),
  },
};

const evaluation = {
  type: 'object',
  properties: {
    _id: ref('ObjectId'), mission: ref('ObjectId'), campagne: ref('ObjectId'), centre: ref('ObjectId'), grille: ref('ObjectId'),
    grilleVersion: { type: 'integer' }, statut: ref('StatutEvaluation'),
    debut: { type: 'string', format: 'date-time' }, fin: { type: 'string', format: 'date-time' }, soumisLe: { type: 'string', format: 'date-time' },
    gpsVisite: ref('Gps'), personnesRencontrees: liste({ type: 'object', properties: { nom: { type: 'string' }, fonction: { type: 'string' } } }),
    reponses: liste(reponseEnregistree), observationsGenerales: { type: 'string' },
    evaluePar: { type: 'array', items: { oneOf: [ref('ObjectId'), ref('Personne')] } },
    historiqueStatuts: liste({ type: 'object', properties: { statut: ref('StatutEvaluation'), par: ref('ObjectId'), le: { type: 'string', format: 'date-time' }, commentaire: { type: 'string' } } }),
    syncVersion: { type: 'integer', description: 'Incrémenté à chaque enregistrement' },
    fichiers: { ...liste(fichier), description: 'GET /evaluations/{id} seulement' },
  },
};

const itemManquant = {
  type: 'object',
  properties: { critereCode: { type: 'string' }, libelle: { type: 'string' }, domaineCode: { type: 'string' }, preuve: { type: 'string', enum: ['PHOTO', 'DOCUMENT'] } },
};

module.exports = {
  tags: [
    { name: 'Collecte mobile', description: 'Téléchargement des missions et des grilles par l\'application des évaluateurs' },
    { name: 'Évaluations', description: 'Saisie sur le terrain : PLANIFIEE → EN_COURS → SOUMISE (A_CORRIGER → SOUMISE)' },
    { name: 'Fichiers', description: 'Photos et documents de preuve (stockage disque ou MinIO / S3)' },
  ],
  paths: {
    '/mobile/mes-missions': {
      get: {
        tags: ['Collecte mobile'], operationId: 'mesMissionsMobile', summary: 'Missions de l\'évaluateur et grilles, en un appel',
        description: `${roles('EVALUATEUR')} Missions non annulées des campagnes en cours, avec centre, équipe et résumé de l'évaluation ; chaque grille utilisée une seule fois.`,
        responses: {
          200: ok('Missions et grilles', {
            type: 'object',
            properties: {
              missions: liste({
                allOf: [ref('Mission'), {
                  type: 'object',
                  properties: {
                    evaluation: {
                      type: 'object',
                      properties: {
                        _id: ref('ObjectId'), statut: ref('StatutEvaluation'), grille: ref('ObjectId'), grilleVersion: { type: 'integer' },
                        syncVersion: { type: 'integer' }, debut: { type: 'string', format: 'date-time' }, nbReponses: { type: 'integer' },
                        motifCorrection: { type: 'string', description: 'Motif du superviseur si l\'évaluation est à corriger' },
                      },
                    },
                  },
                }],
              }),
              grilles: liste(ref('Grille')),
            },
          }),
          ...erreurs(401, 403),
        },
      },
    },
    '/mobile/grilles/{id}': {
      parameters: [parametreId()],
      get: {
        tags: ['Collecte mobile'], operationId: 'grilleMobile', summary: 'Grille d\'une évaluation',
        description: `${roles('EVALUATEUR')} Réponse avec ETag : renvoyer \`If-None-Match\` pour obtenir 304 si la grille n'a pas changé (une grille publiée est figée).`,
        responses: { 200: ok('Grille', ref('Grille')), 304: { description: 'Inchangée' }, ...erreurs(401, 403, 404) },
      },
    },

    '/evaluations/{id}': {
      parameters: [parametreId()],
      get: {
        tags: ['Évaluations'], operationId: 'obtenirEvaluation', summary: 'Évaluation avec ses réponses et ses fichiers',
        description: LECTURE,
        responses: { 200: ok('Évaluation', evaluation), ...erreurs(401, 403, 404) },
      },
    },
    '/evaluations/{id}/demarrer': {
      parameters: [parametreId()],
      post: {
        tags: ['Évaluations'], operationId: 'demarrerEvaluation', summary: 'Démarrer la visite (capture GPS)',
        description: `${TERRAIN} PLANIFIEE → EN_COURS, heure de début et position (preuve de présence). Déjà démarrée par un coéquipier : l'utilisateur rejoint simplement la saisie.`,
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { gps: ref('Gps'), debut: { type: 'string', format: 'date-time' } } } } } },
        responses: { 200: ok('Évaluation en cours', evaluation), ...erreurs(400, 401, 403, 404, 409) },
      },
    },
    '/evaluations/{id}/reponses': {
      parameters: [parametreId()],
      patch: {
        tags: ['Évaluations'], operationId: 'enregistrerReponses', summary: 'Enregistrer une ou plusieurs réponses',
        description: `${TERRAIN} Statut EN_COURS ou A_CORRIGER. Les réponses non envoyées ne changent pas ; une réponse vide (ni valeur, ni sans objet, ni observation, ni photo) est retirée. `
          + 'Tout ou rien : une réponse invalide fait échouer l\'enregistrement (400, détail par critère). Les photos sont d\'abord envoyées par POST /fichiers, puis citées dans `fichiers`.',
        requestBody: corps({
          type: 'object',
          properties: {
            reponses: liste({
              type: 'object', required: ['critereCode'],
              properties: {
                critereCode: { type: 'string' }, valeur: { description: '"Oui"/"Non", 0-3, nombre, code d\'option, tableau de codes, texte, date ISO, { coordinates } pour GPS' },
                sansObjet: { type: 'boolean' }, observation: { type: 'string' }, fichiers: liste(ref('ObjectId')), saisiLe: { type: 'string', format: 'date-time' },
              },
            }),
            observationsGenerales: { type: 'string' },
            personnesRencontrees: liste({ type: 'object', properties: { nom: { type: 'string' }, fonction: { type: 'string' } } }),
          },
        }, { reponses: [{ critereCode: 'EAU-01', valeur: 'Non', observation: 'Forage en panne depuis mars', fichiers: ['6ad77fef55d788951e4e2f21'] }] }),
        responses: {
          200: ok('Réponses enregistrées', { type: 'object', properties: { syncVersion: { type: 'integer' }, reponses: liste(reponseEnregistree), updatedAt: { type: 'string', format: 'date-time' } } }),
          ...erreurs(400, 401, 403, 404, 409),
        },
      },
    },
    '/evaluations/{id}/verification': {
      parameters: [parametreId()],
      get: {
        tags: ['Évaluations'], operationId: 'verifierEvaluation', summary: 'Ce qui manque avant de soumettre',
        description: `${LECTURE} Réponses obligatoires manquantes (critères applicables seulement), preuves exigées absentes, valeurs invalides, progression par domaine.`,
        responses: {
          200: ok('Contrôle', {
            type: 'object',
            properties: {
              complet: { type: 'boolean' }, manquants: liste(itemManquant), preuvesManquantes: liste(itemManquant),
              erreurs: { type: 'array', items: { type: 'string' } },
              progression: liste({ type: 'object', properties: { domaineCode: { type: 'string' }, nom: { type: 'string' }, repondus: { type: 'integer' }, total: { type: 'integer' } } }),
            },
          }),
          ...erreurs(401, 403, 404),
        },
      },
    },
    '/evaluations/{id}/soumettre': {
      parameters: [parametreId()],
      post: {
        tags: ['Évaluations'], operationId: 'soumettreEvaluation', summary: 'Soumettre au superviseur',
        description: `${TERRAIN} Refusé (400, avec la liste de ce qui manque) si l'évaluation est incomplète.`,
        responses: { 200: ok('Évaluation soumise', evaluation), ...erreurs(400, 401, 403, 404, 409) },
      },
    },

    '/fichiers': {
      post: {
        tags: ['Fichiers'], operationId: 'televerserFichier', summary: 'Envoyer une photo ou un document de preuve',
        description: `${TERRAIN} JPEG, PNG, WEBP ou PDF (type vérifié sur le contenu), 10 Mo max. `
          + 'Avec `clientId` (UUID du téléphone), un nouvel envoi après une coupure renvoie le fichier déjà reçu (200) au lieu d\'en créer un second.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object', required: ['fichier', 'evaluation', 'critereCode'],
                properties: {
                  fichier: { type: 'string', format: 'binary' }, evaluation: ref('ObjectId'), critereCode: { type: 'string' },
                  clientId: { type: 'string', format: 'uuid' }, prisLe: { type: 'string', format: 'date-time' },
                  longitude: { type: 'number' }, latitude: { type: 'number' }, precision: { type: 'number', description: 'Précision GPS en mètres' },
                },
              },
            },
          },
        },
        responses: { 201: ok('Fichier reçu', fichier), 200: ok('Déjà reçu (même clientId)', fichier), ...erreurs(400, 401, 403, 404, 409) },
      },
    },
    '/fichiers/{id}/contenu': {
      parameters: [parametreId()],
      get: {
        tags: ['Fichiers'], operationId: 'contenuFichier', summary: 'Contenu d\'un fichier (image ou PDF)',
        description: LECTURE,
        responses: {
          200: { description: 'Contenu binaire', content: { 'image/jpeg': { schema: { type: 'string', format: 'binary' } }, 'application/pdf': { schema: { type: 'string', format: 'binary' } } } },
          ...erreurs(401, 403, 404),
        },
      },
    },
    '/fichiers/{id}': {
      parameters: [parametreId()],
      delete: {
        tags: ['Fichiers'], operationId: 'supprimerFichier', summary: 'Supprimer une preuve pendant la saisie',
        description: `${TERRAIN} Elle est aussi retirée de la réponse qui la citait.`,
        responses: { 204: { description: 'Supprimé' }, ...erreurs(401, 403, 404, 409) },
      },
    },
  },
};
