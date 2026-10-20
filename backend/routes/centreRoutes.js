const express = require('express');
const { listerCentres } = require('../services/referentielService');
const { autoriser } = require('../middlewares/autorisation');
const { ROLES } = require('../models/enumUtils');

const router = express.Router();

// GET /api/centres?zone=<id>&niveau=CENTRE_SANTE&recherche=nord&page=1&limite=50  – centres du périmètre
router.get('/', autoriser(...ROLES), async (req, res) => {
  const { centres, pagination } = await listerCentres(req.affectationsAutorisees, req.query);
  res.json({ success: true, data: centres, pagination });
});

module.exports = router;
