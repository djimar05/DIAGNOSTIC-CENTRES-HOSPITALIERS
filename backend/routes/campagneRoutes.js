const express = require('express');
const controller = require('../controllers/campagneController');
const { autoriser } = require('../middlewares/autorisation');
const { ROLES_GESTION, ROLES_TERRAIN } = require('../services/perimetrePlanification');

const router = express.Router();

// Lecture : gestionnaires, responsable national, et équipes de terrain (leurs campagnes seulement)
const lecture = autoriser(...ROLES_GESTION, 'RESPONSABLE_NATIONAL', ...ROLES_TERRAIN);
// Écriture : administrateur et coordonnateur (dans son périmètre, contrôlé par le service)
const gestion = autoriser(...ROLES_GESTION);

// Avant /:id : évaluateurs et superviseurs possibles pour une zone (assistant de création)
router.get('/intervenants', gestion, controller.intervenantsZone);   // GET /api/campagnes/intervenants?zone=<id>

router.route('/')
  .get(lecture, controller.lister)   // GET /api/campagnes?statut=EN_COURS&recherche=
  .post(gestion, controller.creer);  // POST /api/campagnes  { nom, grille, zone, dateDebut, dateFin, partenaire, description }

router.route('/:id')
  .get(lecture, controller.obtenir)
  .patch(gestion, controller.modifier);

router.post('/:id/demarrer', gestion, controller.demarrer);
router.post('/:id/cloturer', gestion, controller.cloturer);          // { forcer: true } pour annuler les évaluations non terminées
router.post('/:id/missions', gestion, controller.ajouterMissions);   // { centres: [...], evaluateurs?, superviseur?, datePrevue? }
router.post('/:id/equipe', gestion, controller.affecterEquipe);      // { missions: [...], evaluateurs?, superviseur?, datePrevue? }
router.get('/:id/avancement', lecture, controller.avancement);
router.get('/:id/intervenants', gestion, controller.intervenants);   // évaluateurs et superviseurs possibles

module.exports = router;
