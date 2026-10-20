const Grille = require('../models/Grille');
const Campagne = require('../models/Campagne');
const ApiError = require('../middlewares/ApiError');
const scoreService = require('./scoreService');

/**
 * Cycle de vie d'une grille : BROUILLON (modifiable) → PUBLIEE (figée) → ARCHIVEE.
 * Une seule version publiée par code : publier la version N archive la version précédente.
 * Modifier une grille publiée = créer une nouvelle version (brouillon), à publier ensuite.
 */

const obtenirGrille = async (id) => {
  const grille = await Grille.findById(id);
  if (!grille) throw ApiError.notFound('Grille non trouvée');
  return grille;
};

/** Liste résumée (sans le détail des critères) : nombre de domaines et de critères. */
const listerGrilles = async ({ statut, niveau, code } = {}) => {
  const filtre = {};
  if (statut) filtre.statut = statut;
  if (niveau) filtre.niveauxCibles = niveau;
  if (code) filtre.code = code;
  const grilles = await Grille.find(filtre).sort({ code: 1, version: -1 }).lean();
  return grilles.map(({ domaines, ...g }) => ({
    ...g,
    nbDomaines: domaines.length,
    nbCriteres: domaines.reduce((s, d) => s + d.criteres.length, 0),
    totalPoids: domaines.reduce((s, d) => s + (d.poids || 0), 0),
  }));
};

// Champs modifiables d'un brouillon (le code et la version sont fixés à la création)
const CHAMPS_CONTENU = ['nom', 'niveauxCibles', 'domaines', 'classes'];

const contenu = (donnees) => Object.fromEntries(
  CHAMPS_CONTENU.filter((c) => typeof donnees[c] !== 'undefined').map((c) => [c, donnees[c]]),
);

/** Nouvelle grille (version 1, brouillon). Pour un code existant, utiliser nouvelleVersion. */
const creerGrille = async (donnees = {}, auteurId) => {
  if (!donnees.code || !donnees.nom) throw ApiError.badRequest('Les champs code et nom sont obligatoires');
  const code = String(donnees.code).trim().toUpperCase();
  if (await Grille.exists({ code })) {
    throw ApiError.conflict(`La grille ${code} existe déjà : créez une nouvelle version de celle-ci`);
  }
  return Grille.create({ ...contenu(donnees), code, version: 1, statut: 'BROUILLON', creePar: auteurId });
};

/** Remplace le contenu d'un brouillon. */
const modifierGrille = async (id, donnees = {}) => {
  const grille = await obtenirGrille(id);
  if (grille.statut !== 'BROUILLON') {
    throw ApiError.conflict('Seul un brouillon est modifiable : créez une nouvelle version de cette grille');
  }
  grille.set(contenu(donnees));
  return grille.save();
};

/**
 * Contrôles avant publication. Les erreurs bloquent la publication, les avertissements non.
 * (Les codes uniques, les conditions et la somme des poids sont aussi vérifiés par le modèle.)
 */
const verifierPublication = (grille) => {
  const erreurs = [];
  const avertissements = [];
  const domaines = grille.domaines || [];

  if (!grille.niveauxCibles?.length) erreurs.push('Indiquez au moins un niveau de centre ciblé');
  if (!domaines.length) erreurs.push('La grille ne contient aucun domaine');

  const total = domaines.reduce((s, d) => s + (Number(d.poids) || 0), 0);
  if (domaines.length && Math.abs(total - 100) > 0.01) erreurs.push(`La somme des poids des domaines doit faire 100 % (actuellement ${total} %)`);

  const codes = new Set();
  for (const d of domaines) {
    if (codes.has(d.code)) erreurs.push(`Code en double : ${d.code}`);
    codes.add(d.code);
    if (!(d.poids > 0)) erreurs.push(`Domaine ${d.code} : le poids doit être supérieur à 0`);
    if (!d.criteres?.length) {
      erreurs.push(`Domaine ${d.code} : aucun critère`);
      continue;
    }
    if (!d.criteres.some(scoreService.estNote)) {
      avertissements.push(`Domaine ${d.code} : aucun critère noté, il n'aura pas de score`);
    }
    for (const c of d.criteres) {
      if (codes.has(c.code)) erreurs.push(`Code en double : ${c.code}`);
      codes.add(c.code);
      if (['CHOIX_UNIQUE', 'CHOIX_MULTIPLE'].includes(c.typeReponse)) {
        const options = c.options || [];
        if (!options.length) erreurs.push(`${c.code} : aucune option de réponse`);
        if (new Set(options.map((o) => o.code)).size !== options.length) erreurs.push(`${c.code} : codes d'options en double`);
        if (options.some((o) => !o.code)) erreurs.push(`${c.code} : une option n'a pas de code`);
      }
      if (c.typeReponse === 'NOMBRE' && !c.bareme?.seuils?.length) {
        avertissements.push(`${c.code} : nombre sans barème, il ne sera pas noté`);
      }
      if (scoreService.estNote(c) && !(c.pointsMax > 0)) erreurs.push(`${c.code} : les points maximum doivent être supérieurs à 0`);
      if (c.eliminatoire && !scoreService.estNote(c)) avertissements.push(`${c.code} : éliminatoire mais non noté, sans effet`);
      if (c.condition?.critere === c.code) erreurs.push(`${c.code} : un critère ne peut pas dépendre de lui-même`);
    }
  }

  const classes = [...(grille.classes || [])].sort((a, b) => b.min - a.min);
  if (!classes.length || classes[classes.length - 1].min !== 0) erreurs.push('La classe la plus basse doit commencer à 0');

  return { erreurs, avertissements };
};

/** Publie un brouillon (figé ensuite) et archive la version publiée précédente du même code. */
const publierGrille = async (id) => {
  const grille = await obtenirGrille(id);
  if (grille.statut !== 'BROUILLON') throw ApiError.conflict('Seul un brouillon peut être publié');
  const { erreurs, avertissements } = verifierPublication(grille);
  if (erreurs.length) throw ApiError.badRequest('La grille ne peut pas être publiée', erreurs);

  grille.statut = 'PUBLIEE';
  grille.publieeLe = new Date();
  await grille.save();
  const archivees = await Grille.updateMany(
    { code: grille.code, statut: 'PUBLIEE', _id: { $ne: grille._id } },
    { statut: 'ARCHIVEE' },
  );
  return { grille, avertissements, versionsArchivees: archivees.modifiedCount };
};

/** Copie une grille (quel que soit son statut) en brouillon, avec le numéro de version suivant. */
const nouvelleVersion = async (id, auteurId) => {
  const source = await obtenirGrille(id);
  if (await Grille.exists({ code: source.code, statut: 'BROUILLON' })) {
    throw ApiError.conflict(`Un brouillon de la grille ${source.code} existe déjà : modifiez-le ou supprimez-le`);
  }
  const derniere = await Grille.findOne({ code: source.code }).sort({ version: -1 }).select('version').lean();
  const copie = source.toObject({ depopulate: true });
  // Nouveaux identifiants pour la grille, ses domaines et ses critères
  delete copie._id;
  copie.domaines.forEach((d) => { delete d._id; d.criteres.forEach((c) => { delete c._id; }); });
  return Grille.create({
    ...copie, version: derniere.version + 1, statut: 'BROUILLON', publieeLe: undefined, creePar: auteurId,
    createdAt: undefined, updatedAt: undefined,
  });
};

const archiverGrille = async (id) => {
  const grille = await obtenirGrille(id);
  if (grille.statut !== 'PUBLIEE') throw ApiError.conflict('Seule une grille publiée peut être archivée');
  grille.statut = 'ARCHIVEE';
  return grille.save();
};

/** Supprime un brouillon jamais utilisé. Une grille publiée ou archivée se conserve (historique). */
const supprimerGrille = async (id) => {
  const grille = await obtenirGrille(id);
  if (grille.statut !== 'BROUILLON') throw ApiError.conflict('Seul un brouillon peut être supprimé');
  if (await Campagne.exists({ grille: grille._id })) throw ApiError.conflict('Ce brouillon est utilisé par une campagne');
  await grille.deleteOne();
  return grille;
};

/** Aperçu : calcule le score qu'obtiendraient ces réponses avec cette grille (rien n'est enregistré). */
const simulerScore = async (id, reponses = []) => {
  const grille = await Grille.findById(id).lean();
  if (!grille) throw ApiError.notFound('Grille non trouvée');
  return scoreService.calculer({ reponses }, grille);
};

module.exports = {
  obtenirGrille, listerGrilles, creerGrille, modifierGrille, verifierPublication, publierGrille,
  nouvelleVersion, archiverGrille, supprimerGrille, simulerScore,
};
