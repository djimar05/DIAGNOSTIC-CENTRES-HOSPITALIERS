/**
 * Test de fumée des grilles : cycle de vie (brouillon → publiée → archivée, versions), droits,
 * contrôles de publication, aperçu du score, export / import JSON et Excel. MongoDB en mémoire.
 * Usage : node scripts/smokeTestGrilles.js
 */
const ExcelJS = require('exceljs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const GRILLE_DEMO = require('../donnees/grille-demo.json');

const PORT = 3105;
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
  const mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  process.env.MONGODB_URI = mongod.getUri('test-smoke-grilles');
  process.env.PORT = PORT;
  process.env.NODE_ENV = 'test';

  require('../index.js');
  await new Promise((r) => setTimeout(r, 1500));

  const { creerUtilisateur } = require('../services/utilisateurService');
  const Affectation = require('../models/Affectation');
  const Grille = require('../models/Grille');

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
  await compte('+235660004000', { role: 'ADMINISTRATEUR' });
  await compte('+235660004001', { role: 'COORDONNATEUR' });
  const tokenAdmin = await connecter('+235660004000');
  const client = (token) => (methode, chemin, body) => fetch(`${BASE}${chemin}`, {
    method: methode,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body && { body: JSON.stringify(body) }),
  });
  const adm = client(tokenAdmin);
  const coord = client(await connecter('+235660004001'));
  const json = async (rep) => rep.json();
  const envoyer = (buffer, nom, simulation) => {
    const form = new FormData();
    form.append('fichier', new Blob([buffer]), nom);
    return fetch(`${BASE}/grilles/import?simulation=${simulation}`, { method: 'POST', headers: { Authorization: `Bearer ${tokenAdmin}` }, body: form });
  };
  const { code: _c, classes: _cl, ...contenuDemo } = GRILLE_DEMO;

  // 1. Création d'un brouillon
  let rep = await adm('POST', '/grilles', { ...contenuDemo, code: 'grille-cs' });
  let corps = await json(rep);
  const v1 = corps.data;
  verifier('création -> 201, brouillon version 1, code en majuscules', rep.status === 201 && v1.statut === 'BROUILLON' && v1.version === 1 && v1.code === 'GRILLE-CS');
  rep = await adm('POST', '/grilles', { code: 'GRILLE-CS', nom: 'Doublon' });
  verifier('code existant -> 409 (utiliser une nouvelle version)', rep.status === 409, `status=${rep.status}`);
  rep = await coord('POST', '/grilles', { code: 'X', nom: 'X' });
  verifier('coordonnateur : créer une grille -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await coord('GET', '/grilles');
  corps = await json(rep);
  verifier('coordonnateur : lire les grilles -> 200, avec résumé', rep.status === 200 && corps.data[0].nbDomaines === 10 && corps.data[0].nbCriteres === 24, JSON.stringify(corps.data[0]?.nbCriteres));

  // 2. Contrôles de publication
  const sansQua = { domaines: v1.domaines.filter((d) => d.code !== 'QUA') };
  rep = await adm('PUT', `/grilles/${v1._id}`, { ...sansQua, nom: 'Grille CS' });
  verifier('modification du brouillon -> 200', rep.status === 200 && (await json(rep)).data.nom === 'Grille CS');
  rep = await adm('GET', `/grilles/${v1._id}/verification`);
  corps = await json(rep);
  verifier('vérification : somme des poids signalée', corps.data.erreurs.some((e) => /100 %/.test(e)), JSON.stringify(corps.data));
  rep = await adm('POST', `/grilles/${v1._id}/publier`);
  corps = await json(rep);
  verifier('publication refusée (poids = 93 %) -> 400 avec détails', rep.status === 400 && corps.error.details.some((e) => /93/.test(e)), JSON.stringify(corps.error));
  rep = await adm('PUT', `/grilles/${v1._id}`, { domaines: [...sansQua.domaines, { code: 'EAU', nom: 'Doublon', poids: 7, criteres: [] }] });
  verifier('code de domaine en double -> 400', rep.status === 400, `status=${rep.status}`);
  rep = await adm('PUT', `/grilles/${v1._id}`, { domaines: v1.domaines });
  rep = await adm('POST', `/grilles/${v1._id}/publier`);
  corps = await json(rep);
  verifier('publication -> 200, date renseignée', rep.status === 200 && corps.data.statut === 'PUBLIEE' && corps.data.publieeLe);
  verifier('publication : avertissement (domaine sans score impossible ici)', Array.isArray(corps.avertissements));
  rep = await adm('PUT', `/grilles/${v1._id}`, { nom: 'Modif interdite' });
  verifier('grille publiée : modification refusée -> 409', rep.status === 409, `status=${rep.status}`);
  verifier('grille publiée : contenu intact en base', (await Grille.findById(v1._id)).nom === 'Grille CS');

  // 3. Versions
  rep = await adm('POST', `/grilles/${v1._id}/nouvelle-version`);
  corps = await json(rep);
  const v2 = corps.data;
  verifier('nouvelle version -> brouillon version 2', rep.status === 201 && v2.version === 2 && v2.statut === 'BROUILLON' && !v2.publieeLe);
  verifier('nouvelle version : nouveaux identifiants des domaines', v2._id !== v1._id && v2.domaines[0]._id !== v1.domaines[0]._id);
  rep = await adm('POST', `/grilles/${v1._id}/nouvelle-version`);
  verifier('un seul brouillon à la fois -> 409', rep.status === 409, `status=${rep.status}`);
  await adm('PUT', `/grilles/${v2._id}`, { nom: 'Grille CS – v2' });
  rep = await adm('POST', `/grilles/${v2._id}/publier`);
  verifier('publication v2 -> 200', rep.status === 200, `status=${rep.status}`);
  verifier('publication v2 : v1 archivée automatiquement', (await Grille.findById(v1._id)).statut === 'ARCHIVEE');
  rep = await adm('GET', '/grilles?statut=PUBLIEE&niveau=CENTRE_SANTE');
  corps = await json(rep);
  verifier('filtre statut + niveau : une seule version publiée', corps.data.length === 1 && corps.data[0].version === 2);

  const v3 = (await json(await adm('POST', `/grilles/${v2._id}/nouvelle-version`))).data;
  rep = await adm('POST', `/grilles/${v3._id}/archiver`);
  verifier('archiver un brouillon -> 409', rep.status === 409, `status=${rep.status}`);
  rep = await adm('DELETE', `/grilles/${v2._id}`);
  verifier('supprimer une grille publiée -> 409', rep.status === 409, `status=${rep.status}`);
  rep = await adm('DELETE', `/grilles/${v3._id}`);
  verifier('supprimer un brouillon -> 204', rep.status === 204 && !(await Grille.exists({ _id: v3._id })));

  // 4. Aperçu du score
  const reponses = [
    { critereCode: 'EAU-01', valeur: 'Non' }, { critereCode: 'EAU-02', valeur: 'RESEAU' }, { critereCode: 'EAU-03', valeur: 3 },
    { critereCode: 'RH-04', valeur: 82 }, { critereCode: 'SRV-03', valeur: 'Non' },
  ];
  rep = await coord('POST', `/grilles/${v2._id}/simuler-score`, { reponses });
  corps = await json(rep);
  const eau = corps.data.scores.domaines.find((d) => d.domaineCode === 'EAU');
  // EAU : (0 × 1 + 1 × 2 + 1 × 1) / 4 = 75 → plafonné à 40 (EAU-01 éliminatoire = Non)
  verifier('aperçu : domaine EAU plafonné (brut 75 → 40)', eau.scoreBrut === 75 && eau.score === 40 && eau.plafonne, JSON.stringify(eau));
  verifier('aperçu : RH-04 = 82 % → 66,7', corps.data.scores.domaines.find((d) => d.domaineCode === 'RH').score === 66.7);
  verifier('aperçu : SRV-04 sans objet (maternité absente)', corps.data.criteres.find((c) => c.critereCode === 'SRV-04').applicable === false);
  verifier('aperçu : évaluation incomplète signalée', corps.data.complet === false && corps.data.manquants.includes('INF-01'));
  // Global : EAU 40 × 10 + RH 66,67 × 12 + SRV (3/5 → ...) — on vérifie seulement la cohérence avec la classe
  verifier('aperçu : score global et classe', typeof corps.data.scores.global === 'number' && ['A', 'B', 'C', 'D'].includes(corps.data.scores.classe));

  // 5. Export / import JSON (aller-retour)
  rep = await adm('GET', `/grilles/${v2._id}/export?format=json`);
  const exportJson = await rep.text();
  verifier('export JSON : fichier joint', /grille-GRILLE-CS-v2\.json/.test(rep.headers.get('content-disposition')));
  const objetJson = JSON.parse(exportJson);
  verifier('export JSON : pas d\'identifiants techniques', !exportJson.includes('"_id"') && objetJson.domaines.length === 10);
  rep = await envoyer(Buffer.from(exportJson), 'grille.json', true);
  corps = await json(rep);
  verifier('import JSON (simulation) : 10 domaines, 24 critères, 100 %, sans erreur',
    corps.data.resume.domaines === 10 && corps.data.resume.criteres === 24 && corps.data.resume.totalPoids === 100 && !corps.data.erreurs.length, JSON.stringify(corps.data));
  verifier('import JSON (simulation) : version suivante proposée, rien enregistré', corps.data.grille.version === 3 && !corps.data.enregistree
    && await Grille.countDocuments({ code: 'GRILLE-CS' }) === 2);

  // 6. Export / import Excel (aller-retour sans perte)
  rep = await adm('GET', `/grilles/${v2._id}/export?format=xlsx`);
  const exportXlsx = Buffer.from(await rep.arrayBuffer());
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.load(exportXlsx);
  verifier('export Excel : feuilles Grille, Domaines, Criteres', ['Grille', 'Domaines', 'Criteres'].every((n) => classeur.getWorksheet(n)));
  rep = await envoyer(exportXlsx, 'grille.xlsx', false);
  corps = await json(rep);
  verifier('import Excel : brouillon version 3 créé', corps.data.enregistree && corps.data.grille.version === 3, JSON.stringify(corps.data.erreurs));
  const reimportee = JSON.parse(await (await adm('GET', `/grilles/${corps.data.grille._id}/export?format=json`)).text());
  const sansVersion = (g) => JSON.stringify({ ...g, version: 0 });
  verifier('aller-retour Excel : contenu identique (options, barèmes, conditions…)', sansVersion(reimportee) === sansVersion(objetJson),
    'différence entre la grille exportée et réimportée');

  // 7. Fichiers invalides
  rep = await envoyer(Buffer.from('{ pas du json'), 'g.json', true);
  verifier('JSON illisible -> 400', rep.status === 400, `status=${rep.status}`);
  const vide = new ExcelJS.Workbook();
  vide.addWorksheet('Autre');
  rep = await envoyer(Buffer.from(await vide.xlsx.writeBuffer()), 'g.xlsx', true);
  corps = await json(rep);
  verifier('Excel sans les feuilles attendues -> 400', rep.status === 400 && /Grille, Domaines, Criteres/.test(corps.error.message), corps.error?.message);
  const fautive = { ...objetJson, code: 'GRILLE-FAUSSE' };
  fautive.domaines[0].criteres[0].typeReponse = 'INCONNU';
  rep = await envoyer(Buffer.from(JSON.stringify(fautive)), 'g.json', false);
  corps = await json(rep);
  verifier('type de réponse inconnu : erreur signalée, rien enregistré', corps.data.erreurs.length > 0 && !corps.data.enregistree
    && !(await Grille.exists({ code: 'GRILLE-FAUSSE' })));
  rep = await envoyer(Buffer.from('x'), 'g.csv', true);
  verifier('extension refusée -> 400', rep.status === 400, `status=${rep.status}`);

  // 8. Journal
  rep = await adm('GET', '/journal?action=GRILLE_PUBLIEE');
  verifier('publications tracées dans le journal', (await json(rep)).pagination.total === 2);

  console.log(`\nRésultat : ${reussis} réussis, ${echoues} échoués`);
  await mongod.stop();
  process.exit(echoues > 0 ? 1 : 0);
})().catch((err) => {
  console.error('Erreur fatale du test :', err);
  process.exit(1);
});
