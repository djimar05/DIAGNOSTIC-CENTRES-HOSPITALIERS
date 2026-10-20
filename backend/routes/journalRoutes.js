const express = require('express');
const { listerJournal } = require('../services/journalService');
const { autoriser } = require('../middlewares/autorisation');

const router = express.Router();

// GET /api/journal?utilisateur=<id>&action=AFFECTATION_CREEE&entite=<id>&du=2026-10-01&au=2026-10-31&page=1
router.get('/', autoriser('ADMINISTRATEUR'), async (req, res) => {
  const { entrees, pagination } = await listerJournal(req.query);
  res.json({ success: true, data: entrees, pagination });
});

module.exports = router;
