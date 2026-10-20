const ApiError = require('./ApiError');
const droitsService = require('../services/droitsService');

/**
 * Exige que l'utilisateur connecté (voir proteger) ait au moins une affectation active
 * avec l'un des rôles donnés. À placer après proteger.
 *   req.affectations           → toutes ses affectations actives (chargées une seule fois par requête)
 *   req.affectationsAutorisees → celles qui donnent accès à cette route (pour filtrer par périmètre)
 *
 * Exemple : router.post('/', autoriser('ADMINISTRATEUR'), controller.creer);
 */
const autoriser = (...roles) => async (req, res, next) => {
  if (!req.affectations) {
    req.affectations = await droitsService.affectationsActives(req.utilisateur._id);
  }
  const retenues = req.affectations.filter((a) => roles.includes(a.role));
  if (!retenues.length) throw ApiError.forbidden("Vous n'avez pas les droits pour cette action");
  req.affectationsAutorisees = retenues;
  next();
};

/** Vrai si l'utilisateur de la requête a le rôle donné (après autoriser). */
const aLeRole = (req, role) => (req.affectations || []).some((a) => a.role === role);

module.exports = { autoriser, aLeRole };
