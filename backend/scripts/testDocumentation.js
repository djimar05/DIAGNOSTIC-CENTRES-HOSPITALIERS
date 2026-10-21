/**
 * Test de la documentation OpenAPI :
 *   - la spécification est valide (OpenAPI 3, références résolues)
 *   - chaque route Express est documentée, et la documentation ne décrit aucune route inexistante
 *   - chaque opération a un tag, un résumé, un operationId unique et ses réponses
 *   - Swagger UI et openapi.json sont servis, et pas en production sauf API_DOCS=true
 * Usage : node scripts/testDocumentation.js
 */
const SwaggerParser = require('@apidevtools/swagger-parser');
const express = require('express');
const routes = require('../routes');
const { specification, routeurDocumentation, docsActives } = require('../docs/swagger');

let reussis = 0;
let echoues = 0;

const verifier = (nom, condition, extra = '') => {
  if (condition) {
    reussis++;
    console.log(`  OK   ${nom}`);
  } else {
    echoues++;
    console.log(`  ECHEC ${nom} ${extra}`);
  }
};

const METHODES = ['get', 'post', 'put', 'patch', 'delete'];

(async () => {
  // 1. Validité de la spécification
  try {
    await SwaggerParser.validate(structuredClone(specification));
    verifier('spécification OpenAPI 3 valide', true);
  } catch (err) {
    verifier('spécification OpenAPI 3 valide', false, err.message);
  }

  // 2. Correspondance routes Express ↔ documentation
  const routesExpress = new Set();
  for (const { prefixe, routeur } of routes) {
    for (const couche of routeur.stack) {
      if (!couche.route) continue;
      const chemin = `${prefixe}${couche.route.path === '/' ? '' : couche.route.path}`.replace(/:(\w+)/g, '{$1}');
      Object.keys(couche.route.methods).forEach((m) => routesExpress.add(`${m.toUpperCase()} ${chemin}`));
    }
  }
  const routesDocumentees = new Set();
  for (const [chemin, operations] of Object.entries(specification.paths)) {
    METHODES.filter((m) => operations[m]).forEach((m) => routesDocumentees.add(`${m.toUpperCase()} ${chemin}`));
  }
  const nonDocumentees = [...routesExpress].filter((r) => !routesDocumentees.has(r));
  const inexistantes = [...routesDocumentees].filter((r) => !routesExpress.has(r));
  verifier(`toutes les routes sont documentées (${routesExpress.size} routes)`, nonDocumentees.length === 0, nonDocumentees.join(', '));
  verifier('aucune route documentée qui n\'existe pas', inexistantes.length === 0, inexistantes.join(', '));

  // 3. Qualité de chaque opération
  const operations = Object.entries(specification.paths).flatMap(([chemin, ops]) => METHODES.filter((m) => ops[m]).map((m) => ({ id: `${m.toUpperCase()} ${chemin}`, ...ops[m] })));
  const incompletes = operations.filter((o) => !o.tags?.length || !o.summary || !o.operationId || !Object.keys(o.responses || {}).length);
  verifier('chaque opération a tag, résumé, operationId et réponses', incompletes.length === 0, incompletes.map((o) => o.id).join(', '));
  const ids = operations.map((o) => o.operationId);
  verifier('operationId uniques (génération de client)', new Set(ids).size === ids.length, ids.filter((x, i) => ids.indexOf(x) !== i).join(', '));
  const tagsDeclares = new Set(specification.tags.map((t) => t.name));
  const tagsInconnus = [...new Set(operations.flatMap((o) => o.tags))].filter((t) => !tagsDeclares.has(t));
  verifier('tags déclarés', tagsInconnus.length === 0, tagsInconnus.join(', '));
  const publiques = operations.filter((o) => Array.isArray(o.security) && o.security.length === 0).map((o) => o.id).sort();
  verifier('seules connexion / rafraîchissement / déconnexion sont publiques',
    JSON.stringify(publiques) === JSON.stringify(['POST /auth/connexion', 'POST /auth/deconnexion', 'POST /auth/rafraichir']), publiques.join(', '));

  // 4. Service HTTP de la documentation
  const app = express();
  app.use('/api/docs', routeurDocumentation());
  const serveur = app.listen(0);
  const base = `http://localhost:${serveur.address().port}/api/docs`;
  let rep = await fetch(`${base}/openapi.json`);
  const servie = await rep.json();
  verifier('openapi.json servi', rep.status === 200 && servie.openapi === '3.0.3' && Object.keys(servie.paths).length === Object.keys(specification.paths).length);
  rep = await fetch(`${base}/`);
  verifier('Swagger UI servi', rep.status === 200 && /swagger-ui/i.test(await rep.text()));
  serveur.close();

  const sauvegarde = { NODE_ENV: process.env.NODE_ENV, API_DOCS: process.env.API_DOCS };
  delete process.env.API_DOCS;
  process.env.NODE_ENV = 'production';
  verifier('désactivée par défaut en production', docsActives() === false);
  process.env.API_DOCS = 'true';
  verifier('activable en production avec API_DOCS=true', docsActives() === true);
  process.env.NODE_ENV = 'development';
  process.env.API_DOCS = 'false';
  verifier('désactivable hors production avec API_DOCS=false', docsActives() === false);
  Object.assign(process.env, sauvegarde);

  console.log(`\nRésultat : ${reussis} réussis, ${echoues} échoués`);
  process.exit(echoues > 0 ? 1 : 0);
})().catch((err) => {
  console.error('Erreur fatale du test :', err);
  process.exit(1);
});
