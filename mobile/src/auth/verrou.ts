import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Code PIN de l'appareil : protège l'accès à l'application (et, à terme, aux données hors ligne)
 * sans ressaisir le mot de passe. Seule une empreinte SHA-256 est gardée, dans le stockage sécurisé
 * du téléphone ; la limite d'essais est gérée par AuthProvider.
 */
export const LONGUEUR_PIN = 4;
export const ESSAIS_MAX = 5;
export const DELAI_VERROUILLAGE_MS = 5 * 60 * 1000; // en arrière-plan depuis plus de 5 min → verrouillé

const cle = (utilisateurId: string) => `dch.pin.${utilisateurId}`;
const empreinte = (utilisateurId: string, pin: string) => Crypto.digestStringAsync(
  Crypto.CryptoDigestAlgorithm.SHA256, `${utilisateurId}:${pin}`,
);

export const pinDefini = async (utilisateurId: string) => Boolean(await SecureStore.getItemAsync(cle(utilisateurId)));

export const definirPin = async (utilisateurId: string, pin: string) => {
  await SecureStore.setItemAsync(cle(utilisateurId), await empreinte(utilisateurId, pin));
};

export const verifierPin = async (utilisateurId: string, pin: string) => (
  (await SecureStore.getItemAsync(cle(utilisateurId))) === await empreinte(utilisateurId, pin)
);

export const effacerPin = (utilisateurId: string) => SecureStore.deleteItemAsync(cle(utilisateurId));

/** PIN trop simple (1111, 1234…) ? */
export const pinTropSimple = (pin: string) => /^(\d)\1+$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin);
