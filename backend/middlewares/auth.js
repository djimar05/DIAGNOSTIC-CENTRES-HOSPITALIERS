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

module.exports = { proteger };
