/**
 * Configuration de l'authentification, surchargeable par variables d'environnement :
 *   JWT_SECRET            secret de signature des access tokens (OBLIGATOIRE en production)
 *   JWT_EXPIRATION        durée de vie d'un access token (défaut : 15m)
 *   REFRESH_EXPIRATION_JOURS  durée de vie d'un refresh token en jours (défaut : 30)
 */
const SECRET_DEV = 'secret-de-developpement-a-ne-pas-utiliser-en-production';

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('La variable d\'environnement JWT_SECRET est obligatoire en production');
  }
  console.warn('[auth] JWT_SECRET non défini : utilisation d\'un secret de développement');
}

module.exports = {
  jwtSecret: process.env.JWT_SECRET || SECRET_DEV,
  jwtExpiration: process.env.JWT_EXPIRATION || '15m',
  refreshExpirationJours: parseInt(process.env.REFRESH_EXPIRATION_JOURS, 10) || 30,
};
