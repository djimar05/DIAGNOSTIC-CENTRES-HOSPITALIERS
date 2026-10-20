import * as jetons from './jetons';

/**
 * Client HTTP de l'API.
 *   - ajoute l'en-tête Authorization
 *   - sur 401, rafraîchit le jeton une seule fois puis rejoue la requête
 *   - si la session ne peut pas être prolongée, efface les jetons et prévient l'application
 *   - convertit les erreurs au format de l'API ({ success: false, error: { message, details } }) en ErreurApi
 */
const BASE = import.meta.env.VITE_API_URL || '/api';

export class ErreurApi extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = 'ErreurApi';
    this.status = status;
    this.details = details;
  }
}

const ecouteursDeconnexion = new Set();

/** Appelé quand la session a expiré ou a été révoquée. Renvoie la fonction de désabonnement. */
export const surDeconnexionForcee = (ecouteur) => {
  ecouteursDeconnexion.add(ecouteur);
  return () => ecouteursDeconnexion.delete(ecouteur);
};

const lireReponse = async (reponse) => {
  if (reponse.status === 204) return null;
  const corps = await reponse.json().catch(() => null);
  if (!reponse.ok) {
    throw new ErreurApi(reponse.status, corps?.error?.message || `Erreur ${reponse.status}`, corps?.error?.details);
  }
  return corps;
};

// Le backend fait tourner le refresh token à chaque usage et révoque toutes les sessions
// s'il voit un jeton déjà utilisé. Deux rafraîchissements en parallèle (deux requêtes, ou deux
// onglets) déconnecteraient donc l'utilisateur : on les sérialise.
//   - dans l'onglet : une seule promesse partagée
//   - entre onglets : un verrou Web Locks ; le refresh token est relu une fois le verrou obtenu
let rafraichissementEnCours = null;

const avecVerrou = (fn) => (
  typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('dch-rafraichissement-jeton', fn)
    : fn()
);

export const rafraichirJetons = () => {
  if (!rafraichissementEnCours) {
    rafraichissementEnCours = avecVerrou(async () => {
      const refreshToken = jetons.lireRefreshToken();
      if (!refreshToken) throw new ErreurApi(401, 'Session expirée, veuillez vous reconnecter');
      const reponse = await fetch(`${BASE}/auth/rafraichir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const { data } = await lireReponse(reponse);
      jetons.enregistrer(data);
    })
      .catch((err) => {
        // Session refusée par le serveur → déconnexion. Une coupure réseau, elle, garde la session.
        if (err instanceof ErreurApi && (err.status === 401 || err.status === 403)) {
          jetons.effacer();
          ecouteursDeconnexion.forEach((ecouteur) => ecouteur(err));
        }
        throw err;
      })
      .finally(() => {
        rafraichissementEnCours = null;
      });
  }
  return rafraichissementEnCours;
};

/**
 * Appelle l'API. `corps` est envoyé en JSON. `authentifie: false` pour les routes publiques.
 * Renvoie le corps JSON de la réponse ({ success, data, pagination… }) ou null pour un 204.
 */
export const requete = async (chemin, { methode = 'GET', corps, authentifie = true } = {}) => {
  if (authentifie && !jetons.lireAccessToken() && jetons.lireRefreshToken()) {
    await rafraichirJetons(); // page rechargée : l'access token (en mémoire) est à redemander
  }

  const envoyer = () => {
    const token = authentifie ? jetons.lireAccessToken() : null;
    const promesse = fetch(`${BASE}${chemin}`, {
      method: methode,
      headers: {
        ...(corps !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      ...(corps !== undefined && { body: JSON.stringify(corps) }),
    });
    return { token, promesse };
  };

  let { token, promesse } = envoyer();
  let reponse = await promesse;

  if (reponse.status === 401 && authentifie && jetons.lireRefreshToken()) {
    // Si un autre appel a déjà renouvelé le jeton pendant ce temps, on rejoue simplement
    if (jetons.lireAccessToken() === token) await rafraichirJetons();
    ({ promesse } = envoyer());
    reponse = await promesse;
  }

  return lireReponse(reponse);
};

export const api = {
  get: (chemin) => requete(chemin),
  post: (chemin, corps) => requete(chemin, { methode: 'POST', corps }),
  put: (chemin, corps) => requete(chemin, { methode: 'PUT', corps }),
  patch: (chemin, corps) => requete(chemin, { methode: 'PATCH', corps }),
  delete: (chemin) => requete(chemin, { methode: 'DELETE' }),
};
