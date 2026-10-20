// Libellés des grilles (mêmes codes que backend/models/enumUtils.js et Critere.js).

export const LIBELLES_TYPES_REPONSE = {
  OUI_NON: 'Oui / Non',
  ECHELLE_0_3: 'Échelle de 0 à 3',
  NOMBRE: 'Nombre (avec barème)',
  CHOIX_UNIQUE: 'Choix unique',
  CHOIX_MULTIPLE: 'Choix multiple',
  TEXTE: 'Texte libre',
  PHOTO: 'Photo',
  GPS: 'Position GPS',
  DATE: 'Date',
};

// Types qui ne rapportent pas de points (informatifs)
export const TYPES_NON_NOTES = ['TEXTE', 'PHOTO', 'GPS', 'DATE'];
export const TYPES_A_OPTIONS = ['CHOIX_UNIQUE', 'CHOIX_MULTIPLE'];

export const LIBELLES_PREUVES = { AUCUNE: 'Aucune', PHOTO: 'Photo', DOCUMENT: 'Document' };

export const STATUTS_GRILLE = {
  BROUILLON: { libelle: 'Brouillon', couleur: 'yellow' },
  PUBLIEE: { libelle: 'Publiée', couleur: 'teal' },
  ARCHIVEE: { libelle: 'Archivée', couleur: 'gray' },
};

/** Le critère rapporte-t-il des points ? (même règle que le backend) */
export const estNote = (c) => !TYPES_NON_NOTES.includes(c.typeReponse)
  && !(c.typeReponse === 'NOMBRE' && !c.bareme?.seuils?.length)
  && (c.pointsMax ?? 1) > 0;

/** Classes A/B/C/D à partir des trois seuils (A ≥ seuilA, B ≥ seuilB, C ≥ seuilC, D en dessous). */
export const classesDepuisSeuils = ({ A, B, C }) => [
  { classe: 'A', min: A, max: 100 }, { classe: 'B', min: B, max: A },
  { classe: 'C', min: C, max: B }, { classe: 'D', min: 0, max: C },
];

export const seuilsDepuisClasses = (classes = []) => {
  const min = (k, defaut) => classes.find((c) => c.classe === k)?.min ?? defaut;
  return { A: min('A', 80), B: min('B', 60), C: min('C', 40) };
};
