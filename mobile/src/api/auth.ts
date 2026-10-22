import { api, requete, type Reponse } from './client';
import * as jetons from './jetons';
import type { Profil, Utilisateur } from './types';

type ReponseConnexion = { accessToken: string; refreshToken: string; utilisateur: Utilisateur };

/** Connexion par téléphone ou e-mail ; enregistre les jetons. */
export const connexion = async (identifiant: string, motDePasse: string) => {
  const { data } = await requete<Reponse<ReponseConnexion>>('/auth/connexion', {
    methode: 'POST', corps: { identifiant, motDePasse }, authentifie: false,
  });
  await jetons.enregistrer(data);
  return data.utilisateur;
};

/** Ferme la session côté serveur si possible, puis oublie les jetons du téléphone. */
export const deconnexion = async () => {
  const refreshToken = await jetons.lireRefreshToken();
  await jetons.effacer();
  if (refreshToken) {
    await requete('/auth/deconnexion', { methode: 'POST', corps: { refreshToken }, authentifie: false }).catch(() => {});
  }
};

export const moi = async () => (await api.get<Profil>('/auth/moi')).data;

export const changerMotDePasse = (ancienMotDePasse: string, nouveauMotDePasse: string) => (
  api.patch('/auth/mot-de-passe', { ancienMotDePasse, nouveauMotDePasse })
);

export const aUneSession = async () => Boolean(await jetons.lireRefreshToken());
