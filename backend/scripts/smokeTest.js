/**
 * Test de fumée CRUD sur /api/utilisateurs (authentifié) avec MongoDB en mémoire.
 * Usage : node scripts/smokeTest.js
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 3100;
const BASE = `http://localhost:${PORT}/api/utilisateurs`;
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

(async () => {
  const mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  process.env.MONGODB_URI = mongod.getUri('test-smoke');
  process.env.PORT = PORT;
  process.env.NODE_ENV = 'test';

  require('../index.js'); // connecte Mongo puis démarre le serveur
  await new Promise((r) => setTimeout(r, 1500));

  // Les routes /api/utilisateurs exigent d'être connecté et administrateur : on crée un compte et on se connecte
  const { creerUtilisateur } = require('../services/utilisateurService');
  const Affectation = require('../models/Affectation');
  const admin = await creerUtilisateur({ nom: 'Admin', telephone: '+235660000000', motDePasse: 'motdepasseadmin' });
  await Affectation.create({ utilisateur: admin._id, role: 'ADMINISTRATEUR' });
  const connexion = await fetch(`http://localhost:${PORT}/api/auth/connexion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiant: '+235660000000', motDePasse: 'motdepasseadmin' }),
  });
  const { accessToken } = (await connexion.json()).data;
  const api = (url, options = {}) => fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
  });

  // 1. Création
  let rep = await api(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nom: 'Mahamat', prenom: 'Ali', telephone: '+235660000001',
      fonction: "Infirmier diplômé d'État", motDePasse: 'motdepasse123',
    }),
  });
  const cree = await rep.json();
  verifier('POST 201 création', rep.status === 201 && cree.success === true, `status=${rep.status}`);
  verifier('hash masqué dans la réponse', !JSON.stringify(cree).includes('motDePasseHash'));
  const id = cree.data._id;

  // 2. Doublon téléphone -> 409
  rep = await api(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom: 'Autre', telephone: '+235660000001', motDePasse: 'motdepasse123' }),
  });
  verifier('POST doublon -> 409', rep.status === 409, `status=${rep.status}`);

  // 3. Champ manquant -> 400
  rep = await api(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom: 'Incomplet' }),
  });
  verifier('POST incomplet -> 400', rep.status === 400, `status=${rep.status}`);

  // 4. Liste + recherche + pagination
  rep = await api(`${BASE}?recherche=mahamat`);
  const liste = await rep.json();
  verifier('GET liste avec recherche', rep.status === 200 && liste.data.length === 1 && liste.pagination.total === 1);

  // 5. Détail
  rep = await api(`${BASE}/${id}`);
  verifier('GET détail', rep.status === 200 && (await rep.json()).data.telephone === '+235660000001');

  // 6. Mise à jour
  rep = await api(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fonction: 'Médecin-chef de district', langue: 'ar' }),
  });
  const maj = await rep.json();
  verifier('PATCH mise à jour', rep.status === 200 && maj.data.fonction === 'Médecin-chef de district' && maj.data.langue === 'ar');

  // 7. Changement de mot de passe (trop court -> 400)
  rep = await api(`${BASE}/${id}/mot-de-passe`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nouveauMotDePasse: 'court' }),
  });
  verifier('PATCH mot de passe court -> 400', rep.status === 400, `status=${rep.status}`);

  rep = await api(`${BASE}/${id}/mot-de-passe`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nouveauMotDePasse: 'nouveaumotdepasse456' }),
  });
  verifier('PATCH mot de passe valide', rep.status === 200, `status=${rep.status}`);

  // 8. ID invalide -> 400, ID absent -> 404
  rep = await api(`${BASE}/id-invalide`);
  verifier('GET id invalide -> 400', rep.status === 400, `status=${rep.status}`);
  rep = await api(`${BASE}/507f1f77bcf86cd799439011`);
  verifier('GET id absent -> 404', rep.status === 404, `status=${rep.status}`);

  // 9. Suppression
  rep = await api(`${BASE}/${id}`, { method: 'DELETE' });
  verifier('DELETE -> 204', rep.status === 204, `status=${rep.status}`);
  rep = await api(`${BASE}/${id}`);
  verifier('GET après suppression -> 404', rep.status === 404);

  console.log(`\nRésultat : ${reussis} réussis, ${echoues} échoués`);
  await mongod.stop();
  process.exit(echoues > 0 ? 1 : 0);
})().catch((err) => {
  console.error('Erreur fatale du test :', err);
  process.exit(1);
});
