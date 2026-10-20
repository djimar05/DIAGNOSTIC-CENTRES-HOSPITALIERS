const mongoose = require('mongoose');
const { TYPES_REPONSE } = require('./enumUtils');
const OptionSchema = require('./Option');

const { Schema } = mongoose;

/**
 * CRITERE – une question de la grille, avec sa façon d'être notée.
 * Le code doit être unique dans toute la grille (vérifié par Grille).
 *
 * Exemple 1 – critère Oui/Non, éliminatoire, photo exigée :
 *   {
 *     code: "EAU-01", libelle: "Source d'eau potable disponible toute l'année sur le site",
 *     aide: "Forage, adduction ou citerne traitée", typeReponse: "OUI_NON",
 *     pointsMax: 1, poids: 1, eliminatoire: true, preuveExigee: "PHOTO", ordre: 1
 *   }
 *
 * Exemple 2 – critère numérique converti en points par un barème :
 *   {
 *     code: "RH-04", libelle: "Pourcentage de l'effectif requis présent", typeReponse: "NOMBRE",
 *     bareme: { seuils: [ { min: 0,  max: 49,  points: 0 },
 *                         { min: 50, max: 74,  points: 1 },
 *                         { min: 75, max: 89,  points: 2 },
 *                         { min: 90, max: 100, points: 3 } ] },
 *     pointsMax: 3, poids: 2
 *   }
 *
 *   Et un critère affiché seulement si une autre réponse le justifie :
 *   { code: "SRV-04", libelle: "Salle d'accouchement éclairée", typeReponse: "OUI_NON",
 *     condition: { critere: "SRV-03", valeur: "Oui" }, sansObjetAutorise: true }
 */
const CritereSchema = new Schema({
  code: { type: String, required: true },      // ex. EAU-03
  libelle: { type: String, required: true },
  aide: String,                                 // consigne pour l'évaluateur
  typeReponse: { type: String, enum: TYPES_REPONSE, required: true },
  options: [OptionSchema],                      // pour CHOIX_*
  bareme: {                                      // pour NOMBRE : seuils → points
    seuils: [{ min: Number, max: Number, points: Number }],
  },
  pointsMax: { type: Number, default: 1 },
  poids: { type: Number, default: 1 },          // importance du critère dans son domaine
  obligatoire: { type: Boolean, default: true },
  eliminatoire: { type: Boolean, default: false }, // non satisfait → domaine plafonné
  sansObjetAutorise: { type: Boolean, default: false },
  preuveExigee: { type: String, enum: ['AUCUNE', 'PHOTO', 'DOCUMENT'], default: 'AUCUNE' },
  condition: { critere: String, valeur: Schema.Types.Mixed }, // affiché seulement si…
  ordre: Number,
});

module.exports = CritereSchema;
