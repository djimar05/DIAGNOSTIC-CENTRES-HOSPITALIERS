const mongoose = require('mongoose');

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;
const opts = { timestamps: true }; // ajoute createdAt et updatedAt à chaque document

// ───────────────────────────── 6. Campagne ─────────────────────────────
/**
 * CAMPAGNE – une opération de diagnostic sur une période et une zone, avec une grille donnée.
 * Elle regroupe toutes les missions (un centre = une mission).
 *
 * Exemple 1 – campagne régionale :
 *   { nom: "Diagnostic 2026 – Région A", grille: ObjectId("grille_cs_v1"),
 *     zone: ObjectId("zone_region_a"), dateDebut: ISODate("2026-12-01"),
 *     dateFin: ISODate("2027-02-28"), partenaire: "[Bailleur]", statut: "EN_COURS" }
 *
 * Exemple 2 – campagne pilote :
 *   { nom: "Pilote – 20 centres du District A", grille: ObjectId("grille_cs_v1"),
 *     zone: ObjectId("zone_district_a"), statut: "CLOTUREE" }
 */
const CampagneSchema = new Schema({
  nom: { type: String, required: true },       // ex. Diagnostic 2026 – Région du Logone
  description: String,
  grille: { type: ObjectId, ref: 'Grille', required: true },
  zone: { type: ObjectId, ref: 'Zone' },        // null = campagne nationale
  dateDebut: Date,
  dateFin: Date,
  partenaire: String,                           // financeur éventuel
  statut: { type: String, enum: ['PREPARATION', 'EN_COURS', 'CLOTUREE'], default: 'PREPARATION' },
  creePar: { type: ObjectId, ref: 'Utilisateur' },
}, opts);

CampagneSchema.pre('validate', function () {
  if (this.dateDebut && this.dateFin && this.dateFin < this.dateDebut) {
    this.invalidate('dateFin', 'dateFin doit être postérieure à dateDebut');
  }
});

module.exports = mongoose.model('Campagne', CampagneSchema);
