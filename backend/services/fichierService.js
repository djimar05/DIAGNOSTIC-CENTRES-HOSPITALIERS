const crypto = require('crypto');
const Evaluation = require('../models/Evaluation');
const Fichier = require('../models/Fichier');
const Grille = require('../models/Grille');
const ApiError = require('../middlewares/ApiError');
const collecteService = require('./collecteService');
const perimetre = require('./perimetrePlanification');
const stockage = require('./stockageService');

/**
 * Photos et documents de preuve d'une évaluation.
 * Le contenu va dans le stockage (disque ou MinIO), la base ne garde que les métadonnées.
 * Le type réel est vérifié sur les premiers octets du fichier, pas seulement sur l'extension annoncée.
 */
const SIGNATURES = [
  { mime: 'image/jpeg', ext: 'jpg', type: 'PHOTO', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: 'png', type: 'PHOTO', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/webp', ext: 'webp', type: 'PHOTO', test: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  { mime: 'application/pdf', ext: 'pdf', type: 'DOCUMENT', test: (b) => b.toString('ascii', 0, 5) === '%PDF-' },
];

const identifier = (buffer) => SIGNATURES.find((s) => buffer.length > 12 && s.test(buffer));

/**
 * Téléverse une preuve rattachée à un critère d'une évaluation en cours de saisie.
 * `clientId` (UUID créé par le téléphone) rend l'envoi idempotent : un nouvel essai après une coupure
 * renvoie le fichier déjà reçu au lieu d'en créer un second.
 */
const televerser = async (req, fichier, { evaluation: evaluationId, critereCode, clientId, prisLe, longitude, latitude, precision } = {}) => {
  if (!fichier) throw ApiError.badRequest('Joignez le fichier dans le champ "fichier"');
  if (!evaluationId || !critereCode) throw ApiError.badRequest('Les champs evaluation et critereCode sont obligatoires');

  if (clientId) {
    const deja = await Fichier.findOne({ clientId: String(clientId) });
    if (deja) {
      if (String(deja.evaluation) !== String(evaluationId)) throw ApiError.conflict('Identifiant client déjà utilisé pour un autre fichier');
      return { fichier: deja, existant: true };
    }
  }

  const { evaluation } = await collecteService.chargerPourSaisie(req, evaluationId);
  const grille = await Grille.findById(evaluation.grille).select('domaines.criteres.code').lean();
  if (!collecteService.indexerCriteres(grille).has(critereCode)) throw ApiError.badRequest(`Critère inconnu : ${critereCode}`);

  const format = identifier(fichier.buffer);
  if (!format) throw ApiError.badRequest('Format non accepté : photo JPEG, PNG ou WEBP, ou document PDF');

  const cle = `evaluations/${evaluation._id}/${critereCode}/${crypto.randomUUID()}.${format.ext}`;
  await stockage.enregistrer(cle, fichier.buffer, format.mime);

  const lng = Number(longitude);
  const lat = Number(latitude);
  const gps = Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90
    ? { type: 'Point', coordinates: [lng, lat], precisionMetres: Number(precision) || undefined }
    : undefined;
  try {
    const doc = await Fichier.create({
      clientId: clientId ? String(clientId) : undefined,
      evaluation: evaluation._id,
      critereCode,
      type: format.type,
      cleStockage: cle,
      mime: format.mime,
      tailleOctets: fichier.buffer.length,
      gps,
      prisLe: prisLe && !Number.isNaN(Date.parse(prisLe)) ? new Date(prisLe) : new Date(),
      televersePar: req.utilisateur._id,
    });
    return { fichier: doc, existant: false };
  } catch (err) {
    await stockage.supprimer(cle).catch(() => {}); // pas de fichier orphelin dans le stockage
    throw err;
  }
};

/** Contenu d'un fichier, si l'utilisateur peut voir l'évaluation (ou l'a lui-même envoyé). */
const lire = async (req, id) => {
  const fichier = await Fichier.findById(id).lean();
  if (!fichier) throw ApiError.notFound('Fichier non trouvé');
  const visible = String(fichier.televersePar) === String(req.utilisateur._id)
    || await Evaluation.exists({ $and: [{ _id: fichier.evaluation }, await perimetre.filtreEvaluations(req)] });
  if (!visible) throw ApiError.notFound('Fichier non trouvé');
  try {
    return { fichier, flux: await stockage.lire(fichier.cleStockage) };
  } catch {
    throw ApiError.notFound('Contenu du fichier introuvable dans le stockage');
  }
};

/** Supprime une preuve pendant la saisie ; elle est aussi retirée de la réponse qui la citait. */
const supprimer = async (req, id) => {
  const fichier = await Fichier.findById(id);
  if (!fichier) throw ApiError.notFound('Fichier non trouvé');
  const { evaluation } = await collecteService.chargerPourSaisie(req, fichier.evaluation);
  evaluation.reponses.forEach((r) => {
    r.fichiers = r.fichiers.filter((f) => String(f) !== String(fichier._id));
    if (r.typeReponse === 'PHOTO') r.valeur = r.fichiers.length || null;
  });
  evaluation.syncVersion += 1;
  await evaluation.save();
  await fichier.deleteOne();
  await stockage.supprimer(fichier.cleStockage).catch(() => {});
  return fichier;
};

module.exports = { televerser, lire, supprimer };
