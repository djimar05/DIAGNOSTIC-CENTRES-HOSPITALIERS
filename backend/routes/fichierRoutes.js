const express = require('express');
const multer = require('multer');
const controller = require('../controllers/collecteController');
const { autoriser } = require('../middlewares/autorisation');
const { ROLES_GESTION, ROLES_TERRAIN } = require('../services/perimetrePlanification');
const { tailleMaxOctets } = require('../config/stockage');

const router = express.Router();

// En mémoire le temps de vérifier le format, puis envoyé au stockage (disque ou MinIO)
const televersement = multer({ storage: multer.memoryStorage(), limits: { fileSize: tailleMaxOctets, files: 1 } });

router.post('/', autoriser('EVALUATEUR'), televersement.single('fichier'), controller.televerser); // multipart : fichier, evaluation, critereCode…
router.get('/:id/contenu', autoriser(...ROLES_GESTION, 'RESPONSABLE_NATIONAL', ...ROLES_TERRAIN), controller.contenu);
router.delete('/:id', autoriser('EVALUATEUR'), controller.supprimerFichier);

module.exports = router;
