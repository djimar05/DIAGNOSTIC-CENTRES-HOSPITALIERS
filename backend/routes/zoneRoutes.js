const express = require('express');
const controller = require('../controllers/zoneController');
const { autoriser } = require('../middlewares/autorisation');
const { ROLES } = require('../models/enumUtils');

const router = express.Router();

const tous = autoriser(...ROLES);            // lecture : chacun voit les zones de son périmètre
const admin = autoriser('ADMINISTRATEUR');   // écriture : administrateur

router.get('/', tous, controller.lister);       // GET /api/zones?niveau=DISTRICT&parent=<id>
router.get('/arbre', tous, controller.arbre);   // GET /api/zones/arbre  (avec nombre de centres)
router.post('/', admin, controller.creer);      // POST /api/zones  { "code", "nom", "niveau", "parent" }
router.patch('/:id', admin, controller.modifier); // PATCH /api/zones/:id  { "code", "nom", "actif", "parent" }

module.exports = router;
