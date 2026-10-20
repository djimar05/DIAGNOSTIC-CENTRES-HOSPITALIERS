const affectationService = require('../services/affectationService');
const { journaliser } = require('../services/journalService');

// Couche HTTP fine : extraction des paramètres, appel du service, réponse.
// Express 5 transmet automatiquement les erreurs async au gestionnaire global.

const entite = (affectation) => ({ modele: 'Affectation', id: affectation._id });
const resume = (a) => ({ utilisateur: a.utilisateur, role: a.role, zone: a.zone, centre: a.centre });

const lister = async (req, res) => {
  const affectations = await affectationService.listerAffectations(req.params.id, req.affectationsAutorisees);
  res.json({ success: true, data: affectations });
};

const creer = async (req, res) => {
  const affectation = await affectationService.creerAffectation(req.params.id, req.body, req.affectationsAutorisees);
  await journaliser(req, { action: 'AFFECTATION_CREEE', entite: entite(affectation), details: resume(affectation) });
  res.status(201).json({ success: true, data: affectation });
};

const mettreAJour = async (req, res) => {
  const { affectation, avant } = await affectationService.mettreAJourAffectation(
    req.params.id, req.body, req.affectationsAutorisees, req.utilisateur._id,
  );
  await journaliser(req, {
    action: 'AFFECTATION_MODIFIEE', entite: entite(affectation), details: { ...resume(affectation), avant },
  });
  res.json({ success: true, data: affectation });
};

const retirer = async (req, res) => {
  const affectation = await affectationService.retirerAffectation(
    req.params.id, req.affectationsAutorisees, req.utilisateur._id,
  );
  await journaliser(req, { action: 'AFFECTATION_RETIREE', entite: entite(affectation), details: resume(affectation) });
  res.json({ success: true, data: affectation });
};

module.exports = { lister, creer, mettreAJour, retirer };
