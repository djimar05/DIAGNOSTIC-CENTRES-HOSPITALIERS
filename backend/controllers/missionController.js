const missionService = require('../services/missionService');
const { journaliser } = require('../services/journalService');

// Couche HTTP fine : extraction des paramètres, appel du service, réponse.
// Express 5 transmet automatiquement les erreurs async au gestionnaire global.

const entite = (m) => ({ modele: 'Mission', id: m._id });

const lister = async (req, res) => {
  res.json({ success: true, data: await missionService.listerMissions(req, req.query) });
};

const obtenir = async (req, res) => {
  res.json({ success: true, data: await missionService.obtenirMissionDetaillee(req, req.params.id) });
};

const modifier = async (req, res) => {
  const mission = await missionService.modifierMission(req, req.params.id, req.body);
  await journaliser(req, { action: 'MISSION_MODIFIEE', entite: entite(mission), details: { champs: Object.keys(req.body) } });
  res.json({ success: true, data: await missionService.obtenirMissionDetaillee(req, mission._id) });
};

const supprimer = async (req, res) => {
  const mission = await missionService.supprimerMission(req, req.params.id);
  await journaliser(req, { action: 'MISSION_SUPPRIMEE', entite: entite(mission), details: { campagne: mission.campagne, centre: mission.centre } });
  res.status(204).send();
};

module.exports = { lister, obtenir, modifier, supprimer };
