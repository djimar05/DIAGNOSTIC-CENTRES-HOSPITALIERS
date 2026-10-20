import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import * as authApi from '../api/auth';
import { surDeconnexionForcee } from '../api/client';

const AuthContext = createContext(null);
const CLE_MOI = ['moi'];

/**
 * Session de l'utilisateur : profil (/auth/moi), connexion, déconnexion, rôles.
 * La présence d'un refresh token suffit à tenter de restaurer la session au chargement.
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState(authApi.aUneSession);

  const { data: utilisateur, isLoading, error, refetch } = useQuery({
    queryKey: CLE_MOI,
    queryFn: authApi.moi,
    enabled: session,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Session expirée ou révoquée (détectée par le client API) → retour à l'écran de connexion
  useEffect(() => surDeconnexionForcee(() => {
    setSession(false);
    queryClient.clear();
    notifications.show({ color: 'orange', title: 'Session terminée', message: 'Veuillez vous reconnecter.' });
  }), [queryClient]);

  const connecter = useCallback(async (identifiant, motDePasse) => {
    await authApi.connexion(identifiant, motDePasse);
    await queryClient.fetchQuery({ queryKey: CLE_MOI, queryFn: authApi.moi });
    setSession(true);
  }, [queryClient]);

  const deconnecter = useCallback(async () => {
    await authApi.deconnexion();
    setSession(false);
    queryClient.clear();
  }, [queryClient]);

  const valeur = useMemo(() => ({
    utilisateur: session ? utilisateur : null,
    chargement: session && isLoading,
    erreur: session ? error : null,
    recharger: refetch,
    connecter,
    deconnecter,
    aLeRole: (...roles) => Boolean(utilisateur?.roles?.some((r) => roles.includes(r))),
  }), [session, utilisateur, isLoading, error, refetch, connecter, deconnecter]);

  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexte = useContext(AuthContext);
  if (!contexte) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return contexte;
}
