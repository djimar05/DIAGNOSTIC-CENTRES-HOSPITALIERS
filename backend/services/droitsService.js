const Affectation = require('../models/Affectation');
const Zone = require('../models/Zone');

/**
 * Droits d'un utilisateur = ses affectations actives (rôle + périmètre).
 * Une affectation est active si actif = true et si la date du jour est dans [dateDebut, dateFin[.
 *
 * Périmètre d'une affectation :
 *   - ni zone ni centre → national
 *   - centre            → ce seul centre
 *   - zone              → cette zone et toute sa descendance
 * (Pour EVALUATEUR / SUPERVISEUR, le périmètre réel est celui des missions affectées :
 *  il sera filtré par les modules Mission / Evaluation.)
 */

const memeId = (a, b) => String(a) === String(b);
const estNationale = (a) => !a.zone && !a.centre;

/** Affectations actives d'un utilisateur. `peupler` ajoute le code et le nom des zones / centres. */
const affectationsActives = (utilisateurId, { peupler = false } = {}) => {
  const maintenant = new Date();
  const requete = Affectation.find({
    utilisateur: utilisateurId,
    actif: true,
    dateDebut: { $lte: maintenant },
    $or: [{ dateFin: null }, { dateFin: { $gt: maintenant } }],
  }).lean();
  if (peupler) requete.populate('zone', 'code nom niveau').populate('centre', 'code nom');
  return requete;
};

/**
 * Filtre MongoDB limitant une requête au périmètre des affectations données.
 * Les documents filtrés doivent porter un tableau de zones ancêtres (zone incluse) et/ou un centre.
 *   filtrePerimetre(affectations)                               → pour Centre, Evaluation…
 *   filtrePerimetre(affectations, { champZone: 'ancetres' })    → pour Zone (sous-arbre)
 */
const filtrePerimetre = (affectations, { champZone = 'zoneAncetres', champCentre = 'centre' } = {}) => {
  if (affectations.some(estNationale)) return {};
  const conditions = affectations.map((a) => (a.centre ? { [champCentre]: a.centre } : { [champZone]: a.zone }));
  return conditions.length ? { $or: conditions } : { _id: null }; // aucune affectation → aucun résultat
};

/** Vrai si la zone donnée (ou null = national) est couverte par une affectation de zone. */
const zoneDansPerimetre = async (affectations, zoneId) => {
  if (affectations.some(estNationale)) return true;
  if (!zoneId) return false;
  const zone = await Zone.findById(zoneId).select('ancetres').lean();
  if (!zone) return false;
  return affectations.some((a) => !a.centre && a.zone
    && (memeId(a.zone, zoneId) || zone.ancetres.some((z) => memeId(z, a.zone))));
};

/** Identifiants des zones couvertes (descendance comprise), ou null si le périmètre est national. */
const zonesDuPerimetre = async (affectations) => {
  if (affectations.some(estNationale)) return null;
  const racines = affectations.filter((a) => a.zone && !a.centre).map((a) => a.zone);
  if (!racines.length) return [];
  return Zone.find({ $or: [{ _id: { $in: racines } }, { ancetres: { $in: racines } }] }).distinct('_id');
};

module.exports = { affectationsActives, filtrePerimetre, zoneDansPerimetre, zonesDuPerimetre, memeId };
