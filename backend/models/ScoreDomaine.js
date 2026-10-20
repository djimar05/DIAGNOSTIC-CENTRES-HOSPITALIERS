const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * SCORE_DOMAINE – le résultat calculé pour un domaine (sur 100).
 *
 * Exemple 1 – domaine plafonné à cause d'un critère éliminatoire :
 *   { domaineCode: "EAU", nom: "Eau, électricité, assainissement", poids: 10,
 *     score: 40, plafonne: true, criteresRepondus: 6, criteresTotal: 6 }
 *   (score brut 90, ramené à 40 car EAU-01 = Non)
 *
 * Exemple 2 – domaine normal :
 *   { domaineCode: "INF", nom: "Infrastructures", poids: 10,
 *     score: 50, plafonne: false, criteresRepondus: 6, criteresTotal: 6 }
 */
const ScoreDomaineSchema = new Schema({
  domaineCode: String,
  nom: String,
  poids: Number,
  score: Number,               // sur 100
  plafonne: Boolean,
  criteresRepondus: Number,
  criteresTotal: Number,
}, { _id: false });

module.exports = ScoreDomaineSchema;
