const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema.Types;
const opts = { timestamps: { createdAt: true, updatedAt: false } };
// ───────────────────────────── 12. Journal d'activité ─────────────────────────────
/**
 * JOURNAL_ACTIVITE – trace des actions sensibles, pour l'audit (qui a fait quoi, quand).
 * On n'y écrit jamais de mise à jour : uniquement des ajouts.
 *
 * Exemple 1 – validation d'une évaluation :
 *   { utilisateur: ObjectId("user_esther"), action: "VALIDATION",
 *     entite: { modele: "Evaluation", id: ObjectId("eval_2026_cs0142") },
 *     details: { ancienStatut: "SOUMISE", nouveauStatut: "VALIDEE" }, appareil: "web", ip: "41.x.x.x" }
 *
 * Exemple 2 – publication d'une nouvelle version de grille :
 *   { utilisateur: ObjectId("user_admin"), action: "PUBLICATION_GRILLE",
 *     entite: { modele: "Grille", id: ObjectId("grille_cs_v2") },
 *     details: { code: "GRILLE-CS", version: 2 } }
 */
const JournalActiviteSchema = new Schema({
  utilisateur: { type: ObjectId, ref: 'Utilisateur' },
  action: String,           // CONNEXION, SOUMISSION, VALIDATION, PUBLICATION_GRILLE…
  entite: { modele: String, id: ObjectId },
  details: Schema.Types.Mixed,
  appareil: String,         // "web", "android", modèle du téléphone…
  ip: String,
}, opts);
JournalActiviteSchema.index({ createdAt: -1 });
JournalActiviteSchema.index({ utilisateur: 1, createdAt: -1 });
JournalActiviteSchema.index({ 'entite.id': 1 });
module.exports = mongoose.model('JournalActivite', JournalActiviteSchema);