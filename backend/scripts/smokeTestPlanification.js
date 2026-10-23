/**
 * Test de fumée de la planification : campagnes (périmètre, cycle de vie), missions en masse,
 * équipes, avancement, calendrier, campagne régionale vue d'un district. MongoDB en mémoire + seed.
 * Usage : node scripts/smokeTestPlanification.js
 *
 * Seed : REG-01 → DS-01-01 (HR-0001, HD-0001, CS-0142, CS-0143) et DS-01-02 (CS-0201, PS-0055) ;
 *        REG-02 → DS-02-01 (HD-0007, CS-0310)… ; grille GRILLE-DEMO (centres et postes de santé).
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 3106;
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
  process.env.MONGODB_URI = mongod.getUri('test-smoke-planification');
  process.env.PORT = PORT;
  process.env.NODE_ENV = 'test';

  require('../index.js');
  await new Promise((r) => setTimeout(r, 1500));

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

  const zone = async (code) => Zone.findOne({ code }).lean();
  const centre = async (code) => Centre.findOne({ code }).lean();
  const id = async (telephone) => String((await Utilisateur.findOne({ telephone }))._id);
  const [ds0101, ds0201, reg01] = await Promise.all([zone('DS-01-01'), zone('DS-02-01'), zone('REG-01')]);
  const grille = await Grille.findOne({ code: 'GRILLE-DEMO' }).lean();

  // Comptes supplémentaires : un évaluateur d'un autre district, un centre de plus dans le district A
  const eval2 = await creerUtilisateur({ nom: 'Eval', prenom: 'Sud', telephone: '+235660005001', motDePasse: MOT_DE_PASSE_DEMO });
  await Affectation.create({ utilisateur: eval2._id, role: 'EVALUATEUR', zone: ds0201._id });
  const cs999 = await Centre.create({ code: 'CS-0999', nom: 'CS Test', niveau: 'CENTRE_SANTE', zone: ds0101._id, zoneAncetres: [...ds0101.ancetres, ds0101._id] });

  const connecter = async (identifiant) => {
    const rep = await fetch(`${BASE}/auth/connexion`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifiant, motDePasse: MOT_DE_PASSE_DEMO }),
    });
    const token = (await rep.json()).data.accessToken;
    return (methode, chemin, body) => fetch(`${BASE}${chemin}`, {
      method: methode,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(body && { body: JSON.stringify(body) }),
    });
  };
  const adm = await connecter('+235660000100');
  const coord = await connecter('+235660000102'); // coordonnateur DS-01-01
  const evalA = await connecter('+235660000103'); // évaluateur DS-01-01
  const partenaire = await connecter('+235660000106');
  const evalSud = await connecter('+235660005001');
  const idEval = await id('+235660000103');
  const idSup = await id('+235660000104');
  const idCoord = await id('+235660000102');
  const data = async (rep) => (await rep.json()).data;

  // 1. Création de campagne et périmètre
  let rep = await coord('POST', '/campagnes', { nom: 'Pilote District A', grille: grille._id, zone: ds0101._id });
  const camp = await data(rep);
  verifier('coordonnateur : campagne sur son district -> 201', rep.status === 201 && camp.statut === 'PREPARATION', `status=${rep.status}`);
  rep = await coord('POST', '/campagnes', { nom: 'Région', grille: grille._id, zone: reg01._id });
  verifier('coordonnateur : campagne sur la région au-dessus -> 403', rep.status === 403, `status=${rep.status}`);
  rep = await coord('POST', '/campagnes', { nom: 'Nationale', grille: grille._id });
  verifier('coordonnateur de district : campagne nationale -> 403', rep.status === 403, `status=${rep.status}`);
  const brouillon = await Grille.create({ code: 'GRILLE-BROUILLON', nom: 'B', version: 1 });
  rep = await coord('POST', '/campagnes', { nom: 'X', grille: brouillon._id, zone: ds0101._id });
  verifier('grille non publiée -> 400', rep.status === 400, `status=${rep.status}`);
  rep = await partenaire('GET', '/campagnes');
  verifier('partenaire : campagnes -> 403', rep.status === 403, `status=${rep.status}`);

  // 2. Ajout de centres en masse
  const [cs142, cs143, hd001, cs310] = await Promise.all(['CS-0142', 'CS-0143', 'HD-0001', 'CS-0310'].map(centre));
  rep = await coord('POST', `/campagnes/${camp._id}/missions`, {
    centres: [cs142._id, cs143._id, hd001._id, cs310._id], evaluateurs: [idEval], superviseur: idSup, datePrevue: '2026-12-08',
  });
  let r = await data(rep);
  verifier('ajout de centres : 2 missions créées', rep.status === 201 && r.creees === 2, JSON.stringify(r));
  verifier('refus : niveau non visé par la grille (hôpital de district)', r.refus.some((x) => x.code === 'HD-0001' && /niveau/.test(x.motif)));
  verifier('refus : centre hors de la zone de la campagne', r.refus.some((x) => x.code === 'CS-0310' && /zone de la campagne/.test(x.motif)));
  const evaluations = await Evaluation.find({ campagne: camp._id }).lean();
  verifier('une évaluation PLANIFIEE par mission, avec la version de la grille', evaluations.length === 2
    && evaluations.every((e) => e.statut === 'PLANIFIEE' && e.grilleVersion === 1 && e.zoneAncetres.length === 3));
  const missionsEquipees = await Mission.find({ campagne: camp._id }).lean();
  verifier('équipe et date appliquées aux missions', missionsEquipees.every((m) => String(m.evaluateurs[0]) === idEval && String(m.superviseur) === idSup && m.datePrevue));
  rep = await coord('POST', `/campagnes/${camp._id}/missions`, { centres: [cs142._id] });
  verifier('centre déjà dans la campagne : signalé, pas de doublon', (await data(rep)).existants.length === 1);
  rep = await coord('POST', `/campagnes/${camp._id}/missions`, { centres: [cs999._id], evaluateurs: [String(eval2._id)] });
  r = await data(rep);
  verifier('équipe hors zone : mission créée sans équipe, avec avertissement', r.creees === 1 && /n'est pas évaluateur/.test(r.avertissements.join()), JSON.stringify(r));

  r = await data(await evalA('GET', '/missions'));
  verifier('campagne en préparation : missions pas encore visibles par l\'évaluateur', r.length === 0, `n=${r.length}`);
  r = await data(await evalA('GET', '/campagnes'));
  verifier('campagne en préparation : pas encore visible par l\'évaluateur', r.length === 0, `n=${r.length}`);

  // 3. Démarrage et équipes
  rep = await coord('POST', `/campagnes/${camp._id}/demarrer`);
  verifier('démarrer avec une mission sans évaluateur -> 400', rep.status === 400 && /sans évaluateur/.test((await rep.json()).error.message));
  const m999 = await Mission.findOne({ centre: cs999._id }).lean();
  rep = await coord('PATCH', `/missions/${m999._id}`, { evaluateurs: [String(eval2._id)] });
  verifier('évaluateur hors zone -> 400', rep.status === 400, `status=${rep.status}`);
  rep = await coord('PATCH', `/missions/${m999._id}`, { evaluateurs: [idEval], superviseur: idEval });
  verifier('superviseur = évaluateur -> 400', rep.status === 400, `status=${rep.status}`);
  rep = await coord('PATCH', `/missions/${m999._id}`, { evaluateurs: [idEval], superviseur: idCoord });
  verifier('équipe valide (coordonnateur comme superviseur) -> 200', rep.status === 200 && (await data(rep)).superviseur.nom === 'Ngarlem');

  const toutes = (await Mission.find({ campagne: camp._id }).lean()).map((m) => String(m._id));
  const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  rep = await coord('POST', `/campagnes/${camp._id}/equipe`, { missions: toutes, datePrevue: hier });
  verifier('date affectée en masse à 3 missions', (await data(rep)).modifiees === 3);
  rep = await coord('GET', `/campagnes/${camp._id}/intervenants`);
  r = await data(rep);
  verifier('intervenants : évaluateurs de la zone, pas ceux d\'ailleurs', r.evaluateurs.some((u) => u._id === idEval) && !r.evaluateurs.some((u) => u._id === String(eval2._id)));
  verifier('intervenants : superviseurs et coordonnateurs', r.superviseurs.some((u) => u._id === idSup) && r.superviseurs.some((u) => u._id === idCoord));
  r = await data(await coord('GET', `/campagnes/intervenants?zone=${ds0101._id}`));
  verifier('intervenants par zone (assistant de création)', r.evaluateurs.some((u) => u._id === idEval) && !r.evaluateurs.some((u) => u._id === String(eval2._id)));

  rep = await coord('POST', `/campagnes/${camp._id}/demarrer`);
  verifier('démarrage -> EN_COURS', rep.status === 200 && (await data(rep)).statut === 'EN_COURS');
  rep = await coord('PATCH', `/campagnes/${camp._id}`, { grille: grille._id, zone: reg01._id });
  verifier('campagne en cours : zone non modifiable -> 409', rep.status === 409, `status=${rep.status}`);

  // 4. Avancement, calendrier, vues des évaluateurs
  r = await data(await coord('GET', `/campagnes/${camp._id}/avancement`));
  verifier('avancement : 3 missions planifiées, toutes en retard, aucune sans équipe',
    r.total === 3 && r.parStatut.PLANIFIEE === 3 && r.enRetard === 3 && r.sansEquipe === 0, JSON.stringify(r));
  verifier('avancement : détail par zone', r.parZone.length === 1 && r.parZone[0].zone.code === 'DS-01-01' && r.parZone[0].total === 3);
  r = await data(await coord('GET', `/missions?campagne=${camp._id}&enRetard=true`));
  verifier('missions en retard', r.length === 3 && r[0].evaluation.statut === 'PLANIFIEE' && r[0].centre.zone.nom);
  r = await data(await coord('GET', `/missions?du=${hier}&au=${hier}T23:59:59`));
  verifier('calendrier : missions du jour', r.length === 3);
  r = await data(await evalA('GET', '/missions'));
  verifier('évaluateur : ses missions', r.length === 3);
  r = await data(await evalA('GET', '/campagnes'));
  verifier('évaluateur : les campagnes de ses missions', r.length === 1 && r[0].avancement.total === 3);
  r = await data(await evalSud('GET', '/campagnes'));
  verifier('évaluateur d\'un autre district : aucune campagne', r.length === 0);
  rep = await evalA('PATCH', `/missions/${m999._id}`, { datePrevue: '2026-12-01' });
  verifier('évaluateur : modifier une mission -> 403', rep.status === 403, `status=${rep.status}`);

  // 5. Campagne régionale vue par le coordonnateur d'un district
  const regionale = await data(await adm('POST', '/campagnes', { nom: 'Région du Nord', grille: grille._id, zone: reg01._id }));
  const cs201 = await centre('CS-0201');
  r = await data(await adm('POST', `/campagnes/${regionale._id}/missions`, { centres: [cs143._id, cs201._id] }));
  verifier('campagne régionale : 2 centres de 2 districts', r.creees === 2);
  r = await data(await coord('GET', '/campagnes'));
  verifier('coordonnateur : voit la campagne régionale qui touche son district', r.some((c) => c._id === regionale._id && c.avancement.total === 1));
  r = await data(await coord('GET', `/campagnes/${regionale._id}/avancement`));
  verifier('coordonnateur : avancement limité à son district', r.total === 1);
  rep = await coord('PATCH', `/campagnes/${regionale._id}`, { nom: 'Renommée' });
  verifier('coordonnateur : modifier la campagne régionale -> 403', rep.status === 403, `status=${rep.status}`);
  const missionsReg = (await Mission.find({ campagne: regionale._id }).lean()).map((m) => String(m._id));
  r = await data(await coord('POST', `/campagnes/${regionale._id}/equipe`, { missions: missionsReg, evaluateurs: [idEval] }));
  verifier('coordonnateur : équipe sur son centre seulement', r.modifiees === 1 && r.refus.length === 1, JSON.stringify(r));

  // 6. Annuler, réactiver, retirer une mission
  const [mA, mB] = missionsReg;
  const mDuDistrict = (await Mission.findOne({ campagne: regionale._id, centre: cs143._id }).lean())._id;
  rep = await adm('PATCH', `/missions/${mA}`, { statut: 'ANNULEE' });
  verifier('mission annulée -> évaluation annulée', rep.status === 200 && (await Evaluation.findOne({ mission: mA })).statut === 'ANNULEE');
  rep = await adm('PATCH', `/missions/${mA}`, { statut: 'A_FAIRE' });
  verifier('mission réactivée -> évaluation replanifiée', rep.status === 200 && (await Evaluation.findOne({ mission: mA })).statut === 'PLANIFIEE');
  await Evaluation.updateOne({ mission: mDuDistrict }, { statut: 'SOUMISE' });
  rep = await adm('DELETE', `/missions/${mDuDistrict}`);
  verifier('retirer une mission dont l\'évaluation est soumise -> 409', rep.status === 409, `status=${rep.status}`);
  const autre = String(mDuDistrict) === mA ? mB : mA;
  rep = await adm('DELETE', `/missions/${autre}`);
  verifier('retirer une mission planifiée -> 204, évaluation supprimée', rep.status === 204 && !(await Evaluation.exists({ mission: autre })));

  // 7. Clôture
  await Evaluation.updateOne({ mission: toutes[0] }, { statut: 'VALIDEE' });
  rep = await coord('POST', `/campagnes/${camp._id}/cloturer`);
  verifier('clôture avec évaluations en cours -> 409 avec explication', rep.status === 409 && (await rep.json()).error.details.length === 1);
  rep = await coord('POST', `/campagnes/${camp._id}/cloturer`, { forcer: true });
  let corps = await rep.json();
  verifier('clôture forcée : 2 évaluations annulées, la validée conservée', rep.status === 200 && corps.evaluationsAnnulees === 2
    && (await Evaluation.findOne({ mission: toutes[0] })).statut === 'VALIDEE');
  rep = await coord('POST', `/campagnes/${camp._id}/missions`, { centres: [cs142._id] });
  verifier('campagne clôturée : ajout de centres -> 409', rep.status === 409, `status=${rep.status}`);
  rep = await coord('PATCH', `/missions/${toutes[1]}`, { datePrevue: '2027-01-01' });
  verifier('campagne clôturée : mission non modifiable -> 409', rep.status === 409, `status=${rep.status}`);
  corps = await (await adm('GET', '/journal?action=CAMPAGNE_CREEE')).json();
  verifier('créations de campagnes tracées', corps.pagination.total === 2);

  console.log(`\nRésultat : ${reussis} réussis, ${echoues} échoués`);
  await mongod.stop();
  process.exit(echoues > 0 ? 1 : 0);
})().catch((err) => {
  console.error('Erreur fatale du test :', err);
  process.exit(1);
});
