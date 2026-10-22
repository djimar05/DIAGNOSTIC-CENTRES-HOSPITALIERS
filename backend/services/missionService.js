const Campagne = require('../models/Campagne');
const Evaluation = require('../models/Evaluation');
const Mission = require('../models/Mission');
const ApiError = require('../middlewares/ApiError');
const equipeService = require('./equipeService');
const perimetre = require('./perimetrePlanification');

/**
 * Missions : un centre à visiter dans une campagne, avec son équipe et sa date prévue.
 * L'équipe et la date restent modifiables tant que l'évaluation n'est pas validée.
 */

const STATUTS_EVALUATION_FIGES = ['VALIDEE', 'PUBLIEE', 'ANNULEE'];
const debutDuJour = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

const PEUPLEMENT = [
  { path: 'centre', select: 'code nom niveau zone', populate: { path: 'zone', select: 'nom code' } },
  { path: 'evaluateurs', select: 'nom prenom telephone' },
  { path: 'superviseur', select: 'nom prenom telephone' },
  { path: 'campagne', select: 'nom statut' },
];

/** Ajoute à chaque mission le statut et le score de son évaluation. */
const avecEvaluation = async (missions) => {
  const evaluations = await Evaluation.find({ mission: { $in: missions.map((m) => m._id) } })
    .select('mission statut scores.global scores.classe').lean();
  const parMission = new Map(evaluations.map((e) => [String(e.mission), e]));
  return missions.map((m) => {
    const e = parMission.get(String(m._id));
    return { ...m, evaluation: e ? { _id: e._id, statut: e.statut, score: e.scores?.global, classe: e.scores?.classe } : null };
  });
};

/**
 * Missions visibles. Filtres : campagne, statut, centre, evaluateur, du / au (date prévue),
 * sansEquipe, sansDate, enRetard. Pour le calendrier : du / au ; jusqu'à 1000 missions.
 */
const listerMissions = async (req, {
  campagne, statut, centre, evaluateur, du, au, sansEquipe, sansDate, enRetard, limite = 500,
} = {}) => {
  const conditions = [await perimetre.filtreMissions(req)];
  if (campagne) conditions.push({ campagne });
  if (statut) conditions.push({ statut });
  if (centre) conditions.push({ centre });
  if (evaluateur) conditions.push({ evaluateurs: evaluateur });
  if (du || au) conditions.push({ datePrevue: { ...(du && { $gte: new Date(du) }), ...(au && { $lte: new Date(au) }) } });
  if (sansEquipe === 'true') conditions.push({ evaluateurs: { $size: 0 }, statut: { $ne: 'ANNULEE' } });
  if (sansDate === 'true') conditions.push({ datePrevue: null, statut: { $ne: 'ANNULEE' } });
  if (enRetard === 'true') {
    const nonCommencees = await Evaluation.distinct('mission', { statut: { $in: ['PLANIFIEE', 'EN_COURS'] } });
    conditions.push({ datePrevue: { $lt: debutDuJour() }, statut: { $ne: 'ANNULEE' }, _id: { $in: nonCommencees } });
  }
  const missions = await Mission.find({ $and: conditions })
    .populate(PEUPLEMENT)
    .sort({ datePrevue: 1, createdAt: 1 })
    .limit(Math.min(1000, Math.max(1, parseInt(limite, 10) || 500)))
    .lean();
  return avecEvaluation(missions);
};

/** Mission visible, sinon 404. */
const obtenirMission = async (req, id) => {
  const mission = await Mission.findOne({ $and: [{ _id: id }, await perimetre.filtreMissions(req)] });
  if (!mission) throw ApiError.notFound('Mission non trouvée');
  return mission;
};

const obtenirMissionDetaillee = async (req, id) => {
  const mission = await obtenirMission(req, id);
  const [detail] = await avecEvaluation([await Mission.findById(mission._id).populate(PEUPLEMENT).lean()]);
  return detail;
};

/** Contrôles communs avant de changer une mission ; renvoie son évaluation. */
const verifierModification = async (req, mission) => {
  if (!perimetre.peutGerer(req, { zoneAncetres: mission.zoneAncetres, centre: mission.centre })) {
    throw ApiError.forbidden('Ce centre est en dehors de votre périmètre');
  }
  const campagne = await Campagne.findById(mission.campagne).select('statut').lean();
  if (campagne?.statut === 'CLOTUREE') throw ApiError.conflict('La campagne est clôturée');
  return Evaluation.findOne({ mission: mission._id });
};

/**
 * Applique équipe / date à une mission. `evaluateurs` remplace l'équipe ([] la vide),
 * `superviseur: null` retire le superviseur, un champ absent n'est pas modifié.
 */
const appliquerEquipe = async (mission, evaluation, { evaluateurs, superviseur, datePrevue }, verifierEquipe) => {
  if (evaluation && STATUTS_EVALUATION_FIGES.includes(evaluation.statut)) {
    throw ApiError.conflict(`L'évaluation est ${evaluation.statut.toLowerCase()} : la mission n'est plus modifiable`);
  }
  if (typeof evaluateurs !== 'undefined') mission.evaluateurs = evaluateurs;
  if (typeof superviseur !== 'undefined') mission.superviseur = superviseur || undefined;
  if (typeof datePrevue !== 'undefined') mission.datePrevue = datePrevue || undefined;

  const centre = { _id: mission.centre, zoneAncetres: mission.zoneAncetres };
  const problemes = verifierEquipe(centre);
  if (problemes.length) throw ApiError.badRequest('Équipe invalide pour ce centre', problemes);
  await mission.save();
};

/** Modifie une mission : équipe, date, ou statut (ANNULEE / A_FAIRE pour la réactiver). */
const modifierMission = async (req, id, donnees = {}) => {
  const mission = await obtenirMission(req, id);
  const evaluation = await verifierModification(req, mission);

  if (donnees.statut && donnees.statut !== mission.statut) {
    if (donnees.statut === 'ANNULEE') {
      if (evaluation && !['PLANIFIEE', 'EN_COURS'].includes(evaluation.statut)) {
        throw ApiError.conflict('Seule une mission dont l\'évaluation n\'est pas encore soumise peut être annulée');
      }
      mission.statut = 'ANNULEE';
      if (evaluation) { evaluation.statut = 'ANNULEE'; await evaluation.save(); }
      await mission.save();
      return mission;
    }
    if (donnees.statut === 'A_FAIRE' && mission.statut === 'ANNULEE') {
      mission.statut = 'A_FAIRE';
      if (evaluation) { evaluation.statut = 'PLANIFIEE'; await evaluation.save(); }
      await mission.save();
      return mission;
    }
    throw ApiError.badRequest('Changement de statut non autorisé (seuls ANNULEE et la réactivation sont possibles ici)');
  }
  if (mission.statut === 'ANNULEE') throw ApiError.conflict('Mission annulée : réactivez-la d\'abord');

  const equipe = {
    evaluateurs: donnees.evaluateurs ?? mission.evaluateurs.map(String),
    superviseur: typeof donnees.superviseur !== 'undefined' ? donnees.superviseur : mission.superviseur,
  };
  const verifierEquipe = await equipeService.preparerVerification(equipe);
  await appliquerEquipe(mission, evaluation, donnees, verifierEquipe);
  return mission;
};

/**
 * Affecte la même équipe et/ou la même date à plusieurs missions d'une campagne.
 * Renvoie { modifiees, refus: [{ mission, centre, motif }] } : une mission refusée n'empêche pas les autres.
 */
const affecterEquipe = async (req, campagneId, { missions = [], evaluateurs, superviseur, datePrevue } = {}) => {
  if (!missions.length) throw ApiError.badRequest('Sélectionnez au moins une mission');
  const verifierEquipe = await equipeService.preparerVerification({ evaluateurs: evaluateurs || [], superviseur });
  const liste = await Mission.find({ $and: [{ _id: { $in: missions }, campagne: campagneId }, await perimetre.filtreMissions(req)] })
    .populate('centre', 'code nom');

  const resultat = { modifiees: 0, refus: [] };
  for (const mission of liste) {
    const centre = mission.centre;
    mission.centre = centre._id; // on garde l'identifiant pour l'enregistrement
    try {
      if (mission.statut === 'ANNULEE') throw ApiError.conflict('mission annulée');
      const evaluation = await verifierModification(req, mission);
      await appliquerEquipe(mission, evaluation, { evaluateurs, superviseur, datePrevue }, verifierEquipe);
      resultat.modifiees++;
    } catch (err) {
      resultat.refus.push({ mission: mission._id, code: centre.code, nom: centre.nom, motif: err.details?.join(' ; ') || err.message });
    }
  }
  const introuvables = missions.length - liste.length;
  if (introuvables) resultat.refus.push({ motif: `${introuvables} mission(s) introuvable(s) dans cette campagne ou hors de votre périmètre` });
  return resultat;
};

/** Retire un centre de la campagne : seulement si son évaluation n'a pas commencé. */
const supprimerMission = async (req, id) => {
  const mission = await obtenirMission(req, id);
  const evaluation = await verifierModification(req, mission);
  if (evaluation && evaluation.statut !== 'PLANIFIEE') {
    throw ApiError.conflict('L\'évaluation a commencé : annulez la mission au lieu de la supprimer');
  }
  if (evaluation) await evaluation.deleteOne();
  await mission.deleteOne();
  return mission;
};

module.exports = {
  listerMissions, obtenirMissionDetaillee, modifierMission, affecterEquipe, supprimerMission,
};
