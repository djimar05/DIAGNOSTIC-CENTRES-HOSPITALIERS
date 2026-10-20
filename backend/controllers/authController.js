const authService = require('../services/authService');
const { affectationsActives } = require('../services/droitsService');
const { journaliser } = require('../services/journalService');

// Couche HTTP fine : extraction des paramètres, appel du service, réponse.
// Express 5 transmet automatiquement les erreurs async au gestionnaire global.

const connexion = async (req, res) => {
  const resultat = await authService.connecter(req.body, req.get('user-agent'));
  await journaliser(req, { action: 'CONNEXION', utilisateur: resultat.utilisateur._id });
  res.json({ success: true, data: resultat });
};

const rafraichir = async (req, res) => {
  const jetons = await authService.rafraichir(req.body.refreshToken, req.get('user-agent'));
  res.json({ success: true, data: jetons });
};

const deconnexion = async (req, res) => {
  await authService.deconnecter(req.body.refreshToken);
  res.json({ success: true, message: 'Déconnexion effectuée' });
};

const deconnexionPartout = async (req, res) => {
  await authService.revoquerToutesLesSessions(req.utilisateur._id);
  res.json({ success: true, message: 'Toutes les sessions ont été fermées' });
};

/**
 * Profil de l'utilisateur connecté, avec ses affectations actives et la liste de ses rôles :
 * le front s'en sert pour afficher les menus et écrans auxquels il a droit.
 */
const moi = async (req, res) => {
  const affectations = await affectationsActives(req.utilisateur._id, { peupler: true });
  const roles = [...new Set(affectations.map((a) => a.role))];
  res.json({ success: true, data: { ...req.utilisateur.toJSON(), affectations, roles } });
};

const changerMonMotDePasse = async (req, res) => {
  await authService.changerMonMotDePasse(req.utilisateur._id, req.body);
  await journaliser(req, { action: 'MOT_DE_PASSE_CHANGE' });
  res.json({ success: true, message: 'Mot de passe mis à jour, veuillez vous reconnecter' });
};

module.exports = { connexion, rafraichir, deconnexion, deconnexionPartout, moi, changerMonMotDePasse };
