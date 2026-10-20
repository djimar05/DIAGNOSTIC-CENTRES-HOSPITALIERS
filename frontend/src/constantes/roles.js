// Libellés des rôles (mêmes codes que backend/models/enumUtils.js).
export const LIBELLES_ROLES = {
  ADMINISTRATEUR: 'Administrateur',
  RESPONSABLE_NATIONAL: 'Responsable national',
  COORDONNATEUR: 'Coordonnateur',
  EVALUATEUR: 'Évaluateur',
  SUPERVISEUR: 'Superviseur qualité',
  RESPONSABLE_CENTRE: 'Responsable de centre',
  PARTENAIRE: 'Partenaire',
};

export const libelleRole = (role) => LIBELLES_ROLES[role] || role;

export const ROLES = Object.keys(LIBELLES_ROLES);

// Rôles qu'un coordonnateur peut attribuer dans son périmètre (même liste que le backend).
export const ROLES_DELEGABLES = ['EVALUATEUR', 'SUPERVISEUR', 'RESPONSABLE_CENTRE'];

export const COULEURS_ROLES = {
  ADMINISTRATEUR: 'red',
  RESPONSABLE_NATIONAL: 'grape',
  COORDONNATEUR: 'indigo',
  EVALUATEUR: 'teal',
  SUPERVISEUR: 'cyan',
  RESPONSABLE_CENTRE: 'orange',
  PARTENAIRE: 'gray',
};

export const LIBELLES_LANGUES = { fr: 'Français', ar: 'العربية (arabe)' };

// Actions tracées dans le journal d'activité.
export const LIBELLES_ACTIONS = {
  CONNEXION: 'Connexion',
  MOT_DE_PASSE_CHANGE: 'Mot de passe changé',
  MOT_DE_PASSE_REINITIALISE: 'Mot de passe réinitialisé',
  UTILISATEUR_CREE: 'Utilisateur créé',
  UTILISATEUR_MODIFIE: 'Utilisateur modifié',
  UTILISATEUR_SUPPRIME: 'Utilisateur supprimé',
  AFFECTATION_CREEE: 'Affectation créée',
  AFFECTATION_MODIFIEE: 'Affectation modifiée',
  AFFECTATION_RETIREE: 'Affectation retirée',
  ZONE_CREEE: 'Zone créée',
  ZONE_MODIFIEE: 'Zone modifiée',
  CENTRE_CREE: 'Centre créé',
  CENTRE_MODIFIE: 'Centre modifié',
  CENTRES_IMPORTES: 'Import de centres',
};

export const libelleAction = (action) => LIBELLES_ACTIONS[action] || action;

/** Texte du périmètre d'une affectation (zone / centre peuplés par /auth/moi). */
export const libellePerimetre = ({ zone, centre }) => {
  if (centre) return `Centre : ${centre.nom}`;
  if (zone) return zone.nom;
  return 'National';
};
