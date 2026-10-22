import { API_URL } from '@/config';
import * as jetons from './jetons';

/**
 * Client HTTP de l'API (même comportement que le client web) :
 *   - ajoute l'en-tête Authorization
 *   - sur 401, rafraîchit le jeton une seule fois puis rejoue la requête
 *   - si la session est refusée par le serveur, efface les jetons et prévient l'application
 *   - une coupure réseau ne déconnecte pas (le terrain a souvent un réseau instable)
 */

export class ErreurApi extends Error {
  status: number;
  details: string[] | null;

  constructor(status: number, message: string, details: string[] | null = null) {
    super(message);
    this.name = 'ErreurApi';
    this.status = status;
    this.details = details;
  }
}

/** Réponse standard de l'API : { success, data, pagination?, message? }. */
export type Reponse<T> = { success: boolean; data: T; message?: string };

type Ecouteur = (erreur: ErreurApi) => void;
const ecouteursDeconnexion = new Set<Ecouteur>();

/** Appelé quand la session a expiré ou a été révoquée. Renvoie la fonction de désabonnement. */
export const surDeconnexionForcee = (ecouteur: Ecouteur) => {
  ecouteursDeconnexion.add(ecouteur);
  return () => { ecouteursDeconnexion.delete(ecouteur); };
};

const lireReponse = async <T>(reponse: Response): Promise<T> => {
  if (reponse.status === 204) return null as T;
  const corps = await reponse.json().catch(() => null);
  if (!reponse.ok) {
    throw new ErreurApi(reponse.status, corps?.error?.message || `Erreur ${reponse.status}`, corps?.error?.details);
  }
  return corps as T;
};

// Le backend fait tourner le refresh token et révoque toutes les sessions s'il voit un jeton
// réutilisé : un seul rafraîchissement à la fois (promesse partagée).
let rafraichissementEnCours: Promise<void> | null = null;

export const rafraichirJetons = () => {
  if (!rafraichissementEnCours) {
    rafraichissementEnCours = (async () => {
      const refreshToken = await jetons.lireRefreshToken();
      if (!refreshToken) throw new ErreurApi(401, 'Session expirée, veuillez vous reconnecter');
      const reponse = await fetch(`${API_URL}/auth/rafraichir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const { data } = await lireReponse<Reponse<{ accessToken: string; refreshToken: string }>>(reponse);
      await jetons.enregistrer(data);
    })()
      .catch(async (err) => {
        if (err instanceof ErreurApi && (err.status === 401 || err.status === 403)) {
          await jetons.effacer();
          ecouteursDeconnexion.forEach((ecouteur) => ecouteur(err));
        }
        throw err;
      })
      .finally(() => { rafraichissementEnCours = null; });
  }
  return rafraichissementEnCours;
};

type Options = { methode?: string; corps?: unknown; authentifie?: boolean };

/** Appelle l'API ; `corps` est envoyé en JSON. Renvoie le corps JSON de la réponse. */
export const requete = async <T>(chemin: string, { methode = 'GET', corps, authentifie = true }: Options = {}): Promise<T> => {
  if (authentifie && !jetons.lireAccessToken() && await jetons.lireRefreshToken()) {
    await rafraichirJetons(); // application relancée : l'access token (en mémoire) est à redemander
  }

  const envoyer = () => {
    const token = authentifie ? jetons.lireAccessToken() : null;
    const headers: Record<string, string> = {};
    if (corps !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    return {
      token,
      promesse: fetch(`${API_URL}${chemin}`, {
        method: methode, headers, ...(corps !== undefined && { body: JSON.stringify(corps) }),
      }),
    };
  };

  let { token, promesse } = envoyer();
  let reponse = await promesse;

  if (reponse.status === 401 && authentifie && await jetons.lireRefreshToken()) {
    // Si un autre appel a déjà renouvelé le jeton entre-temps, on rejoue simplement
    if (jetons.lireAccessToken() === token) await rafraichirJetons();
    ({ promesse } = envoyer());
    reponse = await promesse;
  }

  return lireReponse<T>(reponse);
};

export const api = {
  get: <T>(chemin: string) => requete<Reponse<T>>(chemin),
  post: <T>(chemin: string, corps?: unknown) => requete<Reponse<T>>(chemin, { methode: 'POST', corps }),
  patch: <T>(chemin: string, corps?: unknown) => requete<Reponse<T>>(chemin, { methode: 'PATCH', corps }),
};

/** Message lisible pour l'utilisateur (erreur de l'API ou coupure réseau). */
export const messageErreur = (err: unknown) => {
  if (err instanceof ErreurApi) return err.details?.length ? `${err.message} : ${err.details.join(', ')}` : err.message;
  return `Serveur injoignable (${API_URL}). Vérifiez votre connexion et que le téléphone est sur le même réseau que le serveur.`;
};
