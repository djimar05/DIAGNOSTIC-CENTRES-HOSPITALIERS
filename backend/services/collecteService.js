const Campagne = require('../models/Campagne');
const Evaluation = require('../models/Evaluation');
const Fichier = require('../models/Fichier');
const Grille = require('../models/Grille');
const Mission = require('../models/Mission');
const ApiError = require('../middlewares/ApiError');
const perimetre = require('./perimetrePlanification');
const scoreService = require('./scoreService');

/**
 * Collecte sur le terrain (application mobile, en ligne) :
 *   PLANIFIEE → (démarrer) EN_COURS → (soumettre) SOUMISE ; A_CORRIGER → (soumettre) SOUMISE
 * Seuls les évaluateurs de la mission saisissent, et seulement pendant que la campagne est en cours.
 * Chaque réponse garde une copie du libellé et du barème du critère (historique fiable).
 */

const STATUTS_MODIFIABLES = ['EN_COURS', 'A_CORRIGER'];
const LIBELLES_STATUTS = {
  PLANIFIEE: 'planifiée (démarrez d\'abord la visite)', EN_COURS: 'en cours', SOUMISE: 'soumise', A_CORRIGER: 'à corriger',
  VALIDEE: 'validée', PUBLIEE: 'publiée', ANNULEE: 'annulée',
};
const TYPES_PREUVE = { PHOTO: 'photo', DOCUMENT: 'document' };
const memeId = (a, b) => String(a) === String(b);

// ─── Lecture ───

/**
 * Tout ce que le téléphone doit télécharger, en un seul appel :
 * les missions de l'évaluateur (campagnes en cours) et les grilles correspondantes (une fois chacune).
 */
const mesMissions = async (req) => {
  const campagnesEnCours = await Campagne.distinct('_id', { statut: 'EN_COURS' });
  const missions = await Mission.find({ evaluateurs: req.utilisateur._id, campagne: { $in: campagnesEnCours }, statut: { $ne: 'ANNULEE' } })
    .populate({ path: 'centre', select: 'code nom niveau localite gps responsable zone', populate: { path: 'zone', select: 'nom code' } })
    .populate('campagne', 'nom dateDebut dateFin statut')
    .populate('evaluateurs', 'nom prenom telephone')
    .populate('superviseur', 'nom prenom telephone')
    .sort({ datePrevue: 1 })
    .lean();
  const evaluations = await Evaluation.find({ mission: { $in: missions.map((m) => m._id) } })
    .select('mission statut grille grilleVersion syncVersion debut soumisLe reponses.critereCode validation.motif updatedAt')
    .lean();
  const parMission = new Map(evaluations.map((e) => [String(e.mission), e]));
  const grilles = await Grille.find({ _id: { $in: [...new Set(evaluations.map((e) => String(e.grille)))] } })
    .select('code nom version niveauxCibles domaines classes updatedAt').lean();

  return {
    missions: missions.map((m) => {
      const e = parMission.get(String(m._id));
      return {
        ...m,
        evaluation: e && {
          _id: e._id, statut: e.statut, grille: e.grille, grilleVersion: e.grilleVersion, syncVersion: e.syncVersion,
          debut: e.debut, soumisLe: e.soumisLe, nbReponses: e.reponses.length, motifCorrection: e.validation?.motif, updatedAt: e.updatedAt,
        },
      };
    }),
    grilles,
  };
};

/** Grille d'une évaluation (figée : le téléphone peut la garder en cache, l'ETag évite de la retélécharger). */
const grillePourMobile = async (id) => {
  const grille = await Grille.findById(id).select('code nom version niveauxCibles domaines classes statut updatedAt').lean();
  if (!grille) throw ApiError.notFound('Grille non trouvée');
  return grille;
};

/** Évaluation visible par l'utilisateur (périmètre ou équipe), avec ses réponses et ses fichiers. */
const obtenirEvaluation = async (req, id) => {
  const evaluation = await Evaluation.findOne({ $and: [{ _id: id }, await perimetre.filtreEvaluations(req)] })
    .populate('evaluePar', 'nom prenom')
    .lean();
  if (!evaluation) throw ApiError.notFound('Évaluation non trouvée');
  const fichiers = await Fichier.find({ evaluation: evaluation._id })
    .select('critereCode type mime tailleOctets prisLe gps televersePar createdAt').lean();
  return { ...evaluation, fichiers };
};

// ─── Contrôles communs ───

/** Charge l'évaluation pour une saisie : évaluateur de la mission, campagne en cours, statut attendu. */
const chargerPourSaisie = async (req, id, statutsAutorises = STATUTS_MODIFIABLES) => {
  const evaluation = await Evaluation.findById(id);
  if (!evaluation) throw ApiError.notFound('Évaluation non trouvée');
  const mission = await Mission.findById(evaluation.mission);
  if (!mission || !mission.evaluateurs.some((e) => memeId(e, req.utilisateur._id))) {
    throw ApiError.forbidden('Seuls les évaluateurs de la mission peuvent saisir cette évaluation');
  }
  const campagne = await Campagne.findById(evaluation.campagne).select('statut').lean();
  if (campagne?.statut !== 'EN_COURS') throw ApiError.conflict('La campagne n\'est pas en cours : saisie impossible');
  if (!statutsAutorises.includes(evaluation.statut)) {
    throw ApiError.conflict(`Action impossible : l'évaluation est ${LIBELLES_STATUTS[evaluation.statut] || evaluation.statut}`);
  }
  return { evaluation, mission };
};

/** Critères de la grille indexés par code, avec leur domaine. */
const indexerCriteres = (grille) => {
  const index = new Map();
  grille.domaines.forEach((d) => d.criteres.forEach((c) => index.set(c.code, { critere: c, domaine: d })));
  return index;
};

const gpsValide = (g) => g && Array.isArray(g.coordinates) && g.coordinates.length === 2
  && g.coordinates[0] >= -180 && g.coordinates[0] <= 180 && g.coordinates[1] >= -90 && g.coordinates[1] <= 90;

// ─── Démarrage ───

/**
 * Démarre la visite : statut EN_COURS, heure de début et position GPS (preuve de passage sur place).
 * Déjà démarrée par un coéquipier : l'utilisateur est simplement ajouté aux évaluateurs.
 */
const demarrer = async (req, id, { gps, debut } = {}) => {
  const { evaluation, mission } = await chargerPourSaisie(req, id, ['PLANIFIEE', 'EN_COURS']);
  if (gps && !gpsValide(gps)) throw ApiError.badRequest('Position GPS invalide : { coordinates: [longitude, latitude] }');
  if (!evaluation.evaluePar.some((e) => memeId(e, req.utilisateur._id))) evaluation.evaluePar.push(req.utilisateur._id);

  const premierDemarrage = evaluation.statut === 'PLANIFIEE';
  if (premierDemarrage) {
    evaluation.statut = 'EN_COURS';
    evaluation.debut = debut ? new Date(debut) : new Date();
    evaluation.historiqueStatuts.push({ statut: 'EN_COURS', par: req.utilisateur._id, le: new Date() });
    mission.statut = 'EN_COURS';
    await mission.save();
  }
  if (gps && !evaluation.gpsVisite?.coordinates?.length) {
    evaluation.gpsVisite = { type: 'Point', coordinates: gps.coordinates, precisionMetres: gps.precisionMetres };
  }
  await evaluation.save();
  return { evaluation, premierDemarrage };
};

// ─── Réponses ───

/** Valeur enregistrée pour un critère, ou message d'erreur. */
const validerValeur = (critere, valeur, fichiers) => {
  switch (critere.typeReponse) {
    case 'PHOTO':
      return { valeur: fichiers.length || null }; // la réponse, ce sont les photos
    case 'TEXTE':
      return typeof valeur === 'string' ? { valeur: valeur.trim().slice(0, 5000) || null } : { erreur: 'texte attendu' };
    case 'DATE':
      return Number.isNaN(Date.parse(valeur)) ? { erreur: 'date invalide' } : { valeur };
    case 'GPS':
      return gpsValide(valeur) ? { valeur: { type: 'Point', coordinates: valeur.coordinates } } : { erreur: 'position GPS invalide' };
    default: {
      if (!scoreService.estNote(critere)) return { valeur };
      const { erreur } = scoreService.pointsPour(critere, valeur);
      return erreur ? { erreur } : { valeur };
    }
  }
};

/**
 * Enregistre des réponses (une ou plusieurs ; les autres ne changent pas).
 * Chaque réponse : { critereCode, valeur?, sansObjet?, observation?, fichiers?: [id], saisiLe? }.
 * Une réponse sans valeur, ni « sans objet », ni observation, ni photo est retirée.
 * Tout ou rien : la moindre réponse invalide fait échouer l'enregistrement (400, détail par critère).
 */
const enregistrerReponses = async (req, id, { reponses = [], observationsGenerales, personnesRencontrees } = {}) => {
  const { evaluation } = await chargerPourSaisie(req, id);
  const grille = await Grille.findById(evaluation.grille).lean();
  const criteres = indexerCriteres(grille);
  const fichiersEvaluation = new Map((await Fichier.find({ evaluation: evaluation._id }).select('critereCode').lean())
    .map((f) => [String(f._id), f]));

  const erreurs = [];
  const parCode = new Map(evaluation.reponses.map((r) => [r.critereCode, r.toObject()]));
  for (const saisie of reponses) {
    const trouve = criteres.get(saisie.critereCode);
    if (!trouve) { erreurs.push(`${saisie.critereCode} : critère inconnu dans cette grille`); continue; }
    const { critere, domaine } = trouve;
    const fichiers = (saisie.fichiers || []).map(String);
    const etranger = fichiers.find((f) => fichiersEvaluation.get(f)?.critereCode !== critere.code);
    if (etranger) { erreurs.push(`${critere.code} : fichier ${etranger} introuvable pour ce critère`); continue; }
    if (saisie.sansObjet && !critere.sansObjetAutorise) { erreurs.push(`${critere.code} : « sans objet » n'est pas autorisé`); continue; }

    let valeur = null;
    if (!saisie.sansObjet && (saisie.valeur !== undefined && saisie.valeur !== null && saisie.valeur !== '' || critere.typeReponse === 'PHOTO')) {
      const resultat = validerValeur(critere, saisie.valeur, fichiers);
      if (resultat.erreur) { erreurs.push(`${critere.code} : ${resultat.erreur}`); continue; }
      valeur = resultat.valeur;
    }
    const observation = typeof saisie.observation === 'string' ? saisie.observation.trim().slice(0, 2000) : '';
    if (valeur === null && !saisie.sansObjet && !observation && !fichiers.length) {
      parCode.delete(critere.code);
      continue;
    }
    const points = valeur !== null && scoreService.estNote(critere) ? scoreService.pointsPour(critere, valeur).points : null;
    parCode.set(critere.code, {
      domaineCode: domaine.code,
      critereCode: critere.code,
      libelle: critere.libelle,
      typeReponse: critere.typeReponse,
      valeur,
      sansObjet: Boolean(saisie.sansObjet),
      points,
      pointsMax: critere.pointsMax,
      poids: critere.poids,
      eliminatoireNonSatisfait: Boolean(critere.eliminatoire && points === 0),
      observation,
      fichiers,
      saisiLe: saisie.saisiLe ? new Date(saisie.saisiLe) : new Date(),
      modifiePar: req.utilisateur._id,
    });
  }
  if (erreurs.length) throw ApiError.badRequest('Réponses invalides : rien n\'a été enregistré', erreurs);

  evaluation.reponses = [...parCode.values()];
  if (typeof observationsGenerales === 'string') evaluation.observationsGenerales = observationsGenerales.trim().slice(0, 5000);
  if (Array.isArray(personnesRencontrees)) {
    evaluation.personnesRencontrees = personnesRencontrees.filter((p) => p?.nom).map((p) => ({ nom: String(p.nom), fonction: p.fonction ? String(p.fonction) : undefined }));
  }
  evaluation.syncVersion += 1;
  if (!evaluation.evaluePar.some((e) => memeId(e, req.utilisateur._id))) evaluation.evaluePar.push(req.utilisateur._id);
  await evaluation.save();
  return evaluation;
};

// ─── Vérification et soumission ───

/**
 * Ce qui manque avant de pouvoir soumettre : réponses obligatoires, preuves exigées, valeurs invalides.
 * Donne aussi la progression par domaine (critères répondus / applicables).
 */
const verifier = (evaluation, grille) => {
  const resultat = scoreService.calculer({ reponses: evaluation.reponses }, grille);
  const reponses = new Map(evaluation.reponses.map((r) => [r.critereCode, r]));
  const applicable = new Map(resultat.criteres.map((c) => [c.critereCode, c.applicable]));
  const libelles = indexerCriteres(grille);

  const preuvesManquantes = [];
  grille.domaines.forEach((d) => d.criteres.forEach((c) => {
    if (!TYPES_PREUVE[c.preuveExigee] || !applicable.get(c.code)) return;
    const r = reponses.get(c.code);
    if (r && !r.sansObjet && !(r.fichiers || []).length) preuvesManquantes.push({ critereCode: c.code, preuve: c.preuveExigee });
  }));

  const detail = (code) => ({ critereCode: code, libelle: libelles.get(code)?.critere.libelle, domaineCode: libelles.get(code)?.domaine.code });
  return {
    complet: !resultat.manquants.length && !preuvesManquantes.length && !resultat.erreurs.length,
    manquants: resultat.manquants.map(detail),
    preuvesManquantes: preuvesManquantes.map((p) => ({ ...detail(p.critereCode), preuve: p.preuve })),
    erreurs: resultat.erreurs,
    progression: resultat.scores.domaines.map((d) => ({
      domaineCode: d.domaineCode, nom: d.nom, repondus: d.criteresRepondus, total: d.criteresTotal,
    })),
  };
};

const verificationEvaluation = async (req, id) => {
  const evaluation = await Evaluation.findOne({ $and: [{ _id: id }, await perimetre.filtreEvaluations(req)] }).lean();
  if (!evaluation) throw ApiError.notFound('Évaluation non trouvée');
  return verifier(evaluation, await Grille.findById(evaluation.grille).lean());
};

/** Soumet l'évaluation au superviseur, si elle est complète. */
const soumettre = async (req, id) => {
  const { evaluation } = await chargerPourSaisie(req, id);
  const controle = verifier(evaluation.toObject(), await Grille.findById(evaluation.grille).lean());
  if (!controle.complet) {
    throw ApiError.badRequest('L\'évaluation est incomplète', [
      ...controle.manquants.map((m) => `${m.critereCode} : réponse manquante`),
      ...controle.preuvesManquantes.map((p) => `${p.critereCode} : ${TYPES_PREUVE[p.preuve]} exigée`),
      ...controle.erreurs,
    ]);
  }
  const maintenant = new Date();
  const resoumission = evaluation.statut === 'A_CORRIGER';
  evaluation.statut = 'SOUMISE';
  evaluation.soumisLe = maintenant;
  evaluation.fin = evaluation.fin && !resoumission ? evaluation.fin : maintenant;
  evaluation.historiqueStatuts.push({ statut: 'SOUMISE', par: req.utilisateur._id, le: maintenant });
  await evaluation.save();
  return { evaluation, resoumission };
};

module.exports = {
  mesMissions, grillePourMobile, obtenirEvaluation, demarrer, enregistrerReponses, verificationEvaluation, soumettre,
  chargerPourSaisie, indexerCriteres, STATUTS_MODIFIABLES,
};
