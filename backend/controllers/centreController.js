const centreService = require('../services/centreService');
const importCentresService = require('../services/importCentresService');
const ApiError = require('../middlewares/ApiError');
const { journaliser } = require('../services/journalService');

// Couche HTTP fine : extraction des paramètres, appel du service, réponse.
// Express 5 transmet automatiquement les erreurs async au gestionnaire global.

const entite = (centre) => ({ modele: 'Centre', id: centre._id });

const lister = async (req, res) => {
  const { centres, pagination } = await centreService.listerCentres(req.affectationsAutorisees, req.query);
  res.json({ success: true, data: centres, pagination });
};

const obtenir = async (req, res) => {
  const centre = await centreService.obtenirCentre(req.params.id, req.affectationsAutorisees);
  res.json({ success: true, data: centre });
};

const creer = async (req, res) => {
  const centre = await centreService.creerCentre(req.body);
  await journaliser(req, { action: 'CENTRE_CREE', entite: entite(centre), details: { code: centre.code } });
  res.status(201).json({ success: true, data: centre });
};

const modifier = async (req, res) => {
  const { centre, champsModifies } = await centreService.modifierCentre(req.params.id, req.body);
  await journaliser(req, { action: 'CENTRE_MODIFIE', entite: entite(centre), details: { code: centre.code, champs: champsModifies } });
  res.json({ success: true, data: centre });
};

const evaluations = async (req, res) => {
  const centre = await centreService.obtenirCentre(req.params.id, req.affectationsAutorisees); // contrôle du périmètre
  res.json({ success: true, data: await centreService.evaluationsDuCentre(centre._id) });
};

const actions = async (req, res) => {
  const centre = await centreService.obtenirCentre(req.params.id, req.affectationsAutorisees);
  res.json({ success: true, data: await centreService.actionsDuCentre(centre._id) });
};

/** POST /api/centres/import?simulation=true  (multipart, champ "fichier") */
const importer = async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Joignez le fichier Excel dans le champ "fichier"');
  const simulation = req.query.simulation !== 'false';
  const rapport = await importCentresService.importerCentres(req.file.buffer, { simulation });
  if (!simulation) {
    await journaliser(req, {
      action: 'CENTRES_IMPORTES', details: { fichier: req.file.originalname, ...rapport.resume },
    });
  }
  res.json({ success: true, data: rapport });
};

const modele = async (req, res) => {
  const buffer = await importCentresService.genererModele();
  res.attachment('modele-import-centres.xlsx');
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(Buffer.from(buffer));
};

module.exports = { lister, obtenir, creer, modifier, evaluations, actions, importer, modele };
