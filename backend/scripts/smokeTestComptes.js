/**
 * Test de fumée : mot de passe temporaire, profil, liste des utilisateurs par rôle,
 * lecture des zones et centres selon le périmètre. MongoDB en mémoire.
 * Usage : node scripts/smokeTestComptes.js
 *
 * Découpage utilisé :  NAT → R1 → { DA (centre CA), DB (centre CB) }
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 3103;
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

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('test-smoke-comptes');
  process.env.PORT = PORT;
  process.env.NODE_ENV = 'test';

  require('../index.js');
  await new Promise((r) => setTimeout(r, 1500));

  const { creerUtilisateur } = require('../services/utilisateurService');
  const Affectation = require('../models/Affectation');
  const Zone = require('../models/Zone');
  const Centre = require('../models/Centre');

  const nat = await Zone.create({ code: 'NAT', nom: 'National', niveau: 'NATIONAL' });
  const r1 = await Zone.create({ code: 'R1', nom: 'Région 1', niveau: 'REGION', parent: nat._id, ancetres: [nat._id] });
  const da = await Zone.create({ code: 'DA', nom: 'District A', niveau: 'DISTRICT', parent: r1._id, ancetres: [nat._id, r1._id] });
  const db = await Zone.create({ code: 'DB', nom: 'District B', niveau: 'DISTRICT', parent: r1._id, ancetres: [nat._id, r1._id] });
  const ca = await Centre.create({ code: 'CA', nom: 'CS Nord', niveau: 'CENTRE_SANTE', zone: da._id, zoneAncetres: [nat._id, r1._id, da._id] });
  await Centre.create({ code: 'CB', nom: 'CS Sud', niveau: 'CENTRE_SANTE', zone: db._id, zoneAncetres: [nat._id, r1._id, db._id] });

  const compte = async (telephone, affectation) => {
    const u = await creerUtilisateur({ nom: telephone, telephone, motDePasse: 'motdepasse123' });
    if (affectation) await Affectation.create({ utilisateur: u._id, ...affectation });
    return u;
  };
  await compte('+235660002000', { role: 'ADMINISTRATEUR' });
  await compte('+235660002001', { role: 'COORDONNATEUR', zone: da._id });
  await compte('+235660002002', { role: 'RESPONSABLE_CENTRE', centre: ca._id });

  const connecter = async (identifiant, motDePasse = 'motdepasse123') => {
    const rep = await fetch(`${BASE}/auth/connexion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiant, motDePasse }),
    });
    return (await rep.json()).data;
  };
  const client = (token) => (methode, chemin, body) => fetch(`${BASE}${chemin}`, {
    method: methode,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body && { body: JSON.stringify(body) }),
  });
  const adm = client((await connecter('+235660002000')).accessToken);
  const coord = client((await connecter('+235660002001')).accessToken);
  const resp = client((await connecter('+235660002002')).accessToken);

  // 1. Compte créé par l'administrateur : mot de passe temporaire
  let rep = await adm('POST', '/utilisateurs', { nom: 'Nouveau', telephone: '+235660002099', motDePasse: 'court' });
  verifier('création : mot de passe trop court -> 400', rep.status === 400, `status=${rep.status}`);
  rep = await adm('POST', '/utilisateurs', { nom: 'Nouveau', telephone: '+235660002099', motDePasse: 'temporaire1' });
  let corps = await rep.json();
  verifier('création : mot de passe à changer', rep.status === 201 && corps.data.motDePasseAChanger === true);
  const idNouveau = corps.data._id;
  await adm('POST', `/utilisateurs/${idNouveau}/affectations`, { role: 'EVALUATEUR', zone: da._id });

  let session = await connecter('+235660002099', 'temporaire1');
  let nouveau = client(session.accessToken);
  rep = await nouveau('GET', '/auth/moi');
  corps = await rep.json();
  verifier('mot de passe temporaire : /auth/moi accessible', rep.status === 200 && corps.data.motDePasseAChanger === true);
  rep = await nouveau('GET', '/zones');
  corps = await rep.json();
  verifier('mot de passe temporaire : reste de l\'API bloqué -> 403', rep.status === 403 && /temporaire/.test(corps.error.message));

  const changer = (api, body) => api('PATCH', '/auth/mot-de-passe', body);
  rep = await changer(nouveau, { ancienMotDePasse: 'temporaire1', nouveauMotDePasse: 'temporaire1' });
  verifier('nouveau mot de passe identique à l\'ancien -> 400', rep.status === 400, `status=${rep.status}`);
  rep = await changer(nouveau, { ancienMotDePasse: 'faux-mot-de-passe', nouveauMotDePasse: 'definitif123' });
  verifier('ancien mot de passe faux -> 400 (pas 401)', rep.status === 400, `status=${rep.status}`);
  rep = await changer(nouveau, { ancienMotDePasse: 'temporaire1', nouveauMotDePasse: 'definitif123' });
  verifier('changement du mot de passe temporaire -> 200', rep.status === 200, `status=${rep.status}`);

  session = await connecter('+235660002099', 'definitif123');
  nouveau = client(session.accessToken);
  verifier('reconnexion : plus de mot de passe à changer', session.utilisateur.motDePasseAChanger === false);
  rep = await nouveau('GET', '/zones');
  verifier('mot de passe définitif : API accessible', rep.status === 200, `status=${rep.status}`);

  // 2. Réinitialisation par l'administrateur (mot de passe oublié)
  rep = await adm('PATCH', `/utilisateurs/${idNouveau}/mot-de-passe`, { nouveauMotDePasse: 'reinit2026' });
  verifier('réinitialisation par l\'admin -> 200', rep.status === 200, `status=${rep.status}`);
  rep = await fetch(`${BASE}/auth/rafraichir`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  verifier('réinitialisation : anciennes sessions fermées', rep.status === 401, `status=${rep.status}`);
  session = await connecter('+235660002099', 'reinit2026');
  verifier('réinitialisation : mot de passe à changer de nouveau', session.utilisateur.motDePasseAChanger === true);
  rep = await adm('GET', `/journal?action=MOT_DE_PASSE_REINITIALISE&entite=${idNouveau}`);
  verifier('réinitialisation tracée dans le journal', (await rep.json()).pagination.total === 1);

  // 3. Mon profil : seule la langue est modifiable par l'utilisateur
  rep = await coord('PATCH', '/auth/moi', { langue: 'ar', telephone: '+235669999999', nom: 'Pirate' });
  corps = await rep.json();
  verifier('profil : langue modifiée', rep.status === 200 && corps.data.langue === 'ar');
  verifier('profil : téléphone et nom non modifiables', corps.data.telephone === '+235660002001' && corps.data.nom === '+235660002001');
  verifier('profil : rôles renvoyés', JSON.stringify(corps.data.roles) === '["COORDONNATEUR"]');
  rep = await coord('PATCH', '/auth/moi', { langue: 'en' });
  verifier('profil : langue inconnue -> 400', rep.status === 400, `status=${rep.status}`);

  // 4. Liste des utilisateurs : rôles et filtre par rôle
  rep = await adm('GET', '/utilisateurs?role=COORDONNATEUR');
  corps = await rep.json();
  verifier('filtre par rôle', corps.data.length === 1 && corps.data[0].telephone === '+235660002001', `n=${corps.data.length}`);
  rep = await adm('GET', '/utilisateurs?limite=100');
  corps = await rep.json();
  const evalNouveau = corps.data.find((u) => u._id === idNouveau);
  verifier('liste : rôles de chaque utilisateur', evalNouveau && JSON.stringify(evalNouveau.roles) === '["EVALUATEUR"]');
  verifier('liste : hash jamais exposé', !JSON.stringify(corps).includes('motDePasseHash'));

  // 5. Référentiel en lecture, selon le périmètre
  const codes = async (api, chemin) => (await (await api('GET', chemin)).json()).data.map((x) => x.code);
  verifier('zones : admin voit tout le découpage', JSON.stringify(await codes(adm, '/zones')) === '["NAT","R1","DA","DB"]');
  verifier('zones : coordonnateur voit son district', JSON.stringify(await codes(coord, '/zones')) === '["DA"]');
  verifier('zones : filtre par niveau', JSON.stringify(await codes(adm, '/zones?niveau=DISTRICT')) === '["DA","DB"]');
  verifier('centres : admin voit tous les centres', (await codes(adm, '/centres')).length === 2);
  verifier('centres : coordonnateur limité à son district', JSON.stringify(await codes(coord, '/centres')) === '["CA"]');
  verifier('centres : responsable limité à son centre', JSON.stringify(await codes(resp, '/centres')) === '["CA"]');
  verifier('centres : filtre par zone (sous-arbre)', JSON.stringify(await codes(adm, `/centres?zone=${db._id}`)) === '["CB"]');
  verifier('centres : recherche', JSON.stringify(await codes(adm, '/centres?recherche=sud')) === '["CB"]');
  rep = await fetch(`${BASE}/centres`);
  verifier('centres : sans connexion -> 401', rep.status === 401, `status=${rep.status}`);

  console.log(`\nRésultat : ${reussis} réussis, ${echoues} échoués`);
  await mongod.stop();
  process.exit(echoues > 0 ? 1 : 0);
})().catch((err) => {
  console.error('Erreur fatale du test :', err);
  process.exit(1);
});
