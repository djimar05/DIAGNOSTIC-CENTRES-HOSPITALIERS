const JournalActivite = require('../models/JournalActivite');

/**
 * Trace une action sensible dans le journal d'activité.
 * Ne lève jamais d'erreur : un échec d'écriture du journal ne doit pas faire échouer l'action.
 * Ne jamais mettre de mot de passe ni de jeton dans `details`.
 *
 * Exemple : await journaliser(req, { action: 'AFFECTATION_CREEE', entite: { modele: 'Affectation', id } });
 */
const journaliser = async (req, { action, entite, details, utilisateur = req.utilisateur && req.utilisateur._id }) => {
  try {
    await JournalActivite.create({
      utilisateur, action, entite, details, ip: req.ip, appareil: req.get('user-agent'),
    });
  } catch (err) {
    console.error(`[journal] Échec d'écriture (${action}) :`, err.message);
  }
};

/** Liste paginée du journal, du plus récent au plus ancien. */
const listerJournal = async ({ page = 1, limite = 50, utilisateur, action, entite, du, au } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limiteNum = Math.min(200, Math.max(1, parseInt(limite, 10) || 50));

  const filtre = {};
  if (utilisateur) filtre.utilisateur = utilisateur;
  if (action) filtre.action = action;
  if (entite) filtre['entite.id'] = entite;
  if (du || au) {
    filtre.createdAt = {};
    if (du) filtre.createdAt.$gte = new Date(du);
    if (au) filtre.createdAt.$lte = new Date(au);
  }

  const [total, entrees] = await Promise.all([
    JournalActivite.countDocuments(filtre),
    JournalActivite.find(filtre)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limiteNum)
      .limit(limiteNum)
      .populate('utilisateur', 'nom prenom telephone'),
  ]);

  return {
    entrees,
    pagination: { total, page: pageNum, limite: limiteNum, pages: Math.ceil(total / limiteNum) },
  };
};

module.exports = { journaliser, listerJournal };
