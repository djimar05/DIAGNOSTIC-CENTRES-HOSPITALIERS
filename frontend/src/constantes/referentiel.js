// Libellés du référentiel (mêmes codes que backend/models/enumUtils.js et Centre.js).

export const NIVEAUX_ZONE = ['NATIONAL', 'REGION', 'DISTRICT', 'ZONE_RESPONSABILITE'];

export const LIBELLES_NIVEAUX_ZONE = {
  NATIONAL: 'National',
  REGION: 'Région',
  DISTRICT: 'District',
  ZONE_RESPONSABILITE: 'Zone de responsabilité',
};

/** Niveau des sous-zones d'une zone (null pour le dernier niveau). */
export const niveauEnfant = (niveau) => NIVEAUX_ZONE[NIVEAUX_ZONE.indexOf(niveau) + 1] || null;
export const niveauParent = (niveau) => NIVEAUX_ZONE[NIVEAUX_ZONE.indexOf(niveau) - 1] || null;

export const LIBELLES_NIVEAUX_CENTRE = {
  HOPITAL_NATIONAL: 'Hôpital national',
  HOPITAL_REGIONAL: 'Hôpital régional',
  HOPITAL_DISTRICT: 'Hôpital de district',
  CENTRE_SANTE: 'Centre de santé',
  POSTE_SANTE: 'Poste de santé',
  AUTRE: 'Autre',
};

export const LIBELLES_STATUTS_JURIDIQUES = {
  PUBLIC: 'Public',
  CONFESSIONNEL: 'Confessionnel',
  PRIVE: 'Privé',
  COMMUNAUTAIRE: 'Communautaire',
  ONG: 'ONG',
};

// Suggestions pour le champ « services » (saisie libre possible)
export const SERVICES_COURANTS = [
  'CONSULTATION', 'MATERNITE', 'URGENCES', 'LABORATOIRE', 'IMAGERIE', 'BLOC', 'VACCINATION',
  'PHARMACIE', 'HOSPITALISATION', 'PEDIATRIE', 'NUTRITION', 'PLANIFICATION_FAMILIALE',
];

export const COULEURS_CLASSES = { A: 'teal', B: 'lime', C: 'orange', D: 'red' };

export const LIBELLES_STATUTS_EVALUATION = {
  PLANIFIEE: 'Planifiée', EN_COURS: 'En cours', SOUMISE: 'Soumise', A_CORRIGER: 'À corriger',
  VALIDEE: 'Validée', PUBLIEE: 'Publiée', ANNULEE: 'Annulée',
};

export const LIBELLES_STATUTS_ACTION = {
  A_FAIRE: 'À faire', EN_COURS: 'En cours', REALISEE: 'Réalisée', VERIFIEE: 'Vérifiée', ABANDONNEE: 'Abandonnée',
};

export const LIBELLES_PRIORITES = { HAUTE: 'Haute', MOYENNE: 'Moyenne', BASSE: 'Basse' };

export const options = (libelles) => Object.entries(libelles).map(([value, label]) => ({ value, label }));
