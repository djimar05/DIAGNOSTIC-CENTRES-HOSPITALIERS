/**
 * Test des règles portées par les modèles Mongoose (validations, grille figée…) avec MongoDB en mémoire.
 * Usage : node scripts/testModeles.js
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let reussis = 0;
let echoues = 0;

/** Exécute fn ; si doitEchouer, le test réussit quand fn lève une erreur. */
const verifier = async (nom, fn, doitEchouer = false) => {
  try {
    await fn();
    if (doitEchouer) { echoues++; console.log(`  ECHEC ${nom} (aurait dû être refusé)`); } else { reussis++; console.log(`  OK   ${nom}`); }
  } catch (err) {
    if (doitEchouer) { reussis++; console.log(`  OK   ${nom}`); } else { echoues++; console.log(`  ECHEC ${nom} ${err.message}`); }
  }
};

(async () => {
  const mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  await mongoose.connect(mongod.getUri('test-modeles'));

  const M = {};
  const noms = ['Zone', 'Centre', 'Affectation', 'Grille', 'Campagne', 'Mission', 'Evaluation',
    'Utilisateur', 'RefreshToken', 'Fichier', 'Commentaire', 'ActionCorrective', 'JournalActivite'];
  for (const nom of noms) M[nom] = require(`../models/${nom}`);
  await Promise.all(Object.values(M).map((m) => m.init()));

  // Zones et centres
  const nat = await M.Zone.create({ code: 'NAT', nom: 'N', niveau: 'NATIONAL' });
  const dA = await M.Zone.create({ code: 'DA', nom: 'A', niveau: 'DISTRICT', parent: nat._id, ancetres: [nat._id] });
  const dB = await M.Zone.create({ code: 'DB', nom: 'B', niveau: 'DISTRICT', parent: nat._id, ancetres: [nat._id] });
  const c = await M.Centre.create({
    code: 'C1', nom: 'C', niveau: 'CENTRE_SANTE', zone: dA._id, zoneAncetres: [nat._id, dA._id], gps: { coordinates: [15, 12] },
  });
  await verifier('centre sans gps accepté', () => M.Centre.create({ code: 'C2', nom: 'C', niveau: 'AUTRE', zone: dA._id }));
  await verifier('gps incomplet refusé', () => M.Centre.create({
    code: 'C3', nom: 'C', niveau: 'AUTRE', zone: dA._id, gps: { coordinates: [15] },
  }), true);

  // Affectations
  const u = new mongoose.Types.ObjectId();
  await verifier('RESPONSABLE_CENTRE sans centre refusé', () => M.Affectation.create({ utilisateur: u, role: 'RESPONSABLE_CENTRE', zone: dA._id }), true);
  await verifier('centre hors zone refusé', () => M.Affectation.create({ utilisateur: u, role: 'RESPONSABLE_CENTRE', zone: dB._id, centre: c._id }), true);
  await verifier('centre dans une zone parente accepté', () => M.Affectation.create({ utilisateur: u, role: 'RESPONSABLE_CENTRE', zone: nat._id, centre: c._id }));
  const a = await M.Affectation.create({ utilisateur: u, role: 'RESPONSABLE_CENTRE', centre: c._id });
  await verifier('zone déduite du centre', async () => { if (!a.zone.equals(dA._id)) throw new Error('zone non déduite'); });

  // Grilles
  const crit = (code, condition) => ({ code, libelle: 'x', typeReponse: 'OUI_NON', condition });
  const dom = (code, poids, criteres) => ({ code, nom: code, poids, criteres });
  await verifier('code de critère en double refusé', () => M.Grille.create({
    code: 'G', nom: 'G', version: 9, domaines: [dom('A', 50, [crit('X')]), dom('B', 50, [crit('X')])],
  }), true);
  await verifier('condition sur un critère inconnu refusée', () => M.Grille.create({
    code: 'G', nom: 'G', version: 9, domaines: [dom('A', 100, [crit('X', { critere: 'Z', valeur: 'Oui' })])],
  }), true);
  await verifier('publication avec poids ≠ 100 refusée', () => M.Grille.create({
    code: 'G', nom: 'G', version: 9, statut: 'PUBLIEE', domaines: [dom('A', 60, [crit('X')])],
  }), true);
  await verifier('brouillon avec poids ≠ 100 accepté', () => M.Grille.create({
    code: 'G', nom: 'G', version: 8, domaines: [dom('A', 60, [crit('X')])],
  }));
  const g = await M.Grille.create({
    code: 'G', nom: 'G', version: 1, statut: 'PUBLIEE',
    domaines: [dom('A', 60, [crit('X')]), dom('B', 40, [crit('Y', { critere: 'X', valeur: 'Oui' })])],
  });
  await verifier('grille publiée : save refusé', async () => { const d = await M.Grille.findById(g._id); d.nom = 'autre'; await d.save(); }, true);
  await verifier('grille publiée : modification d\'un critère refusée', async () => {
    const d = await M.Grille.findById(g._id); d.domaines[0].criteres[0].libelle = 'y'; await d.save();
  }, true);
  await verifier('grille publiée : updateOne refusé', () => M.Grille.updateOne({ _id: g._id }, { $set: { nom: 'x' } }), true);
  await verifier('grille publiée : retour en BROUILLON refusé', () => M.Grille.updateOne({ _id: g._id }, { statut: 'BROUILLON' }), true);
  await verifier('grille publiée : archivage accepté', async () => { const d = await M.Grille.findById(g._id); d.statut = 'ARCHIVEE'; await d.save(); });
  await verifier('brouillon modifiable', () => M.Grille.updateOne({ code: 'G', version: 8 }, { nom: 'ok' }));

  // Campagnes, missions, évaluations
  await verifier('campagne avec dates inversées refusée', () => M.Campagne.create({
    nom: 'c', grille: g._id, dateDebut: new Date('2027-01-01'), dateFin: new Date('2026-01-01'),
  }), true);
  const camp = await M.Campagne.create({ nom: 'c', grille: g._id });
  const mi = await M.Mission.create({ campagne: camp._id, centre: c._id, evaluateurs: [u] });
  const evaluation = { mission: mi._id, campagne: camp._id, centre: c._id, grille: g._id };
  await verifier('statut inconnu dans l\'historique refusé', () => M.Evaluation.create({ ...evaluation, historiqueStatuts: [{ statut: 'FOO' }] }), true);
  await verifier('évaluation valide acceptée', () => M.Evaluation.create({
    ...evaluation, historiqueStatuts: [{ statut: 'SOUMISE' }], reponses: [{ critereCode: 'X', valeur: 'Oui' }],
  }));

  console.log(`\nRésultat : ${reussis} réussis, ${echoues} échoués`);
  await mongoose.disconnect();
  await mongod.stop();
  process.exit(echoues > 0 ? 1 : 0);
})().catch((err) => {
  console.error('Erreur fatale du test :', err);
  process.exit(1);
});
