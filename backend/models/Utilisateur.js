const mongoose = require('mongoose');

const { Schema } = mongoose;
const opts = { timestamps: true }; // ajoute createdAt et updatedAt à chaque document

/**
 * UTILISATEUR – toute personne qui se connecte (web ou mobile).
 * Ne contient PAS les droits : ceux-ci sont dans Affectation, car une même personne
 * peut avoir plusieurs rôles (ex. évaluatrice dans une campagne, superviseure dans une autre).
 *
 * Exemple 1 – un évaluateur de terrain :
 *   {
 *     nom: "Mahamat", prenom: "Ali", telephone: "+235 66 00 00 01",
 *     fonction: "Infirmier diplômé d'État", langue: "fr", actif: true
 *   }
 *
 * Exemple 2 – une coordonnatrice de district qui se connecte avec son e-mail :
 *   {
 *     nom: "Ngarlem", prenom: "Esther", telephone: "+235 66 00 00 02",
 *     email: "e.ngarlem@exemple.td", fonction: "Médecin-chef de district", langue: "fr"
 *   }
 */
const UtilisateurSchema = new Schema({
  nom: { type: String, required: true },
  prenom: String,
  telephone: { type: String, required: true, unique: true }, // identifiant de connexion principal
  email: { type: String, lowercase: true, unique: true, sparse: true },
  fonction: String,            // ex. médecin-chef de district
  motDePasseHash: { type: String, required: true, select: false }, // jamais renvoyé par défaut
  // true quand le mot de passe a été fixé par un administrateur (création, réinitialisation) :
  // l'utilisateur doit le changer avant d'accéder au reste de l'API.
  motDePasseAChanger: { type: Boolean, default: false },
  langue: { type: String, enum: ['fr', 'ar'], default: 'fr' },
  actif: { type: Boolean, default: true },
  derniereConnexion: Date,
}, opts);

// Ne jamais exposer le hash du mot de passe dans les réponses JSON
UtilisateurSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.motDePasseHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Utilisateur', UtilisateurSchema);
