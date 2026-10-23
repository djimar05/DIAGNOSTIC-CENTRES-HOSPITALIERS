const express = require('express');
const controller = require('../controllers/collecteController');
const { autoriser } = require('../middlewares/autorisation');

const router = express.Router();

// Application mobile des évaluateurs
router.use(autoriser('EVALUATEUR'));

router.get('/mes-missions', controller.mesMissions); // missions des campagnes en cours + grilles, en un appel
router.get('/grilles/:id', controller.grille);       // grille figée (ETag / 304)

module.exports = router;
