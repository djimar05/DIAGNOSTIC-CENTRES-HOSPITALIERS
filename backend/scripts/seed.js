/**
 * Données de démonstration : découpage sanitaire, quelques centres, un compte par profil,
 * une grille publiée (donnees/grille-demo.json, 10 domaines aux poids du cahier des charges)
 * et, avec npm run seed, une campagne déjà démarrée : Ali (évaluateur) a des missions sur son téléphone.
 * Idempotent : relancer le script met à jour les données sans créer de doublons.
 * Refusé en production.
 *
 * Usage : npm run seed
 *
 * Tous les comptes ont le mot de passe MOT_DE_PASSE_DEMO (voir COMPTES_DEMO ci-dessous).
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Zone = require('../models/Zone');
const Centre = require('../models/Centre');
const Utilisateur = require('../models/Utilisateur');
const Affectation = require('../models/Affectation');
const Grille = require('../models/Grille');
const Campagne = require('../models/Campagne');
const Mission = require('../models/Mission');
const Evaluation = require('../models/Evaluation');
const GRILLE_DEMO = require('../donnees/grille-demo.json');

// Campagne de démonstration (démarrée) : centres du District A visés par la grille
const CAMPAGNE_DEMO = {
  nom: 'Démonstration – District A',
  zone: 'DS-01-01',
  coordonnateur: '+235660000102',
  evaluateur: '+235660000103',
  superviseur: '+235660000104',
  missions: [{ centre: 'CS-0142', dansJours: 0 }, { centre: 'CS-0143', dansJours: 1 }],
};

const MOT_DE_PASSE_DEMO = 'Demo2026!';

// Découpage : National → 2 régions → 2 districts chacune
const ZONES = [
  { code: 'NAT', nom: 'National', niveau: 'NATIONAL' },
  { code: 'REG-01', nom: 'Région du Nord', niveau: 'REGION', parent: 'NAT' },
  { code: 'REG-02', nom: 'Région du Sud', niveau: 'REGION', parent: 'NAT' },
  { code: 'DS-01-01', nom: 'District A', niveau: 'DISTRICT', parent: 'REG-01' },
  { code: 'DS-01-02', nom: 'District B', niveau: 'DISTRICT', parent: 'REG-01' },
  { code: 'DS-02-01', nom: 'District C', niveau: 'DISTRICT', parent: 'REG-02' },
  { code: 'DS-02-02', nom: 'District D', niveau: 'DISTRICT', parent: 'REG-02' },
];

const CENTRES = [
  { code: 'HR-0001', nom: 'Hôpital régional du Nord', niveau: 'HOPITAL_REGIONAL', zone: 'DS-01-01', gps: [15.05, 12.11], nombreLits: 150, populationDesservie: 450000 },
  { code: 'HD-0001', nom: 'HD Centre-Ville', niveau: 'HOPITAL_DISTRICT', zone: 'DS-01-01', gps: [15.04, 12.13], nombreLits: 80, populationDesservie: 120000 },
  { code: 'CS-0142', nom: 'CS Quartier Nord', niveau: 'CENTRE_SANTE', zone: 'DS-01-01', gps: [15.05, 12.13], nombreLits: 6, populationDesservie: 18500 },
  { code: 'CS-0143', nom: 'CS Marché', niveau: 'CENTRE_SANTE', zone: 'DS-01-01', gps: [15.06, 12.12], nombreLits: 4, populationDesservie: 14200, statutJuridique: 'CONFESSIONNEL' },
  { code: 'CS-0201', nom: 'CS Village Est', niveau: 'CENTRE_SANTE', zone: 'DS-01-02', gps: [15.30, 12.40], nombreLits: 4, populationDesservie: 9800 },
  { code: 'PS-0055', nom: 'Poste de santé Ouaddi', niveau: 'POSTE_SANTE', zone: 'DS-01-02', gps: [15.42, 12.51], populationDesservie: 3200, statutJuridique: 'COMMUNAUTAIRE' },
  { code: 'HD-0007', nom: 'HD du Sud', niveau: 'HOPITAL_DISTRICT', zone: 'DS-02-01', gps: [16.10, 9.20], nombreLits: 60, populationDesservie: 98000 },
  { code: 'CS-0310', nom: 'CS Bord du fleuve', niveau: 'CENTRE_SANTE', zone: 'DS-02-01', gps: [16.15, 9.25], nombreLits: 5, populationDesservie: 11000, statutJuridique: 'PRIVE' },
  { code: 'CS-0402', nom: 'CS Plateau', niveau: 'CENTRE_SANTE', zone: 'DS-02-02', gps: [16.40, 9.05], nombreLits: 3, populationDesservie: 7600, statutJuridique: 'ONG' },
];

// Un compte par profil du cahier des charges. zone / centre = périmètre de l'affectation (absent = national).
const COMPTES_DEMO = [
  { telephone: '+235660000100', nom: 'Admin', prenom: 'Système', fonction: 'Administrateur système', role: 'ADMINISTRATEUR' },
  { telephone: '+235660000101', nom: 'Abakar', prenom: 'Hassan', fonction: 'Directeur national', role: 'RESPONSABLE_NATIONAL' },
  { telephone: '+235660000102', nom: 'Ngarlem', prenom: 'Esther', fonction: 'Médecin-chef de district', role: 'COORDONNATEUR', zone: 'DS-01-01', email: 'e.ngarlem@exemple.td' },
  { telephone: '+235660000103', nom: 'Mahamat', prenom: 'Ali', fonction: "Infirmier diplômé d'État", role: 'EVALUATEUR', zone: 'DS-01-01' },
  { telephone: '+235660000104', nom: 'Djimadoum', prenom: 'Fatimé', fonction: 'Superviseure qualité', role: 'SUPERVISEUR', zone: 'DS-01-01' },
  { telephone: '+235660000105', nom: 'Moussa', prenom: 'Idriss', fonction: 'Major du centre', role: 'RESPONSABLE_CENTRE', centre: 'CS-0142' },
  { telephone: '+235660000106', nom: 'Partenaire', prenom: 'Bailleur', fonction: 'Chargé de programme', role: 'PARTENAIRE' },
];

/**
 * Crée ou met à jour les données de démonstration. Renvoie un résumé des volumes.
 * avecCampagne : ajoute la campagne démarrée (npm run seed) ; les tests la laissent de côté pour créer les leurs.
 */
const seed = async ({ avecCampagne = false } = {}) => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Le seed de démonstration est interdit en production');
  }

  // Zones, dans l'ordre (un parent est toujours traité avant ses enfants)
  const zones = {};
  for (const { parent, ...z } of ZONES) {
    const zoneParent = parent ? zones[parent] : null;
    zones[z.code] = await Zone.findOneAndUpdate(
      { code: z.code },
      { ...z, parent: zoneParent ? zoneParent._id : null, ancetres: zoneParent ? [...zoneParent.ancetres, zoneParent._id] : [] },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );
  }

  const centres = {};
  for (const { zone, gps, ...c } of CENTRES) {
    const z = zones[zone];
    centres[c.code] = await Centre.findOneAndUpdate(
      { code: c.code },
      {
        statutJuridique: 'PUBLIC',
        ...c,
        zone: z._id,
        zoneAncetres: [...z.ancetres, z._id],
        gps: { type: 'Point', coordinates: gps },
      },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );
  }

  const motDePasseHash = await bcrypt.hash(MOT_DE_PASSE_DEMO, 10);
  for (const { role, zone, centre, ...compte } of COMPTES_DEMO) {
    const utilisateur = await Utilisateur.findOneAndUpdate(
      { telephone: compte.telephone },
      { ...compte, motDePasseHash, actif: true },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );
    const perimetre = {
      zone: zone ? zones[zone]._id : (centre ? centres[centre].zone : null),
      centre: centre ? centres[centre]._id : null,
    };
    const existe = await Affectation.exists({ utilisateur: utilisateur._id, role, ...perimetre, actif: true });
    if (!existe) await Affectation.create({ utilisateur: utilisateur._id, role, ...perimetre });
  }

  // Grille publiée (créée une seule fois : une grille publiée est figée)
  if (!await Grille.exists({ code: GRILLE_DEMO.code })) {
    await Grille.create({ ...GRILLE_DEMO, version: 1, statut: 'PUBLIEE', publieeLe: new Date() });
  }

  const missions = avecCampagne ? await creerCampagneDemo(zones, centres) : 0;
  return { zones: ZONES.length, centres: CENTRES.length, comptes: COMPTES_DEMO.length, grilles: 1, missions };
};

/**
 * Campagne démarrée avec une mission (et son évaluation planifiée) par centre.
 * Créée une seule fois : si elle existe déjà, elle n'est pas modifiée (l'évaluateur a pu commencer la saisie).
 */
const creerCampagneDemo = async (zones, centres) => {
  const existante = await Campagne.findOne({ nom: CAMPAGNE_DEMO.nom });
  if (existante) return Mission.countDocuments({ campagne: existante._id });
  const grille = await Grille.findOne({ code: GRILLE_DEMO.code, statut: 'PUBLIEE' });
  const id = async (telephone) => (await Utilisateur.findOne({ telephone }))._id;
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  const campagne = await Campagne.create({
    nom: CAMPAGNE_DEMO.nom, grille: grille._id, zone: zones[CAMPAGNE_DEMO.zone]._id, statut: 'EN_COURS',
    dateDebut: debut, creePar: await id(CAMPAGNE_DEMO.coordonnateur),
  });
  const [evaluateur, superviseur] = [await id(CAMPAGNE_DEMO.evaluateur), await id(CAMPAGNE_DEMO.superviseur)];
  for (const { centre: code, dansJours } of CAMPAGNE_DEMO.missions) {
    const centre = centres[code];
    const datePrevue = new Date(debut.getTime() + dansJours * 24 * 3600 * 1000);
    const mission = await Mission.create({
      campagne: campagne._id, centre: centre._id, zoneAncetres: centre.zoneAncetres,
      datePrevue, evaluateurs: [evaluateur], superviseur,
    });
    await Evaluation.create({
      mission: mission._id, campagne: campagne._id, centre: centre._id, zoneAncetres: centre.zoneAncetres,
      grille: grille._id, grilleVersion: grille.version, statut: 'PLANIFIEE',
    });
  }
  return CAMPAGNE_DEMO.missions.length;
};

module.exports = { seed, COMPTES_DEMO, MOT_DE_PASSE_DEMO };

// Exécution en ligne de commande
if (require.main === module) {
  const connectDB = require('../config/db');
  (async () => {
    await connectDB();
    const resume = await seed({ avecCampagne: true });
    console.log(`Seed terminé : ${resume.zones} zones, ${resume.centres} centres, ${resume.comptes} comptes, ${resume.grilles} grille publiée, `
      + `campagne « ${CAMPAGNE_DEMO.nom} » démarrée avec ${resume.missions} missions.`);
    console.log(`\nComptes de démonstration (mot de passe : ${MOT_DE_PASSE_DEMO})`);
    for (const c of COMPTES_DEMO) console.log(`  ${c.telephone}  ${c.role.padEnd(20)} ${c.prenom} ${c.nom}`);
    await mongoose.disconnect();
  })().catch(async (err) => {
    console.error('Échec du seed :', err.message);
    await mongoose.disconnect();
    process.exit(1);
  });
}
