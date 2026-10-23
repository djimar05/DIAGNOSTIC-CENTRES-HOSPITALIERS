const Campagne = require('../models/Campagne');
const Centre = require('../models/Centre');
const Evaluation = require('../models/Evaluation');
const Grille = require('../models/Grille');
const Mission = require('../models/Mission');
const ApiError = require('../middlewares/ApiError');
const droitsService = require('./droitsService');
const equipeService = require('./equipeService');
const perimetre = require('./perimetrePlanification');
const { jourCalendaire, aujourdhuiCalendaire } = require('../utils/dates');

/**
 * Campagne : PREPARATION → EN_COURS → CLOTUREE.
 *   - en préparation : tout est modifiable (grille, zone, missions)
 *   - en cours       : les évaluations ont commencé, la grille et la zone sont figées ; on peut encore ajouter des centres
 *   - clôturée       : lecture seule
 * Une mission = un centre à visiter ; sa création crée aussi l'évaluation (statut PLANIFIEE).
 */

const STATUTS_EVALUATION_TERMINES = ['VALIDEE', 'PUBLIEE', 'ANNULEE'];

/** Campagne visible par l'utilisateur, sinon 404. */
const obtenirCampagne = async (req, id, { peupler = false } = {}) => {
  const requete = Campagne.findOne({ $and: [{ _id: id }, await perimetre.filtreCampagnes(req)] });
  if (peupler) {
    requete.populate('grille', 'code nom version statut niveauxCibles').populate('zone', 'code nom niveau').populate('creePar', 'nom prenom');
  }
  const campagne = await requete;
  if (!campagne) throw ApiError.notFound('Campagne non trouvée');
  return campagne;
};

const verifierModifiable = (campagne) => {
  if (campagne.statut === 'CLOTUREE') throw ApiError.conflict('Cette campagne est clôturée');
};

const grillePubliee = async (grilleId) => {
  const grille = await Grille.findById(grilleId).select('code version statut niveauxCibles').lean();
  if (!grille) throw ApiError.badRequest('Grille introuvable');
  if (grille.statut !== 'PUBLIEE') throw ApiError.badRequest('Seule une grille publiée peut être utilisée pour une campagne');
  return grille;
};

/** Liste avec, pour chaque campagne, le nombre de missions et d'évaluations par statut (dans le périmètre). */
const listerCampagnes = async (req, { statut, recherche } = {}) => {
  const conditions = [await perimetre.filtreCampagnes(req)];
  if (statut) conditions.push({ statut });
  if (recherche) conditions.push({ nom: new RegExp(String(recherche).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
  const campagnes = await Campagne.find({ $and: conditions })
    .populate('grille', 'code nom version').populate('zone', 'code nom niveau')
    .sort({ statut: 1, dateDebut: -1, createdAt: -1 }).lean();

  const stats = await Evaluation.aggregate([
    { $match: { $and: [{ campagne: { $in: campagnes.map((c) => c._id) } }, await perimetre.filtreEvaluations(req)] } },
    { $group: { _id: { campagne: '$campagne', statut: '$statut' }, n: { $sum: 1 } } },
  ]);
  return campagnes.map((c) => {
    const parStatut = Object.fromEntries(stats.filter((s) => String(s._id.campagne) === String(c._id)).map((s) => [s._id.statut, s.n]));
    const total = Object.values(parStatut).reduce((a, b) => a + b, 0);
    return { ...c, avancement: { total, parStatut, validees: (parStatut.VALIDEE || 0) + (parStatut.PUBLIEE || 0) } };
  });
};

const CHAMPS_INFOS = ['nom', 'description', 'dateDebut', 'dateFin', 'partenaire'];

const creerCampagne = async (req, donnees = {}) => {
  if (!donnees.nom || !donnees.grille) throw ApiError.badRequest('Les champs nom et grille sont obligatoires');
  await grillePubliee(donnees.grille);
  const campagne = new Campagne({
    ...Object.fromEntries(CHAMPS_INFOS.map((c) => [c, donnees[c]])),
    grille: donnees.grille,
    zone: donnees.zone || null,
    creePar: req.utilisateur._id,
  });
  await perimetre.verifierGestionCampagne(req, campagne); // zone dans le périmètre (null = national)
  return campagne.save();
};

/** Modifie les informations ; grille et zone seulement en préparation. */
const modifierCampagne = async (req, id, donnees = {}) => {
  const campagne = await obtenirCampagne(req, id);
  await perimetre.verifierGestionCampagne(req, campagne);
  verifierModifiable(campagne);
  CHAMPS_INFOS.forEach((c) => { if (typeof donnees[c] !== 'undefined') campagne[c] = donnees[c] === '' ? undefined : donnees[c]; });

  const changeGrille = donnees.grille && String(donnees.grille) !== String(campagne.grille);
  const changeZone = typeof donnees.zone !== 'undefined' && String(donnees.zone || '') !== String(campagne.zone || '');
  if ((changeGrille || changeZone) && campagne.statut !== 'PREPARATION') {
    throw ApiError.conflict('La grille et la zone ne sont modifiables qu\'en préparation');
  }
  let grille;
  if (changeGrille) {
    grille = await grillePubliee(donnees.grille);
    campagne.grille = grille._id;
  }
  if (changeZone) {
    campagne.zone = donnees.zone || null;
    await perimetre.verifierGestionCampagne(req, campagne);
    if (campagne.zone && await Mission.exists({ campagne: campagne._id, zoneAncetres: { $ne: campagne.zone } })) {
      throw ApiError.conflict('Des centres de la campagne sont en dehors de cette zone : retirez-les d\'abord');
    }
  }
  await campagne.save();
  if (grille) {
    await Evaluation.updateMany({ campagne: campagne._id, statut: 'PLANIFIEE' }, { grille: grille._id, grilleVersion: grille.version });
  }
  return campagne;
};

/** Démarre la campagne : au moins une mission, et chaque mission a au moins un évaluateur. */
const demarrerCampagne = async (req, id) => {
  const campagne = await obtenirCampagne(req, id);
  await perimetre.verifierGestionCampagne(req, campagne);
  if (campagne.statut !== 'PREPARATION') throw ApiError.conflict('Seule une campagne en préparation peut être démarrée');
  const missions = await Mission.find({ campagne: campagne._id, statut: { $ne: 'ANNULEE' } }).select('evaluateurs').lean();
  if (!missions.length) throw ApiError.badRequest('Ajoutez au moins un centre avant de démarrer la campagne');
  const sansEquipe = missions.filter((m) => !m.evaluateurs.length).length;
  if (sansEquipe) throw ApiError.badRequest(`${sansEquipe} mission(s) sans évaluateur : affectez une équipe à chaque centre avant de démarrer`);
  campagne.statut = 'EN_COURS';
  if (!campagne.dateDebut) campagne.dateDebut = new Date();
  return campagne.save();
};

/**
 * Clôture la campagne. Si des évaluations ne sont pas terminées (ni validées ni annulées), la clôture
 * est refusée, sauf avec `forcer` : elles sont alors annulées, ainsi que leurs missions.
 */
const cloturerCampagne = async (req, id, { forcer = false } = {}) => {
  const campagne = await obtenirCampagne(req, id);
  await perimetre.verifierGestionCampagne(req, campagne);
  if (campagne.statut !== 'EN_COURS') throw ApiError.conflict('Seule une campagne en cours peut être clôturée');
  const enCours = await Evaluation.find({ campagne: campagne._id, statut: { $nin: STATUTS_EVALUATION_TERMINES } }).select('mission').lean();
  if (enCours.length && !forcer) {
    throw ApiError.conflict(`${enCours.length} évaluation(s) ne sont pas terminées`, [
      'Confirmez la clôture forcée pour les annuler (elles resteront visibles comme annulées)',
    ]);
  }
  if (enCours.length) {
    await Evaluation.updateMany({ _id: { $in: enCours.map((e) => e._id) } }, { statut: 'ANNULEE' });
    await Mission.updateMany({ _id: { $in: enCours.map((e) => e.mission) } }, { statut: 'ANNULEE' });
  }
  campagne.statut = 'CLOTUREE';
  if (!campagne.dateFin) campagne.dateFin = new Date();
  await campagne.save();
  return { campagne, evaluationsAnnulees: enCours.length };
};

/**
 * Ajoute des centres à la campagne (une mission + une évaluation PLANIFIEE par centre).
 * Une équipe et une date peuvent être données pour tous les centres ; elles ne s'appliquent qu'aux
 * centres que cette équipe couvre (sinon la mission est créée sans équipe, avec un avertissement).
 * Renvoie { creees, missions, existants, refus, avertissements }.
 */
const ajouterMissions = async (req, id, { centres = [], evaluateurs = [], superviseur, datePrevue } = {}) => {
  const campagne = await obtenirCampagne(req, id);
  verifierModifiable(campagne);
  if (!centres.length) throw ApiError.badRequest('Indiquez au moins un centre');
  const grille = await Grille.findById(campagne.grille).select('version niveauxCibles').lean();

  const trouves = new Map((await Centre.find({ _id: { $in: centres } }).select('code nom niveau zone zoneAncetres actif').lean())
    .map((c) => [String(c._id), c]));
  const dejaPresents = new Set((await Mission.find({ campagne: campagne._id, centre: { $in: centres } }).distinct('centre')).map(String));
  const verifierEquipe = (evaluateurs.length || superviseur) ? await equipeService.preparerVerification({ evaluateurs, superviseur }) : null;

  const resultat = { creees: 0, missions: [], existants: [], refus: [], avertissements: [] };
  for (const centreId of [...new Set(centres.map(String))]) {
    const centre = trouves.get(centreId);
    const refuser = (motif) => resultat.refus.push({ centre: centreId, code: centre?.code, nom: centre?.nom, motif });
    if (!centre) { refuser('centre introuvable'); continue; }
    if (dejaPresents.has(centreId)) { resultat.existants.push({ centre: centreId, code: centre.code, nom: centre.nom }); continue; }
    if (!centre.actif) { refuser('centre inactif'); continue; }
    if (campagne.zone && !centre.zoneAncetres.some((z) => droitsService.memeId(z, campagne.zone))) { refuser('en dehors de la zone de la campagne'); continue; }
    if (!perimetre.peutGerer(req, { zoneAncetres: centre.zoneAncetres, centre: centre._id })) { refuser('en dehors de votre périmètre'); continue; }
    if (grille.niveauxCibles?.length && !grille.niveauxCibles.includes(centre.niveau)) { refuser('niveau de centre non visé par la grille'); continue; }

    const mission = new Mission({ campagne: campagne._id, centre: centre._id, zoneAncetres: centre.zoneAncetres, datePrevue: datePrevue ? jourCalendaire(datePrevue) : undefined });
    if (verifierEquipe) {
      const problemes = verifierEquipe(centre);
      if (problemes.length) resultat.avertissements.push(`${centre.code} : créé sans équipe (${problemes.join(' ; ')})`);
      else { mission.evaluateurs = evaluateurs; mission.superviseur = superviseur || undefined; }
    }
    await mission.save();
    await Evaluation.create({
      mission: mission._id, campagne: campagne._id, centre: centre._id, zoneAncetres: centre.zoneAncetres,
      grille: campagne.grille, grilleVersion: grille.version, statut: 'PLANIFIEE',
    });
    resultat.creees++;
    resultat.missions.push(mission._id);
  }
  return resultat;
};

/**
 * Avancement de la campagne (dans le périmètre de l'utilisateur) :
 * évaluations par statut, missions sans équipe / sans date / en retard, taux de validation, détail par zone.
 */
const avancementCampagne = async (req, id) => {
  const campagne = await obtenirCampagne(req, id);
  const missions = await Mission.find({ $and: [{ campagne: campagne._id }, await perimetre.filtreMissions(req)] })
    .select('statut datePrevue evaluateurs centre').populate({ path: 'centre', select: 'zone', populate: { path: 'zone', select: 'nom code' } }).lean();
  const statuts = new Map((await Evaluation.find({ mission: { $in: missions.map((m) => m._id) } }).select('mission statut').lean())
    .map((e) => [String(e.mission), e.statut]));

  const aujourdhui = aujourdhuiCalendaire();
  const parStatut = {};
  const parZone = new Map();
  let sansEquipe = 0; let sansDate = 0; let enRetard = 0;
  for (const m of missions) {
    const statut = statuts.get(String(m._id)) || 'PLANIFIEE';
    parStatut[statut] = (parStatut[statut] || 0) + 1;
    const active = m.statut !== 'ANNULEE' && statut !== 'ANNULEE';
    const retard = active && m.datePrevue && new Date(m.datePrevue) < aujourdhui && ['PLANIFIEE', 'EN_COURS'].includes(statut);
    if (active && !m.evaluateurs.length) sansEquipe++;
    if (active && !m.datePrevue) sansDate++;
    if (retard) enRetard++;

    const zone = m.centre?.zone;
    const cle = String(zone?._id || 'aucune');
    const ligne = parZone.get(cle) || { zone: zone ? { _id: zone._id, nom: zone.nom, code: zone.code } : null, total: 0, validees: 0, enRetard: 0, annulees: 0 };
    ligne.total++;
    if (['VALIDEE', 'PUBLIEE'].includes(statut)) ligne.validees++;
    if (statut === 'ANNULEE') ligne.annulees++;
    if (retard) ligne.enRetard++;
    parZone.set(cle, ligne);
  }
  const annulees = parStatut.ANNULEE || 0;
  const validees = (parStatut.VALIDEE || 0) + (parStatut.PUBLIEE || 0);
  const aRealiser = missions.length - annulees;
  return {
    total: missions.length,
    parStatut,
    validees,
    soumises: parStatut.SOUMISE || 0,
    sansEquipe,
    sansDate,
    enRetard,
    tauxValidation: aRealiser ? Math.round((validees / aRealiser) * 1000) / 10 : 0,
    parZone: [...parZone.values()].sort((a, b) => (a.zone?.nom || '').localeCompare(b.zone?.nom || '', 'fr')),
  };
};

/** Évaluateurs et superviseurs pouvant intervenir dans la campagne. */
const intervenantsCampagne = async (req, id) => equipeService.intervenantsPour(await obtenirCampagne(req, id));

module.exports = {
  obtenirCampagne, listerCampagnes, creerCampagne, modifierCampagne, demarrerCampagne, cloturerCampagne,
  ajouterMissions, avancementCampagne, intervenantsCampagne,
};
