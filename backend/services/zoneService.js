const Zone = require('../models/Zone');
const Centre = require('../models/Centre');
const Evaluation = require('../models/Evaluation');
const Mission = require('../models/Mission');
const ApiError = require('../middlewares/ApiError');
const droitsService = require('./droitsService');
const { NIVEAUX_ZONE } = require('../models/enumUtils');

/**
 * Découpage sanitaire : National → Région → District → Zone de responsabilité.
 * Chaque zone a pour parent une zone du niveau immédiatement au-dessus.
 * `ancetres` (et `zoneAncetres` des centres / évaluations) sont des copies dénormalisées :
 * elles sont recalculées ici dès qu'une zone change de parent.
 */
const RANG = Object.fromEntries(NIVEAUX_ZONE.map((n, i) => [n, i]));
const memeId = (a, b) => String(a) === String(b);

const obtenirZone = async (id) => {
  const zone = await Zone.findById(id);
  if (!zone) throw ApiError.notFound('Zone non trouvée');
  return zone;
};

/** Zones visibles (périmètre), triées du plus large au plus fin puis par nom. */
const listerZones = async (affectations, { niveau, parent } = {}) => {
  const filtre = {};
  const zones = await droitsService.zonesDuPerimetre(affectations);
  if (zones !== null) filtre._id = { $in: zones };
  if (niveau) filtre.niveau = niveau;
  if (parent) filtre.parent = parent;

  const resultat = await Zone.find(filtre).select('code nom niveau parent ancetres actif').lean();
  return resultat.sort((a, b) => a.ancetres.length - b.ancetres.length || a.nom.localeCompare(b.nom, 'fr'));
};

/**
 * Arbre des zones du périmètre, avec le nombre de centres rattachés directement (nbCentres)
 * et dans tout le sous-arbre (nbCentresTotal). Les racines sont les zones dont le parent est hors périmètre.
 */
const arbreZones = async (affectations) => {
  const zones = await listerZones(affectations);
  const comptes = await Centre.aggregate([
    { $match: { zone: { $in: zones.map((z) => z._id) } } },
    { $group: { _id: '$zone', n: { $sum: 1 } } },
  ]);
  const nbParZone = Object.fromEntries(comptes.map((c) => [String(c._id), c.n]));

  const noeuds = new Map(zones.map((z) => [String(z._id), {
    _id: z._id, code: z.code, nom: z.nom, niveau: z.niveau, actif: z.actif, parent: z.parent,
    nbCentres: nbParZone[String(z._id)] || 0, nbCentresTotal: 0, enfants: [],
  }]));
  const racines = [];
  for (const noeud of noeuds.values()) {
    const parent = noeud.parent && noeuds.get(String(noeud.parent));
    if (parent) parent.enfants.push(noeud); else racines.push(noeud);
  }
  // Totaux par sous-arbre (parcours en profondeur)
  const totaliser = (n) => {
    n.nbCentresTotal = n.nbCentres + n.enfants.reduce((s, e) => s + totaliser(e), 0);
    return n.nbCentresTotal;
  };
  racines.forEach(totaliser);
  return racines;
};

/** Le parent doit être du niveau immédiatement supérieur ; une seule zone nationale, sans parent. */
const verifierParent = async (niveau, parentId) => {
  if (niveau === 'NATIONAL') {
    if (parentId) throw ApiError.badRequest("La zone nationale n'a pas de parent");
    return null;
  }
  if (!parentId) throw ApiError.badRequest('Le champ parent est obligatoire pour ce niveau');
  const parent = await Zone.findById(parentId).lean();
  if (!parent) throw ApiError.badRequest('Zone parente introuvable');
  if (RANG[parent.niveau] !== RANG[niveau] - 1) {
    throw ApiError.badRequest(`Une zone de niveau ${niveau} doit être rattachée à une zone de niveau ${NIVEAUX_ZONE[RANG[niveau] - 1]}`);
  }
  return parent;
};

const creerZone = async ({ code, nom, niveau, parent } = {}) => {
  if (!code || !nom || !niveau) throw ApiError.badRequest('Les champs code, nom et niveau sont obligatoires');
  if (!(niveau in RANG)) throw ApiError.badRequest(`Niveau inconnu : ${niveau}`);
  if (niveau === 'NATIONAL' && await Zone.exists({ niveau: 'NATIONAL' })) {
    throw ApiError.conflict('La zone nationale existe déjà');
  }
  const zoneParent = await verifierParent(niveau, parent);
  return Zone.create({
    code: String(code).trim(),
    nom: String(nom).trim(),
    niveau,
    parent: zoneParent ? zoneParent._id : null,
    ancetres: zoneParent ? [...zoneParent.ancetres, zoneParent._id] : [],
  });
};

/**
 * Après un déplacement : recalcule les ancêtres de toute la descendance, puis les copies
 * dans les centres et les évaluations du sous-arbre.
 */
const recalculerSousArbre = async (zone) => {
  const descendants = await Zone.find({ ancetres: zone._id }).select('ancetres').lean();
  const ancetresPar = new Map([[String(zone._id), zone.ancetres]]);
  if (descendants.length) {
    const operations = descendants.map((d) => {
      const position = d.ancetres.findIndex((a) => memeId(a, zone._id));
      const ancetres = [...zone.ancetres, zone._id, ...d.ancetres.slice(position + 1)];
      ancetresPar.set(String(d._id), ancetres);
      return { updateOne: { filter: { _id: d._id }, update: { ancetres } } };
    });
    await Zone.bulkWrite(operations);
  }

  const centres = await Centre.find({ zone: { $in: [...ancetresPar.keys()] } }).select('zone').lean();
  if (!centres.length) return;
  const zoneAncetresDe = (c) => [...ancetresPar.get(String(c.zone)), c.zone];
  await Centre.bulkWrite(centres.map((c) => ({
    updateOne: { filter: { _id: c._id }, update: { zoneAncetres: zoneAncetresDe(c) } },
  })));
  const parCentre = centres.map((c) => ({
    updateMany: { filter: { centre: c._id }, update: { zoneAncetres: zoneAncetresDe(c) } },
  }));
  await Evaluation.bulkWrite(parCentre);
  await Mission.bulkWrite(parCentre);
};

/** Modifie code, nom, état ou parent (déplacement dans l'arbre). Le niveau n'est pas modifiable. */
const modifierZone = async (id, donnees = {}) => {
  const zone = await obtenirZone(id);
  if (donnees.niveau && donnees.niveau !== zone.niveau) {
    throw ApiError.badRequest("Le niveau d'une zone n'est pas modifiable : créez une nouvelle zone");
  }
  const avant = { code: zone.code, nom: zone.nom, actif: zone.actif, parent: zone.parent };

  if (typeof donnees.code !== 'undefined') zone.code = String(donnees.code).trim();
  if (typeof donnees.nom !== 'undefined') zone.nom = String(donnees.nom).trim();
  if (typeof donnees.actif !== 'undefined') zone.actif = donnees.actif;

  const deplacement = typeof donnees.parent !== 'undefined' && !memeId(donnees.parent, zone.parent);
  if (deplacement) {
    const parent = await verifierParent(zone.niveau, donnees.parent);
    if (parent && (memeId(parent._id, zone._id) || parent.ancetres.some((a) => memeId(a, zone._id)))) {
      throw ApiError.badRequest('Une zone ne peut pas être déplacée sous elle-même ou sous une de ses sous-zones');
    }
    zone.parent = parent ? parent._id : null;
    zone.ancetres = parent ? [...parent.ancetres, parent._id] : [];
  }

  await zone.save();
  if (deplacement) await recalculerSousArbre(zone);
  return { zone, avant };
};

module.exports = { listerZones, arbreZones, creerZone, modifierZone, obtenirZone };
