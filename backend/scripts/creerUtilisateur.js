/**
 * Crée un ADMINISTRATEUR (périmètre national) directement en base : indispensable pour le
 * tout premier compte, puisque /api/utilisateurs exige d'être connecté et administrateur.
 * Usage : node scripts/creerUtilisateur.js <nom> <telephone> <motDePasse> [email]
 */
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { creerUtilisateur } = require('../services/utilisateurService');
const Affectation = require('../models/Affectation');

(async () => {
  const [nom, telephone, motDePasse, email] = process.argv.slice(2);
  if (!nom || !telephone || !motDePasse) {
    console.error('Usage : node scripts/creerUtilisateur.js <nom> <telephone> <motDePasse> [email]');
    process.exit(1);
  }

  await connectDB();
  const utilisateur = await creerUtilisateur({ nom, telephone, motDePasse, email });
  await Affectation.create({ utilisateur: utilisateur._id, role: 'ADMINISTRATEUR' });
  console.log(`Administrateur créé : ${utilisateur.nom} (${utilisateur.telephone}) - id ${utilisateur._id}`);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error('Échec de la création :', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
