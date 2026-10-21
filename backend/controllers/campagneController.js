const campagneService = require('../services/campagneService');
const missionService = require('../services/missionService');
const equipeService = require('../services/equipeService');
const { journaliser } = require('../services/journalService');

// Couche HTTP fine : extraction des paramètres, appel du service, réponse.
// Express 5 transmet automatiquement les erreurs async au gestionnaire global.

const entite = (c) => ({ modele: 'Campagne', id: c._id });

const lister = async (req, res) => {
  res.json({ success: true, data: await campagneService.listerCampagnes(req, req.query) });
};

const obtenir = async (req, res) => {
  res.json({ success: true, data: await campagneService.obtenirCampagne(req, req.params.id, { peupler: true }) });
};

const creer = async (req, res) => {
  const campagne = await campagneService.creerCampagne(req, req.body);
  await journaliser(req, { action: 'CAMPAGNE_CREEE', entite: entite(campagne), details: { nom: campagne.nom } });
  res.status(201).json({ success: true, data: campagne });
};

const modifier = async (req, res) => {
  const campagne = await campagneService.modifierCampagne(req, req.params.id, req.body);
  await journaliser(req, { action: 'CAMPAGNE_MODIFIEE', entite: entite(campagne), details: { champs: Object.keys(req.body) } });
  res.json({ success: true, data: campagne });
};

const demarrer = async (req, res) => {
  const campagne = await campagneService.demarrerCampagne(req, req.params.id);
  await journaliser(req, { action: 'CAMPAGNE_DEMARREE', entite: entite(campagne), details: { nom: campagne.nom } });
  res.json({ success: true, data: campagne });
};

const cloturer = async (req, res) => {
  const { campagne, evaluationsAnnulees } = await campagneService.cloturerCampagne(req, req.params.id, { forcer: req.body?.forcer === true });
  await journaliser(req, { action: 'CAMPAGNE_CLOTUREE', entite: entite(campagne), details: { nom: campagne.nom, evaluationsAnnulees } });
  res.json({ success: true, data: campagne, evaluationsAnnulees });
};

const ajouterMissions = async (req, res) => {
  const resultat = await campagneService.ajouterMissions(req, req.params.id, req.body);
  if (resultat.creees) {
    await journaliser(req, { action: 'MISSIONS_CREEES', entite: { modele: 'Campagne', id: req.params.id }, details: { creees: resultat.creees } });
  }
  res.status(resultat.creees ? 201 : 200).json({ success: true, data: resultat });
};

const affecterEquipe = async (req, res) => {
  const resultat = await missionService.affecterEquipe(req, req.params.id, req.body);
  if (resultat.modifiees) {
    await journaliser(req, { action: 'EQUIPE_AFFECTEE', entite: { modele: 'Campagne', id: req.params.id }, details: { missions: resultat.modifiees } });
  }
  res.json({ success: true, data: resultat });
};

const avancement = async (req, res) => {
  res.json({ success: true, data: await campagneService.avancementCampagne(req, req.params.id) });
};

const intervenants = async (req, res) => {
  res.json({ success: true, data: await campagneService.intervenantsCampagne(req, req.params.id) });
};

const intervenantsZone = async (req, res) => {
  res.json({ success: true, data: await equipeService.intervenantsPour({ zone: req.query.zone || null }) });
};

module.exports = {
  lister, obtenir, creer, modifier, demarrer, cloturer, ajouterMissions, affecterEquipe, avancement, intervenants, intervenantsZone,
};
