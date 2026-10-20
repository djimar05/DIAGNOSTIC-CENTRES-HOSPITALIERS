const express = require('express');
const controller = require('../controllers/utilisateurController');
const affectationController = require('../controllers/affectationController');
const { autoriser } = require('../middlewares/autorisation');

const router = express.Router();

// Les comptes sont gérés par l'administrateur. Le coordonnateur peut consulter la liste
// (pour choisir ses évaluateurs) et gérer les affectations de son périmètre.
const admin = autoriser('ADMINISTRATEUR');
const adminOuCoordonnateur = autoriser('ADMINISTRATEUR', 'COORDONNATEUR');

router.route('/')
  .get(adminOuCoordonnateur, controller.lister) // GET /api/utilisateurs?recherche=ali&actif=true&page=1&limite=20
  .post(admin, controller.creer);               // POST /api/utilisateurs

router.route('/:id')
  .get(adminOuCoordonnateur, controller.obtenir) // GET /api/utilisateurs/:id
  .patch(admin, controller.mettreAJour)          // PATCH /api/utilisateurs/:id
  .delete(admin, controller.supprimer);          // DELETE /api/utilisateurs/:id

// PATCH /api/utilisateurs/:id/mot-de-passe  { "nouveauMotDePasse": "..." }
router.patch('/:id/mot-de-passe', admin, controller.changerMotDePasse);

router.route('/:id/affectations')
  .get(adminOuCoordonnateur, affectationController.lister)  // GET /api/utilisateurs/:id/affectations
  .post(adminOuCoordonnateur, affectationController.creer); // POST { "role", "zone"?, "centre"?, "dateDebut"?, "dateFin"? }

module.exports = router;
