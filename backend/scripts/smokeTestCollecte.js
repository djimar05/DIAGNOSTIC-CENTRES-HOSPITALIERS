/**
 * Test de fumée de la collecte en ligne : téléchargement des missions, démarrage avec GPS, réponses,
 * photos (stockage local), vérification, soumission, correction. MongoDB en mémoire + seed.
 * Usage : node scripts/smokeTestCollecte.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 3107;
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

// Contenus minimaux reconnus par leur signature (le serveur vérifie les premiers octets)
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60, 1)]);
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(60, 32)]);

(async () => {
  const dossierStockage = fs.mkdtempSync(path.join(os.tmpdir(), 'stockage-test-'));
  const mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } }); // machine chargée : démarrage lent toléré
  process.env.MONGODB_URI = mongod.getUri('test-smoke-collecte');
  process.env.PORT = PORT;
  process.env.NODE_ENV = 'test';
  // Par défaut : stockage local dans un dossier temporaire.
  // Avec STOCKAGE=s3 (ex. node --env-file=.env …) : MinIO, dans un bucket de test créé puis supprimé.
  const modeS3 = process.env.STOCKAGE === 's3';
  if (modeS3) {
    process.env.MINIO_BUCKET = `diagnostic-test-${Date.now()}`; // jamais le bucket réel
  } else {
    process.env.STOCKAGE = 'local';
    process.env.STOCKAGE_DOSSIER = dossierStockage;
  }
  console.log(`  Stockage testé : ${modeS3 ? `MinIO / S3 (bucket ${process.env.MINIO_BUCKET})` : 'disque local'}`);
  const configStockage = require('../config/stockage');
  const clientS3 = modeS3 ? (() => {
    const Minio = require('minio');
    const { bucket, region, ...connexion } = configStockage.s3;
    return new Minio.Client(connexion);
  })() : null;
  /** Le fichier est-il présent dans le stockage (dossier local ou bucket MinIO) ? */
  const presentDansStockage = async (cle) => {
    if (!modeS3) return fs.existsSync(path.join(dossierStockage, cle));
    try { await clientS3.statObject(configStockage.s3.bucket, cle); return true; } catch { return false; }
  };

  require('../index.js');
  await new Promise((r) => setTimeout(r, 1500));
  if (modeS3) {
    verifier('MinIO : bucket créé au démarrage du serveur (avant tout envoi)', await clientS3.bucketExists(configStockage.s3.bucket));
  }

  const { seed, MOT_DE_PASSE_DEMO } = require('./seed');
  await seed();
  const { creerUtilisateur } = require('../services/utilisateurService');
  const Affectation = require('../models/Affectation');
  const Centre = require('../models/Centre');
  const Evaluation = require('../models/Evaluation');
  const Grille = require('../models/Grille');
  const Mission = require('../models/Mission');
  const Utilisateur = require('../models/Utilisateur');
  const Zone = require('../models/Zone');

  const da = await Zone.findOne({ code: 'DS-01-01' }).lean();
  const eval2 = await creerUtilisateur({ nom: 'Autre', telephone: '+235660006001', motDePasse: MOT_DE_PASSE_DEMO });
  await Affectation.create({ utilisateur: eval2._id, role: 'EVALUATEUR', zone: da._id });

  const connecter = async (identifiant) => {
    const rep = await fetch(`${BASE}/auth/connexion`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifiant, motDePasse: MOT_DE_PASSE_DEMO }),
    });
    const token = (await rep.json()).data.accessToken;
    const appel = (methode, chemin, body, entetes = {}) => fetch(`${BASE}${chemin}`, {
      method: methode,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...entetes },
      ...(body && { body: JSON.stringify(body) }),
    });
    appel.token = token;
    appel.envoyer = (champs, contenu, nom = 'photo.jpg') => {
      const form = new FormData();
      Object.entries(champs).forEach(([k, v]) => form.append(k, v));
      form.append('fichier', new Blob([contenu]), nom);
      return fetch(`${BASE}/fichiers`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    };
    return appel;
  };
  const coord = await connecter('+235660000102');
  const ali = await connecter('+235660000103');
  const sup = await connecter('+235660000104');
  const autre = await connecter('+235660006001');
  const partenaire = await connecter('+235660000106');
  const data = async (rep) => (await rep.json()).data;
  const idAli = String((await Utilisateur.findOne({ telephone: '+235660000103' }))._id);
  const idSup = String((await Utilisateur.findOne({ telephone: '+235660000104' }))._id);

  // Campagne démarrée : 2 centres, Ali évaluateur, Fatimé superviseure
  const grille = await Grille.findOne({ code: 'GRILLE-DEMO' }).lean();
  const camp = await data(await coord('POST', '/campagnes', { nom: 'Collecte', grille: grille._id, zone: da._id }));
  const centres = await Centre.find({ code: { $in: ['CS-0142', 'CS-0143'] } }).lean();
  await coord('POST', `/campagnes/${camp._id}/missions`, { centres: centres.map((c) => c._id), evaluateurs: [idAli], superviseur: idSup, datePrevue: '2026-12-08' });
  await coord('POST', `/campagnes/${camp._id}/demarrer`);

  // 1. Téléchargement
  let rep = await ali('GET', '/mobile/mes-missions');
  let r = await data(rep);
  verifier('mes missions : 2 missions et la grille une seule fois', rep.status === 200 && r.missions.length === 2 && r.grilles.length === 1 && r.grilles[0].domaines.length === 10);
  verifier('mes missions : centre, équipe et évaluation planifiée', r.missions[0].centre.zone.nom && r.missions[0].superviseur.nom && r.missions[0].evaluation.statut === 'PLANIFIEE');
  const [m1, m2] = r.missions;
  const e1 = m1.evaluation._id;
  const e2 = m2.evaluation._id;
  rep = await coord('GET', '/mobile/mes-missions');
  verifier('coordonnateur : route mobile -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await ali('GET', `/mobile/grilles/${grille._id}`);
  const etag = rep.headers.get('etag');
  // Requête HTTP brute : fetch ajoute « Cache-Control: no-cache » aux requêtes conditionnelles, ce qui empêche le 304
  const statut304 = await new Promise((ok, ko) => {
    require('http').get(`${BASE}/mobile/grilles/${grille._id}`, {
      headers: { Authorization: rep.headers.get('authorization') || `Bearer ${ali.token}`, 'If-None-Match': etag },
    }, (res) => { res.resume(); ok(res.statusCode); }).on('error', ko);
  });
  verifier('grille déjà en cache (ETag) -> 304', Boolean(etag) && statut304 === 304, `statut=${statut304}`);

  // 2. Démarrage
  rep = await ali('PATCH', `/evaluations/${e1}/reponses`, { reponses: [{ critereCode: 'INF-02', valeur: 'Oui' }] });
  verifier('saisie avant démarrage -> 409', rep.status === 409, `status=${rep.status}`);
  rep = await ali('POST', `/evaluations/${e1}/demarrer`, { gps: { coordinates: [200, 12] } });
  verifier('démarrage avec GPS invalide -> 400', rep.status === 400, `status=${rep.status}`);
  rep = await autre('POST', `/evaluations/${e1}/demarrer`, {});
  verifier('évaluateur hors de l\'équipe -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await sup('POST', `/evaluations/${e1}/demarrer`, {});
  verifier('superviseur : démarrer -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await ali('POST', `/evaluations/${e1}/demarrer`, { gps: { coordinates: [15.05, 12.13], precisionMetres: 8 } });
  r = await data(rep);
  verifier('démarrage -> EN_COURS avec GPS et heure de début', rep.status === 200 && r.statut === 'EN_COURS' && r.gpsVisite.coordinates[0] === 15.05 && r.debut);
  verifier('démarrage : mission en cours', (await Mission.findById(m1._id)).statut === 'EN_COURS');

  // 3. Réponses invalides : tout ou rien
  rep = await ali('PATCH', `/evaluations/${e1}/reponses`, { reponses: [
    { critereCode: 'INF-02', valeur: 'Oui' }, { critereCode: 'EAU-01', valeur: 'peut-être' }, { critereCode: 'XXX-99', valeur: 1 },
    { critereCode: 'INF-02', sansObjet: true },
  ] });
  r = await rep.json();
  verifier('réponses invalides -> 400, détail par critère', rep.status === 400 && r.error.details.length === 3, JSON.stringify(r.error));
  verifier('réponses invalides : rien enregistré', (await Evaluation.findById(e1)).reponses.length === 0);

  // 4. Photos
  rep = await ali.envoyer({ evaluation: e1, critereCode: 'EAU-01', clientId: '11111111-1111-4111-8111-111111111111', longitude: 15.05, latitude: 12.13 }, JPEG);
  r = await data(rep);
  verifier('photo reçue -> 201 (type vérifié, GPS)', rep.status === 201 && r.mime === 'image/jpeg' && r.type === 'PHOTO' && r.gps.coordinates[1] === 12.13);
  const photoEau = r._id;
  rep = await ali.envoyer({ evaluation: e1, critereCode: 'EAU-01', clientId: '11111111-1111-4111-8111-111111111111' }, JPEG);
  verifier('renvoi après coupure (même clientId) -> 200, pas de doublon', rep.status === 200 && (await data(rep))._id === photoEau);
  rep = await ali.envoyer({ evaluation: e1, critereCode: 'EAU-01' }, Buffer.from('ceci n\'est pas une image, juste du texte'), 'faux.jpg');
  verifier('faux fichier (extension .jpg) -> 400', rep.status === 400, `status=${rep.status}`);
  rep = await ali.envoyer({ evaluation: e1, critereCode: 'ZZZ' }, JPEG);
  verifier('critère inconnu -> 400', rep.status === 400, `status=${rep.status}`);
  const photoInf = (await data(await ali.envoyer({ evaluation: e1, critereCode: 'INF-01' }, JPEG)))._id;
  const docEqu = (await data(await ali.envoyer({ evaluation: e1, critereCode: 'EQU-02' }, PDF, 'contrat.pdf')))._id;
  rep = await sup('GET', `/fichiers/${photoEau}/contenu`);
  const octets = Buffer.from(await rep.arrayBuffer());
  verifier('superviseur : voir la photo', rep.status === 200 && rep.headers.get('content-type').startsWith('image/jpeg') && octets.equals(JPEG));
  rep = await partenaire('GET', `/fichiers/${photoEau}/contenu`);
  verifier('partenaire : photo -> 403', rep.status === 403, `status=${rep.status}`);

  // 5. Saisie complète (sauf la photo exigée de HYG-02)
  const reponses = [
    { critereCode: 'INF-01', valeur: 2, fichiers: [photoInf] }, { critereCode: 'INF-02', valeur: 'Oui' }, { critereCode: 'INF-03', sansObjet: true },
    { critereCode: 'EAU-01', valeur: 'Non', observation: 'Forage en panne', fichiers: [photoEau] }, { critereCode: 'EAU-02', valeur: 'SOLAIRE' },
    { critereCode: 'EAU-03', valeur: 2 }, { critereCode: 'EQU-01', valeur: 3 }, { critereCode: 'EQU-02', valeur: 'Oui', fichiers: [docEqu] },
    { critereCode: 'RH-04', valeur: 82 }, { critereCode: 'RH-05', valeur: 'Oui' }, { critereCode: 'MED-01', valeur: 90 }, { critereCode: 'MED-02', valeur: 'Oui' },
    { critereCode: 'SRV-01', valeur: ['CONSULTATION', 'VACCINATION'] }, { critereCode: 'SRV-03', valeur: 'Non' }, { critereCode: 'HYG-01', valeur: 2 },
    { critereCode: 'HYG-02', valeur: 'Oui' }, { critereCode: 'GES-01', valeur: 'Oui' }, { critereCode: 'GES-02', valeur: 3 },
    { critereCode: 'SIS-01', valeur: 2 }, { critereCode: 'SIS-02', valeur: 85 }, { critereCode: 'QUA-01', valeur: 'MOINS_30' }, { critereCode: 'QUA-02', valeur: 'Oui' },
  ];
  rep = await ali('PATCH', `/evaluations/${e1}/reponses`, { reponses, observationsGenerales: 'Accueil correct', personnesRencontrees: [{ nom: 'Idriss Moussa', fonction: 'Major' }] });
  r = await data(rep);
  verifier('22 réponses enregistrées', rep.status === 200 && r.reponses.length === 22, JSON.stringify(r).slice(0, 200));
  const rh = r.reponses.find((x) => x.critereCode === 'RH-04');
  const eau = r.reponses.find((x) => x.critereCode === 'EAU-01');
  verifier('copie du libellé et points calculés (RH-04 = 82 % → 2 pts)', rh.libelle.startsWith('Pourcentage') && rh.points === 2 && rh.pointsMax === 3);
  verifier('éliminatoire non satisfait repéré (EAU-01 = Non)', eau.eliminatoireNonSatisfait === true && eau.observation === 'Forage en panne');
  rep = await ali('PATCH', `/evaluations/${e1}/reponses`, { reponses: [{ critereCode: 'QUA-03', valeur: 'Manque de personnel' }] });
  verifier('mise à jour partielle : les autres réponses sont conservées', (await data(rep)).reponses.length === 23);
  rep = await ali('PATCH', `/evaluations/${e1}/reponses`, { reponses: [{ critereCode: 'QUA-03', valeur: '' }] });
  verifier('réponse vidée : retirée', (await data(rep)).reponses.length === 22);

  r = await data(await ali('GET', `/evaluations/${e1}/verification`));
  verifier('vérification : seule la photo de HYG-02 manque', !r.complet && r.manquants.length === 0 && r.preuvesManquantes.length === 1 && r.preuvesManquantes[0].critereCode === 'HYG-02', JSON.stringify(r));
  verifier('vérification : SRV-04 non demandé (maternité absente)', r.progression.find((p) => p.domaineCode === 'SRV').total === 2);
  rep = await ali('POST', `/evaluations/${e1}/soumettre`);
  r = await rep.json();
  verifier('soumission incomplète -> 400 avec ce qui manque', rep.status === 400 && /HYG-02/.test(r.error.details.join()), JSON.stringify(r.error));

  const photoHyg = (await data(await ali.envoyer({ evaluation: e1, critereCode: 'HYG-02' }, JPEG)))._id;
  await ali('PATCH', `/evaluations/${e1}/reponses`, { reponses: [{ critereCode: 'HYG-02', valeur: 'Oui', fichiers: [photoHyg] }] });
  r = await data(await ali('GET', `/evaluations/${e1}/verification`));
  verifier('vérification : complète', r.complet === true, JSON.stringify(r));
  rep = await ali('POST', `/evaluations/${e1}/soumettre`);
  r = await data(rep);
  verifier('soumission -> SOUMISE, date et historique', rep.status === 200 && r.statut === 'SOUMISE' && r.soumisLe
    && r.historiqueStatuts.map((h) => h.statut).join() === 'EN_COURS,SOUMISE');
  rep = await ali('PATCH', `/evaluations/${e1}/reponses`, { reponses: [{ critereCode: 'INF-02', valeur: 'Non' }] });
  verifier('après soumission : saisie refusée -> 409', rep.status === 409, `status=${rep.status}`);
  r = await data(await sup('GET', `/evaluations/${e1}`));
  verifier('superviseur : évaluation avec réponses, fichiers et personnes rencontrées', r.reponses.length === 22 && r.fichiers.length === 4 && r.personnesRencontrees[0].nom === 'Idriss Moussa');

  // 6. Renvoyée pour correction (étape suivante) : l'évaluateur peut corriger et resoumettre
  await Evaluation.updateOne({ _id: e1 }, { statut: 'A_CORRIGER' });
  rep = await ali('PATCH', `/evaluations/${e1}/reponses`, { reponses: [{ critereCode: 'INF-02', valeur: 'Non' }] });
  verifier('à corriger : saisie de nouveau possible', rep.status === 200, `status=${rep.status}`);
  rep = await ali('POST', `/evaluations/${e1}/soumettre`);
  verifier('resoumission -> SOUMISE', rep.status === 200 && (await data(rep)).statut === 'SOUMISE');

  // 7. Suppression d'une photo pendant la saisie
  await ali('POST', `/evaluations/${e2}/demarrer`, {});
  const photo2 = await data(await ali.envoyer({ evaluation: e2, critereCode: 'INF-01' }, JPEG));
  await ali('PATCH', `/evaluations/${e2}/reponses`, { reponses: [{ critereCode: 'INF-01', valeur: 1, fichiers: [photo2._id] }] });
  const Fichier = require('../models/Fichier');
  const cle = (await Fichier.findById(photo2._id)).cleStockage;
  verifier(`photo écrite dans le stockage (${modeS3 ? 'MinIO' : 'disque'})`, await presentDansStockage(cle));
  rep = await ali('DELETE', `/fichiers/${photo2._id}`);
  const apres = await Evaluation.findById(e2);
  verifier('suppression : retirée de la réponse et du stockage', rep.status === 204 && apres.reponses[0].fichiers.length === 0 && !(await presentDansStockage(cle)));
  if (modeS3) {
    const fichiers = await Fichier.find().lean();
    const tous = (await Promise.all(fichiers.map((f) => presentDansStockage(f.cleStockage)))).every(Boolean);
    verifier(`MinIO : ${fichiers.length} objets présents dans le bucket`, tous);
    const objet = await clientS3.statObject(configStockage.s3.bucket, fichiers.find((f) => f.mime === 'application/pdf').cleStockage);
    verifier('MinIO : type MIME enregistré avec l\'objet (PDF)', objet.metaData['content-type'] === 'application/pdf', JSON.stringify(objet.metaData));
  }
  rep = await ali('DELETE', `/fichiers/${photoEau}`);
  verifier('supprimer une preuve d\'une évaluation soumise -> 409', rep.status === 409, `status=${rep.status}`);

  const adm = await connecter('+235660000100');
  rep = await adm('GET', '/journal?action=EVALUATION_SOUMISE');
  verifier('soumissions tracées dans le journal', (await rep.json()).pagination.total === 2);
  r = await data(await ali('GET', '/mobile/mes-missions'));
  verifier('mes missions : statuts à jour', r.missions.find((m) => m.evaluation._id === e1).evaluation.statut === 'SOUMISE'
    && r.missions.find((m) => m.evaluation._id === e2).evaluation.statut === 'EN_COURS');

  console.log(`\nRésultat : ${reussis} réussis, ${echoues} échoués`);
  if (modeS3) {
    // Nettoyage : objets puis bucket de test
    const { bucket } = configStockage.s3;
    const cles = await new Promise((ok, ko) => {
      const liste = [];
      clientS3.listObjectsV2(bucket, '', true).on('data', (o) => liste.push(o.name)).on('end', () => ok(liste)).on('error', ko);
    });
    if (cles.length) await clientS3.removeObjects(bucket, cles);
    await clientS3.removeBucket(bucket);
    console.log(`  Bucket de test ${bucket} supprimé (${cles.length} objet(s))`);
  }
  await mongod.stop();
  fs.rmSync(dossierStockage, { recursive: true, force: true });
  process.exit(echoues > 0 ? 1 : 0);
})().catch((err) => {
  console.error('Erreur fatale du test :', err);
  process.exit(1);
});
