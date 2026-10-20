/**
 * Test de fumée de l'authentification (/api/auth) avec MongoDB en mémoire.
 * Usage : node scripts/smokeTestAuth.js
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 3101;
const BASE = `http://localhost:${PORT}/api`;
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

const post = (chemin, body, token) => fetch(`${BASE}${chemin}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
  body: JSON.stringify(body),
});

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('test-smoke-auth');
  process.env.PORT = PORT;
  process.env.NODE_ENV = 'test';

  require('../index.js');
  await new Promise((r) => setTimeout(r, 1500));

  const { creerUtilisateur } = require('../services/utilisateurService');
  await creerUtilisateur({
    nom: 'Ngarlem', prenom: 'Esther', telephone: '+235660000002',
    email: 'E.Ngarlem@exemple.td', motDePasse: 'motdepasse123',
  });
  // Administrateur qui désactivera le compte d'Esther (étape 7)
  const Affectation = require('../models/Affectation');
  const admin = await creerUtilisateur({ nom: 'Admin', telephone: '+235660000009', motDePasse: 'motdepasseadmin' });
  await Affectation.create({ utilisateur: admin._id, role: 'ADMINISTRATEUR' });

  // 1. Connexion : champs manquants, mauvais mot de passe, identifiant inconnu
  let rep = await post('/auth/connexion', { identifiant: '+235660000002' });
  verifier('connexion incomplète -> 400', rep.status === 400, `status=${rep.status}`);
  rep = await post('/auth/connexion', { identifiant: '+235660000002', motDePasse: 'faux' });
  verifier('mauvais mot de passe -> 401', rep.status === 401, `status=${rep.status}`);
  rep = await post('/auth/connexion', { identifiant: '+235669999999', motDePasse: 'motdepasse123' });
  verifier('identifiant inconnu -> 401', rep.status === 401, `status=${rep.status}`);

  // 2. Connexion par téléphone et par e-mail (insensible à la casse)
  rep = await post('/auth/connexion', { identifiant: '+235660000002', motDePasse: 'motdepasse123' });
  let corps = await rep.json();
  verifier('connexion téléphone -> 200', rep.status === 200 && corps.data.accessToken && corps.data.refreshToken);
  verifier('hash masqué à la connexion', !JSON.stringify(corps).includes('motDePasseHash'));
  verifier('derniereConnexion renseignée', Boolean(corps.data.utilisateur.derniereConnexion));
  let { accessToken, refreshToken } = corps.data;

  rep = await post('/auth/connexion', { identifiant: 'e.ngarlem@EXEMPLE.td', motDePasse: 'motdepasse123' });
  verifier('connexion e-mail -> 200', rep.status === 200, `status=${rep.status}`);

  // 3. Routes protégées
  rep = await fetch(`${BASE}/auth/moi`);
  verifier('moi sans token -> 401', rep.status === 401, `status=${rep.status}`);
  rep = await fetch(`${BASE}/auth/moi`, { headers: { Authorization: 'Bearer abc.def.ghi' } });
  verifier('moi token invalide -> 401', rep.status === 401, `status=${rep.status}`);
  rep = await fetch(`${BASE}/auth/moi`, { headers: { Authorization: `Bearer ${accessToken}` } });
  corps = await rep.json();
  verifier('moi avec token -> 200', rep.status === 200 && corps.data.telephone === '+235660000002');
  rep = await fetch(`${BASE}/utilisateurs`);
  verifier('/utilisateurs sans token -> 401', rep.status === 401, `status=${rep.status}`);

  // 3 bis. CORS : l'application web de développement est autorisée, un site inconnu non
  const preverification = (origine) => fetch(`${BASE}/auth/moi`, {
    method: 'OPTIONS',
    headers: { Origin: origine, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' },
  });
  rep = await preverification('http://localhost:5173');
  verifier('CORS : origine web autorisée', rep.headers.get('access-control-allow-origin') === 'http://localhost:5173'
    && /authorization/i.test(rep.headers.get('access-control-allow-headers') || ''));
  rep = await preverification('https://site-malveillant.example');
  verifier('CORS : origine inconnue refusée', !rep.headers.get('access-control-allow-origin'));

  // 4. Rafraîchissement avec rotation et détection de réutilisation
  rep = await post('/auth/rafraichir', { refreshToken });
  corps = await rep.json();
  verifier('rafraîchir -> 200', rep.status === 200 && corps.data.refreshToken !== refreshToken);
  const ancienRefresh = refreshToken;
  ({ accessToken, refreshToken } = corps.data);

  rep = await post('/auth/rafraichir', { refreshToken: ancienRefresh });
  verifier('réutilisation ancien refresh -> 401', rep.status === 401, `status=${rep.status}`);
  rep = await post('/auth/rafraichir', { refreshToken });
  verifier('réutilisation détectée : nouveau refresh révoqué aussi', rep.status === 401, `status=${rep.status}`);

  // 5. Déconnexion
  rep = await post('/auth/connexion', { identifiant: '+235660000002', motDePasse: 'motdepasse123' });
  ({ accessToken, refreshToken } = (await rep.json()).data);
  rep = await post('/auth/deconnexion', { refreshToken });
  verifier('déconnexion -> 200', rep.status === 200, `status=${rep.status}`);
  rep = await post('/auth/rafraichir', { refreshToken });
  verifier('refresh après déconnexion -> 401', rep.status === 401, `status=${rep.status}`);

  // 6. Changement de son mot de passe
  rep = await post('/auth/connexion', { identifiant: '+235660000002', motDePasse: 'motdepasse123' });
  ({ accessToken, refreshToken } = (await rep.json()).data);
  const patchMdp = (body) => fetch(`${BASE}/auth/mot-de-passe`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  rep = await patchMdp({ ancienMotDePasse: 'faux', nouveauMotDePasse: 'nouveaumotdepasse456' });
  verifier('mdp : ancien incorrect -> 401', rep.status === 401, `status=${rep.status}`);
  rep = await patchMdp({ ancienMotDePasse: 'motdepasse123', nouveauMotDePasse: 'court' });
  verifier('mdp : trop court -> 400', rep.status === 400, `status=${rep.status}`);
  rep = await patchMdp({ ancienMotDePasse: 'motdepasse123', nouveauMotDePasse: 'nouveaumotdepasse456' });
  verifier('mdp : changé -> 200', rep.status === 200, `status=${rep.status}`);
  rep = await post('/auth/rafraichir', { refreshToken });
  verifier('sessions révoquées après changement de mdp', rep.status === 401, `status=${rep.status}`);
  rep = await post('/auth/connexion', { identifiant: '+235660000002', motDePasse: 'nouveaumotdepasse456' });
  corps = await rep.json();
  verifier('connexion avec nouveau mdp -> 200', rep.status === 200);
  ({ accessToken, refreshToken } = corps.data);

  // 7. Compte désactivé : sessions coupées et connexion refusée
  const id = corps.data.utilisateur._id;
  rep = await post('/auth/connexion', { identifiant: '+235660000009', motDePasse: 'motdepasseadmin' });
  const tokenAdmin = (await rep.json()).data.accessToken;
  rep = await fetch(`${BASE}/utilisateurs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
    body: JSON.stringify({ actif: false }),
  });
  verifier('désactivation -> 200', rep.status === 200, `status=${rep.status}`);
  rep = await fetch(`${BASE}/auth/moi`, { headers: { Authorization: `Bearer ${accessToken}` } });
  verifier('access token d\'un compte désactivé -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await post('/auth/rafraichir', { refreshToken });
  verifier('refresh d\'un compte désactivé -> 401', rep.status === 401, `status=${rep.status}`);
  rep = await post('/auth/connexion', { identifiant: '+235660000002', motDePasse: 'nouveaumotdepasse456' });
  verifier('connexion compte désactivé -> 403', rep.status === 403, `status=${rep.status}`);

  // 8. Limitation de débit : les échecs répétés de connexion finissent en 429
  // (les connexions réussies ci-dessus ne sont pas comptées)
  let statuts = [];
  for (let i = 0; i < 15; i++) {
    rep = await post('/auth/connexion', { identifiant: '+235660000002', motDePasse: 'faux' });
    statuts.push(rep.status);
    if (rep.status === 429) break;
  }
  corps = await rep.json();
  verifier('échecs répétés -> 429', rep.status === 429, `statuts=${statuts.join(',')}`);
  verifier('429 au format standard de l\'API', corps.success === false && Boolean(corps.error.message));
  verifier('en-têtes RateLimit présents', rep.headers.has('ratelimit') && rep.headers.has('ratelimit-policy'));
  rep = await post('/auth/connexion', { identifiant: '+235660000002', motDePasse: 'nouveaumotdepasse456' });
  verifier('connexion bloquée même avec le bon mot de passe', rep.status === 429, `status=${rep.status}`);

  console.log(`\nRésultat : ${reussis} réussis, ${echoues} échoués`);
  await mongod.stop();
  process.exit(echoues > 0 ? 1 : 0);
})().catch((err) => {
  console.error('Erreur fatale du test :', err);
  process.exit(1);
});
