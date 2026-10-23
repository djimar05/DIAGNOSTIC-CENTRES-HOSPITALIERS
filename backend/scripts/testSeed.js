/**
 * Test du seed de démonstration avec MongoDB en mémoire : volumes, idempotence, périmètres.
 * Usage : node scripts/testSeed.js
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { seed, COMPTES_DEMO } = require('./seed');
const Zone = require('../models/Zone');
const Centre = require('../models/Centre');
const Utilisateur = require('../models/Utilisateur');
const Affectation = require('../models/Affectation');

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
  await mongoose.connect(mongod.getUri('test-seed'));
  await Promise.all([Zone, Centre, Utilisateur, Affectation].map((m) => m.init()));

  const resume = await seed({ avecCampagne: true });
  await seed({ avecCampagne: true }); // deuxième passage : ne doit rien dupliquer

  const [nbZones, nbCentres, nbUtilisateurs, nbAffectations] = await Promise.all([
    Zone.countDocuments(), Centre.countDocuments(), Utilisateur.countDocuments(), Affectation.countDocuments(),
  ]);
  verifier('zones créées sans doublon', nbZones === resume.zones, `n=${nbZones}`);
  verifier('centres créés sans doublon', nbCentres === resume.centres, `n=${nbCentres}`);
  verifier('un compte par profil sans doublon', nbUtilisateurs === COMPTES_DEMO.length, `n=${nbUtilisateurs}`);
  verifier('une affectation par compte sans doublon', nbAffectations === COMPTES_DEMO.length, `n=${nbAffectations}`);

  const Grille = require('../models/Grille');
  const grilles = await Grille.find().lean();
  verifier('grille de démonstration publiée, sans doublon', grilles.length === 1 && grilles[0].statut === 'PUBLIEE');
  verifier('grille : 10 domaines dont les poids font 100', grilles[0].domaines.length === 10
    && grilles[0].domaines.reduce((s, d) => s + d.poids, 0) === 100);

  const roles = await Affectation.distinct('role');
  verifier('les 7 rôles sont représentés', roles.length === 7, roles.join(','));

  const district = await Zone.findOne({ code: 'DS-01-01' });
  verifier('ancêtres du district renseignés', district.ancetres.length === 2);
  const centre = await Centre.findOne({ code: 'CS-0142' });
  verifier('zoneAncetres du centre = ancêtres + district', centre.zoneAncetres.length === 3
    && centre.zoneAncetres[2].equals(district._id));

  const respCentre = await Affectation.findOne({ role: 'RESPONSABLE_CENTRE' });
  verifier('responsable de centre rattaché à son centre et à sa zone',
    respCentre.centre.equals(centre._id) && respCentre.zone.equals(district._id));
  const admin = await Affectation.findOne({ role: 'ADMINISTRATEUR' });
  verifier('administrateur national', !admin.zone && !admin.centre);

  // Campagne de démonstration : visible sur le téléphone de l'évaluateur
  const Campagne = require('../models/Campagne');
  const Evaluation = require('../models/Evaluation');
  const { mesMissions } = require('../services/collecteService');
  const campagnes = await Campagne.find().lean();
  verifier('une campagne démarrée, sans doublon', campagnes.length === 1 && campagnes[0].statut === 'EN_COURS'
    && campagnes[0].grille.equals(grilles[0]._id));
  const evaluations = await Evaluation.find().lean();
  verifier('une évaluation planifiée par mission, sans doublon', resume.missions === 2 && evaluations.length === 2
    && evaluations.every((e) => e.statut === 'PLANIFIEE'));
  const ali = await Utilisateur.findOne({ telephone: '+235660000103' });
  const { missions: missionsAli } = await mesMissions({ utilisateur: ali });
  verifier("l'évaluateur voit ses 2 missions", missionsAli.length === 2, `n=${missionsAli.length}`);
  verifier('superviseure renseignée sur les missions', missionsAli.every((m) => m.superviseur?.telephone === '+235660000104'));

  process.env.NODE_ENV = 'production';
  let refuse = false;
  try { await seed(); } catch { refuse = true; }
  verifier('seed refusé en production', refuse);

  console.log(`\nRésultat : ${reussis} réussis, ${echoues} échoués`);
  await mongoose.disconnect();
  await mongod.stop();
  process.exit(echoues > 0 ? 1 : 0);
})().catch((err) => {
  console.error('Erreur fatale du test :', err);
  process.exit(1);
});
