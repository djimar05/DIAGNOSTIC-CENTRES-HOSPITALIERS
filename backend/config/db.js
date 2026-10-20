const mongoose = require('mongoose');

/**
 * Connexion à MongoDB. L'URI est configurable via la variable
 * d'environnement MONGODB_URI (par défaut : instance locale).
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/diagnostic-centres-db';
  await mongoose.connect(uri);
  console.log(`MongoDB connecté : ${mongoose.connection.host}/${mongoose.connection.name}`);
};

module.exports = connectDB;
