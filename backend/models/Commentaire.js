const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema.Types;
const opts = { timestamps: true };
// ───────────────────────────── 11. Commentaire ─────────────────────────────
/**
 * COMMENTAIRE – échanges entre superviseur et évaluateur sur une évaluation,
 * soit sur un critère précis, soit sur l'ensemble (critereCode absent).
 *
 * Exemple 1 – remarque du superviseur sur un critère :
 *   { evaluation: ObjectId("eval_2026_cs0142"), critereCode: "HYG-02",
 *     auteur: ObjectId("user_esther"), texte: "Merci d'ajouter la photo du tri des déchets",
 *     resolu: false }
 *
 * Exemple 2 – réponse générale de l'évaluateur :
 *   { evaluation: ObjectId("eval_2026_cs0142"), auteur: ObjectId("user_ali"),
 *     texte: "Photo ajoutée, renvoyé pour validation", resolu: true }
 */
const CommentaireSchema = new Schema({
  evaluation: { type: ObjectId, ref: 'Evaluation', required: true, index: true },
  critereCode: String,  // null = commentaire général
  auteur: { type: ObjectId, ref: 'Utilisateur', required: true },
  texte: { type: String, required: true },
  resolu: { type: Boolean, default: false },
}, opts);

module.exports = mongoose.model('Commentaire', CommentaireSchema);