const express = require('express');
const multer = require('multer');
const controller = require('../controllers/centreController');
const ApiError = require('../middlewares/ApiError');
const { autoriser } = require('../middlewares/autorisation');
const { ROLES } = require('../models/enumUtils');

const router = express.Router();

const tous = autoriser(...ROLES);
const admin = autoriser('ADMINISTRATEUR');
// Évaluations et actions d'un centre : données détaillées, pas pour le partenaire (agrégats seulement)
const sansPartenaire = autoriser(...ROLES.filter((r) => r !== 'PARTENAIRE'));

// Fichier Excel gardé en mémoire (jamais écrit sur le disque), 5 Mo au plus
const televersement = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, fichier, cb) => {
    if (/\.xlsx$/i.test(fichier.originalname)) cb(null, true);
    else cb(ApiError.badRequest('Seuls les fichiers Excel .xlsx sont acceptés'));
  },
});

// Les routes fixes avant /:id
router.get('/import/modele', admin, controller.modele);                                  // GET /api/centres/import/modele
router.post('/import', admin, televersement.single('fichier'), controller.importer);     // POST /api/centres/import?simulation=true

router.route('/')
  .get(tous, controller.lister)   // GET /api/centres?zone=<id>&niveau=&statutJuridique=&actif=&recherche=&page=&limite=
  .post(admin, controller.creer); // POST /api/centres

router.route('/:id')
  .get(tous, controller.obtenir)       // GET /api/centres/:id
  .patch(admin, controller.modifier);  // PATCH /api/centres/:id

router.get('/:id/evaluations', sansPartenaire, controller.evaluations);
router.get('/:id/actions', sansPartenaire, controller.actions);

module.exports = router;
