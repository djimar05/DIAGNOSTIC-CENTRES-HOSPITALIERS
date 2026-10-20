// Sans caractères ambigus (0/O, 1/l/I) : le mot de passe temporaire est souvent dicté par téléphone.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Mot de passe temporaire aléatoire (générateur cryptographique du navigateur). */
export const genererMotDePasse = (longueur = 10) => {
  const octets = crypto.getRandomValues(new Uint32Array(longueur));
  return Array.from(octets, (n) => ALPHABET[n % ALPHABET.length]).join('');
};
