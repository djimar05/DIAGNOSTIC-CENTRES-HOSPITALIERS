const mongoose = require('mongoose');
const GpsSchema = require('./Gps');
const { Schema } = mongoose;
const { ObjectId } = Schema.Types;
const opts = { timestamps: true };
// ───────────────────────────── 9. Fichier (preuves) ─────────────────────────────
/**
 * FICHIER – les métadonnées d'une photo ou d'un document de preuve.
 * Le fichier lui-même est dans le stockage objet (S3 / MinIO) ; ici on garde son chemin,
 * sa date, sa position et à quoi il se rattache (une réponse ou une action corrective).
 *
 * Exemple 1 – photo prise pendant l'évaluation :
 *   { clientId: "a1b2c3d4-...", evaluation: ObjectId("eval_2026_cs0142"), critereCode: "EAU-01",
 *     type: "PHOTO", cleStockage: "evaluations/eval_2026_cs0142/EAU-01/a1b2c3d4.jpg",
 *     mime: "image/jpeg", tailleOctets: 412000,
 *     gps: { type: "Point", coordinates: [15.05, 12.13] },
 *     prisLe: ISODate("2026-12-08T09:41:00Z"), televersePar: ObjectId("user_ali") }
 *
 * Exemple 2 – procès-verbal joint comme preuve qu'une action est réalisée :
 *   { action: ObjectId("action_coges"), type: "DOCUMENT",
 *     cleStockage: "actions/action_coges/pv-reunion.pdf", mime: "application/pdf",
 *     televersePar: ObjectId("user_major_cs_nord") }
 */
const FichierSchema = new Schema({
  clientId: { type: String, unique: true, sparse: true },
  evaluation: { type: ObjectId, ref: 'Evaluation' },
  action: { type: ObjectId, ref: 'ActionCorrective' },
  critereCode: String,
  type: { type: String, enum: ['PHOTO', 'DOCUMENT'], required: true },
  cleStockage: { type: String, required: true }, // chemin dans le stockage objet
  mime: String,
  tailleOctets: Number,
  gps: GpsSchema,
  prisLe: Date,
  televersePar: { type: ObjectId, ref: 'Utilisateur' },
}, opts);
module.exports = mongoose.model('Fichier', FichierSchema);