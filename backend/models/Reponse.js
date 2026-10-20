const mongoose = require('mongoose');

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

/**
 * REPONSE – la réponse donnée à un critère pendant la visite.
 * Le libellé, les points max et le poids sont recopiés depuis la grille :
 * si la grille évolue plus tard, l'évaluation reste lisible et son score ne change pas.
 *
 * Exemple 1 – critère éliminatoire non satisfait, avec photo :
 *   { domaineCode: "EAU", critereCode: "EAU-01",
 *     libelle: "Source d'eau potable disponible toute l'année sur le site",
 *     typeReponse: "OUI_NON", valeur: "Non", points: 0, pointsMax: 1, poids: 1,
 *     eliminatoireNonSatisfait: true,
 *     observation: "Forage en panne depuis mars, eau achetée au puits voisin",
 *     fichiers: [ObjectId("photo_eau01")], saisiLe: ISODate("2026-12-08T09:42:00Z") }
 *
 * Exemple 2 – critère sans objet (service inexistant à ce niveau) :
 *   { domaineCode: "SRV", critereCode: "SRV-06", typeReponse: "OUI_NON",
 *     sansObjet: true, points: null, pointsMax: 1, poids: 1,
 *     observation: "Pas de service d'urgence prévu pour un centre de santé" }
 */
const ReponseSchema = new Schema({
  domaineCode: String,
  critereCode: { type: String, required: true },
  libelle: String,                // copie au moment de l'évaluation
  typeReponse: String,
  valeur: Schema.Types.Mixed,     // true/false, 0-3, nombre, code d'option, texte…
  sansObjet: { type: Boolean, default: false }, // exclu du calcul du score
  points: Number,
  pointsMax: Number,
  poids: Number,
  eliminatoireNonSatisfait: { type: Boolean, default: false },
  observation: String,
  fichiers: [{ type: ObjectId, ref: 'Fichier' }],
  saisiLe: Date,
  modifiePar: { type: ObjectId, ref: 'Utilisateur' },
}, { _id: false });

module.exports = ReponseSchema;
