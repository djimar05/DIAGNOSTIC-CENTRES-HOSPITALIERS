const mongoose = require('mongoose');
const { ROLES } = require('./enumUtils');
const Centre = require('./Centre');

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;
const opts = { timestamps: true }; // ajoute createdAt et updatedAt à chaque document

// ───────────────────────────── 3. Affectation (rôle + périmètre) ─────────────────────────────
/**
 * AFFECTATION – donne un rôle à un utilisateur sur un périmètre.
 * C'est ce document que l'API consulte pour décider ce qu'un utilisateur peut voir ou faire.
 *   - zone = null      → périmètre national
 *   - zone = district  → ce district et tous les centres en dessous
 *   - centre renseigné → un seul centre (cas du RESPONSABLE_CENTRE), qui doit être dans la zone
 *
 * Exemple 1 – coordonnatrice sur le District A :
 *   { utilisateur: ObjectId("user_esther"), role: "COORDONNATEUR",
 *     zone: ObjectId("zone_district_a"), actif: true }
 *
 * Exemple 2 – responsable d'un seul centre :
 *   { utilisateur: ObjectId("user_major_cs_nord"), role: "RESPONSABLE_CENTRE",
 *     zone: ObjectId("zone_district_a"), centre: ObjectId("centre_cs_quartier_nord") }
 */
const AffectationSchema = new Schema({
  utilisateur: { type: ObjectId, ref: 'Utilisateur', required: true },
  role: { type: String, enum: ROLES, required: true },
  zone: { type: ObjectId, ref: 'Zone' },        // périmètre géographique (null = national)
  centre: { type: ObjectId, ref: 'Centre' },    // pour RESPONSABLE_CENTRE
  actif: { type: Boolean, default: true },
  dateDebut: { type: Date, default: Date.now },
  dateFin: Date,                                // fin de mission, départ, mutation…
}, opts);
AffectationSchema.index({ utilisateur: 1, actif: 1 }); // droits de l'utilisateur connecté

// Un périmètre incohérent donnerait trop (ou pas assez) de droits : on le refuse.
AffectationSchema.pre('validate', async function () {
  if (this.role === 'RESPONSABLE_CENTRE' && !this.centre) {
    this.invalidate('centre', 'Un RESPONSABLE_CENTRE doit être rattaché à un centre');
  }
  if (this.dateDebut && this.dateFin && this.dateFin < this.dateDebut) {
    this.invalidate('dateFin', 'dateFin doit être postérieure à dateDebut');
  }
  if (this.centre && (this.isModified('centre') || this.isModified('zone'))) {
    const centre = await Centre.findById(this.centre).select('zone zoneAncetres').lean();
    if (!centre) {
      this.invalidate('centre', 'Centre introuvable');
    } else if (!this.zone) {
      this.zone = centre.zone; // périmètre déduit du centre
    } else if (!centre.zone.equals(this.zone) && !centre.zoneAncetres.some((z) => z.equals(this.zone))) {
      this.invalidate('centre', "Le centre n'appartient pas à la zone de l'affectation");
    }
  }
});

module.exports = mongoose.model('Affectation', AffectationSchema);
