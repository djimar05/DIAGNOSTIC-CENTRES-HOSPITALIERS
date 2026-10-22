import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as authApi from '@/api/auth';
import { ErreurApi, surDeconnexionForcee } from '@/api/client';
import type { Profil, Role } from '@/api/types';

/**
 * Session de l'utilisateur sur le téléphone.
 *   chargement  : au démarrage, on cherche une session enregistrée
 *   deconnecte  : écran de connexion
 *   hors-ligne  : session enregistrée mais serveur injoignable (on propose de réessayer)
 *   connecte    : profil chargé
 */
type Etat = 'chargement' | 'deconnecte' | 'hors-ligne' | 'connecte';

type ValeurAuth = {
  etat: Etat;
  utilisateur: Profil | null;
  connecter: (identifiant: string, motDePasse: string) => Promise<void>;
  deconnecter: () => Promise<void>;
  changerMotDePasse: (ancien: string, nouveau: string) => Promise<void>;
  recharger: () => Promise<void>;
  aLeRole: (...roles: Role[]) => boolean;
};

const AuthContext = createContext<ValeurAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [etat, setEtat] = useState<Etat>('chargement');
  const [utilisateur, setUtilisateur] = useState<Profil | null>(null);

  const chargerProfil = useCallback(async () => {
    try {
      setUtilisateur(await authApi.moi());
      setEtat('connecte');
    } catch (err) {
      // Session refusée → reconnexion ; coupure réseau → on garde la session
      if (err instanceof ErreurApi && (err.status === 401 || err.status === 403)) {
        setUtilisateur(null);
        setEtat('deconnecte');
      } else {
        setEtat('hors-ligne');
      }
    }
  }, []);

  // Au démarrage : reprendre la session enregistrée, s'il y en a une
  useEffect(() => {
    (async () => {
      if (await authApi.aUneSession()) await chargerProfil();
      else setEtat('deconnecte');
    })();
  }, [chargerProfil]);

  // Session expirée ou révoquée (détectée par le client API)
  useEffect(() => surDeconnexionForcee(() => {
    setUtilisateur(null);
    setEtat('deconnecte');
    queryClient.clear();
  }), [queryClient]);

  const connecter = useCallback(async (identifiant: string, motDePasse: string) => {
    await authApi.connexion(identifiant, motDePasse);
    await chargerProfil();
  }, [chargerProfil]);

  const deconnecter = useCallback(async () => {
    await authApi.deconnexion();
    queryClient.clear();
    setUtilisateur(null);
    setEtat('deconnecte');
  }, [queryClient]);

  // Le serveur ferme toutes les sessions après un changement : on se reconnecte avec le nouveau mot de passe
  const changerMotDePasse = useCallback(async (ancien: string, nouveau: string) => {
    if (!utilisateur) return;
    await authApi.changerMotDePasse(ancien, nouveau);
    await connecter(utilisateur.telephone || '', nouveau);
  }, [utilisateur, connecter]);

  const valeur = useMemo<ValeurAuth>(() => ({
    etat,
    utilisateur,
    connecter,
    deconnecter,
    changerMotDePasse,
    recharger: chargerProfil,
    aLeRole: (...roles) => Boolean(utilisateur?.roles.some((r) => roles.includes(r))),
  }), [etat, utilisateur, connecter, deconnecter, changerMotDePasse, chargerProfil]);

  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexte = useContext(AuthContext);
  if (!contexte) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return contexte;
}
