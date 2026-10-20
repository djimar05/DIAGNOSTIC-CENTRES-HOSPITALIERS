const express = require('express');
const { listerZones } = require('../services/referentielService');
const { autoriser } = require('../middlewares/autorisation');
const { ROLES } = require('../models/enumUtils');

const router = express.Router();

// GET /api/zones?niveau=DISTRICT&parent=<id>  – zones du périmètre de l'utilisateur
router.get('/', autoriser(...ROLES), async (req, res) => {
  const zones = await listerZones(req.affectationsAutorisees, req.query);
  res.json({ success: true, data: zones });
});

module.exports = router;
