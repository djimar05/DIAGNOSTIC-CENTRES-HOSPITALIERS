const mongoose = require('mongoose');
const DomaineSchema = require('./Domaine');
const { NIVEAUX_CENTRE, CLASSES } = require('./enumUtils');

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;
const opts = { timestamps: true }; // ajoute createdAt et updatedAt à chaque document

// Statuts à partir desquels le contenu de la grille est figé.
const STATUTS_FIGES = ['PUBLIEE', 'ARCHIVEE'];

/**
 * GRILLE – le questionnaire complet, versionné.
 * Une fois PUBLIEE, une grille n'est plus modifiée : on crée la version suivante.
 * Ainsi, deux évaluations faites avec la même version sont toujours comparables.
 * Seul changement autorisé sur une grille publiée : passer son statut à ARCHIVEE.
 *
 * Classes : `min` inclus, `max` exclu (sauf pour la classe qui finit à 100).
 *
 * Exemple 1 – grille des centres de santé, version 1 publiée :
 *   { code: "GRILLE-CS", nom: "Grille centres et postes de santé", version: 1,
 *     niveauxCibles: ["CENTRE_SANTE", "POSTE_SANTE"], statut: "PUBLIEE",
 *     publieeLe: ISODate("2026-11-15"), domaines: [ ...10 domaines... ] }
 *
 * Exemple 2 – la version 2 en préparation (un critère ajouté) :
 *   { code: "GRILLE-CS", nom: "Grille centres et postes de santé", version: 2,
 *     niveauxCibles: ["CENTRE_SANTE", "POSTE_SANTE"], statut: "BROUILLON", domaines: [ ... ] }
 */
const GrilleSchema = new Schema({
  code: { type: String, required: true },      // ex. GRILLE-CS
  nom: { type: String, required: true },
  version: { type: Number, required: true },
  niveauxCibles: [{ type: String, enum: NIVEAUX_CENTRE }],
  statut: { type: String, enum: ['BROUILLON', ...STATUTS_FIGES], default: 'BROUILLON' },
  domaines: [DomaineSchema],
  classes: {
    type: [{ classe: { type: String, enum: CLASSES }, min: Number, max: Number }],
    default: [
      { classe: 'A', min: 80, max: 100 }, { classe: 'B', min: 60, max: 80 },
      { classe: 'C', min: 40, max: 60 }, { classe: 'D', min: 0, max: 40 },
    ],
  },
  publieeLe: Date,
  creePar: { type: ObjectId, ref: 'Utilisateur' },
}, opts);
GrilleSchema.index({ code: 1, version: 1 }, { unique: true });

// Cohérence du contenu : codes uniques, conditions valides, poids = 100 à la publication.
GrilleSchema.pre('validate', function () {
  const codesDomaines = new Set();
  const codesCriteres = new Set();
  for (const domaine of this.domaines) {
    if (codesDomaines.has(domaine.code)) {
      this.invalidate('domaines', `Code de domaine en double : ${domaine.code}`);
    }
    codesDomaines.add(domaine.code);
    for (const critere of domaine.criteres) {
      if (codesCriteres.has(critere.code)) {
        this.invalidate('domaines', `Code de critère en double : ${critere.code}`);
      }
      codesCriteres.add(critere.code);
    }
  }

  for (const domaine of this.domaines) {
    for (const critere of domaine.criteres) {
      const cible = critere.condition && critere.condition.critere;
      if (cible && !codesCriteres.has(cible)) {
        this.invalidate('domaines', `Le critère ${critere.code} dépend d'un critère inconnu : ${cible}`);
      }
    }
  }

  if (this.statut === 'PUBLIEE') {
    const totalPoids = this.domaines.reduce((somme, d) => somme + d.poids, 0);
    if (Math.abs(totalPoids - 100) > 0.01) {
      this.invalidate('domaines', `La somme des poids des domaines doit faire 100 (actuellement ${totalPoids})`);
    }
  }
});

// Grille figée : on mémorise le statut lu en base pour savoir si elle l'était déjà.
GrilleSchema.post('init', function () {
  this.$locals.statutInitial = this.statut;
});

function verifierChangementGrilleFigee(statutInitial, champsModifies, nouveauStatut) {
  if (!STATUTS_FIGES.includes(statutInitial)) return;
  const autres = champsModifies.filter((c) => !['statut', 'updatedAt'].includes(c));
  if (autres.length > 0 || (champsModifies.includes('statut') && nouveauStatut !== 'ARCHIVEE')) {
    const libelle = statutInitial === 'PUBLIEE' ? 'publiée' : 'archivée';
    throw new Error(`Grille ${libelle} : elle ne peut plus être modifiée, créez une nouvelle version`);
  }
}

GrilleSchema.pre('save', function () {
  if (this.isNew) return;
  const champs = this.modifiedPaths({ includeChildren: false }).map((p) => p.split('.')[0]);
  verifierChangementGrilleFigee(this.$locals.statutInitial, [...new Set(champs)], this.statut);
});

GrilleSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace'], async function () {
  const update = this.getUpdate() || {};
  const champs = new Set();
  let nouveauStatut;
  for (const [cle, valeur] of Object.entries(update)) {
    if (cle === '$setOnInsert') continue;
    if (cle.startsWith('$')) {
      for (const chemin of Object.keys(valeur || {})) champs.add(chemin.split('.')[0]);
      if (valeur && valeur.statut !== undefined) nouveauStatut = valeur.statut;
    } else {
      champs.add(cle.split('.')[0]);
      if (cle === 'statut') nouveauStatut = valeur;
    }
  }
  const figee = await this.model.findOne({ ...this.getFilter(), statut: { $in: STATUTS_FIGES } })
    .select('statut').lean();
  if (figee) verifierChangementGrilleFigee(figee.statut, [...champs], nouveauStatut);
});

module.exports = mongoose.model('Grille', GrilleSchema);
