import { api, requete } from './client';
import * as jetons from './jetons';

/** Connexion par téléphone ou e-mail. Enregistre les jetons et renvoie l'utilisateur. */
export const connexion = async (identifiant, motDePasse) => {
  const { data } = await requete('/auth/connexion', {
    methode: 'POST', corps: { identifiant, motDePasse }, authentifie: false,
  });
  jetons.enregistrer(data);
  return data.utilisateur;
};

/** Ferme la session côté serveur (si possible) puis oublie les jetons localement. */
export const deconnexion = async () => {
  const refreshToken = jetons.lireRefreshToken();
  jetons.effacer();
  if (refreshToken) {
    await requete('/auth/deconnexion', { methode: 'POST', corps: { refreshToken }, authentifie: false })
      .catch(() => {}); // hors ligne : le jeton expirera de lui-même
  }
};

/** Profil connecté, avec affectations et rôles. */
export const moi = async () => (await api.get('/auth/moi')).data;

/** Modifie ses préférences (langue). Renvoie le profil à jour. */
export const mettreAJourMoi = async (donnees) => (await api.patch('/auth/moi', donnees)).data;

export const changerMotDePasse = (ancienMotDePasse, nouveauMotDePasse) => (
  api.patch('/auth/mot-de-passe', { ancienMotDePasse, nouveauMotDePasse })
);

export const deconnexionPartout = () => api.post('/auth/deconnexion-partout');

export const aUneSession = () => Boolean(jetons.lireRefreshToken());
