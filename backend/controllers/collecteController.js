const collecteService = require('../services/collecteService');
const fichierService = require('../services/fichierService');
const { journaliser } = require('../services/journalService');

// Couche HTTP fine : extraction des paramètres, appel du service, réponse.
// Express 5 transmet automatiquement les erreurs async au gestionnaire global.

const entite = (e) => ({ modele: 'Evaluation', id: e._id });

// ─── /mobile ───

const mesMissions = async (req, res) => {
  res.json({ success: true, data: await collecteService.mesMissions(req) });
};

// Express calcule un ETag et répond 304 si le téléphone a déjà cette version (If-None-Match)
const grille = async (req, res) => {
  res.json({ success: true, data: await collecteService.grillePourMobile(req.params.id) });
};

// ─── /evaluations ───

const obtenir = async (req, res) => {
  res.json({ success: true, data: await collecteService.obtenirEvaluation(req, req.params.id) });
};

const demarrer = async (req, res) => {
  const { evaluation, premierDemarrage } = await collecteService.demarrer(req, req.params.id, req.body);
  if (premierDemarrage) await journaliser(req, { action: 'EVALUATION_DEMARREE', entite: entite(evaluation), details: { gps: Boolean(evaluation.gpsVisite?.coordinates?.length) } });
  res.json({ success: true, data: evaluation });
};

const enregistrerReponses = async (req, res) => {
  const evaluation = await collecteService.enregistrerReponses(req, req.params.id, req.body);
  res.json({ success: true, data: { syncVersion: evaluation.syncVersion, reponses: evaluation.reponses, updatedAt: evaluation.updatedAt } });
};

const verification = async (req, res) => {
  res.json({ success: true, data: await collecteService.verificationEvaluation(req, req.params.id) });
};

const soumettre = async (req, res) => {
  const { evaluation, resoumission } = await collecteService.soumettre(req, req.params.id);
  await journaliser(req, { action: 'EVALUATION_SOUMISE', entite: entite(evaluation), details: { resoumission, reponses: evaluation.reponses.length } });
  res.json({ success: true, data: evaluation });
};

// ─── /fichiers ───

const televerser = async (req, res) => {
  const { fichier, existant } = await fichierService.televerser(req, req.file, req.body);
  res.status(existant ? 200 : 201).json({ success: true, data: fichier });
};

const contenu = async (req, res) => {
  const { fichier, flux } = await fichierService.lire(req, req.params.id);
  res.type(fichier.mime);
  res.set('Cache-Control', 'private, max-age=86400'); // contenu jamais modifié : le téléphone peut le garder
  flux.on('error', () => res.destroy());
  flux.pipe(res);
};

const supprimerFichier = async (req, res) => {
  await fichierService.supprimer(req, req.params.id);
  res.status(204).send();
};

module.exports = {
  mesMissions, grille, obtenir, demarrer, enregistrerReponses, verification, soumettre, televerser, contenu, supprimerFichier,
};
