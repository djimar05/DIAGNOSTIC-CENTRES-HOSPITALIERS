const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema.Types;
const opts = { timestamps: true };
// ───────────────────────────── 10. Action corrective ─────────────────────────────
/**
 * ACTION_CORRECTIVE – ce qui doit être fait pour corriger un écart constaté.
 * Créée à partir d'un critère non conforme, puis suivie jusqu'à sa réalisation
 * (le statut VERIFIEE indique qu'un superviseur a contrôlé la preuve).
 *
 * Exemple 1 – action urgente en retard :
 *   { centre: ObjectId("centre_cs_quartier_nord"), evaluation: ObjectId("eval_2026_cs0142"),
 *     domaineCode: "EAU", critereCode: "EAU-01",
 *     ecartConstate: "Forage en panne depuis mars",
 *     actionPrevue: "Réparer la pompe du forage", priorite: "HAUTE",
 *     responsable: { nom: "Chef de centre" }, echeance: ISODate("2027-01-31"),
 *     budgetEstime: 850000, sourceFinancement: "Budget du district",
 *     statut: "EN_COURS", avancement: 30,
 *     suivi: [{ le: ISODate("2027-01-10"), par: ObjectId("user_major_cs_nord"),
 *               commentaire: "Devis reçu, en attente de financement", statut: "EN_COURS" }] }
 *
 * Exemple 2 – action réalisée et vérifiée :
 *   { centre: ObjectId("centre_cs_quartier_nord"), evaluation: ObjectId("eval_2026_cs0142"),
 *     critereCode: "RH-05", ecartConstate: "Liste de garde non affichée",
 *     actionPrevue: "Afficher la liste de garde à l'accueil", priorite: "BASSE",
 *     statut: "VERIFIEE", avancement: 100, preuves: [ObjectId("photo_liste_garde")] }
 */
const ActionCorrectiveSchema = new Schema({
  centre: { type: ObjectId, ref: 'Centre', required: true, index: true },
  evaluation: { type: ObjectId, ref: 'Evaluation', required: true },
  domaineCode: String,
  critereCode: String,
  ecartConstate: { type: String, required: true },
  actionPrevue: { type: String, required: true },
  priorite: { type: String, enum: ['HAUTE', 'MOYENNE', 'BASSE'], default: 'MOYENNE' },
  responsable: { utilisateur: { type: ObjectId, ref: 'Utilisateur' }, nom: String },
  echeance: Date,
  budgetEstime: Number,                         // en FCFA
  sourceFinancement: String,
  statut: { type: String, enum: ['A_FAIRE', 'EN_COURS', 'REALISEE', 'VERIFIEE', 'ABANDONNEE'], default: 'A_FAIRE' },
  avancement: { type: Number, min: 0, max: 100, default: 0 }, // en %
  preuves: [{ type: ObjectId, ref: 'Fichier' }],
  suivi: [{ le: Date, par: { type: ObjectId, ref: 'Utilisateur' }, commentaire: String, statut: String }],
}, opts);
ActionCorrectiveSchema.index({ statut: 1, echeance: 1 }); // pour les relances « échéance proche »
module.exports = mongoose.model('ActionCorrective', ActionCorrectiveSchema);