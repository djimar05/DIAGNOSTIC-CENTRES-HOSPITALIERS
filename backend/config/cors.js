/**
 * Origines autorisées à appeler l'API depuis un navigateur (CORS).
 *   CORS_ORIGINES  liste séparée par des virgules, ex. "https://diagnostic.sante.td,https://admin.sante.td"
 *
 * Hors production, l'application web de développement (Vite, port 5173) est autorisée par défaut.
 * En production, sans CORS_ORIGINES, aucun site tiers n'est autorisé (l'application mobile
 * n'envoie pas d'en-tête Origin : elle n'est pas concernée).
 */
const ORIGINES_DEV = ['http://localhost:5173', 'http://127.0.0.1:5173'];

const origines = process.env.CORS_ORIGINES
  ? process.env.CORS_ORIGINES.split(',').map((o) => o.trim()).filter(Boolean)
  : (process.env.NODE_ENV === 'production' ? [] : ORIGINES_DEV);

module.exports = {
  origin: origines,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['RateLimit', 'RateLimit-Policy'],
  maxAge: 600, // le navigateur garde la réponse de pré-vérification 10 min (moins d'allers-retours en 3G)
};
