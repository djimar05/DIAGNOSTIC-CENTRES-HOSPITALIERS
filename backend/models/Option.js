const mongoose = require('mongoose');

const { Schema } = mongoose;

// ───────────────────────────── Sous-schémas ─────────────────────────────

/**
 * OptionSchema – une option de réponse pour les critères CHOIX_UNIQUE / CHOIX_MULTIPLE,
 * avec les points qu'elle rapporte.
 *
 * Exemples (critère « Source principale d'électricité ») :
 *   { code: "RESEAU",  libelle: "Réseau électrique", points: 3 }
 *   { code: "AUCUNE",  libelle: "Aucune source",     points: 0 }
 */
const OptionSchema = new Schema({
  code: String,
  libelle: String,
  points: Number,
}, { _id: false });

module.exports = OptionSchema;
