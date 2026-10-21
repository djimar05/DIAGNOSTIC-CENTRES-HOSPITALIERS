const mongoose = require('mongoose');

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;
const opts = { timestamps: true }; // ajoute createdAt et updatedAt à chaque document

// ───────────────────────────── 7. Mission ─────────────────────────────
/**
 * MISSION – la visite d'UN centre dans UNE campagne, avec l'équipe qui s'en charge.
 * C'est ce que l'évaluateur voit dans « Mes missions » sur son téléphone.
 * Un centre ne peut avoir qu'une mission par campagne (index unique).
 *
 * Exemple 1 – mission planifiée :
 *   { campagne: ObjectId("camp_2026_region_a"), centre: ObjectId("centre_cs_quartier_nord"),
 *     datePrevue: ISODate("2026-12-08"),
 *     evaluateurs: [ObjectId("user_ali"), ObjectId("user_fatime")],
 *     superviseur: ObjectId("user_esther"), statut: "A_FAIRE" }
 *
 * Exemple 2 – mission terminée :
 *   { campagne: ObjectId("camp_2026_region_a"), centre: ObjectId("centre_hd_centre_ville"),
 *     evaluateurs: [ObjectId("user_ali")], superviseur: ObjectId("user_esther"), statut: "TERMINEE" }
 */
const MissionSchema = new Schema({
  campagne: { type: ObjectId, ref: 'Campagne', required: true, index: true },
  centre: { type: ObjectId, ref: 'Centre', required: true },
  zoneAncetres: [{ type: ObjectId, ref: 'Zone' }], // copie de centre.zoneAncetres, pour filtrer par périmètre
  datePrevue: Date,
  evaluateurs: [{ type: ObjectId, ref: 'Utilisateur' }],
  superviseur: { type: ObjectId, ref: 'Utilisateur' },
  statut: { type: String, enum: ['A_FAIRE', 'EN_COURS', 'TERMINEE', 'ANNULEE'], default: 'A_FAIRE' },
}, opts);
MissionSchema.index({ campagne: 1, centre: 1 }, { unique: true });
MissionSchema.index({ evaluateurs: 1, statut: 1 }); // « Mes missions »
MissionSchema.index({ superviseur: 1, statut: 1 });
MissionSchema.index({ zoneAncetres: 1, datePrevue: 1 }); // calendrier du coordonnateur

// Un évaluateur ne valide pas ses propres évaluations : le superviseur ne fait pas partie de l'équipe d'évaluation
MissionSchema.pre('validate', function () {
  if (this.superviseur && this.evaluateurs.some((e) => e.equals(this.superviseur))) {
    this.invalidate('superviseur', 'Le superviseur ne peut pas être aussi évaluateur de la mission');
  }
});

module.exports = mongoose.model('Mission', MissionSchema);
