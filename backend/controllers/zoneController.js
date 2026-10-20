const zoneService = require('../services/zoneService');
const { journaliser } = require('../services/journalService');

// Couche HTTP fine : extraction des paramètres, appel du service, réponse.
// Express 5 transmet automatiquement les erreurs async au gestionnaire global.

const entite = (zone) => ({ modele: 'Zone', id: zone._id });

const lister = async (req, res) => {
  const zones = await zoneService.listerZones(req.affectationsAutorisees, req.query);
  res.json({ success: true, data: zones });
};

const arbre = async (req, res) => {
  const racines = await zoneService.arbreZones(req.affectationsAutorisees);
  res.json({ success: true, data: racines });
};

const creer = async (req, res) => {
  const zone = await zoneService.creerZone(req.body);
  await journaliser(req, { action: 'ZONE_CREEE', entite: entite(zone), details: { code: zone.code, niveau: zone.niveau } });
  res.status(201).json({ success: true, data: zone });
};

const modifier = async (req, res) => {
  const { zone, avant } = await zoneService.modifierZone(req.params.id, req.body);
  await journaliser(req, { action: 'ZONE_MODIFIEE', entite: entite(zone), details: { code: zone.code, avant } });
  res.json({ success: true, data: zone });
};

module.exports = { lister, arbre, creer, modifier };
