const mongoose = require('mongoose');

const { Schema } = mongoose;

// ───────────────────────────── Sous-schémas ─────────────────────────────

/**
 * GpsSchema – position géographique au format GeoJSON (compatible avec les requêtes « près de… »).
 * Attention : l'ordre est [longitude, latitude].
 *
 * Exemple : { type: "Point", coordinates: [15.0444, 12.1348], precisionMetres: 8 }
 */
const GpsSchema = new Schema({
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { // [longitude, latitude] – obligatoire, sinon l'index 2dsphere refuse le document
    type: [Number],
    required: true,
    validate: {
      validator: (c) => Array.isArray(c) && c.length === 2
        && c[0] >= -180 && c[0] <= 180 && c[1] >= -90 && c[1] <= 90,
      message: 'coordinates doit valoir [longitude (-180..180), latitude (-90..90)]',
    },
  },
  precisionMetres: Number,          // précision donnée par le téléphone
}, { _id: false });

module.exports = GpsSchema;
