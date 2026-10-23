const path = require('path');

/**
 * Stockage des photos et documents de preuve (hors de la base : seules les métadonnées y sont).
 *   STOCKAGE=local (défaut)  fichiers sur le disque du serveur, dans STOCKAGE_DOSSIER
 *   STOCKAGE=s3              MinIO ou tout stockage compatible S3 :
 *     MINIO_ENDPOINT, MINIO_PORT, MINIO_USE_SSL (true/false), MINIO_ACCESS_KEY, MINIO_SECRET_KEY,
 *     MINIO_BUCKET (créé au démarrage s'il n'existe pas), MINIO_REGION
 * Les anciens noms S3_* (S3_ENDPOINT, S3_PORT…) sont encore acceptés.
 */
const env = (nom) => process.env[`MINIO_${nom}`] ?? process.env[`S3_${nom}`];

module.exports = {
  pilote: process.env.STOCKAGE || 'local',
  dossier: process.env.STOCKAGE_DOSSIER || path.join(__dirname, '..', 'stockage'),
  s3: {
    endPoint: env('ENDPOINT') || 'localhost',
    port: parseInt(env('PORT'), 10) || 9000,
    useSSL: (env('USE_SSL') ?? env('SSL')) === 'true',
    accessKey: env('ACCESS_KEY') || '',
    secretKey: env('SECRET_KEY') || '',
    bucket: env('BUCKET') || 'diagnostic-preuves',
    region: env('REGION') || 'us-east-1',
  },
  tailleMaxOctets: 10 * 1024 * 1024,
};
