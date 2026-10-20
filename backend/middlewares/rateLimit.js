const { rateLimit } = require('express-rate-limit');
const ApiError = require('./ApiError');

/**
 * Limitation du nombre de requêtes par adresse IP.
 * Limites surchargeables par variables d'environnement :
 *   RATE_LIMIT_CONNEXION  échecs de connexion autorisés par fenêtre de 15 min (défaut : 10)
 *   RATE_LIMIT_AUTH       requêtes /rafraichir et /deconnexion par fenêtre de 15 min (défaut : 100)
 *   RATE_LIMIT_API        requêtes sur l'ensemble de l'API par minute (défaut : 300)
 *
 * Derrière un reverse proxy (nginx, load balancer), définir TRUST_PROXY (voir index.js),
 * sinon toutes les requêtes semblent venir de l'IP du proxy.
 */
const QUINZE_MINUTES = 15 * 60 * 1000;

const creerLimiteur = ({ windowMs, limit, message, ...options }) => rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-8', // en-têtes RateLimit / RateLimit-Policy
  legacyHeaders: false,
  // Réponse au format standard de l'API via le gestionnaire d'erreurs global
  handler: (req, res, next) => next(new ApiError(429, message)),
  ...options,
});

/** Anti force brute : seuls les échecs (réponse >= 400) sont comptés. */
const limiteurConnexion = creerLimiteur({
  windowMs: QUINZE_MINUTES,
  limit: parseInt(process.env.RATE_LIMIT_CONNEXION, 10) || 10,
  skipSuccessfulRequests: true,
  message: 'Trop de tentatives de connexion, réessayez dans 15 minutes',
});

/** Routes publiques d'authentification autres que la connexion. */
const limiteurAuth = creerLimiteur({
  windowMs: QUINZE_MINUTES,
  limit: parseInt(process.env.RATE_LIMIT_AUTH, 10) || 100,
  message: 'Trop de requêtes d\'authentification, réessayez plus tard',
});

/** Limite globale de l'API, contre les abus et les clients défaillants. */
const limiteurApi = creerLimiteur({
  windowMs: 60 * 1000,
  limit: parseInt(process.env.RATE_LIMIT_API, 10) || 300,
  message: 'Trop de requêtes, réessayez dans une minute',
});

module.exports = { limiteurConnexion, limiteurAuth, limiteurApi };
