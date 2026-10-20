/**
 * Stockage des jetons d'authentification.
 *   - access token  : en mémoire uniquement (perdu au rechargement, redemandé avec le refresh token)
 *   - refresh token : dans localStorage, pour rester connecté entre deux visites
 * Les accès à localStorage sont protégés : navigation privée ou stockage bloqué ne doivent pas planter l'application.
 */
const CLE_REFRESH = 'dch.refreshToken';

let accessToken = null;

export const lireAccessToken = () => accessToken;

export const lireRefreshToken = () => {
  try {
    return localStorage.getItem(CLE_REFRESH);
  } catch {
    return null;
  }
};

/** Enregistre la paire de jetons renvoyée par /auth/connexion ou /auth/rafraichir. */
export const enregistrer = ({ accessToken: acces, refreshToken }) => {
  accessToken = acces;
  try {
    localStorage.setItem(CLE_REFRESH, refreshToken);
  } catch {
    // stockage indisponible : la session durera jusqu'au rechargement de la page
  }
};

export const effacer = () => {
  accessToken = null;
  try {
    localStorage.removeItem(CLE_REFRESH);
  } catch {
    // rien à faire
  }
};
