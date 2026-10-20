const express = require('express');
const controller = require('../controllers/authController');
const { proteger } = require('../middlewares/auth');
const { limiteurConnexion, limiteurAuth } = require('../middlewares/rateLimit');

const router = express.Router();

// Routes publiques (limitées par IP)
router.post('/connexion', limiteurConnexion, controller.connexion);  // { "identifiant": "+235...", "motDePasse": "..." }
router.post('/rafraichir', limiteurAuth, controller.rafraichir);     // { "refreshToken": "..." }
router.post('/deconnexion', limiteurAuth, controller.deconnexion);   // { "refreshToken": "..." }

// Routes réservées à l'utilisateur connecté (Authorization: Bearer <accessToken>)
router.get('/moi', proteger, controller.moi);
router.patch('/moi', proteger, controller.mettreAJourMoi); // { "langue": "fr" | "ar" }
router.post('/deconnexion-partout', proteger, controller.deconnexionPartout);
router.patch('/mot-de-passe', proteger, controller.changerMonMotDePasse); // { "ancienMotDePasse", "nouveauMotDePasse" }

module.exports = router;
