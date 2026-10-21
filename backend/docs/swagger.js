const express = require('express');
const swaggerUi = require('swagger-ui-express');
const specification = require('./openapi');

/**
 * Documentation interactive de l'API :
 *   /api/docs               interface Swagger UI (essayer les routes avec son jeton)
 *   /api/docs/openapi.json  spécification brute (génération de client, import Postman / Insomnia)
 *
 * Active hors production. En production, l'activer explicitement avec API_DOCS=true.
 */
const docsActives = () => (process.env.API_DOCS
  ? process.env.API_DOCS === 'true'
  : process.env.NODE_ENV !== 'production');

const routeurDocumentation = () => {
  const router = express.Router();
  // Avant Swagger UI, qui répond à toutes les adresses sous /api/docs
  router.get('/openapi.json', (req, res) => res.json(specification));
  router.use('/', swaggerUi.serve, swaggerUi.setup(specification, {
    customSiteTitle: 'API – Diagnostic des centres',
    swaggerOptions: {
      persistAuthorization: true, // garde le jeton saisi dans « Authorize » après un rechargement
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
    },
  }));
  return router;
};

module.exports = { docsActives, routeurDocumentation, specification };
