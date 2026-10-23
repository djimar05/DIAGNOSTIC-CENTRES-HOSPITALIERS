import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as authApi from '@/api/auth';
import { ErreurApi, surDeconnexionForcee } from '@/api/client';
import type { Profil, Role } from '@/api/types';
import * as fileAttente from '@/hors-ligne/fileAttente';
import * as verrou from './verrou';

/**
 * Session de l'utilisateur sur le téléphone.
 *   chargement  : au démarrage, on cherche une session enregistrée
 *   deconnecte  : écran de connexion
 *   hors-ligne  : session enregistrée mais serveur injoignable (on propose de réessayer)
 *   connecte    : profil chargé
 * Code PIN : à définir après la première connexion ; demandé au démarrage et après 5 min en arrière-plan.
 */
type Etat = 'chargement' | 'deconnecte' | 'hors-ligne' | 'connecte';
type EtatPin = 'inconnu' | 'absent' | 'defini';

type ValeurAuth = {
  etat: Etat;
  utilisateur: Profil | null;
  pin: EtatPin;
  verrouille: boolean;
  essaisRestants: number;
  connecter: (identifiant: string, motDePasse: string) => Promise<void>;
  deconnecter: () => Promise<void>;
  changerMotDePasse: (ancien: string, nouveau: string) => Promise<void>;
  recharger: () => Promise<void>;
  definirPin: (pin: string) => Promise<void>;
  deverrouiller: (pin: string) => Promise<boolean>;
  aLeRole: (...roles: Role[]) => boolean;
};

const AuthContext = createContext<ValeurAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [etat, setEtat] = useState<Etat>('chargement');
  const [utilisateur, setUtilisateur] = useState<Profil | null>(null);
  const [pin, setPin] = useState<EtatPin>('inconnu');
  const [verrouille, setVerrouille] = useState(false);
  const [essais, setEssais] = useState(0);
  const passeEnArrierePlan = useRef<number | null>(null);

  /** Charge le profil ; `verrouiller` : demander le PIN (reprise de session, pas après un mot de passe). */
  const chargerProfil = useCallback(async (verrouiller = false) => {
    try {
      const profil = await authApi.moi();
      const aUnPin = await verrou.pinDefini(profil._id);
      setUtilisateur(profil);
      setPin(aUnPin ? 'defini' : 'absent');
      setVerrouille(verrouiller && aUnPin);
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

  // Au démarrage : reprendre la session enregistrée, s'il y en a une (PIN demandé)
  useEffect(() => {
    (async () => {
      if (await authApi.aUneSession()) await chargerProfil(true);
      else setEtat('deconnecte');
    })();
  }, [chargerProfil]);

  // Retour au premier plan après plus de 5 minutes : verrouillage
  useEffect(() => {
    const abonnement = AppState.addEventListener('change', (statut) => {
      if (statut === 'background') passeEnArrierePlan.current = Date.now();
      if (statut === 'active' && passeEnArrierePlan.current && pin === 'defini'
        && Date.now() - passeEnArrierePlan.current > verrou.DELAI_VERROUILLAGE_MS) {
        setVerrouille(true);
      }
      if (statut === 'active') passeEnArrierePlan.current = null;
    });
    return () => abonnement.remove();
  }, [pin]);

  const reinitialiser = useCallback(() => {
    queryClient.clear();
    setUtilisateur(null);
    setPin('inconnu');
    setVerrouille(false);
    setEssais(0);
    setEtat('deconnecte');
  }, [queryClient]);

  // Session expirée ou révoquée (détectée par le client API)
  useEffect(() => surDeconnexionForcee(reinitialiser), [reinitialiser]);

  const connecter = useCallback(async (identifiant: string, motDePasse: string) => {
    await authApi.connexion(identifiant, motDePasse);
    await chargerProfil(false);
  }, [chargerProfil]);

  // Déconnexion volontaire : PIN, file d'attente et coffre local effacés (l'écran prévient s'il reste des envois)
  const deconnecter = useCallback(async () => {
    if (utilisateur) await verrou.effacerPin(utilisateur._id); // nouvelle connexion = nouveau PIN
    await fileAttente.vider();
    await authApi.deconnexion();
    reinitialiser();
  }, [utilisateur, reinitialiser]);

  // Le serveur ferme toutes les sessions après un changement : on se reconnecte avec le nouveau mot de passe
  const changerMotDePasse = useCallback(async (ancien: string, nouveau: string) => {
    if (!utilisateur) return;
    await authApi.changerMotDePasse(ancien, nouveau);
    await connecter(utilisateur.telephone || '', nouveau);
  }, [utilisateur, connecter]);

  const definirPin = useCallback(async (code: string) => {
    if (!utilisateur) return;
    await verrou.definirPin(utilisateur._id, code);
    setPin('defini');
  }, [utilisateur]);

  /** Vérifie le PIN ; après trop d'essais faux, déconnexion (le mot de passe sera redemandé). */
  const deverrouiller = useCallback(async (code: string) => {
    if (!utilisateur) return false;
    if (await verrou.verifierPin(utilisateur._id, code)) {
      setEssais(0);
      setVerrouille(false);
      return true;
    }
    const total = essais + 1;
    setEssais(total);
    if (total >= verrou.ESSAIS_MAX) await deconnecter();
    return false;
  }, [utilisateur, essais, deconnecter]);

  const valeur = useMemo<ValeurAuth>(() => ({
    etat,
    utilisateur,
    pin,
    verrouille,
    essaisRestants: verrou.ESSAIS_MAX - essais,
    connecter,
    deconnecter,
    changerMotDePasse,
    recharger: () => chargerProfil(false),
    definirPin,
    deverrouiller,
    aLeRole: (...roles) => Boolean(utilisateur?.roles.some((r) => roles.includes(r))),
  }), [etat, utilisateur, pin, verrouille, essais, connecter, deconnecter, changerMotDePasse, chargerProfil, definirPin, deverrouiller]);

  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexte = useContext(AuthContext);
  if (!contexte) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return contexte;
}
