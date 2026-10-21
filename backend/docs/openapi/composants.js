const {
  NIVEAUX_CENTRE, NIVEAUX_ZONE, ROLES, STATUTS_EVALUATION, TYPES_REPONSE, CLASSES,
} = require('../../models/enumUtils');
const { ref, liste } = require('./outils');

// Les énumérations viennent des modèles : la documentation suit automatiquement leurs évolutions.

const objectId = { type: 'string', pattern: '^[0-9a-fA-F]{24}$', example: '6ad77fef55d788951e4e2f21' };
const date = { type: 'string', format: 'date-time' };
const horodatage = { createdAt: date, updatedAt: date };

const erreur = (code, description, exemple, details) => ({
  description,
  content: {
    'application/json': {
      schema: ref('Erreur'),
      example: { success: false, error: { message: exemple, ...(details && { details }) } },
    },
  },
});

module.exports = {
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Access token obtenu par POST /auth/connexion (valable 15 min par défaut, renouvelable avec POST /auth/rafraichir).',
    },
  },

  parameters: {
    page: { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
  },

  responses: {
    E400: erreur(400, 'Requête invalide (champ manquant, valeur hors liste, règle métier non respectée)', 'Erreur de validation des données', ['nom est obligatoire']),
    E401: erreur(401, 'Non authentifié : jeton absent, invalide ou expiré', 'Token expiré'),
    E403: erreur(403, 'Accès refusé : rôle insuffisant, hors périmètre, ou mot de passe temporaire à changer', "Vous n'avez pas les droits pour cette action"),
    E404: erreur(404, 'Ressource introuvable (ou hors de votre périmètre)', 'Ressource non trouvée'),
    E409: erreur(409, 'Conflit : doublon, ou opération impossible dans l\'état actuel', 'Une valeur existe déjà pour : code'),
    E429: erreur(429, 'Trop de requêtes', 'Trop de requêtes, réessayez dans une minute'),
  },

  schemas: {
    // ─── Communs ───
    ObjectId: objectId,
    Erreur: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            details: { type: 'array', items: { type: 'string' }, description: 'Précisions (erreurs de validation, contrôles…)' },
          },
        },
      },
    },
    Pagination: {
      type: 'object',
      properties: { total: { type: 'integer' }, page: { type: 'integer' }, limite: { type: 'integer' }, pages: { type: 'integer' } },
    },
    Role: { type: 'string', enum: ROLES },
    NiveauZone: { type: 'string', enum: NIVEAUX_ZONE },
    NiveauCentre: { type: 'string', enum: NIVEAUX_CENTRE },
    TypeReponse: { type: 'string', enum: TYPES_REPONSE },
    StatutEvaluation: { type: 'string', enum: STATUTS_EVALUATION },
    Classe: { type: 'string', enum: CLASSES },
    Reference: {
      type: 'object',
      description: 'Objet lié, renvoyé avec quelques champs (code, nom…) selon la route',
      properties: { _id: objectId, code: { type: 'string' }, nom: { type: 'string' }, niveau: { type: 'string' } },
    },
    Personne: {
      type: 'object',
      properties: { _id: objectId, nom: { type: 'string' }, prenom: { type: 'string' }, telephone: { type: 'string' } },
    },
    Gps: {
      type: 'object',
      description: 'Point GeoJSON. Attention : [longitude, latitude].',
      required: ['coordinates'],
      properties: {
        type: { type: 'string', enum: ['Point'], default: 'Point' },
        coordinates: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2, example: [15.0444, 12.1348] },
        precisionMetres: { type: 'number' },
      },
    },

    // ─── Comptes ───
    Jetons: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', description: 'JWT à envoyer dans Authorization: Bearer …' },
        refreshToken: { type: 'string', description: 'Jeton opaque à usage unique (rotation à chaque rafraîchissement)' },
        expiresIn: { type: 'string', example: '15m' },
      },
    },
    Utilisateur: {
      type: 'object',
      properties: {
        _id: objectId,
        nom: { type: 'string', example: 'Mahamat' },
        prenom: { type: 'string', example: 'Ali' },
        telephone: { type: 'string', example: '+235660000103', description: 'Identifiant de connexion' },
        email: { type: 'string', format: 'email' },
        fonction: { type: 'string', example: "Infirmier diplômé d'État" },
        langue: { type: 'string', enum: ['fr', 'ar'] },
        actif: { type: 'boolean' },
        motDePasseAChanger: { type: 'boolean', description: 'Mot de passe temporaire : le reste de l\'API répond 403 tant qu\'il n\'est pas changé' },
        derniereConnexion: date,
        roles: { type: 'array', items: ref('Role'), description: 'Rôles actifs (dans les listes seulement)' },
        ...horodatage,
      },
    },
    Affectation: {
      type: 'object',
      properties: {
        _id: objectId,
        utilisateur: objectId,
        role: ref('Role'),
        zone: { description: 'Zone (identifiant ou objet). Absente = périmètre national', oneOf: [objectId, ref('Reference')], nullable: true },
        centre: { description: 'Centre (identifiant ou objet), pour un responsable de centre', oneOf: [objectId, ref('Reference')], nullable: true },
        actif: { type: 'boolean' },
        dateDebut: date,
        dateFin: { ...date, nullable: true },
        ...horodatage,
      },
    },
    Profil: {
      description: 'Utilisateur connecté, avec ses affectations actives et ses rôles',
      allOf: [ref('Utilisateur'), {
        type: 'object',
        properties: { affectations: liste(ref('Affectation')), roles: liste(ref('Role')) },
      }],
    },

    // ─── Référentiel ───
    Zone: {
      type: 'object',
      properties: {
        _id: objectId,
        code: { type: 'string', example: 'DS-01-01' },
        nom: { type: 'string', example: 'District A' },
        niveau: ref('NiveauZone'),
        parent: { ...objectId, nullable: true },
        ancetres: liste(objectId),
        actif: { type: 'boolean' },
      },
    },
    NoeudZone: {
      type: 'object',
      properties: {
        _id: objectId,
        code: { type: 'string' },
        nom: { type: 'string' },
        niveau: ref('NiveauZone'),
        actif: { type: 'boolean' },
        parent: { ...objectId, nullable: true },
        nbCentres: { type: 'integer', description: 'Centres rattachés directement' },
        nbCentresTotal: { type: 'integer', description: 'Centres de tout le sous-arbre' },
        enfants: liste(ref('NoeudZone')),
      },
    },
    Centre: {
      type: 'object',
      properties: {
        _id: objectId,
        code: { type: 'string', example: 'CS-0142' },
        nom: { type: 'string', example: 'CS Quartier Nord' },
        niveau: ref('NiveauCentre'),
        statutJuridique: { type: 'string', enum: ['PUBLIC', 'CONFESSIONNEL', 'PRIVE', 'COMMUNAUTAIRE', 'ONG'] },
        zone: { oneOf: [objectId, ref('Reference')] },
        zoneAncetres: { type: 'array', items: { oneOf: [objectId, ref('Reference')] }, description: 'Zones du centre, du national à sa zone (calculé)' },
        localite: { type: 'string' },
        gps: ref('Gps'),
        populationDesservie: { type: 'integer' },
        nombreLits: { type: 'integer' },
        services: liste({ type: 'string', example: 'MATERNITE' }),
        responsable: { type: 'object', properties: { nom: { type: 'string' }, telephone: { type: 'string' } } },
        derniereEvaluation: {
          type: 'object',
          properties: { evaluation: objectId, date, score: { type: 'number' }, classe: ref('Classe') },
        },
        actif: { type: 'boolean' },
        ...horodatage,
      },
    },

    // ─── Grilles ───
    Critere: {
      type: 'object',
      required: ['code', 'libelle', 'typeReponse'],
      properties: {
        code: { type: 'string', example: 'EAU-01', description: 'Unique dans toute la grille' },
        libelle: { type: 'string', example: "Source d'eau potable disponible toute l'année sur le site" },
        aide: { type: 'string' },
        typeReponse: ref('TypeReponse'),
        options: liste({
          type: 'object',
          properties: { code: { type: 'string' }, libelle: { type: 'string' }, points: { type: 'number' } },
        }),
        bareme: {
          type: 'object',
          description: 'Pour NOMBRE : on retient le dernier seuil dont le min est ≤ valeur',
          properties: {
            seuils: liste({ type: 'object', properties: { min: { type: 'number' }, max: { type: 'number' }, points: { type: 'number' } } }),
          },
        },
        pointsMax: { type: 'number', default: 1 },
        poids: { type: 'number', default: 1 },
        obligatoire: { type: 'boolean', default: true },
        eliminatoire: { type: 'boolean', default: false, description: 'Non satisfait (0 point) → domaine plafonné' },
        sansObjetAutorise: { type: 'boolean', default: false },
        preuveExigee: { type: 'string', enum: ['AUCUNE', 'PHOTO', 'DOCUMENT'], default: 'AUCUNE' },
        condition: {
          type: 'object',
          description: 'Critère affiché seulement si un autre critère a cette réponse',
          properties: { critere: { type: 'string', example: 'SRV-03' }, valeur: { example: 'Oui' } },
        },
        ordre: { type: 'integer' },
      },
    },
    Domaine: {
      type: 'object',
      required: ['code', 'nom', 'poids'],
      properties: {
        code: { type: 'string', example: 'EAU' },
        nom: { type: 'string', example: 'Eau, électricité, assainissement' },
        poids: { type: 'number', example: 10, description: '% du score global ; la somme des domaines doit faire 100 pour publier' },
        plafondSiEliminatoire: { type: 'number', default: 40 },
        ordre: { type: 'integer' },
        criteres: liste(ref('Critere')),
      },
    },
    ClasseGrille: {
      type: 'object',
      properties: { classe: ref('Classe'), min: { type: 'number' }, max: { type: 'number' } },
    },
    Grille: {
      type: 'object',
      properties: {
        _id: objectId,
        code: { type: 'string', example: 'GRILLE-CS' },
        nom: { type: 'string' },
        version: { type: 'integer', example: 1 },
        niveauxCibles: liste(ref('NiveauCentre')),
        statut: { type: 'string', enum: ['BROUILLON', 'PUBLIEE', 'ARCHIVEE'] },
        domaines: liste(ref('Domaine')),
        classes: liste(ref('ClasseGrille')),
        publieeLe: date,
        creePar: objectId,
        ...horodatage,
      },
    },
    ReponseSaisie: {
      type: 'object',
      required: ['critereCode'],
      properties: {
        critereCode: { type: 'string', example: 'EAU-01' },
        valeur: { description: 'Selon le type : "Oui"/"Non", 0-3, nombre, code d\'option, tableau de codes, texte…', example: 'Non' },
        sansObjet: { type: 'boolean' },
      },
    },
    ScoreDomaine: {
      type: 'object',
      properties: {
        domaineCode: { type: 'string' },
        nom: { type: 'string' },
        poids: { type: 'number' },
        score: { type: 'number', nullable: true, description: 'Sur 100, arrondi à 1 décimale ; null si aucun critère noté' },
        scoreBrut: { type: 'number', nullable: true, description: 'Avant plafonnement' },
        plafonne: { type: 'boolean' },
        criteresRepondus: { type: 'integer' },
        criteresTotal: { type: 'integer' },
      },
    },
    ResultatScore: {
      type: 'object',
      properties: {
        scores: {
          type: 'object',
          properties: {
            domaines: liste(ref('ScoreDomaine')),
            global: { type: 'number', nullable: true, example: 60.6 },
            classe: { ...ref('Classe') },
            calculeLe: date,
          },
        },
        criteres: liste({
          type: 'object',
          properties: {
            domaineCode: { type: 'string' }, critereCode: { type: 'string' }, applicable: { type: 'boolean' },
            sansObjet: { type: 'boolean' }, note: { type: 'boolean' }, points: { type: 'number', nullable: true },
            pointsMax: { type: 'number' }, poids: { type: 'number' }, score: { type: 'number', nullable: true },
            eliminatoireNonSatisfait: { type: 'boolean' },
          },
        }),
        complet: { type: 'boolean' },
        manquants: { type: 'array', items: { type: 'string' }, description: 'Critères obligatoires sans réponse' },
        erreurs: { type: 'array', items: { type: 'string' } },
      },
    },

    // ─── Planification ───
    Campagne: {
      type: 'object',
      properties: {
        _id: objectId,
        nom: { type: 'string', example: 'Pilote – 20 centres du District A' },
        description: { type: 'string' },
        grille: { oneOf: [objectId, ref('Reference')] },
        zone: { oneOf: [objectId, ref('Reference')], nullable: true, description: 'Absente = campagne nationale' },
        dateDebut: date,
        dateFin: date,
        partenaire: { type: 'string' },
        statut: { type: 'string', enum: ['PREPARATION', 'EN_COURS', 'CLOTUREE'] },
        creePar: { oneOf: [objectId, ref('Personne')] },
        ...horodatage,
      },
    },
    Mission: {
      type: 'object',
      properties: {
        _id: objectId,
        campagne: { oneOf: [objectId, ref('Reference')] },
        centre: { oneOf: [objectId, ref('Reference')] },
        zoneAncetres: liste(objectId),
        datePrevue: { ...date, nullable: true },
        evaluateurs: { type: 'array', items: { oneOf: [objectId, ref('Personne')] } },
        superviseur: { oneOf: [objectId, ref('Personne')], nullable: true },
        statut: { type: 'string', enum: ['A_FAIRE', 'EN_COURS', 'TERMINEE', 'ANNULEE'] },
        evaluation: {
          type: 'object',
          nullable: true,
          description: 'Résumé de l\'évaluation de la mission',
          properties: { _id: objectId, statut: ref('StatutEvaluation'), score: { type: 'number' }, classe: ref('Classe') },
        },
        ...horodatage,
      },
    },
    Intervenant: {
      allOf: [ref('Personne'), {
        type: 'object',
        properties: { perimetres: { type: 'array', items: { type: 'string' }, example: ['District A'] } },
      }],
    },
  },
};
