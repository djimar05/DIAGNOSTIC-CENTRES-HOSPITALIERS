const Zone = require('../models/Zone');
const Centre = require('../models/Centre');
const droitsService = require('./droitsService');

// Lecture du référentiel (zones, centres), limitée au périmètre de l'utilisateur.
// La création, la modification et l'import Excel viendront avec le module Référentiel (étape 2).

const echapper = (texte) => String(texte).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Zones visibles : tout le découpage pour un périmètre national, sinon les zones affectées
 * et leur descendance. Triées du plus large au plus fin, puis par nom.
 */
const listerZones = async (affectations, { niveau, parent } = {}) => {
  const filtre = {};
  const zones = await droitsService.zonesDuPerimetre(affectations);
  if (zones !== null) filtre._id = { $in: zones };
  if (niveau) filtre.niveau = niveau;
  if (parent) filtre.parent = parent;

  const resultat = await Zone.find(filtre).select('code nom niveau parent ancetres actif').lean();
  return resultat.sort((a, b) => a.ancetres.length - b.ancetres.length || a.nom.localeCompare(b.nom, 'fr'));
};

/** Centres visibles (périmètre), filtrables par zone (sous-arbre compris), niveau et recherche. */
const listerCentres = async (affectations, { zone, niveau, recherche, page = 1, limite = 50 } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limiteNum = Math.min(200, Math.max(1, parseInt(limite, 10) || 50));

  // Dans la collection Centre, « le centre » d'une affectation est le document lui-même (_id)
  const conditions = [droitsService.filtrePerimetre(affectations, { champCentre: '_id' })];
  if (zone) conditions.push({ zoneAncetres: zone });
  if (niveau) conditions.push({ niveau });
  if (recherche) {
    const regex = new RegExp(echapper(recherche), 'i');
    conditions.push({ $or: [{ nom: regex }, { code: regex }] });
  }
  const filtre = { $and: conditions };

  const [total, centres] = await Promise.all([
    Centre.countDocuments(filtre),
    Centre.find(filtre)
      .select('code nom niveau statutJuridique zone actif derniereEvaluation')
      .populate('zone', 'code nom')
      .sort({ nom: 1 })
      .skip((pageNum - 1) * limiteNum)
      .limit(limiteNum)
      .lean(),
  ]);

  return {
    centres,
    pagination: { total, page: pageNum, limite: limiteNum, pages: Math.ceil(total / limiteNum) },
  };
};

module.exports = { listerZones, listerCentres };
