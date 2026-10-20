const mongoose = require('mongoose');
const { NIVEAUX_ZONE } = require('./enumUtils');

const { Schema } = mongoose;
const opts = { timestamps: true }; // ajoute createdAt et updatedAt à chaque document
const { ObjectId } = Schema.Types;
// ───────────────────────────── 2. Zone (découpage sanitaire) ─────────────────────────────
/**
 * ZONE – le découpage administratif sanitaire, sous forme d'arbre :
 *   National → Région → District → Zone de responsabilité.
 * Le champ `ancetres` liste toutes les zones au-dessus : il permet de retrouver en une
 * seule requête tous les centres d'une région, quel que soit leur district.
 *
 * Exemple 1 – une région (rattachée au national) :
 *   { code: "REG-01", nom: "Région A", niveau: "REGION",
 *     parent: ObjectId("zone_national"), ancetres: [ObjectId("zone_national")] }
 *
 * Exemple 2 – un district de cette région :
 *   { code: "DS-01-03", nom: "District A", niveau: "DISTRICT",
 *     parent: ObjectId("zone_region_a"),
 *     ancetres: [ObjectId("zone_national"), ObjectId("zone_region_a")] }
 */
const ZoneSchema = new Schema({
  code: { type: String, required: true, unique: true },
  nom: { type: String, required: true },
  niveau: { type: String, enum: NIVEAUX_ZONE, required: true },
  parent: { type: ObjectId, ref: 'Zone', default: null },   // null pour le niveau national
  ancetres: [{ type: ObjectId, ref: 'Zone' }], // pour filtrer vite tout un sous-arbre
  actif: { type: Boolean, default: true },
}, opts);
ZoneSchema.index({ ancetres: 1 });

module.exports = mongoose.model('Zone', ZoneSchema);