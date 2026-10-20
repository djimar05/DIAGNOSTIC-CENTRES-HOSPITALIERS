const mongoose = require('mongoose');
const ReponseSchema = require('./Reponse');
const ScoreDomaineSchema = require('./ScoreDomaine');
const GpsSchema = require('./Gps');
const { STATUTS_EVALUATION, CLASSES } = require('./enumUtils');

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;
const opts = { timestamps: true }; // ajoute createdAt et updatedAt à chaque document

/**
 * EVALUATION – le cœur de l'application : toutes les réponses d'une visite, les scores
 * calculés et le suivi de validation.
 * Elle est créée sur le téléphone (clientId) puis synchronisée ; `syncVersion` évite
 * qu'un envoi ancien écrase une version plus récente.
 *
 * Exemple 1 – évaluation en cours sur le terrain (pas encore de score) :
 *   {
 *     clientId: "3f6c2a9e-8b1d-4c55-9a0e-1d2b3c4d5e6f",
 *     mission: ObjectId("mission_cs_nord"), campagne: ObjectId("camp_2026_region_a"),
 *     centre: ObjectId("centre_cs_quartier_nord"), grille: ObjectId("grille_cs_v1"), grilleVersion: 1,
 *     statut: "EN_COURS", debut: ISODate("2026-12-08T08:30:00Z"),
 *     personnesRencontrees: [{ nom: "[Nom]", fonction: "Major du centre" }],
 *     reponses: [ ...7 réponses sur 59... ], evaluePar: [ObjectId("user_ali")], syncVersion: 3
 *   }
 *
 * Exemple 2 – évaluation validée, avec scores :
 *   {
 *     mission: ObjectId("mission_cs_nord"), centre: ObjectId("centre_cs_quartier_nord"),
 *     statut: "VALIDEE", reponses: [ ...59 réponses... ],
 *     scores: { domaines: [ ...10 scores... ], global: 31.5, classe: "D",
 *               calculeLe: ISODate("2026-12-09T10:00:00Z") },
 *     soumisLe: ISODate("2026-12-08T16:10:00Z"),
 *     validation: { par: ObjectId("user_esther"), le: ISODate("2026-12-09T10:00:00Z"),
 *                   decision: "VALIDEE" },
 *     historiqueStatuts: [
 *       { statut: "SOUMISE",    par: ObjectId("user_ali"),    le: ISODate("2026-12-08T16:10:00Z") },
 *       { statut: "A_CORRIGER", par: ObjectId("user_esther"), le: ISODate("2026-12-08T18:00:00Z"),
 *         commentaire: "Photo manquante pour HYG-02" },
 *       { statut: "SOUMISE",    par: ObjectId("user_ali"),    le: ISODate("2026-12-09T08:20:00Z") },
 *       { statut: "VALIDEE",    par: ObjectId("user_esther"), le: ISODate("2026-12-09T10:00:00Z") }
 *     ]
 *   }
 */
const EvaluationSchema = new Schema({
  clientId: { type: String, unique: true, sparse: true }, // UUID créé hors ligne
  mission: { type: ObjectId, ref: 'Mission', required: true, index: true },
  campagne: { type: ObjectId, ref: 'Campagne', required: true },
  centre: { type: ObjectId, ref: 'Centre', required: true, index: true },
  zoneAncetres: [{ type: ObjectId, ref: 'Zone' }],       // copie, pour filtrer par région/district
  grille: { type: ObjectId, ref: 'Grille', required: true },
  grilleVersion: Number,
  statut: { type: String, enum: STATUTS_EVALUATION, default: 'PLANIFIEE' },
  debut: Date,
  fin: Date,
  gpsVisite: GpsSchema,                                    // prouve que la visite a eu lieu sur place
  personnesRencontrees: [{ nom: String, fonction: String }],
  reponses: [ReponseSchema],
  scores: {
    domaines: [ScoreDomaineSchema],
    global: Number,
    classe: { type: String, enum: CLASSES },
    calculeLe: Date,
  },
  observationsGenerales: String,
  evaluePar: [{ type: ObjectId, ref: 'Utilisateur' }],
  soumisLe: Date,
  validation: {
    par: { type: ObjectId, ref: 'Utilisateur' },
    le: Date,
    decision: { type: String, enum: ['VALIDEE', 'A_CORRIGER'] },
    motif: String,
  },
  historiqueStatuts: [{
    statut: { type: String, enum: STATUTS_EVALUATION, required: true },
    par: { type: ObjectId, ref: 'Utilisateur' },
    le: Date,
    commentaire: String,
  }],
  syncVersion: { type: Number, default: 0 }, // incrémenté à chaque synchronisation
}, opts);
EvaluationSchema.index({ zoneAncetres: 1, statut: 1 });
EvaluationSchema.index({ campagne: 1, 'scores.classe': 1 });

EvaluationSchema.pre('validate', function () {
  if (this.debut && this.fin && this.fin < this.debut) {
    this.invalidate('fin', 'fin doit être postérieure à debut');
  }
});

module.exports = mongoose.model('Evaluation', EvaluationSchema);
