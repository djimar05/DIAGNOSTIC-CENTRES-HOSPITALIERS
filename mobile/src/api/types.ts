// Formes des données renvoyées par l'API (voir la documentation Swagger : /api/docs).

export type Role =
  | 'ADMINISTRATEUR' | 'RESPONSABLE_NATIONAL' | 'COORDONNATEUR' | 'EVALUATEUR'
  | 'SUPERVISEUR' | 'RESPONSABLE_CENTRE' | 'PARTENAIRE';

export type StatutEvaluation = 'PLANIFIEE' | 'EN_COURS' | 'SOUMISE' | 'A_CORRIGER' | 'VALIDEE' | 'PUBLIEE' | 'ANNULEE';

export type Reference = { _id: string; code?: string; nom: string; niveau?: string };

export type Personne = { _id: string; nom: string; prenom?: string; telephone?: string };

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

export type Mission = {
  _id: string;
  campagne: { _id: string; nom: string; statut: 'PREPARATION' | 'EN_COURS' | 'CLOTUREE' };
  centre: Reference & { zone?: Reference };
  datePrevue?: string | null;
  evaluateurs: Personne[];
  superviseur?: Personne | null;
  statut: 'A_FAIRE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE';
  evaluation: { _id: string; statut: StatutEvaluation; score?: number; classe?: string } | null;
};
