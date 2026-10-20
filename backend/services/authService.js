const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Utilisateur = require('../models/Utilisateur');
const RefreshToken = require('../models/RefreshToken');
const ApiError = require('../middlewares/ApiError');
const { jwtSecret, jwtExpiration, refreshExpirationJours } = require('../config/auth');

const ROUNDS_BCRYPT = 10;

// Hash factice comparé quand l'utilisateur n'existe pas, pour que le temps de réponse
// ne révèle pas si un identifiant est enregistré.
const HASH_FACTICE = bcrypt.hashSync('mot-de-passe-factice', ROUNDS_BCRYPT);

const empreinte = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Signe un access token JWT de courte durée. */
const genererAccessToken = (utilisateur) =>
  jwt.sign({ sub: utilisateur._id.toString() }, jwtSecret, { expiresIn: jwtExpiration });

/** Crée et enregistre un refresh token opaque ; renvoie la valeur en clair (une seule fois). */
const genererRefreshToken = async (utilisateurId, appareil) => {
  const token = crypto.randomBytes(48).toString('hex');
  await RefreshToken.create({
    utilisateur: utilisateurId,
    tokenHash: empreinte(token),
    expireLe: new Date(Date.now() + refreshExpirationJours * 24 * 60 * 60 * 1000),
    appareil,
  });
  return token;
};

const emettreJetons = async (utilisateur, appareil) => ({
  accessToken: genererAccessToken(utilisateur),
  refreshToken: await genererRefreshToken(utilisateur._id, appareil),
  expiresIn: jwtExpiration,
});

/** Révoque toutes les sessions actives d'un utilisateur. */
const revoquerToutesLesSessions = (utilisateurId) =>
  RefreshToken.updateMany(
    { utilisateur: utilisateurId, revoqueLe: null },
    { revoqueLe: new Date() },
  );

/**
 * Connexion par téléphone ou e-mail (champ "identifiant") et mot de passe.
 * Le message d'erreur est volontairement identique que l'identifiant ou le mot de passe soit faux.
 */
const connecter = async ({ identifiant, motDePasse } = {}, appareil) => {
  if (!identifiant || !motDePasse) {
    throw ApiError.badRequest('Les champs identifiant et motDePasse sont obligatoires');
  }

  const id = String(identifiant).trim();
  const filtre = id.includes('@') ? { email: id.toLowerCase() } : { telephone: id };
  const utilisateur = await Utilisateur.findOne(filtre).select('+motDePasseHash');

  const valide = await bcrypt.compare(String(motDePasse), utilisateur ? utilisateur.motDePasseHash : HASH_FACTICE);
  if (!utilisateur || !valide) throw ApiError.unauthorized('Identifiant ou mot de passe incorrect');
  if (!utilisateur.actif) throw ApiError.forbidden('Ce compte est désactivé');

  utilisateur.derniereConnexion = new Date();
  await utilisateur.save();

  return { utilisateur, ...(await emettreJetons(utilisateur, appareil)) };
};

/**
 * Échange un refresh token valide contre une nouvelle paire de jetons (rotation).
 * Si un jeton déjà révoqué est présenté, il a probablement été volé :
 * toutes les sessions de l'utilisateur sont révoquées par précaution.
 */
const rafraichir = async (refreshToken, appareil) => {
  if (!refreshToken) throw ApiError.badRequest('Le champ refreshToken est obligatoire');

  const session = await RefreshToken.findOne({ tokenHash: empreinte(String(refreshToken)) });
  if (!session || session.expireLe <= new Date()) {
    throw ApiError.unauthorized('Session invalide ou expirée');
  }
  if (session.revoqueLe) {
    await revoquerToutesLesSessions(session.utilisateur);
    throw ApiError.unauthorized('Session révoquée');
  }

  const utilisateur = await Utilisateur.findById(session.utilisateur);
  if (!utilisateur || !utilisateur.actif) {
    throw ApiError.unauthorized('Compte introuvable ou désactivé');
  }

  // Révocation atomique : deux rafraîchissements simultanés ne peuvent pas réussir tous les deux
  const revoque = await RefreshToken.findOneAndUpdate(
    { _id: session._id, revoqueLe: null },
    { revoqueLe: new Date() },
  );
  if (!revoque) throw ApiError.unauthorized('Session révoquée');

  return emettreJetons(utilisateur, appareil);
};

/** Déconnexion de la session courante. Sans effet si le jeton est inconnu. */
const deconnecter = async (refreshToken) => {
  if (!refreshToken) throw ApiError.badRequest('Le champ refreshToken est obligatoire');
  await RefreshToken.updateOne(
    { tokenHash: empreinte(String(refreshToken)), revoqueLe: null },
    { revoqueLe: new Date() },
  );
};

/**
 * Vérifie un access token et renvoie l'utilisateur correspondant.
 * Les erreurs JWT (invalide / expiré) sont converties en 401 par le gestionnaire global.
 */
const verifierAccessToken = async (token) => {
  const { sub } = jwt.verify(token, jwtSecret);
  const utilisateur = await Utilisateur.findById(sub);
  if (!utilisateur) throw ApiError.unauthorized('Utilisateur introuvable');
  if (!utilisateur.actif) throw ApiError.forbidden('Ce compte est désactivé');
  return utilisateur;
};

/**
 * Changement de son propre mot de passe (ancien mot de passe requis).
 * Toutes les sessions sont révoquées : l'utilisateur doit se reconnecter sur ses autres appareils.
 */
const changerMonMotDePasse = async (utilisateurId, { ancienMotDePasse, nouveauMotDePasse } = {}) => {
  if (!ancienMotDePasse || !nouveauMotDePasse) {
    throw ApiError.badRequest('Les champs ancienMotDePasse et nouveauMotDePasse sont obligatoires');
  }
  if (String(nouveauMotDePasse).length < 8) {
    throw ApiError.badRequest('Le nouveau mot de passe doit contenir au moins 8 caractères');
  }
  if (String(nouveauMotDePasse) === String(ancienMotDePasse)) {
    throw ApiError.badRequest("Le nouveau mot de passe doit être différent de l'ancien");
  }

  const utilisateur = await Utilisateur.findById(utilisateurId).select('+motDePasseHash');
  if (!utilisateur) throw ApiError.notFound('Utilisateur non trouvé');

  // 400 et non 401 : la session est valide, c'est la saisie qui est fausse
  // (un 401 ferait croire au client que son jeton a expiré)
  const valide = await bcrypt.compare(String(ancienMotDePasse), utilisateur.motDePasseHash);
  if (!valide) throw ApiError.badRequest('Ancien mot de passe incorrect');

  utilisateur.motDePasseHash = await bcrypt.hash(String(nouveauMotDePasse), ROUNDS_BCRYPT);
  utilisateur.motDePasseAChanger = false;
  await utilisateur.save();
  await revoquerToutesLesSessions(utilisateur._id);
};

module.exports = {
  connecter,
  rafraichir,
  deconnecter,
  verifierAccessToken,
  changerMonMotDePasse,
  revoquerToutesLesSessions,
};
