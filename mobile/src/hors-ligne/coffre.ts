import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils.js';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

/**
 * Coffre local chiffré du téléphone : réponses et photos pas encore reçues par le serveur.
 *   - clé aléatoire de 256 bits, générée sur l'appareil et gardée dans le stockage sécurisé
 *     (Keystore Android / Keychain iOS) : elle ne quitte jamais le téléphone
 *   - chaque fichier est chiffré et authentifié (XChaCha20-Poly1305, nonce aléatoire de 24 octets)
 * Un fichier volé ou modifié hors de l'application est illisible.
 */

const CLE_SECURE_STORE = 'dch.cleCoffre';
const dossier = new Directory(Paths.document, 'coffre');
let cle: Uint8Array | null = null;

const versHex = (b: Uint8Array) => Array.from(b, (o) => o.toString(16).padStart(2, '0')).join('');
const depuisHex = (h: string) => Uint8Array.from(h.match(/.{2}/g) || [], (o) => parseInt(o, 16));

const obtenirCle = async () => {
  if (cle) return cle;
  let hex = await SecureStore.getItemAsync(CLE_SECURE_STORE);
  if (!hex) {
    hex = versHex(Crypto.getRandomBytes(32));
    await SecureStore.setItemAsync(CLE_SECURE_STORE, hex);
  }
  cle = depuisHex(hex);
  return cle;
};

const assurerDossier = () => { if (!dossier.exists) dossier.create(); };
const fichier = (nom: string) => new File(dossier, nom);

/** Chiffre puis écrit des octets dans le coffre. */
export const ecrire = async (nom: string, donnees: Uint8Array) => {
  const nonce = Crypto.getRandomBytes(24);
  const chiffre = xchacha20poly1305(await obtenirCle(), nonce).encrypt(donnees);
  const contenu = new Uint8Array(nonce.length + chiffre.length);
  contenu.set(nonce);
  contenu.set(chiffre, nonce.length);
  assurerDossier();
  const f = fichier(nom);
  if (!f.exists) f.create();
  f.write(contenu);
};

/** Lit et déchiffre un fichier du coffre (null s'il n'existe pas). Lève une erreur s'il a été altéré. */
export const lire = async (nom: string): Promise<Uint8Array | null> => {
  const f = fichier(nom);
  if (!f.exists) return null;
  const contenu = await f.bytes();
  return xchacha20poly1305(await obtenirCle(), contenu.slice(0, 24)).decrypt(contenu.slice(24));
};

export const ecrireJson = (nom: string, valeur: unknown) => ecrire(nom, utf8ToBytes(JSON.stringify(valeur)));

export const lireJson = async <T>(nom: string): Promise<T | null> => {
  const octets = await lire(nom);
  return octets ? (JSON.parse(bytesToUtf8(octets)) as T) : null;
};

export const supprimer = (nom: string) => {
  const f = fichier(nom);
  if (f.exists) f.delete();
};

/** Efface tout le coffre et sa clé (déconnexion). */
export const toutEffacer = async () => {
  if (dossier.exists) dossier.delete();
  cle = null;
  await SecureStore.deleteItemAsync(CLE_SECURE_STORE);
};
