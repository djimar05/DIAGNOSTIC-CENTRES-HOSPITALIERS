/**
 * Test de fumée du référentiel : zones (arbre, création, déplacement), centres (CRUD, périmètre),
 * import Excel (modèle, simulation, rapport par ligne, import réel). MongoDB en mémoire.
 * Usage : node scripts/smokeTestReferentiel.js
 */
const ExcelJS = require('exceljs');
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 3104;
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

/** Classeur .xlsx en mémoire : première ligne = en-têtes. */
const classeur = async (lignes) => {
  const wb = new ExcelJS.Workbook();
  const feuille = wb.addWorksheet('Centres');
  lignes.forEach((l) => feuille.addRow(l));
  return Buffer.from(await wb.xlsx.writeBuffer());
};

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('test-smoke-referentiel');
  process.env.PORT = PORT;
  process.env.NODE_ENV = 'test';

  require('../index.js');
  await new Promise((r) => setTimeout(r, 1500));

  const { creerUtilisateur } = require('../services/utilisateurService');
  const Affectation = require('../models/Affectation');
  const Centre = require('../models/Centre');
  const Zone = require('../models/Zone');
  const Evaluation = require('../models/Evaluation');

  const compte = async (telephone, affectation) => {
    const u = await creerUtilisateur({ nom: telephone, telephone, motDePasse: 'motdepasse123' });
    await Affectation.create({ utilisateur: u._id, ...affectation });
  };
  const connecter = async (identifiant) => {
    const rep = await fetch(`${BASE}/auth/connexion`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifiant, motDePasse: 'motdepasse123' }),
    });
    return (await rep.json()).data.accessToken;
  };
  const client = (token) => (methode, chemin, body) => fetch(`${BASE}${chemin}`, {
    method: methode,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body && { body: JSON.stringify(body) }),
  });
  const corpsDe = async (rep) => (await rep.json()).data;

  await compte('+235660003000', { role: 'ADMINISTRATEUR' });
  const adm = client(await connecter('+235660003000'));

  // 1. Zones : création et règles de hiérarchie
  let rep = await adm('POST', '/zones', { code: 'NAT', nom: 'National', niveau: 'NATIONAL' });
  const nat = await corpsDe(rep);
  verifier('création zone nationale -> 201', rep.status === 201, `status=${rep.status}`);
  rep = await adm('POST', '/zones', { code: 'NAT2', nom: 'Autre', niveau: 'NATIONAL' });
  verifier('deuxième zone nationale -> 409', rep.status === 409, `status=${rep.status}`);
  const r1 = await corpsDe(await adm('POST', '/zones', { code: 'R1', nom: 'Région 1', niveau: 'REGION', parent: nat._id }));
  const r2 = await corpsDe(await adm('POST', '/zones', { code: 'R2', nom: 'Région 2', niveau: 'REGION', parent: nat._id }));
  rep = await adm('POST', '/zones', { code: 'DX', nom: 'District X', niveau: 'DISTRICT', parent: nat._id });
  verifier('district rattaché directement au national -> 400', rep.status === 400, `status=${rep.status}`);
  rep = await adm('POST', '/zones', { code: 'DX', nom: 'District X', niveau: 'DISTRICT' });
  verifier('district sans parent -> 400', rep.status === 400, `status=${rep.status}`);
  const da = await corpsDe(await adm('POST', '/zones', { code: 'DA', nom: 'District A', niveau: 'DISTRICT', parent: r1._id }));
  const db = await corpsDe(await adm('POST', '/zones', { code: 'DB', nom: 'District B', niveau: 'DISTRICT', parent: r1._id }));
  const zr = await corpsDe(await adm('POST', '/zones', { code: 'ZR1', nom: 'Aire 1', niveau: 'ZONE_RESPONSABILITE', parent: da._id }));
  verifier('ancêtres calculés à la création', zr.ancetres.length === 3 && zr.ancetres[2] === da._id);
  rep = await adm('POST', '/zones', { code: 'DA', nom: 'Doublon', niveau: 'DISTRICT', parent: r1._id });
  verifier('code de zone en double -> 409', rep.status === 409, `status=${rep.status}`);

  await compte('+235660003001', { role: 'COORDONNATEUR', zone: da._id });
  const coord = client(await connecter('+235660003001'));
  rep = await coord('POST', '/zones', { code: 'X', nom: 'X', niveau: 'DISTRICT', parent: r1._id });
  verifier('coordonnateur : créer une zone -> 403', rep.status === 403, `status=${rep.status}`);

  // 2. Centres : création, lecture, périmètre
  rep = await adm('POST', '/centres', { code: 'CA', nom: 'CS A', niveau: 'CENTRE_SANTE', zone: zr._id, gps: { coordinates: [15, 12] } });
  const ca = await corpsDe(rep);
  verifier('création centre -> 201', rep.status === 201, `status=${rep.status}`);
  verifier('zoneAncetres rempli automatiquement', ca.zoneAncetres.length === 4 && ca.zoneAncetres.includes(da._id));
  const cb = await corpsDe(await adm('POST', '/centres', { code: 'CB', nom: 'CS B', niveau: 'CENTRE_SANTE', zone: db._id }));
  rep = await adm('POST', '/centres', { code: 'CN', nom: 'CS N', niveau: 'CENTRE_SANTE', zone: nat._id });
  verifier('centre rattaché au national -> 400', rep.status === 400, `status=${rep.status}`);
  rep = await adm('POST', '/centres', { code: 'CA', nom: 'Doublon', niveau: 'CENTRE_SANTE', zone: da._id });
  verifier('code de centre en double -> 409', rep.status === 409, `status=${rep.status}`);
  rep = await adm('POST', '/centres', { code: 'CG', nom: 'GPS faux', niveau: 'CENTRE_SANTE', zone: da._id, gps: { coordinates: [200, 12] } });
  verifier('coordonnées GPS invalides -> 400', rep.status === 400, `status=${rep.status}`);

  rep = await coord('GET', `/centres/${ca._id}`);
  let corps = await corpsDe(rep);
  verifier('coordonnateur : fiche d\'un centre de son district', rep.status === 200 && corps.zoneAncetres.map((z) => z.code).join('>') === 'NAT>R1>DA>ZR1');
  rep = await coord('GET', `/centres/${cb._id}`);
  verifier('coordonnateur : centre d\'un autre district -> 404', rep.status === 404, `status=${rep.status}`);
  rep = await coord('PATCH', `/centres/${ca._id}`, { nom: 'Piraté' });
  verifier('coordonnateur : modifier un centre -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await coord('GET', `/centres/${ca._id}/evaluations`);
  verifier('onglet évaluations accessible', rep.status === 200 && Array.isArray(await corpsDe(rep)));

  rep = await adm('PATCH', `/centres/${ca._id}`, { nombreLits: 8, gps: null });
  corps = await corpsDe(rep);
  verifier('modification du centre (et effacement du GPS)', rep.status === 200 && corps.nombreLits === 8 && !corps.gps);

  // 3. Arbre avec nombre de centres
  let arbre = await corpsDe(await adm('GET', '/zones/arbre'));
  verifier('arbre : une racine nationale', arbre.length === 1 && arbre[0].code === 'NAT');
  verifier('arbre : total des centres du sous-arbre', arbre[0].nbCentresTotal === 2 && arbre[0].enfants.find((z) => z.code === 'R1').nbCentresTotal === 2);
  arbre = await corpsDe(await coord('GET', '/zones/arbre'));
  verifier('arbre du coordonnateur : son district comme racine', arbre.length === 1 && arbre[0].code === 'DA' && arbre[0].enfants[0].code === 'ZR1');

  // 4. Déplacement d'un district : ancêtres de la descendance, des centres et des évaluations recalculés
  const evalCa = await Evaluation.create({
    mission: new Zone()._id, campagne: new Zone()._id, centre: ca._id, grille: new Zone()._id, zoneAncetres: ca.zoneAncetres,
  });
  rep = await adm('PATCH', `/zones/${da._id}`, { parent: zr._id });
  verifier('déplacement sous une zone d\'un autre niveau -> 400', rep.status === 400, `status=${rep.status}`);
  rep = await adm('PATCH', `/zones/${da._id}`, { niveau: 'REGION' });
  verifier('changement de niveau -> 400', rep.status === 400, `status=${rep.status}`);
  rep = await adm('PATCH', `/zones/${da._id}`, { parent: r2._id });
  verifier('déplacement du district A vers la région 2 -> 200', rep.status === 200, `status=${rep.status}`);
  const zrApres = await Zone.findById(zr._id).lean();
  verifier('sous-zone : ancêtres recalculés', String(zrApres.ancetres[1]) === r2._id);
  const caApres = await Centre.findById(ca._id).lean();
  verifier('centre : zoneAncetres recalculé', caApres.zoneAncetres.map(String).includes(r2._id) && !caApres.zoneAncetres.map(String).includes(r1._id));
  const evalApres = await Evaluation.findById(evalCa._id).lean();
  verifier('évaluation : zoneAncetres recalculé', evalApres.zoneAncetres.map(String).includes(r2._id));

  // 5. Import Excel
  rep = await adm('GET', '/centres/import/modele');
  const modele = new ExcelJS.Workbook();
  await modele.xlsx.load(Buffer.from(await rep.arrayBuffer()));
  verifier('modèle : fichier Excel valide', rep.status === 200 && /spreadsheetml/.test(rep.headers.get('content-type')));
  verifier('modèle : feuilles Centres, Listes, Zones, Aide', ['Centres', 'Listes', 'Zones', 'Aide'].every((n) => modele.getWorksheet(n)));
  verifier('modèle : en-têtes', modele.getWorksheet('Centres').getRow(1).getCell(1).value === 'code');
  verifier('modèle : zones existantes listées', modele.getWorksheet('Zones').rowCount === 6);

  const tokenAdmin = await connecter('+235660003000');
  const envoyer = (buffer, simulation, nomFichier = 'centres.xlsx') => {
    const form = new FormData();
    form.append('fichier', new Blob([buffer]), nomFichier);
    return fetch(`${BASE}/centres/import?simulation=${simulation}`, {
      method: 'POST', headers: { Authorization: `Bearer ${tokenAdmin}` }, body: form,
    });
  };

  const fichier = await classeur([
    ['Code', 'Nom', 'Niveau', 'Statut juridique', 'Code zone', 'Localité', 'Longitude', 'Latitude', 'Population desservie', 'Nombre lits', 'Services', 'Actif'],
    ['CS-100', 'CS Nouveau', 'Centre de santé', 'Privé', 'DB', 'Village', '15,5', '12.2', '4500', '3', 'maternité; vaccination', 'oui'],
    ['CA', 'CS A renommé', 'CENTRE_SANTE', '', 'ZR1', '', '', '', '', '', '', ''],
    ['CB', 'CS B', 'CENTRE_SANTE', 'PUBLIC', 'DB', '', '', '', '', '', '', 'oui'],
    ['CS-101', 'Sans zone', 'CS', '', 'INCONNUE', '', '', '', '', '', '', ''],
    ['CS-102', 'Niveau faux', 'Clinique', '', 'DB', '', '', '', '', '', '', ''],
    ['CS-103', 'GPS faux', 'PS', '', 'DB', '', '200', '12', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', '', ''],
    ['CS-100', 'Doublon', 'CS', '', 'DB', '', '', '', '', '', '', ''],
    ['', 'Sans code', 'CS', '', 'DB', '', '', '', '', '', '', 'peut-être'],
  ]);

  const nbAvant = await Centre.countDocuments();
  rep = await envoyer(fichier, true);
  corps = await corpsDe(rep);
  verifier('simulation -> 200', rep.status === 200, `status=${rep.status}`);
  verifier('simulation : rien enregistré', await Centre.countDocuments() === nbAvant && (await Centre.findById(ca._id)).nom === 'CS A');
  // 8 lignes non vides ; CB reçoit le statut PUBLIC (vide = PUBLIC) : mis à jour
  verifier('simulation : résumé', JSON.stringify(corps.resume) === JSON.stringify({ total: 8, crees: 1, misAJour: 2, inchanges: 0, erreurs: 5 }), JSON.stringify(corps.resume));
  const ligne = (n) => corps.lignes.find((l) => l.ligne === n);
  verifier('rapport : numéros de ligne Excel (ligne vide ignorée)', ligne(9).code === 'CS-100' && !ligne(8));
  verifier('rapport : zone inconnue', /zone inconnue/.test(ligne(5).erreurs.join()));
  verifier('rapport : niveau inconnu', /niveau inconnu/.test(ligne(6).erreurs.join()));
  verifier('rapport : longitude invalide', /longitude invalide/.test(ligne(7).erreurs.join()));
  verifier('rapport : code en double dans le fichier', /ligne 2/.test(ligne(9).erreurs.join()));
  verifier('rapport : code manquant et actif invalide', /code est obligatoire/.test(ligne(10).erreurs.join()) && /actif/.test(ligne(10).erreurs.join()));

  rep = await envoyer(fichier, false);
  corps = await corpsDe(rep);
  verifier('import réel : lignes valides enregistrées', corps.resume.crees === 1 && corps.resume.misAJour === 2, JSON.stringify(corps.resume));
  const nouveau = await Centre.findOne({ code: 'CS-100' }).lean();
  verifier('import : valeurs converties (libellés, virgule décimale, services)', nouveau.niveau === 'CENTRE_SANTE'
    && nouveau.statutJuridique === 'PRIVE' && nouveau.gps.coordinates[0] === 15.5
    && nouveau.services.join() === 'MATERNITE,VACCINATION' && String(nouveau.zone) === db._id);
  verifier('import : zoneAncetres rempli', nouveau.zoneAncetres.length === 3);
  verifier('import : centre existant mis à jour', (await Centre.findById(ca._id)).nom === 'CS A renommé');
  rep = await envoyer(fichier, false);
  corps = await corpsDe(rep);
  verifier('import relancé : aucun doublon', await Centre.countDocuments({ code: 'CS-100' }) === 1 && corps.resume.crees === 0);
  verifier('import relancé : lignes déjà à jour signalées inchangées', corps.resume.inchanges === 3 && corps.resume.misAJour === 0, JSON.stringify(corps.resume));
  rep = await adm('GET', '/journal?action=CENTRES_IMPORTES');
  verifier('import tracé dans le journal (pas les simulations)', (await rep.json()).pagination.total === 2);

  rep = await envoyer(await classeur([['nom', 'niveau'], ['X', 'CS']]), true);
  corps = await rep.json();
  verifier('colonnes obligatoires absentes -> 400', rep.status === 400 && /code, code_zone/.test(corps.error.message), corps.error && corps.error.message);
  rep = await envoyer(Buffer.from('pas un excel'), true, 'faux.xlsx');
  verifier('fichier illisible -> 400', rep.status === 400, `status=${rep.status}`);
  rep = await envoyer(fichier, true, 'centres.csv');
  verifier('extension refusée -> 400', rep.status === 400, `status=${rep.status}`);
  rep = await coord('GET', '/centres/import/modele');
  verifier('coordonnateur : modèle d\'import -> 403', rep.status === 403, `status=${rep.status}`);

  console.log(`\nRésultat : ${reussis} réussis, ${echoues} échoués`);
  await mongod.stop();
  process.exit(echoues > 0 ? 1 : 0);
})().catch((err) => {
  console.error('Erreur fatale du test :', err);
  process.exit(1);
});
