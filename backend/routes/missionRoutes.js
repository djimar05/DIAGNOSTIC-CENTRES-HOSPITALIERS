const express = require('express');
const controller = require('../controllers/missionController');
const { autoriser } = require('../middlewares/autorisation');
const { ROLES_GESTION, ROLES_TERRAIN } = require('../services/perimetrePlanification');

const router = express.Router();

const lecture = autoriser(...ROLES_GESTION, 'RESPONSABLE_NATIONAL', ...ROLES_TERRAIN);
const gestion = autoriser(...ROLES_GESTION);

// GET /api/missions?campagne=&statut=&centre=&evaluateur=&du=&au=&sansEquipe=true&sansDate=true&enRetard=true
router.get('/', lecture, controller.lister);

router.route('/:id')
  .get(lecture, controller.obtenir)
  .patch(gestion, controller.modifier)    // { evaluateurs, superviseur, datePrevue } ou { statut: 'ANNULEE' | 'A_FAIRE' }
  .delete(gestion, controller.supprimer); // retire le centre (évaluation pas encore commencée)

module.exports = router;
