const mongoose = require('mongoose');
const GpsSchema = require('./Gps');
const { NIVEAUX_CENTRE, CLASSES } = require('./enumUtils');

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;
const opts = { timestamps: true }; // ajoute createdAt et updatedAt à chaque document

// ───────────────────────────── 4. Centre ─────────────────────────────
/**
 * CENTRE – la fiche d'identité d'une formation sanitaire évaluée.
 * `derniereEvaluation` est une copie du dernier résultat validé : elle sert à afficher
 * la carte et le classement rapidement, sans recalculer à chaque fois.
 *
 * Exemple 1 – un centre de santé :
 *   {
 *     code: "CS-0142", nom: "CS Quartier Nord", niveau: "CENTRE_SANTE",
 *     statutJuridique: "PUBLIC", zone: ObjectId("zone_district_a"),
 *     zoneAncetres: [ObjectId("zone_national"), ObjectId("zone_region_a"), ObjectId("zone_district_a")],
 *     localite: "Quartier Nord", gps: { type: "Point", coordinates: [15.05, 12.13] },
 *     populationDesservie: 18500, nombreLits: 6,
 *     services: ["CONSULTATION", "MATERNITE", "VACCINATION"],
 *     responsable: { nom: "Major du centre", telephone: "+235 66 00 00 03" },
 *     derniereEvaluation: { evaluation: ObjectId("eval_2026_cs0142"), date: ISODate("2026-10-12"),
 *                           score: 31.5, classe: "D" }
 *   }
 *
 * Exemple 2 – un hôpital de district pas encore évalué :
 *   {
 *     code: "HD-0007", nom: "HD Centre-Ville", niveau: "HOPITAL_DISTRICT",
 *     statutJuridique: "PUBLIC", zone: ObjectId("zone_district_c"), nombreLits: 80,
 *     services: ["URGENCES", "MATERNITE", "BLOC", "LABORATOIRE", "IMAGERIE"]
 *     // derniereEvaluation absente
 *   }
 */
const CentreSchema = new Schema({
  code: { type: String, required: true, unique: true },
  nom: { type: String, required: true },
  niveau: { type: String, enum: NIVEAUX_CENTRE, required: true },
  statutJuridique: { type: String, enum: ['PUBLIC', 'CONFESSIONNEL', 'PRIVE', 'COMMUNAUTAIRE', 'ONG'] },
  zone: { type: ObjectId, ref: 'Zone', required: true },
  zoneAncetres: [{ type: ObjectId, ref: 'Zone' }],   // copie de zone.ancetres + zone, pour filtrer vite
  localite: String,
  gps: GpsSchema,
  populationDesservie: Number,
  nombreLits: Number,
  services: [String],              // MATERNITE, URGENCES, LABORATOIRE, IMAGERIE, BLOC…
  responsable: { nom: String, telephone: String },
  derniereEvaluation: {
    evaluation: { type: ObjectId, ref: 'Evaluation' },
    date: Date,
    score: Number,
    classe: { type: String, enum: CLASSES },
  },
  actif: { type: Boolean, default: true },
}, opts);
CentreSchema.index({ gps: '2dsphere' });
CentreSchema.index({ zoneAncetres: 1, niveau: 1 });

module.exports = mongoose.model('Centre', CentreSchema);
