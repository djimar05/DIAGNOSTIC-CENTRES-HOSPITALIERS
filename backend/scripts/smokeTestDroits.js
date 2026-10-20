/**
 * Test de fumée des droits par rôle et par périmètre (affectations, journal) avec MongoDB en mémoire.
 * Usage : node scripts/smokeTestDroits.js
 *
 * Découpage utilisé :  NAT → R1 → { DA (centre CA), DB (centre CB) }
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 3102;
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
  process.env.MONGODB_URI = mongod.getUri('test-smoke-droits');
  process.env.PORT = PORT;
  process.env.NODE_ENV = 'test';

  require('../index.js');
  await new Promise((r) => setTimeout(r, 1500));

  const { creerUtilisateur } = require('../services/utilisateurService');
  const Affectation = require('../models/Affectation');
  const Zone = require('../models/Zone');
  const Centre = require('../models/Centre');

  // Référentiel
  const nat = await Zone.create({ code: 'NAT', nom: 'National', niveau: 'NATIONAL' });
  const r1 = await Zone.create({ code: 'R1', nom: 'Région 1', niveau: 'REGION', parent: nat._id, ancetres: [nat._id] });
  const da = await Zone.create({ code: 'DA', nom: 'District A', niveau: 'DISTRICT', parent: r1._id, ancetres: [nat._id, r1._id] });
  const db = await Zone.create({ code: 'DB', nom: 'District B', niveau: 'DISTRICT', parent: r1._id, ancetres: [nat._id, r1._id] });
  const ca = await Centre.create({ code: 'CA', nom: 'CS A', niveau: 'CENTRE_SANTE', zone: da._id, zoneAncetres: [nat._id, r1._id, da._id] });
  const cb = await Centre.create({ code: 'CB', nom: 'CS B', niveau: 'CENTRE_SANTE', zone: db._id, zoneAncetres: [nat._id, r1._id, db._id] });

  // Comptes : un par profil
  const compte = async (telephone, affectation) => {
    const u = await creerUtilisateur({ nom: telephone, telephone, motDePasse: 'motdepasse123' });
    if (affectation) await Affectation.create({ utilisateur: u._id, ...affectation });
    return u;
  };
  const admin = await compte('+235660001000', { role: 'ADMINISTRATEUR' });
  await compte('+235660001001', { role: 'COORDONNATEUR', zone: da._id });
  await compte('+235660001002', { role: 'EVALUATEUR', zone: da._id });
  await compte('+235660001003'); // aucune affectation
  const hier = new Date(Date.now() - 24 * 3600 * 1000);
  await compte('+235660001004', { role: 'COORDONNATEUR', zone: da._id, dateDebut: new Date(hier - 24 * 3600 * 1000), dateFin: hier });
  const cible = await compte('+235660001005'); // à qui on donne des rôles

  const connecter = async (identifiant) => {
    const rep = await fetch(`${BASE}/auth/connexion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiant, motDePasse: 'motdepasse123' }),
    });
    return (await rep.json()).data.accessToken;
  };
  const client = (token) => (methode, chemin, body) => fetch(`${BASE}${chemin}`, {
    method: methode,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body && { body: JSON.stringify(body) }),
  });
  const adm = client(await connecter('+235660001000'));
  const coord = client(await connecter('+235660001001'));
  const evalu = client(await connecter('+235660001002'));
  const sansRole = client(await connecter('+235660001003'));
  const expire = client(await connecter('+235660001004'));
  const nouvelUtilisateur = { nom: 'Nouveau', telephone: '+235660001099', motDePasse: 'motdepasse123' };

  // 1. Gestion des comptes : réservée à l'administrateur
  let rep = await evalu('GET', '/utilisateurs');
  verifier('évaluateur : liste des utilisateurs -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await sansRole('GET', '/utilisateurs');
  verifier('sans affectation : liste -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await expire('GET', '/utilisateurs');
  verifier('affectation expirée : liste -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await coord('GET', '/utilisateurs');
  verifier('coordonnateur : liste -> 200', rep.status === 200, `status=${rep.status}`);
  rep = await coord('POST', '/utilisateurs', nouvelUtilisateur);
  verifier('coordonnateur : création de compte -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await coord('PATCH', `/utilisateurs/${cible._id}/mot-de-passe`, { nouveauMotDePasse: 'piratage123' });
  verifier('coordonnateur : changer le mot de passe d\'un autre -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await evalu('DELETE', `/utilisateurs/${cible._id}`);
  verifier('évaluateur : suppression -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await adm('POST', '/utilisateurs', nouvelUtilisateur);
  verifier('administrateur : création de compte -> 201', rep.status === 201, `status=${rep.status}`);
  rep = await adm('GET', '/utilisateurs?recherche=(((a+)+)+$');
  verifier('recherche avec caractères spéciaux -> 200', rep.status === 200, `status=${rep.status}`);

  // 2. L'administrateur ne peut pas se bloquer lui-même
  rep = await adm('PATCH', `/utilisateurs/${admin._id}`, { actif: false });
  verifier('admin : se désactiver -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await adm('DELETE', `/utilisateurs/${admin._id}`);
  verifier('admin : se supprimer -> 403', rep.status === 403, `status=${rep.status}`);
  const affAdmin = await Affectation.findOne({ utilisateur: admin._id });
  rep = await adm('DELETE', `/affectations/${affAdmin._id}`);
  verifier('admin : retirer son propre rôle admin -> 403', rep.status === 403, `status=${rep.status}`);

  // 3. /auth/moi renvoie rôles et affectations
  rep = await coord('GET', '/auth/moi');
  let corps = await rep.json();
  verifier('moi : rôles du coordonnateur', JSON.stringify(corps.data.roles) === '["COORDONNATEUR"]', JSON.stringify(corps.data.roles));
  verifier('moi : zone de l\'affectation détaillée', corps.data.affectations[0].zone.code === 'DA');
  rep = await expire('GET', '/auth/moi');
  corps = await rep.json();
  verifier('moi : affectation expirée absente', corps.data.roles.length === 0);

  // 4. Le coordonnateur affecte dans son périmètre seulement
  const affecter = (api, body) => api('POST', `/utilisateurs/${cible._id}/affectations`, body);
  rep = await affecter(coord, { role: 'EVALUATEUR', zone: da._id });
  corps = await rep.json();
  verifier('coordonnateur : évaluateur dans son district -> 201', rep.status === 201, `status=${rep.status}`);
  const affEvalDA = corps.data;
  rep = await affecter(coord, { role: 'EVALUATEUR', zone: da._id });
  verifier('affectation en double -> 409', rep.status === 409, `status=${rep.status}`);
  rep = await affecter(coord, { role: 'EVALUATEUR', zone: db._id });
  verifier('coordonnateur : district voisin -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await affecter(coord, { role: 'EVALUATEUR', zone: r1._id });
  verifier('coordonnateur : zone parente -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await affecter(coord, { role: 'EVALUATEUR' });
  verifier('coordonnateur : périmètre national -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await affecter(coord, { role: 'ADMINISTRATEUR', zone: da._id });
  verifier('coordonnateur : donner le rôle ADMINISTRATEUR -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await affecter(coord, { role: 'COORDONNATEUR', zone: da._id });
  verifier('coordonnateur : donner le rôle COORDONNATEUR -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await affecter(coord, { role: 'RESPONSABLE_CENTRE', centre: ca._id });
  corps = await rep.json();
  verifier('coordonnateur : responsable d\'un centre de son district -> 201', rep.status === 201, `status=${rep.status}`);
  verifier('zone déduite du centre', corps.data && String(corps.data.zone) === String(da._id));
  rep = await affecter(coord, { role: 'RESPONSABLE_CENTRE', centre: cb._id });
  verifier('coordonnateur : centre d\'un autre district -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await affecter(adm, { role: 'RESPONSABLE_CENTRE' });
  verifier('RESPONSABLE_CENTRE sans centre -> 400', rep.status === 400, `status=${rep.status}`);
  rep = await affecter(adm, { role: 'ROLE_INCONNU' });
  verifier('rôle inconnu -> 400', rep.status === 400, `status=${rep.status}`);
  rep = await affecter(adm, { role: 'SUPERVISEUR', zone: db._id });
  corps = await rep.json();
  verifier('admin : superviseur district B -> 201', rep.status === 201, `status=${rep.status}`);
  const affSupDB = corps.data;
  rep = await affecter(evalu, { role: 'EVALUATEUR', zone: da._id });
  verifier('évaluateur : créer une affectation -> 403', rep.status === 403, `status=${rep.status}`);

  // 5. Lecture filtrée par périmètre
  rep = await coord('GET', `/utilisateurs/${cible._id}/affectations`);
  corps = await rep.json();
  verifier('coordonnateur : ne voit que les affectations de son district', rep.status === 200 && corps.data.length === 2, `n=${corps.data && corps.data.length}`);
  rep = await adm('GET', `/utilisateurs/${cible._id}/affectations`);
  corps = await rep.json();
  verifier('admin : voit toutes les affectations', corps.data.length === 3, `n=${corps.data.length}`);

  // 6. Modification et retrait
  rep = await coord('PATCH', `/affectations/${affSupDB._id}`, { dateFin: '2030-01-01' });
  verifier('coordonnateur : modifier une affectation hors périmètre -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await coord('PATCH', `/affectations/${affEvalDA._id}`, { zone: db._id });
  verifier('coordonnateur : déplacer une affectation hors périmètre -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await coord('PATCH', `/affectations/${affEvalDA._id}`, { dateFin: '2030-01-01' });
  verifier('coordonnateur : modifier dans son périmètre -> 200', rep.status === 200, `status=${rep.status}`);
  rep = await coord('DELETE', `/affectations/${affSupDB._id}`);
  verifier('coordonnateur : retirer hors périmètre -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await coord('DELETE', `/affectations/${affEvalDA._id}`);
  corps = await rep.json();
  verifier('coordonnateur : retirer dans son périmètre -> 200 (désactivée)', rep.status === 200 && corps.data.actif === false);
  rep = await affecter(coord, { role: 'EVALUATEUR', zone: da._id });
  verifier('réaffecter après retrait -> 201', rep.status === 201, `status=${rep.status}`);

  // 7. Journal d'activité
  rep = await coord('GET', '/journal');
  verifier('coordonnateur : journal -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await adm('GET', '/journal?action=AFFECTATION_CREEE');
  corps = await rep.json();
  verifier('journal : créations d\'affectation tracées', rep.status === 200 && corps.pagination.total === 4, `total=${corps.pagination && corps.pagination.total}`);
  verifier('journal : auteur renseigné', corps.data[0].utilisateur && corps.data[0].utilisateur.telephone === '+235660001001');
  rep = await adm('GET', '/journal?action=AFFECTATION_RETIREE');
  verifier('journal : retrait tracé', (await rep.json()).pagination.total === 1);
  rep = await adm('GET', '/journal?action=CONNEXION');
  verifier('journal : connexions tracées', (await rep.json()).pagination.total === 5);

  console.log(`\nRésultat : ${reussis} réussis, ${echoues} échoués`);
  await mongod.stop();
  process.exit(echoues > 0 ? 1 : 0);
})().catch((err) => {
  console.error('Erreur fatale du test :', err);
  process.exit(1);
});
