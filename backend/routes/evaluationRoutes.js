const express = require('express');
const controller = require('../controllers/collecteController');
const { autoriser } = require('../middlewares/autorisation');
const { ROLES_GESTION, ROLES_TERRAIN } = require('../services/perimetrePlanification');

const router = express.Router();

const lecture = autoriser(...ROLES_GESTION, 'RESPONSABLE_NATIONAL', ...ROLES_TERRAIN);
const saisie = autoriser('EVALUATEUR'); // + être évaluateur de la mission (contrôlé par le service)

router.get('/:id', lecture, controller.obtenir);                       // réponses, fichiers, historique
router.post('/:id/demarrer', saisie, controller.demarrer);             // { gps?: { coordinates: [lng, lat], precisionMetres }, debut? }
router.patch('/:id/reponses', saisie, controller.enregistrerReponses); // { reponses: [...], observationsGenerales?, personnesRencontrees? }
router.get('/:id/verification', lecture, controller.verification);     // ce qui manque avant soumission
router.post('/:id/soumettre', saisie, controller.soumettre);

module.exports = router;
