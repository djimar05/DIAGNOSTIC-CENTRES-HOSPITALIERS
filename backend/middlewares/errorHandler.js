const ApiError = require('./ApiError');

/**
 * Convertit n'importe quelle erreur levée dans l'application
 * en ApiError normalisée avec le bon code HTTP.
 */
const normalizeError = (err) => {
  // Déjà une erreur applicative
  if (err instanceof ApiError) return err;

  // JSON malformé dans le body (express.json / body-parser)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return ApiError.badRequest('JSON invalide dans le corps de la requête');
  }

  // Erreur de validation de type "entity too large"
  if (err.type === 'entity.too.large') {
    return new ApiError(413, 'Corps de la requête trop volumineux');
  }

  // Mongoose : ObjectId ou type invalide
  if (err.name === 'CastError') {
    return ApiError.badRequest(`Valeur invalide pour le champ "${err.path}"`);
  }

  // Mongoose : erreurs de validation de schéma
  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.values(err.errors).map((e) => e.message);
    return ApiError.badRequest('Erreur de validation des données', details);
  }

  // Mongoose/Mongo : violation d'unicité (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {}).join(', ');
    return ApiError.conflict(`Une valeur existe déjà pour : ${field}`);
  }

  // JWT : token invalide ou expiré
  if (err.name === 'JsonWebTokenError') {
    return ApiError.unauthorized('Token invalide');
  }
  if (err.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Token expiré');
  }

  // Multer : erreurs d'upload de fichiers
  if (err.name === 'MulterError') {
    return ApiError.badRequest(`Erreur lors de l'upload : ${err.message}`);
  }

  // Erreurs tierces portant déjà un code HTTP (express-rate-limit, cors, etc.)
  if (Number.isInteger(err.statusCode) || Number.isInteger(err.status)) {
    return new ApiError(err.statusCode || err.status, err.message);
  }

  // Erreur inattendue : on masque les détails internes
  return ApiError.internal();
};

/**
 * Middleware 404 : intercepte toute requête sans route correspondante
 * et la transforme en ApiError pour le gestionnaire global.
 */
const notFound = (req, res, next) => {
  next(ApiError.notFound(`Route non trouvée : ${req.method} ${req.originalUrl}`));
};

/**
 * Middleware de gestion d'erreurs global.
 * Doit être enregistré EN DERNIER, après toutes les routes.
 * (4 paramètres obligatoires pour qu'Express le reconnaisse.)
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const error = normalizeError(err);

  // Log serveur : complet pour les erreurs 5xx, concis sinon
  if (error.statusCode >= 500) {
    console.error(`[ERREUR ${error.statusCode}]`, err);
  } else {
    console.warn(`[${error.statusCode}] ${req.method} ${req.originalUrl} - ${error.message}`);
  }

  res.status(error.statusCode).json({
    success: false,
    error: {
      message: error.message,
      ...(error.details && { details: error.details }),
      // Stack trace uniquement hors production
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
};

module.exports = { errorHandler, notFound, ApiError };
