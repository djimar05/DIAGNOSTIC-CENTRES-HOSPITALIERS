// Formes des données renvoyées par l'API (voir la documentation Swagger : /api/docs).

export type Role =
  | 'ADMINISTRATEUR' | 'RESPONSABLE_NATIONAL' | 'COORDONNATEUR' | 'EVALUATEUR'
  | 'SUPERVISEUR' | 'RESPONSABLE_CENTRE' | 'PARTENAIRE';

export type StatutEvaluation = 'PLANIFIEE' | 'EN_COURS' | 'SOUMISE' | 'A_CORRIGER' | 'VALIDEE' | 'PUBLIEE' | 'ANNULEE';

export type Reference = { _id: string; code?: string; nom: string; niveau?: string };

export type Personne = { _id: string; nom: string; prenom?: string; telephone?: string };

export type Gps = { type?: 'Point'; coordinates: [number, number]; precisionMetres?: number };

export type Utilisateur = Personne & {
  email?: string;
  fonction?: string;
  langue: 'fr' | 'ar';
  motDePasseAChanger: boolean;
  derniereConnexion?: string;
};

export type Profil = Utilisateur & {
  roles: Role[];
  affectations: { _id: string; role: Role; zone?: Reference | null; centre?: Reference | null }[];
};

// ─── Grille ───

export type TypeReponse = 'OUI_NON' | 'ECHELLE_0_3' | 'NOMBRE' | 'CHOIX_UNIQUE' | 'CHOIX_MULTIPLE' | 'TEXTE' | 'PHOTO' | 'GPS' | 'DATE';

export type Critere = {
  _id?: string;
  code: string;
  libelle: string;
  aide?: string;
  typeReponse: TypeReponse;
  options?: { code: string; libelle: string; points: number }[];
  bareme?: { seuils: { min?: number; max?: number; points: number }[] };
  pointsMax?: number;
  poids?: number;
  obligatoire?: boolean;
  eliminatoire?: boolean;
  sansObjetAutorise?: boolean;
  preuveExigee?: 'AUCUNE' | 'PHOTO' | 'DOCUMENT';
  condition?: { critere?: string; valeur?: unknown };
};

export type Domaine = { code: string; nom: string; poids: number; criteres: Critere[] };

export type Grille = { _id: string; code: string; nom: string; version: number; domaines: Domaine[] };

// ─── Missions et évaluations ───

export type ResumeEvaluation = {
  _id: string;
  statut: StatutEvaluation;
  grille: string;
  grilleVersion: number;
  syncVersion: number;
  debut?: string;
  soumisLe?: string;
  nbReponses: number;
  motifCorrection?: string;
};

export type Mission = {
  _id: string;
  campagne: { _id: string; nom: string; statut: 'PREPARATION' | 'EN_COURS' | 'CLOTUREE'; dateDebut?: string; dateFin?: string };
  centre: Reference & { zone?: Reference; localite?: string; gps?: Gps; responsable?: { nom?: string; telephone?: string } };
  datePrevue?: string | null;
  evaluateurs: Personne[];
  superviseur?: Personne | null;
  statut: 'A_FAIRE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE';
  evaluation: ResumeEvaluation | null;
};

export type MesMissions = { missions: Mission[]; grilles: Grille[] };

export type Reponse = {
  critereCode: string;
  domaineCode?: string;
  valeur?: unknown;
  sansObjet?: boolean;
  observation?: string;
  fichiers?: string[];
  points?: number | null;
  saisiLe?: string;
};

export type Fichier = { _id: string; critereCode: string; type: 'PHOTO' | 'DOCUMENT'; mime: string; prisLe?: string };

export type Evaluation = {
  _id: string;
  mission: string;
  grille: string;
  statut: StatutEvaluation;
  debut?: string;
  gpsVisite?: Gps;
  reponses: Reponse[];
  observationsGenerales?: string;
  syncVersion: number;
  fichiers: Fichier[];
  validation?: { motif?: string };
};

export type ElementManquant = { critereCode: string; libelle?: string; domaineCode?: string; preuve?: 'PHOTO' | 'DOCUMENT' };

export type Verification = {
  complet: boolean;
  manquants: ElementManquant[];
  preuvesManquantes: ElementManquant[];
  erreurs: string[];
  progression: { domaineCode: string; nom: string; repondus: number; total: number }[];
};
