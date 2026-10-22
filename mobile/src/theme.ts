// Couleurs et espacements communs (mêmes teintes que l'application web).

export const couleurs = {
  primaire: '#0b7285',
  primaireClair: '#e3fafc',
  texte: '#1a1b1e',
  texteSecondaire: '#5c5f66',
  bordure: '#dee2e6',
  fond: '#f8f9fa',
  carte: '#ffffff',
  erreur: '#e03131',
  erreurClair: '#fff5f5',
  alerte: '#e8590c',
  alerteClair: '#fff4e6',
  succes: '#2b8a3e',
};

export const espace = { xs: 4, sm: 8, md: 16, lg: 24 };

// Statut de l'évaluation d'une mission : libellé et couleur
export const STATUTS_EVALUATION: Record<string, { libelle: string; couleur: string }> = {
  PLANIFIEE: { libelle: 'À faire', couleur: '#868e96' },
  EN_COURS: { libelle: 'En cours', couleur: '#1c7ed6' },
  SOUMISE: { libelle: 'Soumise', couleur: '#7048e8' },
  A_CORRIGER: { libelle: 'À corriger', couleur: '#e8590c' },
  VALIDEE: { libelle: 'Validée', couleur: '#0ca678' },
  PUBLIEE: { libelle: 'Publiée', couleur: '#2b8a3e' },
  ANNULEE: { libelle: 'Annulée', couleur: '#e03131' },
};
