const grilleService = require('../services/grilleService');
const grilleFichierService = require('../services/grilleFichierService');
const ApiError = require('../middlewares/ApiError');
const { journaliser } = require('../services/journalService');

// Couche HTTP fine : extraction des paramètres, appel du service, réponse.
// Express 5 transmet automatiquement les erreurs async au gestionnaire global.

const entite = (g) => ({ modele: 'Grille', id: g._id });
const resume = (g) => ({ code: g.code, version: g.version });

const lister = async (req, res) => {
  res.json({ success: true, data: await grilleService.listerGrilles(req.query) });
};

const obtenir = async (req, res) => {
  res.json({ success: true, data: await grilleService.obtenirGrille(req.params.id) });
};

const creer = async (req, res) => {
  const grille = await grilleService.creerGrille(req.body, req.utilisateur._id);
  await journaliser(req, { action: 'GRILLE_CREEE', entite: entite(grille), details: resume(grille) });
  res.status(201).json({ success: true, data: grille });
};

const modifier = async (req, res) => {
  const grille = await grilleService.modifierGrille(req.params.id, req.body);
  res.json({ success: true, data: grille });
};

const verifier = async (req, res) => {
  const grille = await grilleService.obtenirGrille(req.params.id);
  res.json({ success: true, data: grilleService.verifierPublication(grille) });
};

const publier = async (req, res) => {
  const { grille, avertissements, versionsArchivees } = await grilleService.publierGrille(req.params.id);
  await journaliser(req, { action: 'GRILLE_PUBLIEE', entite: entite(grille), details: { ...resume(grille), versionsArchivees } });
  res.json({ success: true, data: grille, avertissements });
};

const nouvelleVersion = async (req, res) => {
  const grille = await grilleService.nouvelleVersion(req.params.id, req.utilisateur._id);
  await journaliser(req, { action: 'GRILLE_CREEE', entite: entite(grille), details: resume(grille) });
  res.status(201).json({ success: true, data: grille });
};

const archiver = async (req, res) => {
  const grille = await grilleService.archiverGrille(req.params.id);
  await journaliser(req, { action: 'GRILLE_ARCHIVEE', entite: entite(grille), details: resume(grille) });
  res.json({ success: true, data: grille });
};

const supprimer = async (req, res) => {
  const grille = await grilleService.supprimerGrille(req.params.id);
  await journaliser(req, { action: 'GRILLE_SUPPRIMEE', entite: entite(grille), details: resume(grille) });
  res.status(204).send();
};

const simulerScore = async (req, res) => {
  res.json({ success: true, data: await grilleService.simulerScore(req.params.id, req.body.reponses) });
};

/** GET /api/grilles/:id/export?format=json|xlsx */
const exporter = async (req, res) => {
  const grille = await grilleService.obtenirGrille(req.params.id);
  const nom = `grille-${grille.code}-v${grille.version}`;
  if (req.query.format === 'json') {
    res.attachment(`${nom}.json`);
    res.type('application/json');
    return res.send(JSON.stringify(grilleFichierService.versJson(grille), null, 2));
  }
  res.attachment(`${nom}.xlsx`);
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return res.send(Buffer.from(await grilleFichierService.versExcel(grille)));
};

/** POST /api/grilles/import?simulation=true  (multipart, champ "fichier", .json ou .xlsx) */
const importer = async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Joignez le fichier dans le champ "fichier"');
  const simulation = req.query.simulation !== 'false';
  const rapport = await grilleFichierService.importerGrille(req.file.buffer, req.file.originalname, {
    simulation, auteurId: req.utilisateur._id,
  });
  if (rapport.enregistree) {
    await journaliser(req, {
      action: 'GRILLE_IMPORTEE', entite: entite(rapport.grille), details: { ...resume(rapport.grille), fichier: req.file.originalname },
    });
  }
  res.json({ success: true, data: rapport });
};

module.exports = {
  lister, obtenir, creer, modifier, verifier, publier, nouvelleVersion, archiver, supprimer, simulerScore, exporter, importer,
};
