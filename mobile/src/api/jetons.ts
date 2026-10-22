import * as SecureStore from 'expo-secure-store';

/**
 * Jetons de session.
 *   - access token  : en mémoire (redemandé au démarrage avec le refresh token)
 *   - refresh token : stockage sécurisé du téléphone (Keystore Android / Keychain iOS), chiffré
 */
const CLE_REFRESH = 'dch.refreshToken';

let accessToken: string | null = null;

export const lireAccessToken = () => accessToken;

export const lireRefreshToken = () => SecureStore.getItemAsync(CLE_REFRESH);

export const enregistrer = async (jetons: { accessToken: string; refreshToken: string }) => {
  accessToken = jetons.accessToken;
  await SecureStore.setItemAsync(CLE_REFRESH, jetons.refreshToken);
};

export const effacer = async () => {
  accessToken = null;
  await SecureStore.deleteItemAsync(CLE_REFRESH);
};
