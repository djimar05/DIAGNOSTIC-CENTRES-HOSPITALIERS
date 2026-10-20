const express = require('express');
const multer = require('multer');
const controller = require('../controllers/grilleController');
const ApiError = require('../middlewares/ApiError');
const { autoriser } = require('../middlewares/autorisation');
const { ROLES } = require('../models/enumUtils');

const router = express.Router();

// Lecture : tous les profils (coordonnateur pour ses campagnes, évaluateur pour la collecte…)
const tous = autoriser(...ROLES);
const admin = autoriser('ADMINISTRATEUR');

const televersement = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, fichier, cb) => {
    if (/\.(xlsx|json)$/i.test(fichier.originalname)) cb(null, true);
    else cb(ApiError.badRequest('Seuls les fichiers .xlsx et .json sont acceptés'));
  },
});

router.post('/import', admin, televersement.single('fichier'), controller.importer); // POST /api/grilles/import?simulation=true

router.route('/')
  .get(tous, controller.lister)   // GET /api/grilles?statut=PUBLIEE&niveau=CENTRE_SANTE&code=
  .post(admin, controller.creer); // POST /api/grilles  { code, nom, niveauxCibles, domaines, classes }

router.route('/:id')
  .get(tous, controller.obtenir)       // GET /api/grilles/:id
  .put(admin, controller.modifier)     // PUT /api/grilles/:id  (brouillon uniquement)
  .delete(admin, controller.supprimer); // DELETE /api/grilles/:id  (brouillon jamais utilisé)

router.get('/:id/verification', admin, controller.verifier);         // contrôles avant publication
router.post('/:id/publier', admin, controller.publier);
router.post('/:id/nouvelle-version', admin, controller.nouvelleVersion);
router.post('/:id/archiver', admin, controller.archiver);
router.post('/:id/simuler-score', tous, controller.simulerScore);    // { reponses: [{ critereCode, valeur, sansObjet }] }
router.get('/:id/export', admin, controller.exporter);               // ?format=json|xlsx

module.exports = router;
