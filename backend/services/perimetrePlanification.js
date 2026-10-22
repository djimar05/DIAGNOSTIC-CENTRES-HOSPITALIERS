const Campagne = require('../models/Campagne');
const Mission = require('../models/Mission');
const ApiError = require('../middlewares/ApiError');
const droitsService = require('./droitsService');

/**
 * Qui voit et gère quoi dans la planification.
 *   - Administrateur, responsable national : tout
 *   - Coordonnateur : les campagnes de sa zone (ou en dessous) et les missions des centres de son périmètre,
 *     y compris celles d'une campagne régionale qui touchent son district
 *   - Évaluateur, superviseur : les missions où ils sont affectés, dans les campagnes démarrées
 *     (une campagne en préparation n'est pas encore visible sur le terrain)
 */
const ROLES_NATIONAUX = ['ADMINISTRATEUR', 'RESPONSABLE_NATIONAL'];
const ROLES_GESTION = ['ADMINISTRATEUR', 'COORDONNATEUR'];
const ROLES_TERRAIN = ['EVALUATEUR', 'SUPERVISEUR'];

const national = (affectations) => affectations.some(
  (a) => ROLES_NATIONAUX.includes(a.role) || (a.role === 'COORDONNATEUR' && droitsService.estNationale(a)),
);
const coordination = (affectations) => affectations.filter((a) => a.role === 'COORDONNATEUR');
const terrain = (affectations) => affectations.some((a) => ROLES_TERRAIN.includes(a.role));
/** Missions de l'utilisateur (évaluateur ou superviseur) dans les campagnes démarrées. */
const sesMissions = async (utilisateurId) => ({
  $or: [{ evaluateurs: utilisateurId }, { superviseur: utilisateurId }],
  campagne: { $in: await Campagne.distinct('_id', { statut: { $ne: 'PREPARATION' } }) },
});

/** Filtre des missions visibles (zoneAncetres / centre de la mission). */
const filtreMissions = async (req) => {
  const affectations = req.affectationsAutorisees;
  if (national(affectations)) return {};
  const conditions = [];
  const coord = coordination(affectations);
  if (coord.length) conditions.push(droitsService.filtrePerimetre(coord));
  if (terrain(affectations)) conditions.push(await sesMissions(req.utilisateur._id));
  return conditions.length ? { $or: conditions } : { _id: null };
};

/** Filtre des évaluations visibles (mêmes règles, appliquées aux champs de l'évaluation). */
const filtreEvaluations = async (req) => {
  const affectations = req.affectationsAutorisees;
  if (national(affectations)) return {};
  const conditions = [];
  const coord = coordination(affectations);
  if (coord.length) conditions.push(droitsService.filtrePerimetre(coord));
  if (terrain(affectations)) conditions.push({ mission: { $in: await Mission.distinct('_id', await sesMissions(req.utilisateur._id)) } });
  return conditions.length ? { $or: conditions } : { _id: null };
};

/** Filtre des campagnes visibles. */
const filtreCampagnes = async (req) => {
  const affectations = req.affectationsAutorisees;
  if (national(affectations)) return {};
  const conditions = [];
  const coord = coordination(affectations);
  if (coord.length) {
    const zones = await droitsService.zonesDuPerimetre(coord);
    conditions.push({ zone: { $in: zones } });
    conditions.push({ _id: { $in: await Mission.distinct('campagne', droitsService.filtrePerimetre(coord)) } });
  }
  if (terrain(affectations)) {
    conditions.push({ _id: { $in: await Mission.distinct('campagne', await sesMissions(req.utilisateur._id)) } });
  }
  return conditions.length ? { $or: conditions } : { _id: null };
};

/** Gérer la campagne elle-même (informations, démarrage, clôture) : admin, ou coordonnateur de sa zone. */
const verifierGestionCampagne = async (req, campagne) => {
  const affectations = req.affectationsAutorisees;
  if (affectations.some((a) => a.role === 'ADMINISTRATEUR')) return;
  const coord = coordination(affectations);
  if (coord.length && await droitsService.zoneDansPerimetre(coord, campagne.zone)) return;
  throw ApiError.forbidden('Cette campagne est gérée par un coordonnateur d\'un niveau supérieur');
};

/** Gérer un centre ou une mission (ajout dans une campagne, équipe, date) : admin, ou coordonnateur qui le couvre. */
const peutGerer = (req, objet) => {
  const affectations = req.affectationsAutorisees;
  if (affectations.some((a) => a.role === 'ADMINISTRATEUR')) return true;
  return droitsService.couvre(coordination(affectations), objet);
};

module.exports = {
  ROLES_GESTION, ROLES_TERRAIN, filtreMissions, filtreEvaluations, filtreCampagnes, verifierGestionCampagne, peutGerer,
};
