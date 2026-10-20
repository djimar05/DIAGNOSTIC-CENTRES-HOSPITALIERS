const Affectation = require('../models/Affectation');
const Centre = require('../models/Centre');
const Utilisateur = require('../models/Utilisateur');
const ApiError = require('../middlewares/ApiError');
const droitsService = require('./droitsService');

// Rôles qu'un coordonnateur peut attribuer, dans son seul périmètre.
// Les autres (ADMINISTRATEUR, RESPONSABLE_NATIONAL, COORDONNATEUR, PARTENAIRE) sont réservés à l'administrateur.
const ROLES_DELEGABLES = ['EVALUATEUR', 'SUPERVISEUR', 'RESPONSABLE_CENTRE'];

const estAdmin = (affectationsAuteur) => affectationsAuteur.some((a) => a.role === 'ADMINISTRATEUR');

/** Zone effective d'une affectation : sa zone, sinon celle de son centre (null = national). */
const zoneEffective = async ({ zone, centre }) => {
  if (zone || !centre) return zone || null;
  const c = await Centre.findById(centre).select('zone').lean();
  if (!c) throw ApiError.notFound('Centre introuvable');
  return c.zone;
};

/**
 * Vérifie que l'auteur peut créer / modifier / retirer cette affectation.
 * Administrateur : tout. Coordonnateur : rôles délégables, dans sa zone ou en dessous.
 */
const verifierPeutGerer = async (affectationsAuteur, { role, zone, centre }) => {
  if (estAdmin(affectationsAuteur)) return;
  if (!ROLES_DELEGABLES.includes(role)) {
    throw ApiError.forbidden(`Un coordonnateur ne peut pas gérer le rôle ${role}`);
  }
  const coordination = affectationsAuteur.filter((a) => a.role === 'COORDONNATEUR');
  const zoneCible = await zoneEffective({ zone, centre });
  if (!(await droitsService.zoneDansPerimetre(coordination, zoneCible))) {
    throw ApiError.forbidden('Ce périmètre est en dehors du vôtre');
  }
};

/** Un administrateur ne peut pas se retirer à lui-même ce rôle (risque de perdre tout accès admin). */
const verifierPasAutoRetraitAdmin = (affectation, auteurId) => {
  if (affectation.role === 'ADMINISTRATEUR' && droitsService.memeId(affectation.utilisateur, auteurId)) {
    throw ApiError.forbidden("Vous ne pouvez pas retirer votre propre rôle d'administrateur");
  }
};

const obtenirAffectation = async (id) => {
  const affectation = await Affectation.findById(id);
  if (!affectation) throw ApiError.notFound('Affectation non trouvée');
  return affectation;
};

/**
 * Affectations d'un utilisateur (actives et passées).
 * Un coordonnateur ne voit que celles de son périmètre.
 */
const listerAffectations = async (utilisateurId, affectationsAuteur) => {
  if (!(await Utilisateur.exists({ _id: utilisateurId }))) throw ApiError.notFound('Utilisateur non trouvé');

  const filtre = { utilisateur: utilisateurId };
  if (!estAdmin(affectationsAuteur)) {
    const zones = await droitsService.zonesDuPerimetre(affectationsAuteur.filter((a) => a.role === 'COORDONNATEUR'));
    if (zones !== null) filtre.zone = { $in: zones };
  }
  return Affectation.find(filtre)
    .sort({ actif: -1, dateDebut: -1 })
    .populate('zone', 'code nom niveau')
    .populate('centre', 'code nom');
};

/** Donne un rôle sur un périmètre à un utilisateur. */
const creerAffectation = async (utilisateurId, donnees, affectationsAuteur) => {
  const { role, centre, dateDebut, dateFin } = donnees;
  if (!role) throw ApiError.badRequest('Le champ role est obligatoire');
  if (!(await Utilisateur.exists({ _id: utilisateurId }))) throw ApiError.notFound('Utilisateur non trouvé');

  const zone = await zoneEffective(donnees);
  await verifierPeutGerer(affectationsAuteur, { role, zone, centre });

  const doublon = await Affectation.exists({
    utilisateur: utilisateurId, role, zone, centre: centre || null, actif: true,
  });
  if (doublon) throw ApiError.conflict('Cet utilisateur a déjà ce rôle sur ce périmètre');

  return Affectation.create({ utilisateur: utilisateurId, role, zone, centre, dateDebut, dateFin });
};

// Le rôle n'est pas modifiable : pour changer de rôle, on retire l'affectation et on en crée une autre.
const CHAMPS_MODIFIABLES = ['zone', 'centre', 'actif', 'dateDebut', 'dateFin'];

/** Modifie le périmètre, les dates ou l'état d'une affectation. */
const mettreAJourAffectation = async (id, donnees, affectationsAuteur, auteurId) => {
  const affectation = await obtenirAffectation(id);
  await verifierPeutGerer(affectationsAuteur, affectation);

  const avant = {};
  for (const champ of CHAMPS_MODIFIABLES) {
    if (typeof donnees[champ] !== 'undefined') {
      avant[champ] = affectation[champ];
      affectation[champ] = donnees[champ];
    }
  }
  if (affectation.actif === false || (affectation.dateFin && affectation.dateFin <= new Date())) {
    verifierPasAutoRetraitAdmin(affectation, auteurId);
  }
  await verifierPeutGerer(affectationsAuteur, affectation); // le nouveau périmètre aussi
  await affectation.save();
  return { affectation, avant };
};

/** Retire une affectation. Elle est désactivée (pas supprimée) pour garder l'historique des droits. */
const retirerAffectation = async (id, affectationsAuteur, auteurId) => {
  const affectation = await obtenirAffectation(id);
  await verifierPeutGerer(affectationsAuteur, affectation);
  verifierPasAutoRetraitAdmin(affectation, auteurId);

  affectation.actif = false;
  if (!affectation.dateFin || affectation.dateFin > new Date()) affectation.dateFin = new Date();
  await affectation.save();
  return affectation;
};

module.exports = {
  ROLES_DELEGABLES,
  listerAffectations,
  creerAffectation,
  mettreAJourAffectation,
  retirerAffectation,
};
