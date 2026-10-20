const utilisateurService = require('../services/utilisateurService');
const { journaliser } = require('../services/journalService');

// Couche HTTP fine : extraction des paramètres, appel du service, réponse.
// Express 5 transmet automatiquement les erreurs async au gestionnaire global.

const entite = (id) => ({ modele: 'Utilisateur', id });

const creer = async (req, res) => {
  const utilisateur = await utilisateurService.creerUtilisateur(req.body);
  await journaliser(req, {
    action: 'UTILISATEUR_CREE', entite: entite(utilisateur._id), details: { telephone: utilisateur.telephone },
  });
  res.status(201).json({ success: true, data: utilisateur });
};

const lister = async (req, res) => {
  const { utilisateurs, pagination } = await utilisateurService.listerUtilisateurs(req.query);
  res.json({ success: true, data: utilisateurs, pagination });
};

const obtenir = async (req, res) => {
  const utilisateur = await utilisateurService.obtenirUtilisateurParId(req.params.id);
  res.json({ success: true, data: utilisateur });
};

const mettreAJour = async (req, res) => {
  const utilisateur = await utilisateurService.mettreAJourUtilisateur(req.params.id, req.body, req.utilisateur._id);
  await journaliser(req, {
    action: 'UTILISATEUR_MODIFIE', entite: entite(utilisateur._id), details: { champs: Object.keys(req.body) },
  });
  res.json({ success: true, data: utilisateur });
};

const changerMotDePasse = async (req, res) => {
  await utilisateurService.changerMotDePasse(req.params.id, req.body.nouveauMotDePasse);
  await journaliser(req, { action: 'MOT_DE_PASSE_REINITIALISE', entite: entite(req.params.id) });
  res.json({ success: true, message: 'Mot de passe mis à jour' });
};

const supprimer = async (req, res) => {
  await utilisateurService.supprimerUtilisateur(req.params.id, req.utilisateur._id);
  await journaliser(req, { action: 'UTILISATEUR_SUPPRIME', entite: entite(req.params.id) });
  res.status(204).send();
};

module.exports = { creer, lister, obtenir, mettreAJour, changerMotDePasse, supprimer };
