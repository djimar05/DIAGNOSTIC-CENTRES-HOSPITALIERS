const fs = require('fs/promises');
const { createReadStream } = require('fs');
const path = require('path');
const config = require('../config/stockage');

/**
 * Accès au stockage des fichiers, indépendant du support (disque local ou MinIO / S3).
 * Les clés sont toujours fabriquées par le serveur (jamais à partir d'une saisie), par ex.
 * « evaluations/<id>/<critere>/<uuid>.jpg ».
 *
 *   enregistrer(cle, buffer, mime)   → void
 *   lire(cle)                        → flux lisible
 *   supprimer(cle)                   → void (sans erreur si absent)
 */

const piloteLocal = () => {
  const chemin = (cle) => {
    const complet = path.resolve(config.dossier, cle);
    // Garde-fou : la clé ne doit jamais sortir du dossier de stockage
    if (!complet.startsWith(path.resolve(config.dossier) + path.sep)) throw new Error(`Clé de stockage invalide : ${cle}`);
    return complet;
  };
  return {
    nom: 'local',
    description: `disque local ${config.dossier}`,
    async preparer() {
      await fs.mkdir(config.dossier, { recursive: true });
      return 'dossier prêt';
    },
    async enregistrer(cle, buffer) {
      const fichier = chemin(cle);
      await fs.mkdir(path.dirname(fichier), { recursive: true });
      await fs.writeFile(fichier, buffer);
    },
    async lire(cle) {
      const fichier = chemin(cle);
      await fs.access(fichier);
      return createReadStream(fichier);
    },
    async supprimer(cle) {
      await fs.rm(chemin(cle), { force: true });
    },
  };
};

const piloteS3 = () => {
  const Minio = require('minio');
  const { bucket, region, ...connexion } = config.s3;
  const client = new Minio.Client(connexion);
  // Vérifié une seule fois (au démarrage, sinon au premier envoi) ; refait après un échec
  let bucketPret = null;
  const assurerBucket = () => {
    if (!bucketPret) {
      bucketPret = client.bucketExists(bucket)
        .then(async (existe) => {
          if (existe) return `bucket « ${bucket} » trouvé`;
          await client.makeBucket(bucket, region);
          return `bucket « ${bucket} » créé (région ${region})`;
        })
        .catch((err) => { bucketPret = null; throw err; });
    }
    return bucketPret;
  };
  return {
    nom: 's3',
    description: `MinIO / S3 ${connexion.useSSL ? 'https' : 'http'}://${connexion.endPoint}:${connexion.port}`,
    preparer: assurerBucket,
    async enregistrer(cle, buffer, mime) {
      await assurerBucket();
      await client.putObject(bucket, cle, buffer, buffer.length, { 'Content-Type': mime });
    },
    async lire(cle) {
      return client.getObject(bucket, cle);
    },
    async supprimer(cle) {
      await client.removeObject(bucket, cle);
    },
  };
};

let pilote = null;
const stockage = () => {
  if (!pilote) pilote = config.pilote === 's3' ? piloteS3() : piloteLocal();
  return pilote;
};

/**
 * Au démarrage du serveur : vérifie le stockage et crée le bucket (ou le dossier) s'il n'existe pas.
 * Ne bloque pas le démarrage : en cas d'échec (MinIO arrêté, identifiants faux), l'erreur est signalée
 * dans les logs, le reste de l'API fonctionne, et la création sera retentée au premier envoi de fichier.
 */
const verifierAuDemarrage = async () => {
  const s = stockage();
  try {
    console.log(`[stockage] ${s.description} : ${await s.preparer()}`);
    return true;
  } catch (err) {
    console.error(`[stockage] ${s.description} : INACCESSIBLE (${err.code || err.message}). `
      + 'Les envois de photos échoueront tant que le stockage ne répond pas ; vérifiez STOCKAGE et les variables MINIO_*.');
    return false;
  }
};

module.exports = {
  verifierAuDemarrage,
  enregistrer: (...args) => stockage().enregistrer(...args),
  lire: (...args) => stockage().lire(...args),
  supprimer: (...args) => stockage().supprimer(...args),
  nomPilote: () => stockage().nom,
};
