// Libellés et couleurs de la planification (mêmes codes que les modèles Campagne, Mission, Evaluation).

export const STATUTS_CAMPAGNE = {
  PREPARATION: { libelle: 'En préparation', couleur: 'yellow' },
  EN_COURS: { libelle: 'En cours', couleur: 'blue' },
  CLOTUREE: { libelle: 'Clôturée', couleur: 'gray' },
};

// Statut de l'évaluation d'une mission : c'est lui qui dit où en est la visite
export const STATUTS_EVALUATION = {
  PLANIFIEE: { libelle: 'Planifiée', couleur: 'gray' },
  EN_COURS: { libelle: 'En cours', couleur: 'blue' },
  SOUMISE: { libelle: 'Soumise', couleur: 'violet' },
  A_CORRIGER: { libelle: 'À corriger', couleur: 'orange' },
  VALIDEE: { libelle: 'Validée', couleur: 'teal' },
  PUBLIEE: { libelle: 'Publiée', couleur: 'green' },
  ANNULEE: { libelle: 'Annulée', couleur: 'red' },
};

export const ORDRE_STATUTS_EVALUATION = ['VALIDEE', 'PUBLIEE', 'SOUMISE', 'A_CORRIGER', 'EN_COURS', 'PLANIFIEE', 'ANNULEE'];

export const ROLES_GESTION_CAMPAGNE = ['ADMINISTRATEUR', 'COORDONNATEUR'];
export const ROLES_LECTURE_CAMPAGNE = ['ADMINISTRATEUR', 'RESPONSABLE_NATIONAL', 'COORDONNATEUR', 'SUPERVISEUR', 'EVALUATEUR'];

/** Une mission est en retard si sa date est passée et que la visite n'est pas commencée ou terminée. */
export const estEnRetard = (mission) => {
  if (!mission.datePrevue || mission.statut === 'ANNULEE') return false;
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  return new Date(mission.datePrevue) < aujourdhui && ['PLANIFIEE', 'EN_COURS'].includes(mission.evaluation?.statut || 'PLANIFIEE');
};

export const nomsEquipe = (personnes = []) => personnes.map((p) => [p.prenom, p.nom].filter(Boolean).join(' ')).join(', ');
