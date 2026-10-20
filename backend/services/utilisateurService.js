const bcrypt = require('bcryptjs');
const Utilisateur = require('../models/Utilisateur');
const Affectation = require('../models/Affectation');
const ApiError = require('../middlewares/ApiError');
const { revoquerToutesLesSessions } = require('./authService');

const ROUNDS_BCRYPT = 10;

/**
 * Crée un utilisateur. Le mot de passe en clair est haché avant enregistrement.
 * Les doublons (telephone / email) sont détectés par les index uniques de MongoDB
 * et convertis en 409 par le gestionnaire d'erreurs global.
 */
const creerUtilisateur = async (donnees) => {
  const { nom, prenom, telephone, email, fonction, motDePasse, langue } = donnees;

  if (!nom || !telephone || !motDePasse) {
    throw ApiError.badRequest('Les champs nom, telephone et motDePasse sont obligatoires');
  }

  const motDePasseHash = await bcrypt.hash(motDePasse, ROUNDS_BCRYPT);
  return Utilisateur.create({ nom, prenom, telephone, email, fonction, motDePasseHash, langue });
};

/**
 * Liste paginée des utilisateurs avec recherche textuelle optionnelle
 * (nom, prénom, téléphone, e-mail) et filtre sur le statut actif.
 */
const listerUtilisateurs = async ({ page = 1, limite = 20, recherche, actif } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limiteNum = Math.min(100, Math.max(1, parseInt(limite, 10) || 20));

  const filtre = {};
  if (typeof actif !== 'undefined') {
    filtre.actif = actif === 'true' || actif === true;
  }
  if (recherche) {
    // Caractères spéciaux échappés : la recherche est littérale (pas d'injection d'expression régulière)
    const regex = new RegExp(String(recherche).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filtre.$or = [{ nom: regex }, { prenom: regex }, { telephone: regex }, { email: regex }];
  }

  const [total, utilisateurs] = await Promise.all([
    Utilisateur.countDocuments(filtre),
    Utilisateur.find(filtre)
      .sort({ nom: 1, prenom: 1 })
      .skip((pageNum - 1) * limiteNum)
      .limit(limiteNum),
  ]);

  return {
    utilisateurs,
    pagination: { total, page: pageNum, limite: limiteNum, pages: Math.ceil(total / limiteNum) },
  };
};

/** Récupère un utilisateur par son identifiant (404 si absent). */
const obtenirUtilisateurParId = async (id) => {
  const utilisateur = await Utilisateur.findById(id);
  if (!utilisateur) throw ApiError.notFound('Utilisateur non trouvé');
  return utilisateur;
};

// Seuls ces champs sont modifiables via l'API (jamais motDePasseHash directement).
const CHAMPS_MODIFIABLES = ['nom', 'prenom', 'telephone', 'email', 'fonction', 'langue', 'actif'];

/** Empêche un administrateur de bloquer son propre compte. */
const verifierPasSoiMeme = (id, auteurId, message) => {
  if (auteurId && String(id) === String(auteurId)) throw ApiError.forbidden(message);
};

/** Met à jour les champs autorisés d'un utilisateur (404 si absent). */
const mettreAJourUtilisateur = async (id, donnees, auteurId) => {
  const miseAJour = {};
  for (const champ of CHAMPS_MODIFIABLES) {
    if (typeof donnees[champ] !== 'undefined') miseAJour[champ] = donnees[champ];
  }
  if (miseAJour.actif === false) verifierPasSoiMeme(id, auteurId, 'Vous ne pouvez pas désactiver votre propre compte');

  const utilisateur = await Utilisateur.findByIdAndUpdate(id, miseAJour, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!utilisateur) throw ApiError.notFound('Utilisateur non trouvé');
  // Un compte désactivé perd immédiatement ses sessions
  if (miseAJour.actif === false) await revoquerToutesLesSessions(utilisateur._id);
  return utilisateur;
};

/** Change le mot de passe (haché) d'un utilisateur et ferme toutes ses sessions. */
const changerMotDePasse = async (id, nouveauMotDePasse) => {
  if (!nouveauMotDePasse || nouveauMotDePasse.length < 8) {
    throw ApiError.badRequest('Le nouveau mot de passe doit contenir au moins 8 caractères');
  }

  const utilisateur = await Utilisateur.findById(id).select('+motDePasseHash');
  if (!utilisateur) throw ApiError.notFound('Utilisateur non trouvé');

  utilisateur.motDePasseHash = await bcrypt.hash(nouveauMotDePasse, ROUNDS_BCRYPT);
  await utilisateur.save();
  await revoquerToutesLesSessions(utilisateur._id);
};

/** Suppression définitive. Pour une désactivation, utiliser PATCH avec { actif: false }. */
const supprimerUtilisateur = async (id, auteurId) => {
  verifierPasSoiMeme(id, auteurId, 'Vous ne pouvez pas supprimer votre propre compte');
  const utilisateur = await Utilisateur.findByIdAndDelete(id);
  if (!utilisateur) throw ApiError.notFound('Utilisateur non trouvé');
  await revoquerToutesLesSessions(utilisateur._id);
  await Affectation.updateMany({ utilisateur: utilisateur._id, actif: true }, { actif: false, dateFin: new Date() });
};

module.exports = {
  creerUtilisateur,
  listerUtilisateurs,
  obtenirUtilisateurParId,
  mettreAJourUtilisateur,
  changerMotDePasse,
  supprimerUtilisateur,
};
