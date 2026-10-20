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

/** Texte du périmètre d'une affectation (zone / centre peuplés par /auth/moi). */
export const libellePerimetre = ({ zone, centre }) => {
  if (centre) return `Centre : ${centre.nom}`;
  if (zone) return zone.nom;
  return 'National';
};
