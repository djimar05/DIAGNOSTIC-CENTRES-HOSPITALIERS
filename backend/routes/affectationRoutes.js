const express = require('express');
const controller = require('../controllers/affectationController');
const { autoriser } = require('../middlewares/autorisation');

const router = express.Router();

// Les affectations d'un utilisateur se listent et se créent via /api/utilisateurs/:id/affectations.
router.use(autoriser('ADMINISTRATEUR', 'COORDONNATEUR'));

router.route('/:id')
  .patch(controller.mettreAJour) // PATCH /api/affectations/:id  { "zone", "centre", "actif", "dateDebut", "dateFin" }
  .delete(controller.retirer);   // DELETE /api/affectations/:id  (désactive, garde l'historique)

module.exports = router;
