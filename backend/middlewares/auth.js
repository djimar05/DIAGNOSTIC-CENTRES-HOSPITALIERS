const ApiError = require('./ApiError');
const authService = require('../services/authService');

/**
 * Exige un access token valide dans l'en-tête "Authorization: Bearer <token>".
 * En cas de succès, l'utilisateur connecté est disponible dans req.utilisateur.
 */
const proteger = async (req, res, next) => {
  const [schema, token] = (req.headers.authorization || '').split(' ');
  if (schema !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Authentification requise');
  }

  req.utilisateur = await authService.verifierAccessToken(token);
  next();
};

/**
 * Bloque l'accès tant que l'utilisateur garde un mot de passe temporaire (fixé par un administrateur).
 * À placer après proteger sur les routes métier ; /api/auth reste accessible pour changer le mot de passe.
 */
const exigerMotDePasseAJour = (req, res, next) => {
  if (req.utilisateur.motDePasseAChanger) {
    throw ApiError.forbidden('Vous devez remplacer votre mot de passe temporaire avant de continuer');
  }
  next();
};

module.exports = { proteger, exigerMotDePasseAJour };
