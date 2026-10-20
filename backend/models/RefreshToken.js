const mongoose = require('mongoose');

const { Schema } = mongoose;
const opts = { timestamps: true }; // ajoute createdAt et updatedAt à chaque document

/**
 * REFRESH_TOKEN – jeton de session longue durée (un par appareil connecté).
 * Seule l'empreinte SHA-256 du jeton est stockée : une fuite de la base ne permet pas
 * de réutiliser les sessions. Le jeton est remplacé à chaque rafraîchissement (rotation) ;
 * présenter un jeton déjà révoqué révoque toutes les sessions de l'utilisateur.
 *
 * Exemple :
 *   {
 *     utilisateur: ObjectId("utilisateur_ali"), tokenHash: "9f86d08…",
 *     expireLe: ISODate("2026-11-19"), appareil: "Mozilla/5.0 (Android 14)…", revoqueLe: null
 *   }
 */
const RefreshTokenSchema = new Schema({
  utilisateur: { type: Schema.Types.ObjectId, ref: 'Utilisateur', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expireLe: { type: Date, required: true },
  revoqueLe: Date,
  appareil: String, // user-agent du client, pour identifier la session
}, opts);

// MongoDB supprime automatiquement les jetons expirés
RefreshTokenSchema.index({ expireLe: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', RefreshTokenSchema);
