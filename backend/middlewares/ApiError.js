/**
 * Classe d'erreur applicative avec code HTTP.
 * Les erreurs "opérationnelles" (isOperational = true) sont prévisibles
 * (validation, authentification, etc.) — leur message peut être renvoyé au client.
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Requête invalide', details = null) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Authentification requise') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Accès interdit') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Ressource non trouvée') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Conflit de données') {
    return new ApiError(409, message);
  }

  static internal(message = 'Erreur interne du serveur') {
    return new ApiError(500, message);
  }
}

module.exports = ApiError;
