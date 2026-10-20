// ───────────────────────────── Énumérations ─────────────────────────────

// Profils disponibles dans l'application (voir le cahier des charges, section « Périmètre et utilisateurs »).
const ROLES = [
  'ADMINISTRATEUR',       // gère comptes, grilles, paramètres
  'RESPONSABLE_NATIONAL', // consulte tout, valide les rapports finaux
  'COORDONNATEUR',        // planifie les missions de sa région / son district
  'EVALUATEUR',           // remplit les grilles sur le terrain
  'SUPERVISEUR',          // contrôle et valide les évaluations
  'RESPONSABLE_CENTRE',   // suit les résultats et les actions de son centre
  'PARTENAIRE',           // lecture des tableaux de bord agrégés
];

// Niveaux du découpage sanitaire (du plus large au plus fin).
const NIVEAUX_ZONE = ['NATIONAL', 'REGION', 'DISTRICT', 'ZONE_RESPONSABILITE'];

// Niveaux de la pyramide sanitaire : une grille peut viser un ou plusieurs niveaux.
const NIVEAUX_CENTRE = [
  'HOPITAL_NATIONAL', 'HOPITAL_REGIONAL', 'HOPITAL_DISTRICT', 'CENTRE_SANTE', 'POSTE_SANTE', 'AUTRE',
];

// Formes de réponse possibles pour un critère.
//   OUI_NON        → "Oui" / "Non"                  ex. « Organigramme affiché ? »
//   ECHELLE_0_3    → 0, 1, 2 ou 3                   ex. « Propreté générale des locaux »
//   NOMBRE         → valeur numérique               ex. « Nombre de médecins » : 2
//   CHOIX_UNIQUE   → une option dans une liste      ex. « Source d'énergie » : SOLAIRE
//   CHOIX_MULTIPLE → plusieurs options              ex. « Services disponibles » : [MATERNITE, LABO]
//   TEXTE          → texte libre                    ex. « Principales difficultés signalées »
//   PHOTO          → une photo obligatoire          ex. « Photo de la façade »
//   GPS            → position                       ex. « Position de l'entrée principale »
//   DATE           → une date                       ex. « Date du dernier passage de maintenance »
const TYPES_REPONSE = ['OUI_NON', 'ECHELLE_0_3', 'NOMBRE', 'CHOIX_UNIQUE', 'CHOIX_MULTIPLE', 'TEXTE', 'PHOTO', 'GPS', 'DATE'];

// Cycle de vie d'une évaluation :
//   PLANIFIEE → EN_COURS → SOUMISE → VALIDEE → PUBLIEE
//                              ↘ A_CORRIGER → SOUMISE (retour au superviseur)
const STATUTS_EVALUATION = ['PLANIFIEE', 'EN_COURS', 'SOUMISE', 'A_CORRIGER', 'VALIDEE', 'PUBLIEE', 'ANNULEE'];

// Classes de performance : A ≥ 80, B 60–79, C 40–59, D < 40 (seuils réglables dans la grille).
const CLASSES = ['A', 'B', 'C', 'D'];

module.exports = {
  ROLES,
  NIVEAUX_ZONE,
  NIVEAUX_CENTRE,
  TYPES_REPONSE,
  STATUTS_EVALUATION,
  CLASSES,
};
