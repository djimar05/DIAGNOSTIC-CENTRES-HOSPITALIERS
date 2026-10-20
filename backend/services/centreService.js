const Centre = require('../models/Centre');
const Zone = require('../models/Zone');
const Evaluation = require('../models/Evaluation');
const ActionCorrective = require('../models/ActionCorrective');
const ApiError = require('../middlewares/ApiError');
const droitsService = require('./droitsService');

const echapper = (texte) => String(texte).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Dans la collection Centre, « le centre » d'une affectation est le document lui-même (_id)
const filtreCentres = (affectations) => droitsService.filtrePerimetre(affectations, { champCentre: '_id' });

/** Centres visibles (périmètre), filtrables par zone (sous-arbre compris), niveau, statut, état et recherche. */
const listerCentres = async (affectations, {
  zone, niveau, statutJuridique, actif, recherche, page = 1, limite = 50,
} = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limiteNum = Math.min(200, Math.max(1, parseInt(limite, 10) || 50));

  const conditions = [filtreCentres(affectations)];
  if (zone) conditions.push({ zoneAncetres: zone });
  if (niveau) conditions.push({ niveau });
  if (statutJuridique) conditions.push({ statutJuridique });
  if (typeof actif !== 'undefined' && actif !== '') conditions.push({ actif: actif === 'true' || actif === true });
  if (recherche) {
    const regex = new RegExp(echapper(recherche), 'i');
    conditions.push({ $or: [{ nom: regex }, { code: regex }, { localite: regex }] });
  }
  const filtre = { $and: conditions };

  const [total, centres] = await Promise.all([
    Centre.countDocuments(filtre),
    Centre.find(filtre)
      .select('code nom niveau statutJuridique zone localite actif derniereEvaluation')
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

/** Un centre du périmètre (404 sinon, sans révéler qu'il existe ailleurs), avec le chemin de ses zones. */
const obtenirCentre = async (id, affectations) => {
  const centre = await Centre.findOne({ $and: [{ _id: id }, filtreCentres(affectations)] })
    .populate('zone', 'code nom niveau')
    .populate('zoneAncetres', 'code nom niveau')
    .lean();
  if (!centre) throw ApiError.notFound('Centre non trouvé');
  return centre;
};

/** Zone de rattachement d'un centre : n'importe quel niveau sauf national. */
const zoneDeRattachement = async (zoneId) => {
  const zone = await Zone.findById(zoneId).lean();
  if (!zone) throw ApiError.badRequest('Zone introuvable');
  if (zone.niveau === 'NATIONAL') throw ApiError.badRequest('Un centre doit être rattaché à une région, un district ou une zone de responsabilité');
  return zone;
};

const CHAMPS = ['code', 'nom', 'niveau', 'statutJuridique', 'localite', 'gps', 'populationDesservie',
  'nombreLits', 'services', 'responsable', 'actif'];

const appliquer = (centre, donnees) => {
  for (const champ of CHAMPS) {
    if (typeof donnees[champ] === 'undefined') continue;
    // null efface un champ facultatif (ex. gps: null)
    centre.set(champ, donnees[champ] === null ? undefined : donnees[champ]);
  }
  if (typeof centre.code === 'string') centre.code = centre.code.trim();
};

const creerCentre = async (donnees = {}) => {
  if (!donnees.zone) throw ApiError.badRequest('Le champ zone est obligatoire');
  const zone = await zoneDeRattachement(donnees.zone);
  const centre = new Centre({ zone: zone._id, zoneAncetres: [...zone.ancetres, zone._id] });
  appliquer(centre, donnees);
  return centre.save();
};

/** Modifie un centre. Un changement de zone recalcule zoneAncetres (centre et évaluations). */
const modifierCentre = async (id, donnees = {}) => {
  const centre = await Centre.findById(id);
  if (!centre) throw ApiError.notFound('Centre non trouvé');
  appliquer(centre, donnees);

  const changementZone = donnees.zone && String(donnees.zone) !== String(centre.zone);
  if (changementZone) {
    const zone = await zoneDeRattachement(donnees.zone);
    centre.zone = zone._id;
    centre.zoneAncetres = [...zone.ancetres, zone._id];
  }
  const champsModifies = centre.modifiedPaths({ includeChildren: false });
  await centre.save();
  if (changementZone) {
    await Evaluation.updateMany({ centre: centre._id }, { zoneAncetres: centre.zoneAncetres });
  }
  return { centre, champsModifies };
};

/** Historique des évaluations d'un centre (onglet de la fiche). */
const evaluationsDuCentre = (centreId) => Evaluation.find({ centre: centreId })
  .select('statut campagne grilleVersion debut fin soumisLe scores.global scores.classe createdAt')
  .populate('campagne', 'nom')
  .sort({ createdAt: -1 })
  .limit(100)
  .lean();

/** Actions correctives d'un centre (onglet de la fiche). */
const actionsDuCentre = (centreId) => ActionCorrective.find({ centre: centreId })
  .select('domaineCode critereCode actionPrevue priorite echeance statut avancement responsable.nom')
  .sort({ statut: 1, echeance: 1 })
  .limit(200)
  .lean();

module.exports = {
  listerCentres, obtenirCentre, creerCentre, modifierCentre, evaluationsDuCentre, actionsDuCentre, zoneDeRattachement,
};
