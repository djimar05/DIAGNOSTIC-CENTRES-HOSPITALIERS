const mongoose = require('mongoose');
const CritereSchema = require('./Critere');

const { Schema } = mongoose;

/**
 * DOMAINE – un groupe de critères (ex. « Hygiène »), avec son poids dans le score global.
 * La somme des poids des domaines d'une grille doit faire 100 (vérifié par Grille à la publication).
 *
 * Exemple 1 :
 *   { code: "EAU", nom: "Eau, électricité, assainissement", poids: 10,
 *     plafondSiEliminatoire: 40, ordre: 2, criteres: [ ...6 critères... ] }
 *
 * Exemple 2 :
 *   { code: "HYG", nom: "Hygiène et prévention des infections", poids: 10,
 *     plafondSiEliminatoire: 40, ordre: 7, criteres: [ ...6 critères... ] }
 */
const DomaineSchema = new Schema({
  code: { type: String, required: true },      // ex. EAU
  nom: { type: String, required: true },
  poids: { type: Number, required: true, min: 0, max: 100 }, // en % du score global
  plafondSiEliminatoire: { type: Number, default: 40 },
  ordre: Number,
  criteres: [CritereSchema],
});

module.exports = DomaineSchema;
