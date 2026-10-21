const {
  ref, liste, ok, erreurs, corps, parametreId, requete, roles,
} = require('./outils');

const LECTURE = roles('ADMINISTRATEUR', 'RESPONSABLE_NATIONAL', 'COORDONNATEUR (périmètre)', 'SUPERVISEUR et EVALUATEUR (leurs missions)');
const GESTION = roles('ADMINISTRATEUR', 'COORDONNATEUR (dans son périmètre)');

const intervenants = {
  type: 'object',
  properties: { evaluateurs: liste(ref('Intervenant')), superviseurs: liste(ref('Intervenant')) },
};
const equipe = {
  evaluateurs: { type: 'array', items: ref('ObjectId'), description: 'Remplace l\'équipe ([] la vide)' },
  superviseur: { ...ref('ObjectId'), nullable: true, description: 'null pour retirer le superviseur' },
  datePrevue: { type: 'string', format: 'date', nullable: true },
};
const refus = liste({
  type: 'object',
  properties: { centre: ref('ObjectId'), mission: ref('ObjectId'), code: { type: 'string' }, nom: { type: 'string' }, motif: { type: 'string' } },
});

module.exports = {
  tags: [
    { name: 'Campagnes', description: 'PREPARATION → EN_COURS → CLOTUREE. Une mission par centre, avec son évaluation.' },
    { name: 'Missions', description: 'Centres à visiter : équipe, date, calendrier' },
  ],
  paths: {
    '/campagnes': {
      get: {
        tags: ['Campagnes'], operationId: 'listerCampagnes', summary: 'Campagnes visibles, avec avancement résumé',
        description: `${LECTURE} Un coordonnateur de district voit aussi les campagnes régionales qui touchent son district.`,
        parameters: [
          requete('statut', null, { type: 'string', enum: ['PREPARATION', 'EN_COURS', 'CLOTUREE'] }),
          requete('recherche', 'Dans le nom'),
        ],
        responses: {
          200: ok('Campagnes', liste({
            allOf: [ref('Campagne'), {
              type: 'object',
              properties: {
                avancement: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' }, validees: { type: 'integer' },
                    parStatut: { type: 'object', additionalProperties: { type: 'integer' }, example: { PLANIFIEE: 18, VALIDEE: 2 } },
                  },
                },
              },
            }],
          })),
          ...erreurs(401, 403),
        },
      },
      post: {
        tags: ['Campagnes'], operationId: 'creerCampagne', summary: 'Créer une campagne (en préparation)',
        description: `${GESTION} Grille publiée obligatoire. Sans zone = nationale (admin ou coordonnateur national).`,
        requestBody: corps({
          type: 'object', required: ['nom', 'grille'],
          properties: {
            nom: { type: 'string' }, description: { type: 'string' }, grille: ref('ObjectId'), zone: ref('ObjectId'),
            dateDebut: { type: 'string', format: 'date' }, dateFin: { type: 'string', format: 'date' }, partenaire: { type: 'string' },
          },
        }),
        responses: { 201: ok('Campagne créée', ref('Campagne')), ...erreurs(400, 401, 403) },
      },
    },
    '/campagnes/intervenants': {
      get: {
        tags: ['Campagnes'], operationId: 'intervenantsZone', summary: 'Évaluateurs et superviseurs possibles pour une zone',
        description: `${GESTION} Utilisé par l'assistant de création, avant que la campagne existe.`,
        parameters: [requete('zone', 'Zone de la future campagne (vide = nationale)', ref('ObjectId'))],
        responses: { 200: ok('Intervenants', intervenants), ...erreurs(401, 403) },
      },
    },
    '/campagnes/{id}': {
      parameters: [parametreId()],
      get: {
        tags: ['Campagnes'], operationId: 'obtenirCampagne', summary: 'Détail d\'une campagne',
        description: LECTURE,
        responses: { 200: ok('Campagne (grille, zone et auteur détaillés)', ref('Campagne')), ...erreurs(401, 403, 404) },
      },
      patch: {
        tags: ['Campagnes'], operationId: 'modifierCampagne', summary: 'Modifier une campagne',
        description: `${GESTION} La grille et la zone ne sont modifiables qu'en préparation ; une campagne clôturée est en lecture seule.`,
        requestBody: corps({
          type: 'object',
          properties: {
            nom: { type: 'string' }, description: { type: 'string' }, partenaire: { type: 'string' },
            dateDebut: { type: 'string', format: 'date' }, dateFin: { type: 'string', format: 'date' },
            grille: ref('ObjectId'), zone: { ...ref('ObjectId'), nullable: true },
          },
        }),
        responses: { 200: ok('Campagne à jour', ref('Campagne')), ...erreurs(400, 401, 403, 404, 409) },
      },
    },
    '/campagnes/{id}/demarrer': {
      parameters: [parametreId()],
      post: {
        tags: ['Campagnes'], operationId: 'demarrerCampagne', summary: 'Démarrer la campagne',
        description: `${GESTION} Exige au moins une mission, et un évaluateur sur chaque mission non annulée.`,
        responses: { 200: ok('Campagne en cours', ref('Campagne')), ...erreurs(400, 401, 403, 404, 409) },
      },
    },
    '/campagnes/{id}/cloturer': {
      parameters: [parametreId()],
      post: {
        tags: ['Campagnes'], operationId: 'cloturerCampagne', summary: 'Clôturer la campagne',
        description: `${GESTION} Refusé (409) s'il reste des évaluations non terminées, sauf avec \`forcer: true\` : elles sont alors annulées.`,
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { forcer: { type: 'boolean', default: false } } } } } },
        responses: {
          200: ok('Campagne clôturée', ref('Campagne'), { evaluationsAnnulees: { type: 'integer' } }),
          ...erreurs(401, 403, 404, 409),
        },
      },
    },
    '/campagnes/{id}/missions': {
      parameters: [parametreId()],
      post: {
        tags: ['Campagnes'], operationId: 'ajouterMissions', summary: 'Ajouter des centres (missions en masse)',
        description: `${GESTION} Une mission + une évaluation PLANIFIEE par centre. Centres refusés : inactif, hors zone de la campagne, `
          + 'hors périmètre, niveau non visé par la grille. L\'équipe facultative n\'est appliquée qu\'aux centres qu\'elle couvre.',
        requestBody: corps({
          type: 'object', required: ['centres'],
          properties: { centres: { type: 'array', items: ref('ObjectId') }, ...equipe },
        }),
        responses: {
          201: ok('Centres ajoutés', {
            type: 'object',
            properties: {
              creees: { type: 'integer' }, missions: { type: 'array', items: ref('ObjectId') },
              existants: liste({ type: 'object', properties: { centre: ref('ObjectId'), code: { type: 'string' }, nom: { type: 'string' } } }),
              refus, avertissements: { type: 'array', items: { type: 'string' } },
            },
          }),
          200: { description: 'Aucun centre ajouté (tous refusés ou déjà présents) – même corps qu\'en 201' },
          ...erreurs(400, 401, 403, 404, 409),
        },
      },
    },
    '/campagnes/{id}/equipe': {
      parameters: [parametreId()],
      post: {
        tags: ['Campagnes'], operationId: 'affecterEquipe', summary: 'Affecter une équipe et/ou une date à plusieurs missions',
        description: `${GESTION} Chaque personne doit avoir le rôle sur la zone du centre ; le superviseur ne peut pas être évaluateur. `
          + 'Un champ absent n\'est pas modifié. Une mission refusée n\'empêche pas les autres.',
        requestBody: corps({ type: 'object', required: ['missions'], properties: { missions: { type: 'array', items: ref('ObjectId') }, ...equipe } }),
        responses: {
          200: ok('Résultat', { type: 'object', properties: { modifiees: { type: 'integer' }, refus } }),
          ...erreurs(400, 401, 403),
        },
      },
    },
    '/campagnes/{id}/avancement': {
      parameters: [parametreId()],
      get: {
        tags: ['Campagnes'], operationId: 'avancementCampagne', summary: 'Avancement de la campagne (dans le périmètre)',
        description: LECTURE,
        responses: {
          200: ok('Avancement', {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              parStatut: { type: 'object', additionalProperties: { type: 'integer' }, description: 'Évaluations par statut' },
              validees: { type: 'integer' }, soumises: { type: 'integer' }, sansEquipe: { type: 'integer' }, sansDate: { type: 'integer' },
              enRetard: { type: 'integer', description: 'Date passée, évaluation pas encore soumise' },
              tauxValidation: { type: 'number', description: '% de validées parmi les missions non annulées' },
              parZone: liste({
                type: 'object',
                properties: {
                  zone: ref('Reference'), total: { type: 'integer' }, validees: { type: 'integer' },
                  enRetard: { type: 'integer' }, annulees: { type: 'integer' },
                },
              }),
            },
          }),
          ...erreurs(401, 403, 404),
        },
      },
    },
    '/campagnes/{id}/intervenants': {
      parameters: [parametreId()],
      get: {
        tags: ['Campagnes'], operationId: 'intervenantsCampagne', summary: 'Évaluateurs et superviseurs possibles pour la campagne',
        description: `${GESTION} Affectations EVALUATEUR / SUPERVISEUR / COORDONNATEUR sur la zone de la campagne, au-dessus ou en dessous.`,
        responses: { 200: ok('Intervenants', intervenants), ...erreurs(401, 403, 404) },
      },
    },

    '/missions': {
      get: {
        tags: ['Missions'], operationId: 'listerMissions', summary: 'Missions visibles (liste et calendrier)',
        description: `${LECTURE} Triées par date prévue ; 1000 au plus.`,
        parameters: [
          requete('campagne', null, ref('ObjectId')),
          requete('statut', null, { type: 'string', enum: ['A_FAIRE', 'EN_COURS', 'TERMINEE', 'ANNULEE'] }),
          requete('centre', null, ref('ObjectId')),
          requete('evaluateur', null, ref('ObjectId')),
          requete('du', 'Date prévue à partir de', { type: 'string', format: 'date' }),
          requete('au', 'Date prévue jusqu\'à', { type: 'string', format: 'date-time' }),
          requete('sansEquipe', null, { type: 'boolean' }),
          requete('sansDate', null, { type: 'boolean' }),
          requete('enRetard', null, { type: 'boolean' }),
          requete('limite', null, { type: 'integer', default: 500, maximum: 1000 }),
        ],
        responses: { 200: ok('Missions (centre, équipe, campagne et évaluation détaillés)', liste(ref('Mission'))), ...erreurs(401, 403) },
      },
    },
    '/missions/{id}': {
      parameters: [parametreId()],
      get: {
        tags: ['Missions'], operationId: 'obtenirMission', summary: 'Détail d\'une mission',
        description: LECTURE,
        responses: { 200: ok('Mission', ref('Mission')), ...erreurs(401, 403, 404) },
      },
      patch: {
        tags: ['Missions'], operationId: 'modifierMission', summary: 'Modifier l\'équipe, la date ou le statut d\'une mission',
        description: `${GESTION} \`statut: ANNULEE\` annule aussi l'évaluation (si elle n'est pas soumise) ; \`statut: A_FAIRE\` réactive. `
          + 'Plus modifiable une fois l\'évaluation validée, ni dans une campagne clôturée.',
        requestBody: corps({ type: 'object', properties: { ...equipe, statut: { type: 'string', enum: ['ANNULEE', 'A_FAIRE'] } } }),
        responses: { 200: ok('Mission à jour', ref('Mission')), ...erreurs(400, 401, 403, 404, 409) },
      },
      delete: {
        tags: ['Missions'], operationId: 'supprimerMission', summary: 'Retirer un centre de la campagne',
        description: `${GESTION} Seulement si l'évaluation n'a pas commencé (sinon : annuler la mission).`,
        responses: { 204: { description: 'Mission et évaluation supprimées' }, ...erreurs(401, 403, 404, 409) },
      },
    },
  },
};
